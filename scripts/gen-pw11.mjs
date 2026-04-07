/**
 * scripts/gen-pw11.mjs
 * Download PW-11 video from Hailuo, add TTS audio, save to output/
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

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
      // Strip inline comments
      const commentIdx = val.indexOf('#');
      if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
      env[key] = val;
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();
const ELEVENLABS_KEY = env.ELEVENLABS_API_KEY;
const HAILUO_SESSION = JSON.parse(readFileSync(resolve(ROOT, '.hailuo-session.json'), 'utf-8'));

// Load PW-11 script
const pw11 = JSON.parse(readFileSync(resolve(SCRIPTS_PENDING, 'PW-11.json'), 'utf-8'));
console.log('PW-11 script:', pw11.title);

// TTS via ElevenLabs (corrected key extraction)
async function tts(text) {
  const voiceId = 'TX3LPaxmHKxFdv7VOQHJ'; // Liam - Energetic Gen Z
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const body = JSON.stringify({
    text,
    model_id: 'eleven_monolingual_v1',
    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
  });
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ELEVENLABS_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      if (res.statusCode >= 400) { reject(new Error('TTS HTTP ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Find latest Hailuo video from session cookies
async function findLatestHailuoVideo() {
  // Try the assets API
  const cookies = HAILUO_SESSION.cookies;
  const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'hailuoai.video',
      path: '/api/v1/video/list?page=1&page_size=10',
      method: 'GET',
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          console.log('Assets API response status:', res.statusCode);
          console.log('First video:', json.data?.videos?.[0]?.prompt?.slice(0, 100));
          resolve(json);
        } catch(e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  if (!existsSync(OUTPUT)) mkdirSync(OUTPUT, { recursive: true });
  
  // Find latest video from Hailuo
  console.log('Finding latest Hailuo video...');
  try {
    const result = await findLatestHailuoVideo();
    console.log(JSON.stringify(result, null, 2).slice(0, 2000));
  } catch(e) {
    console.error('Error finding video:', e.message);
  }
  
  // Generate TTS audio
  console.log('\nGenerating TTS audio...');
  const scriptText = pw11.script;
  try {
    const audioBuffer = await tts(scriptText);
    const audioPath = resolve(OUTPUT, 'PW-11_audio.mp3');
    writeFileSync(audioPath, audioBuffer);
    console.log('TTS saved:', audioPath, 'Size:', audioBuffer.length);
  } catch(e) {
    console.error('TTS Error:', e.message);
  }
}

main().catch(console.error);
