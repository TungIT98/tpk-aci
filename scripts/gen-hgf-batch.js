/**
 * gen-hgf-batch.js - Generate HGF-08 to HGF-15 videos using Pexels + gTTS + FFmpeg
 * Health/Gym/Fitness themed stock footage + Vietnamese TTS narration
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
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
    const val = t.split('#')[0].trim();
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const PEXELS_KEY = env.PEXELS_API_KEY ?? '';
const OUTPUT_DIR = resolve(ROOT, 'output_topic', 'videos');
const TEMP_DIR   = resolve(ROOT, 'output', '_temp_hgf');

mkdirSync(OUTPUT_DIR, { recursive: true });

function log(...args) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args); }

function ff(args) {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) throw new Error('FFmpeg: ' + (r.stderr || '').split('\n')[0]);
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
        let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('JSON: ' + d.slice(0, 200))); } });
      } else {
        const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    });
    req.on('error', reject);
    req.end();
  });
}

async function searchPexels(query) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5`;
  const data = await httpReq(url, { headers: { Authorization: PEXELS_KEY }, json: true });
  const videos = data.videos || [];
  if (videos.length === 0) throw new Error('No videos for: ' + query);
  const portrait = videos.find(v => v.height > v.width);
  const best = portrait || videos[0];
  const fp = best.video_files.find(f => f.width >= 720 && f.height >= 1280) || best.video_files[0];
  return fp.link;
}

async function downloadVideo(url, destPath) {
  const data = await httpReq(url, { headers: { Authorization: PEXELS_KEY } });
  writeFileSync(destPath, data);
}

async function generateTTS(text, destPath) {
  const textPath = resolve(TEMP_DIR, '_tts_text.txt');
  writeFileSync(textPath, text, 'utf8');
  const scriptPath = resolve(TEMP_DIR, '_tts.py');
  const pyScript = `from gtts import gTTS
with open("${textPath.replace(/\\/g, '\\\\')}", "r", encoding="utf-8") as f:
    t = f.read()
t = t[:500] if len(t) > 500 else t
gTTS(text=t, lang="vi", slow=False).save("${destPath.replace(/\\/g, '\\\\')}")
print("TTS saved:", len(t), "chars")
`;
  writeFileSync(scriptPath, pyScript, 'utf8');
  const r = spawnSync('python', [scriptPath], { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) throw new Error('gTTS failed: ' + (r.stderr || r.stdout || '').slice(0, 200));
}

async function muxVideoAudio(videoPath, audioPath, outputPath, duration) {
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
}

// Fitness-themed Pexels search queries (queries confirmed working with Pexels API)
const QUERY_POOL = [
  'fitness', 'exercise', 'health', 'sport', 'running',
  'yoga', 'wellness', 'training', 'bodybuilding', 'cardio'
];

const SCRIPTS = ['HGF-08','HGF-09','HGF-10','HGF-12','HGF-13','HGF-14','HGF-15'];

function pickQuery(idx) {
  // Rotate through query pool based on index
  return QUERY_POOL[idx % QUERY_POOL.length];
}

function allQueries(idx) {
  // Return array of queries to try for this script index
  const start = (idx * 3) % QUERY_POOL.length;
  return [
    QUERY_POOL[start % QUERY_POOL.length],
    QUERY_POOL[(start + 1) % QUERY_POOL.length],
    QUERY_POOL[(start + 2) % QUERY_POOL.length],
    QUERY_POOL[(start + 3) % QUERY_POOL.length],
    QUERY_POOL[(start + 4) % QUERY_POOL.length],
  ];
}

(async () => {
  for (const SCRIPT_ID of SCRIPTS) {
    const scriptPath = resolve(ROOT, 'scripts', 'pending', `${SCRIPT_ID}.json`);
    if (!statSync(scriptPath).size) { log(`${SCRIPT_ID}: file missing, skipping`); continue; }

    const script = JSON.parse(readFileSync(scriptPath, 'utf-8'));
    if (script.status === 'produced' || script.video_path) {
      log(`${SCRIPT_ID}: already produced, skipping`);
      continue;
    }

    log(`=== ${SCRIPT_ID}: ${script.title} ===`);

    try {
      const tmpDir = resolve(TEMP_DIR, SCRIPT_ID);
      mkdirSync(tmpDir, { recursive: true });

      const idx = SCRIPTS.indexOf(SCRIPT_ID);
      const queries = allQueries(idx);
      let videoUrl = null;
      for (const query of queries) {
        try {
          log(`  Pexels query: "${query}"`);
          videoUrl = await searchPexels(query);
          break;
        } catch(e) {
          log(`  Query failed: ${e.message}`);
        }
      }
      if (!videoUrl) throw new Error('All Pexels queries failed');
      const videoTmp = resolve(tmpDir, 'raw.mp4');
      await downloadVideo(videoUrl, videoTmp);
      log(`  Downloaded: ${(statSync(videoTmp).size/1024/1024).toFixed(2)} MB`);

      const ttsPath = resolve(tmpDir, 'narration.mp3');
      await generateTTS(script.script || script.audio?.narration || script.title, ttsPath);
      log(`  TTS generated`);

      const outputPath = resolve(OUTPUT_DIR, `${SCRIPT_ID}.mp4`);
      const duration = parseInt(script.duration_seconds) || 10;
      await muxVideoAudio(videoTmp, ttsPath, outputPath, duration);

      const size = statSync(outputPath).size;
      log(`  Output: ${outputPath} (${(size/1024/1024).toFixed(2)} MB)`);

      script.video_path = outputPath;
      script.produced_at = new Date().toISOString();
      script.status = 'produced';
      writeFileSync(scriptPath, JSON.stringify(script, null, 2));
      log(`  ${SCRIPT_ID} DONE`);
    } catch(e) {
      log(`  ERROR ${SCRIPT_ID}: ${e.message}`);
    }
  }
  log('=== ALL HGF VIDEOS COMPLETE ===');
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });