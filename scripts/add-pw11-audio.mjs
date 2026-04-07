/**
 * Add TTS audio to PW-11 video (existing video has no audio)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const env = {};
  for (const line of readFileSync(resolve(ROOT, '.env'), 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    let val = t.slice(eq + 1).trim();
    const hashIdx = val.indexOf('#');
    if (hashIdx !== -1) val = val.slice(0, hashIdx).trim();
    env[t.slice(0, eq).trim()] = val;
  }
  return env;
}

const env = loadEnv();
const ELEVENLABS_KEY = env.ELEVENLABS_KEY ?? '';
const VOICE_ID = 'TX3LPaxmHKxFdv7VOQHJ'; // Liam

function log(...args) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const mod = isHttps ? https : http;
    const headers = { ...(options.headers ?? {}), method: options.method ?? 'GET' };
    const reqOptions = { ...options, headers };
    delete reqOptions.json;
    const req = mod.request(url, reqOptions, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function generateTTS(text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({ text: text.slice(0, 5000), stability: 0.5, similarity_boost: 0.75 }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function ffmpeg(args, cwd) {
  const r = spawnSync('ffmpeg', ['-y', ...args], {
    cwd: cwd ?? ROOT, encoding: 'utf-8', timeout: 120000,
  });
  if (r.status !== 0) throw new Error(`FFmpeg error: ${r.stderr.slice(-500)}`);
  return r;
}

function muxAudioAdd(videoPath, audioPath, outputPath) {
  ffmpeg([
    '-i', videoPath, '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    outputPath,
  ]);
}

const VIDEO_IN  = resolve(ROOT, 'output', 'videos', 'PW-11_final.mp4');
const AUDIO_OUT = resolve(ROOT, 'output_topic', 'videos', 'audio_tmp.mp3');
const VIDEO_OUT = resolve(ROOT, 'output_topic', 'videos', 'PW-11.mp4');

const script11 = "Saying no at work feels risky. But research proves the opposite — people who set boundaries are seen as more competent, not less. Here's the three-part formula. Part one: acknowledge. 'I appreciate you thinking of me.' Part two: decline clearly. 'I can't take this on right now.' Part three: redirect. 'What would help is...' That's it. Don't over-explain. Brevity is respect. The reason this works is because it shows you took their request seriously. Every yes to someone else is a no to your own priorities. Protect your time with language that keeps relationships intact.";

log('Starting PW-11 audio fix...');

if (!existsSync(VIDEO_IN)) {
  log('❌ Video not found:', VIDEO_IN);
  process.exit(1);
}

log('🎙️ Generating TTS...');
const audioBuf = await generateTTS(script11);
writeFileSync(AUDIO_OUT, audioBuf);
log('✅ TTS done:', audioBuf.length, 'bytes');

log('🔊 Muxing audio...');
muxAudioAdd(VIDEO_IN, AUDIO_OUT, VIDEO_OUT);
log('✅ PW-11 audio added:', VIDEO_OUT);
