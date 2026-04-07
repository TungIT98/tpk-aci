/**
 * gen-tech-batch.js - Generate TECH-03 to TECH-11 videos using Pexels + gTTS + FFmpeg
 * Tech AI themed stock footage + Vietnamese TTS narration
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
console.log('[INIT] ROOT:', ROOT);

function loadEnv() {
  const env = {};
  const dotenvPath = resolve(ROOT, '.env');
  console.log('[loadEnv] Reading:', dotenvPath);
  try {
    const content = readFileSync(dotenvPath, 'utf-8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      const val = t.split('#')[0].trim();
      if (key && val && !key.includes('=')) {
        env[key] = val;
      }
    }
    console.log('[loadEnv] Loaded keys:', Object.keys(env).join(', ').slice(0, 200));
  } catch(e) {
    console.log('[loadEnv] Failed to read .env:', e.code, dotenvPath);
  }
  return env;
}

const env = loadEnv();
const PEXELS_KEY = (() => {
  const k = env.PEXELS_API_KEY ?? '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa';
  if (k.startsWith('PEXELS_API_KEY=')) {
    console.error('ERROR: PEXELS_API_KEY env var includes key name! Falling back to hardcoded value.');
    return '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa';
  }
  return k;
})();
console.log('[INIT] PEXELS_KEY length:', PEXELS_KEY.length, 'startsWith 1Og:', PEXELS_KEY.startsWith('1Og'));
const OUTPUT_DIR = resolve(ROOT, 'output_topic', 'videos');
const TEMP_DIR   = resolve(ROOT, 'output', '_temp_tech');

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(TEMP_DIR,   { recursive: true });

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
  const best = videos[0];
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
# Truncate to 500 chars if needed
t = t[:500] if len(t) > 500 else t
gTTS(text=t, lang="vi", slow=False).save("${destPath.replace(/\\/g, '\\\\')}")
print("TTS saved:", len(t), "chars")
`;
  writeFileSync(scriptPath, pyScript, 'utf8');
  const r = spawnSync('python', [scriptPath], { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) throw new Error('gTTS failed: ' + (r.stderr || r.stdout || '').slice(0, 200));
  if (!statSync(destPath).size) throw new Error('TTS file empty');
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

// Tech-themed Pexels search queries (rotate to get variety)
const QUERIES = [
  'artificial intelligence technology', 'computer code programming', 'robot technology',
  'tech office workspace', 'computer screen data', 'floating digital interface',
  'technology abstract blue', 'laptop coding dark room'
];

const SCRIPTS = ['TECH-03','TECH-04','TECH-05','TECH-06','TECH-07','TECH-08','TECH-09','TECH-10','TECH-11'];

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
      
      // Pick a query based on script index
      const qIdx = SCRIPTS.indexOf(SCRIPT_ID) % QUERIES.length;
      const query = QUERIES[qIdx];
      log(`  Pexels query: "${query}"`);
      const videoUrl = await searchPexels(query);
      const videoTmp = resolve(tmpDir, 'raw.mp4');
      await downloadVideo(videoUrl, videoTmp);
      log(`  Downloaded: ${(statSync(videoTmp).size/1024/1024).toFixed(2)} MB`);
      
      const ttsPath = resolve(tmpDir, 'narration.mp3');
      await generateTTS(script.script || script.audio?.narration || script.title, ttsPath);
      log(`  TTS generated`);
      
      const outputPath = resolve(OUTPUT_DIR, `${SCRIPT_ID}.mp4`);
      const duration = parseInt(script.duration_seconds) || 8;
      await muxVideoAudio(videoTmp, ttsPath, outputPath, duration);
      
      const size = statSync(outputPath).size;
      log(`  Output: ${outputPath} (${(size/1024/1024).toFixed(2)} MB)`);
      
      // Update script JSON
      script.video_path = outputPath;
      script.produced_at = new Date().toISOString();
      script.status = 'produced';
      writeFileSync(scriptPath, JSON.stringify(script, null, 2));
      log(`  ${SCRIPT_ID} DONE`);
    } catch(e) {
      log(`  ERROR ${SCRIPT_ID}: ${e.message}`);
    }
  }
  log('=== ALL TECH VIDEOS COMPLETE ===');
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
