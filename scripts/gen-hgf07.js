/**
 * gen-hgf07.js - Generate HGF-07 video using Pexels + gTTS + FFmpeg
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
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
    const key = t.slice(0, eq).trim();
    const rawVal = t.slice(eq + 1).trim();
    const val = rawVal.split('#')[0].trim(); // strip inline comments
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const PEXELS_KEY = env.PEXELS_API_KEY ?? '';
const OUTPUT_DIR = resolve(ROOT, 'output_topic', 'videos');
const TEMP_DIR   = resolve(ROOT, 'output', '_temp_hgf07');

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(TEMP_DIR,   { recursive: true });

function log(...args) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args); }
function sleep(ms)    { return new Promise(r => setTimeout(r, ms)); }

function ff(args) {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) throw new Error('FFmpeg: ' + (r.stderr || '').split('\n')[0]);
  return r;
}

function httpReq(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const headers = { ...(options.headers || {}) };
    if (options.json) headers['Accept'] = 'application/json';
    const o = { ...options, headers, method: options.method || 'GET' };
    delete o.json;
    const req = mod.request(url, o, res => {
      if (headers['Accept'] === 'application/json') {
        let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('JSON: ' + d.slice(0, 100))); } });
      } else {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    });
    req.on('error', reject);
    req.end();
  });
}

async function searchPexels(query) {
  log(`Pexels search: "${query}"`);
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5`;
  const data = await httpReq(url, {
    headers: { Authorization: PEXELS_KEY },
    json: true
  });
  log(`  API response: page=${data.page}, total_results=${data.total_results}, videos returned=${data.videos?.length}`);
  const videos = data.videos || [];
  if (videos.length === 0) throw new Error('No Pexels videos found for: ' + query);
  // Prefer portrait video
  const portrait = videos.find(v => v.height > v.width);
  const best = portrait || videos[0];
  const fp = best.video_files.find(f => f.width >= 720 && f.height >= 1280) || best.video_files[0];
  log(`  Pexels video: ${best.id}, ${fp.width}x${fp.height}, duration=${fp.duration}s`);
  return fp.link;
}

async function downloadVideo(url, destPath) {
  log(`Downloading: ${destPath}`);
  const data = await httpReq(url, { headers: { Authorization: PEXELS_KEY } });
  writeFileSync(destPath, data);
  log(`  Downloaded: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
}

async function generateTTS(text, destPath) {
  log(`Generating TTS: ${text.slice(0, 60)}...`);
  const scriptPath = resolve(TEMP_DIR, '_tts.py');
  // Write text to a temp file to avoid shell escaping issues
  const textPath = resolve(TEMP_DIR, '_tts_text.txt');
  writeFileSync(textPath, text, 'utf8');
  const pyScript = `
from gtts import gTTS
with open("${textPath.replace(/\\/g, '\\\\')}", "r", encoding="utf-8") as f:
    text = f.read()
gTTS(text=text, lang="vi", slow=False).save("${destPath.replace(/\\/g, '\\\\')}")
print("TTS saved")
`;
  writeFileSync(scriptPath, pyScript, 'utf8');
  const r = spawnSync('python', [scriptPath], { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) throw new Error('gTTS failed: ' + (r.stderr || r.stdout || '').slice(0, 200));
  log(`  TTS saved to ${destPath}`);
}

async function muxVideoAudio(videoPath, audioPath, outputPath, duration) {
  log(`Muxing: video=${videoPath}, audio=${audioPath}, output=${outputPath}`);
  // Trim audio to match video duration
  ff(['-y',
    '-i', videoPath,
    '-i', audioPath,
    '-t', String(duration),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    outputPath
  ]);
  log(`  Done: ${outputPath}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const SCRIPT_ID = 'HGF-07';
const scriptPath = resolve(ROOT, 'scripts', 'pending', `${SCRIPT_ID}.json`);
const script = JSON.parse(readFileSync(scriptPath, 'utf-8'));

log(`=== ${SCRIPT_ID} Video Production ===`);
log(`Title: ${script.title}`);
log(`Script: ${script.script.slice(0, 80)}...`);

// Step 1: Search Pexels for fitness video
const queries = ['fitness woman gym workout', 'beautiful woman gym lifting weights', 'gym fitness portrait video'];
let videoUrl = null;
for (const q of queries) {
  try {
    videoUrl = await searchPexels(q);
    break;
  } catch(e) {
    log(`  Query failed: ${e.message}`);
  }
}
if (!videoUrl) throw new Error('All Pexels queries failed');
const videoTmp = resolve(TEMP_DIR, 'raw.mp4');

// Step 2: Download
await downloadVideo(videoUrl, videoTmp);

// Step 3: Generate Vietnamese TTS
const ttsPath = resolve(TEMP_DIR, 'narration.mp3');
await generateTTS(script.script, ttsPath);

// Step 4: Mux
const outputPath = resolve(OUTPUT_DIR, `${SCRIPT_ID}.mp4`);
const targetDuration = parseInt(script.duration_seconds) || 10;
await muxVideoAudio(videoTmp, ttsPath, outputPath, targetDuration);

// Step 5: Verify
const stats = statSync(outputPath);
log(`Output: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

// Step 6: Update script JSON
script.video_path = outputPath;
script.produced_at = new Date().toISOString();
script.status = 'produced';
writeFileSync(scriptPath, JSON.stringify(script, null, 2));
log(`Script updated: status=produced, video_path=${outputPath}`);

log(`=== ${SCRIPT_ID} DONE ===`);
