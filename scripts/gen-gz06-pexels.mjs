/**
 * scripts/gen-gz06-pexels.mjs
 * Generate GZ-06 using Pexels + ElevenLabs TTS + FFmpeg
 * GZ-06: "Why Most Gen Zers Are Getting Promotions Faster Than You"
 */

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { createHash, randomUUID } from 'crypto';
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
const PEXELS_KEY = env.PEXELS_API_KEY ?? '';
const ELEVENLABS_KEY = env.ELEVENLABS_API_KEY ?? '';
const VOICE_ID = 'CwhRBWXzGAHq8TQ4Fs17'; // Roger - Laid-Back, Casual

const OUTPUT_DIR = resolve(ROOT, 'output_topic', 'videos');
const TEMP_DIR = resolve(ROOT, 'output', '_temp_gz06');
mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(TEMP_DIR, { recursive: true });

function log(...args) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const mod = isHttps ? https : http;
    const headers = { ...(options.headers ?? {}), 'Accept': 'application/json' };
    const req = mod.request(url, { ...options, headers, method: options.method ?? 'GET' }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error(d)); } });
    });
    req.on('error', reject);
    req.end(options.body ? JSON.stringify(options.body) : undefined);
  });
}

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const mod = isHttps ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 400) { reject(new Error('HTTP ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        writeFileSync(outPath, buf);
        resolve(buf.length);
      });
    });
    req.on('error', reject);
  });
}

function runFFmpeg(args) {
  const r = spawnSync('ffmpeg', ['-y', ...args], { timeout: 120000 });
  if (r.status !== 0) throw new Error('FFmpeg failed: ' + r.stderr?.toString().slice(-300));
}

