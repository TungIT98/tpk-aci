/**
 * gen-xianyx-batch.js - Generate XIANYX-51 to XIANYX-70 using Pexels + gTTS + FFmpeg
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
const PEXELS_KEY = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa';
const OUTPUT_DIR = resolve(ROOT, 'output_topic', 'videos');
const TEMP_DIR   = resolve(ROOT, 'output', '_temp_xianyx');
const FFMPEG_BIN = 'C:\\New folder\\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\\bin\\ffmpeg.exe';

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(TEMP_DIR, { recursive: true });

function log(...args) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args); }

function ff(args) {
  const r = spawnSync(FFMPEG_BIN, args, { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) {
    const err = (r.stderr || '').split('\n').filter(l => l.includes('Error'))[0] || '';
    throw new Error('FFmpeg: ' + err);
  }
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
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait`;
  const data = await httpReq(url, { headers: { Authorization: PEXELS_KEY }, json: true });
  const videos = data.videos || [];
  if (videos.length === 0) throw new Error('No videos: ' + query.slice(0, 50));
  const portrait = videos.find(v => v.height > v.width) || videos[0];
  const fp = portrait.video_files.find(f => f.width >= 720 && f.height >= 1280) || portrait.video_files[0];
  return fp.link;
}

async function downloadVideo(url, destPath) {
  const data = await httpReq(url, { headers: { Authorization: PEXELS_KEY } });
  writeFileSync(destPath, data);
}

async function generateTTS(text, destPath, lang = 'vi') {
  // Write text to a temp file so we avoid all shell escaping issues
  const textPath = resolve(TEMP_DIR, '_tts_text.txt');
  writeFileSync(textPath, text.slice(0, 500), 'utf8');
  const scriptPath = resolve(TEMP_DIR, '_tts_temp.py');
  // Use raw string with triple quotes in Python to avoid escaping issues
  const pyScript = `from gtts import gTTS\nwith open(r"${textPath.replace(/\\/g, '\\\\')}", "r", encoding="utf-8") as f:\n    t = f.read()\ngTTS(text=t, lang="${lang}", slow=False).save(r"${destPath.replace(/\\/g, '\\\\')}")\n`;
  writeFileSync(scriptPath, pyScript, 'utf8');
  const r = spawnSync('python', [scriptPath], { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) throw new Error('gTTS failed: ' + (r.stderr || r.stdout || '').slice(0, 300));
}

// Keyword pool for fallback queries
const KW = [
  'dark fantasy warrior', 'ancient china warrior', 'storm rain night', 'forest fog moonlight',
  'martial arts training', 'warrior silhouette', 'pagoda temple night', 'mist mountain dawn',
  'fantasy sword fight', 'candle light meditation', 'mountain peak clouds', 'epic battle warrior',
  'dark atmosphere fog', 'cinematic dramatic', 'warrior martial arts', 'desert wind dunes',
];

function extractQuery(prompt) {
  return prompt
    .replace(/[—–-].*$/gm, '')
    .replace(/[,.\/]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5)
    .join(' ');
}

async function processScript(scriptId) {
  const scriptPath = resolve(ROOT, 'scripts', 'pending', 'xianxia', `${scriptId}.json`);
  if (!statSync(scriptPath).size) return { id: scriptId, status: 'missing' };
  const script = JSON.parse(readFileSync(scriptPath, 'utf-8'));
  if (script.status === 'produced') return { id: scriptId, status: 'already_produced' };

  log(`=== ${scriptId}: ${script.title} ===`);
  const tmpDir = resolve(TEMP_DIR, scriptId);
  mkdirSync(tmpDir, { recursive: true });

  const clips = [];
  const shots = script.shots || [];

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const rawQuery = extractQuery(shot.prompt || '');
    const clipPath = resolve(tmpDir, `clip${i + 1}.mp4`);
    let success = false;

    // Try: extracted query -> keyword pool -> general fallbacks
    const queries = [
      rawQuery,
      KW[i % KW.length],
      KW[(i + 5) % KW.length],
      'fantasy cinematic dramatic',
      'warrior martial arts',
    ];

    for (const q of queries) {
      if (!q || success) break;
      try {
        const videoUrl = await searchPexels(q);
        await downloadVideo(videoUrl, clipPath);
        const size = statSync(clipPath).size;
        log(`  Shot ${i + 1}: ${(size / 1024 / 1024).toFixed(2)} MB ["${q.slice(0, 40)}"]`);
        clips.push({ path: clipPath, duration: shot.duration || 6 });
        success = true;
      } catch (_) {}
    }
    if (!success) log(`  Shot ${i + 1}: all queries failed`);
  }

  if (clips.length === 0) throw new Error('No clips downloaded');

  // Concat
  const concatList = resolve(tmpDir, 'concat.txt');
  writeFileSync(concatList, clips.map(c => `file '${c.path.replace(/\\/g, '/')}'`).join('\n'), 'utf8');
  const concatPath = resolve(tmpDir, 'concat_raw.mp4');
  ff(['-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', concatPath]);

  // TTS
  const narrationText = shots.map(s => s.narration).filter(Boolean).join(' ');
  const ttsPath = resolve(tmpDir, 'narration.mp3');
  await generateTTS(narrationText, ttsPath, 'vi');

  // Mux
  const outputPath = resolve(OUTPUT_DIR, `${scriptId}.mp4`);
  const targetDuration = parseInt(script.concept?.duration_seconds) || 30;
  ff(['-y',
    '-i', concatPath, '-i', ttsPath, '-t', String(targetDuration),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-vf', `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,fps=30`,
    '-c:a', 'aac', '-b:a', '128k', '-shortest',
    outputPath
  ]);

  const size = statSync(outputPath).size;
  log(`  => ${(size / 1024 / 1024).toFixed(2)} MB | ${targetDuration}s`);

  script.status = 'produced';
  script.video_path = outputPath;
  script.produced_at = new Date().toISOString();
  writeFileSync(scriptPath, JSON.stringify(script, null, 2));

  return { id: scriptId, status: 'produced', size };
}

const SCRIPTS = [];
for (let i = 51; i <= 70; i++) SCRIPTS.push('XIANYX-' + i);

(async () => {
  let produced = 0, skipped = 0, failed = 0;
  for (const sid of SCRIPTS) {
    try {
      const r = await processScript(sid);
      if (r.status === 'already_produced' || r.status === 'missing') skipped++;
      else { produced++; log(`  ${sid} DONE`); }
    } catch (e) {
      failed++;
      log(`  ERROR ${sid}: ${e.message}`);
    }
  }
  log(`\n=== DONE: ${produced} produced, ${skipped} skipped, ${failed} failed ===`);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
