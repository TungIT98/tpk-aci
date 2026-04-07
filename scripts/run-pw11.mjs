/**
 * scripts/run-pw11.mjs
 * Step 1: Find latest Hailuo video via API using session cookies
 * Step 2: Generate TTS for PW-11 script
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
      const commentIdx = val.indexOf('#');
      if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
      env[key] = val;
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();
const ELEVENLABS_KEY = env.ELEVENLABS_API_KEY;

if (!existsSync(OUTPUT)) mkdirSync(OUTPUT, { recursive: true });

// Load PW-11 script
const pw11 = JSON.parse(readFileSync(resolve(SCRIPTS_PENDING, 'PW-11.json'), 'utf-8'));
console.log('PW-11 title:', pw11.title);

// Extract cookies from session
const session = JSON.parse(readFileSync(resolve(ROOT, '.hailuo-session.json'), 'utf-8'));
const cookieStr = session.cookies.map(c => `${c.name}=${c.value}`).join('; ');

// Try Hailuo internal API to list videos
function hailuoApi(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'hailuoai.video',
      path,
      method: 'GET',
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://hailuoai.video/mine'
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        console.log(`API ${path} => HTTP ${res.statusCode}`);
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ raw: body.slice(0, 500) });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ElevenLabs TTS
async function tts(text, outputPath) {
  const voiceId = 'TX3LPaxmHKxFdv7VOQHJ'; // Liam - Energetic Gen Z
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
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
      console.log(`ElevenLabs => HTTP ${res.statusCode}`);
      if (res.statusCode >= 400) { reject(new Error('TTS HTTP ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        writeFileSync(outputPath, buf);
        console.log(`TTS saved: ${outputPath} (${buf.length} bytes)`);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Step 1: Try to get videos from Hailuo API
  console.log('\n=== Step 1: Finding PW-11 video from Hailuo ===');
  const paths_to_try = [
    '/api/v1/video/list?page=1&page_size=5',
    '/api/v2/video/list?page=1&page_size=5',
    '/v2/api/multimodal/video/list?page=1&page_size=5'
  ];
  
  for (const p of paths_to_try) {
    try {
      const r = await hailuoApi(p);
      console.log(p, '=>', JSON.stringify(r).slice(0, 300));
    } catch(e) {
      console.log(p, '=> ERROR:', e.message);
    }
  }
  
  // Step 2: Generate TTS
  console.log('\n=== Step 2: Generating TTS for PW-11 ===');
  const audioPath = resolve(OUTPUT, 'PW-11.mp3');
  try {
    await tts(pw11.script, audioPath);
    console.log('TTS DONE:', audioPath);
  } catch(e) {
    console.error('TTS Error:', e.message);
  }
}

main().catch(console.error);