async function searchPexels(query, perPage = 3) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait&duration_max=15`;
  const data = await httpRequest(url, { headers: { Authorization: PEXELS_KEY } });
  return (data.videos || []).filter(v => v.width >= 1080 && v.duration >= 3 && v.duration <= 15);
}

async function tts(text) {
  return new Promise((resolve, reject) => {
    const url = 'https://api.elevenlabs.io/v1/text-to-speech/' + VOICE_ID;
    const body = { text, model_id: 'eleven_flash_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8 } };
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_KEY }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < 1000) { reject(new Error('TTS failed: ' + buf.toString())); return; }
        resolve(buf);
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const scriptId = 'GZ-06';
  const script = JSON.parse(readFileSync(resolve(ROOT, 'scripts', 'pending', `${scriptId}.json`), 'utf-8'));
  
  log('=== GZ-06 Pexels Generation ===');
  log('Title:', script.title);

  // Step 1: Search Pexels for clips
  const searchTerms = [
    'young professional career office success',
    'business meeting confident person promotion',
    'person desk laptop achievement career'
  ];

  let clips = [];
  for (const term of searchTerms) {
    log('Searching Pexels:', term);
    try {
      const results = await searchPexels(term, 5);
      clips.push(...results);
      if (clips.length >= 2) break;
    } catch(e) { log('Search error:', e.message); }
  }

  if (clips.length === 0) { log('ERROR: No clips found'); process.exit(1); }
  log(`Found ${clips.length} clips`);

  // Deduplicate
  const seen = new Set();
  clips = clips.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });

  // Step 2: Download clips
  const downloadedClips = [];
  for (let i = 0; i < Math.min(clips.length, 2); i++) {
    const video = clips[i];
    const hdFile = video.video_files.find(f => f.height === 1080) || video.video_files.find(f => f.quality === 'hd') || video.video_files[0];
    const clipPath = resolve(TEMP_DIR, `clip${i}.mp4`);
    log(`Downloading clip ${i}: ${hdFile.link.slice(0, 80)}...`);
    try {
      await download(hdFile.link, clipPath);
      const size = statSync(clipPath).size;
      downloadedClips.push({ path: clipPath, duration: video.duration });
      log(`  OK: ${(size/1024/1024).toFixed(1)}MB, ${video.duration}s`);
    } catch(e) { log(`  Failed: ${e.message}`); }
  }

  if (downloadedClips.length === 0) { log('ERROR: No clips downloaded'); process.exit(1); }

  // Step 3: Trim clips to ~2.5s
  const trimmedClips = [];
  for (let i = 0; i < downloadedClips.length; i++) {
    const clip = downloadedClips[i];
    const outPath = resolve(TEMP_DIR, `trim${i}.mp4`);
    const duration = Math.min(3, Math.max(2, clip.duration - 1));
    runFFmpeg([
      '-i', clip.path,
      '-ss', '1',
      '-t', String(duration),
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
      '-c:v', 'libx264', '-preset', 'ultrafast',
      '-c:a', 'aac',
      outPath
    ]);
    trimmedClips.push({ path: outPath, duration });
    log(`  Trimmed clip ${i}: ${duration}s → ${outPath}`);
  }

  // Step 4: TTS (shorten to fit remaining quota: ~159 credits, ~22s audio max)
  log('Generating TTS (250 char limit for quota)...');
  const ttsText = 'Gen Z keeps getting promoted faster. Why? They have a system. They send weekly updates. They ask for feedback quarterly. They name what they want out loud. That is not annoying. That is a system. And it works.'; // 250 chars → ~15s audio
  log('TTS text:', ttsText.slice(0, 80) + '...');
  const ttsAudio = await tts(ttsText);
  const ttsPath = resolve(TEMP_DIR, 'audio.mp3');
  writeFileSync(ttsPath, ttsAudio);
  log(`  TTS: ${(ttsAudio.length/1024/1024).toFixed(1)}MB`);

  // Convert to wav
  const wavPath = resolve(TEMP_DIR, 'audio.wav');
  runFFmpeg(['-i', ttsPath, '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', wavPath]);

  // Get TTS duration
  const ffprobeOut = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', wavPath
  ], { encoding: 'utf8' });
  const ttsDuration = parseFloat(ffprobeOut.stdout.toString().trim() || '0');
  log(`TTS duration: ${ttsDuration.toFixed(1)}s`);

  // Total video duration
  const clipDuration = trimmedClips.reduce((s, c) => s + c.duration, 0);
  const totalDuration = Math.max(clipDuration, Math.min(ttsDuration, 60));

  // Extend clips if needed to match TTS
  const extendedClips = [];
  for (const clip of trimmedClips) {
    if (totalDuration <= clip.duration) {
      extendedClips.push(clip.path);
      continue;
    }
    const outPath = resolve(TEMP_DIR, `ext_${randomUUID()}.mp4`);
    runFFmpeg([
      '-stream_loop', '-1', '-i', clip.path,
      '-t', String(totalDuration),
      '-c:v', 'libx264', '-preset', 'ultrafast',
      '-c:a', 'aac', '-shortest',
      outPath
    ]);
    extendedClips.push(outPath);
  }

  // Concat clips
  const concatListPath = resolve(TEMP_DIR, 'concat.txt');
  writeFileSync(concatListPath, extendedClips.map(p => `file '${p}'`).join('\n'));
  const videoOnlyPath = resolve(TEMP_DIR, 'video_only.mp4');
  runFFmpeg(['-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', videoOnlyPath]);

  // Mux with audio
  const finalPath = resolve(OUTPUT_DIR, 'GZ-06.mp4');
  runFFmpeg(['-i', videoOnlyPath, '-i', wavPath, '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-y', finalPath]);

  const size = statSync(finalPath).size;
  log(`\n✅ GZ-06 DONE: ${(size/1024/1024).toFixed(1)}MB → ${finalPath}`);

  // Update script
  script.status = 'produced';
  script.video_path = finalPath;
  script.generated_at = new Date().toISOString();
  writeFileSync(resolve(ROOT, 'scripts', 'pending', `${scriptId}.json`), JSON.stringify(script, null, 2));
  log('Script updated to produced');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
