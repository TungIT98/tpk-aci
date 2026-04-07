/**
 * scripts/pw11_ffmpeg.mjs
 * Generate TTS and merge with video for PW-11
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT = resolve(ROOT, 'output', 'videos');
const SCRIPTS_PENDING = resolve(ROOT, 'scripts', 'pending');

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  try {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      const commentIdx = val.indexOf('#');
      if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
      env[key] = val;
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();
const ELEVENLABS_KEY = env.ELEVENLABS_API_KEY?.trim();
const MINIMAX_KEY = env.ANTHROPIC_TOKEN_KEY;

const pw11 = JSON.parse(readFileSync(resolve(SCRIPTS_PENDING, 'PW-11.json'), 'utf-8'));
console.log('PW-11 title:', pw11.title);
console.log('ElevenLabs key starts with:', ELEVENLABS_KEY?.slice(0, 10));

if (!existsSync(OUTPUT)) mkdirSync(OUTPUT, { recursive: true });

const videoPath = resolve(OUTPUT, 'PW-11.mp4');
const audioPath = resolve(OUTPUT, 'PW-11.mp3');
const finalPath = resolve(OUTPUT, 'PW-11_final.mp4');

// Check video
if (!existsSync(videoPath)) {
  console.error('Video not found:', videoPath);
  process.exit(1);
}
const videoStat = statSync(videoPath);
console.log('Video size:', videoStat.size, 'bytes');

// ElevenLabs TTS
async function ttsElevenLabs(text, outputPath) {
  const voiceId = 'TX3LPaxmHKxFdv7VOQHJ'; // Liam
  console.log('Trying ElevenLabs TTS...');
  const body = JSON.stringify({
    text,
    model_id: 'eleven_monolingual_v1',
    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
  });
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ELEVENLABS_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      console.log('ElevenLabs response status:', res.statusCode);
      if (res.statusCode >= 400) {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          console.log('ElevenLabs error body:', d.slice(0, 200));
          reject(new Error('TTS HTTP ' + res.statusCode));
        });
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        writeFileSync(outputPath, buf);
        console.log('TTS saved:', buf.length, 'bytes');
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// MiniMax TTS
async function ttsMiniMax(text, outputPath) {
  console.log('Trying MiniMax TTS...');
  const body = JSON.stringify({
    model: 'speech-02-hd',
    text,
    voice_setting: { voice_id: 'male-qn-qingse' },
    audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3' }
  });
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.minimax.io',
      path: '/v1/t2a_v2',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MINIMAX_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      console.log('MiniMax TTS status:', res.statusCode);
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log('MiniMax TTS response:', d.slice(0, 300));
        try {
          const json = JSON.parse(d);
          if (json.data?.audio_file?.download_url) {
            // Download the audio
            const url = json.data.audio_file.download_url;
            https.get(url, (res2) => {
              const chunks = [];
              res2.on('data', c => chunks.push(c));
              res2.on('end', () => {
                const buf = Buffer.concat(chunks);
                writeFileSync(outputPath, buf);
                console.log('MiniMax TTS saved:', buf.length, 'bytes');
                resolve();
              });
            }).on('error', reject);
          } else {
            reject(new Error('No audio URL in response'));
          }
        } catch(e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function mergeAudioVideo(audioPath, videoPath, outputPath) {
  console.log('Merging audio + video with FFmpeg...');
  try {
    execSync(`ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${outputPath}"`, { stdio: 'inherit' });
    const stat = statSync(outputPath);
    console.log('Final video:', stat.size, 'bytes');
  } catch(e) {
    console.error('FFmpeg error:', e.message);
  }
}

async function main() {
  // Try ElevenLabs first
  let ttsSuccess = false;
  try {
    await ttsElevenLabs(pw11.script, audioPath);
    ttsSuccess = true;
  } catch(e) {
    console.error('ElevenLabs TTS failed:', e.message);
  }
  
  // If ElevenLabs failed, try MiniMax
  if (!ttsSuccess) {
    try {
      await ttsMiniMax(pw11.script, audioPath);
      ttsSuccess = true;
    } catch(e) {
      console.error('MiniMax TTS also failed:', e.message);
    }
  }
  
  // If no TTS, just use video without audio
  if (!ttsSuccess) {
    console.log('No TTS available - copying video without audio');
    copyFileSync(videoPath, finalPath);
    console.log('Final (no audio):', finalPath);
  } else {
    await mergeAudioVideo(audioPath, videoPath, finalPath);
  }
}

main().catch(console.error);
