/**
 * gen-wave2.js - Generate Wave 2 videos using Pexels + gTTS + FFmpeg
 * Run: node scripts/gen-wave2.js
 */
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const env = {};
  const dotenvPath = resolve(ROOT, '.env');
  try {
    const content = readFileSync(dotenvPath, 'utf-8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).split('#')[0].trim();
      if (key && val && !key.includes('=')) env[key] = val;
    }
  } catch(e) { console.log('[loadEnv] Failed:', e.code); }
  return env;
}

const env = loadEnv();
const PEXELS_KEY = env.PEXELS_API_KEY || '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa';
const OUTPUT_DIR = resolve(ROOT, 'output_topic', 'videos');
const TEMP_DIR   = resolve(ROOT, 'output', '_temp_wave2');

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(TEMP_DIR,   { recursive: true });

function log(...args) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args); }

function ff(args) {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) throw new Error('FFmpeg error: ' + (r.stderr || '').split('\n').slice(0,3).join(' | '));
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
  // Pick best portrait video
  const portrait = videos.find(v => v.width < v.height) || videos[0];
  const best = portrait.video_files.find(f => f.width >= 720 && f.height >= 1280) || portrait.video_files[0];
  return { url: best.link, width: best.width, height: best.height, id: portrait.id };
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

// Map scripts to generic Pexels search terms
const TASKS = [
  {
    id: 'TECH-12',
    query: 'robot artificial intelligence coding',
    duration: 6,
  },
  {
    id: 'COM-03',
    query: 'job interview professional office',
    duration: 6,
  },
  {
    id: 'COM-04',
    query: 'developer coding multiple screens night',
    duration: 6,
  },
  {
    id: 'LIFE-02',
    query: 'woman cafe scrolling phone',
    duration: 6,
  },
  {
    id: 'COM-05',
    query: 'interview professional office woman',
    duration: 6,
  },
  {
    id: 'COM-06',
    query: 'woman morning routine coffee desk',
    duration: 6,
  },
  {
    id: 'LIFE-04',
    query: 'luxury apartment morning routine woman',
    duration: 6,
  },
  {
    id: 'LIFE-05',
    query: 'person phone late night bedroom',
    duration: 6,
  },
];

(async () => {
  for (const task of TASKS) {
    const scriptPath = resolve(ROOT, 'scripts', 'pending', `${task.id}.json`);
    const outputPath = resolve(OUTPUT_DIR, `${task.id}.mp4`);

    if (!existsSync(scriptPath)) { log(`SKIP ${task.id}: script not found`); continue; }

    const script = JSON.parse(readFileSync(scriptPath, 'utf-8'));
    if (script.status === 'produced' && existsSync(outputPath) && statSync(outputPath).size > 1024 * 1024) {
      log(`SKIP ${task.id}: already produced (${(statSync(outputPath).size/1024/1024).toFixed(1)}MB)`);
      continue;
    }

    log(`=== ${task.id}: ${script.title || task.id} ===`);
    log(`  Pexels: "${task.query}"`);

    try {
      const tmpDir = resolve(TEMP_DIR, task.id);
      mkdirSync(tmpDir, { recursive: true });

      // Get video
      const { url, width, height, id: vid } = await searchPexels(task.query);
      log(`  Video: ${width}x${height} (pexels id=${vid})`);
      const videoTmp = resolve(tmpDir, 'raw.mp4');
      await downloadVideo(url, videoTmp);
      log(`  Downloaded: ${(statSync(videoTmp).size/1024/1024).toFixed(2)}MB`);

      // TTS - use script field or title
      const ttsText = script.script || script.title || 'Video noi';
      const ttsPath = resolve(tmpDir, 'narration.mp3');
      await generateTTS(ttsText, ttsPath);
      log(`  TTS: ${ttsText.slice(0,60)}...`);

      // Combine
      await muxVideoAudio(videoTmp, ttsPath, outputPath, task.duration);
      const size = statSync(outputPath).size;
      log(`  OUTPUT: ${outputPath} (${(size/1024/1024).toFixed(2)}MB)`);

      // Update script
      script.status = 'produced';
      script.video_path = outputPath;
      script.produced_at = new Date().toISOString();
      script.produced_by = 'ceo-gen-wave2';
      writeFileSync(scriptPath, JSON.stringify(script, null, 2));
      log(`  ${task.id} DONE ✓`);
    } catch(e) {
      log(`  ERROR ${task.id}: ${e.message}`);
    }
  }
  log('\n=== WAVE 2 GENERATION COMPLETE ===');
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
