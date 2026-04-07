/**
 * gen-xianyx-single.js - Test single script production
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
const TEMP_DIR   = resolve(ROOT, 'output', '_temp_xianyx_test');
const FFMPEG_BIN = 'C:\\New folder\\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\\bin\\ffmpeg.exe';

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(TEMP_DIR, { recursive: true });

function log(...args) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args); }

function ff(args) {
  const r = spawnSync(FFMPEG_BIN, args, { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) {
    const err = (r.stderr || '').split('\n').filter(l => l.includes('Error') || l.includes('error') || l.includes('Invalid'))[0] || '';
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
  log(`  Pexels query: "${query}"`);
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait`;
  const data = await httpReq(url, { headers: { Authorization: PEXELS_KEY }, json: true });
  log(`  Pexels response: total=${data.total_results}, videos=${data.videos?.length}`);
  const videos = data.videos || [];
  if (videos.length === 0) throw new Error('No videos for: ' + query);
  const portrait = videos.find(v => v.height > v.width) || videos[0];
  const fp = portrait.video_files.find(f => f.width >= 720 && f.height >= 1280) || portrait.video_files[0];
  return fp.link;
}

async function downloadVideo(url, destPath) {
  const data = await httpReq(url, { headers: { Authorization: PEXELS_KEY } });
  writeFileSync(destPath, data);
}

async function generateTTS(text, destPath, lang = 'vi') {
  const scriptPath = resolve(TEMP_DIR, '_tts_temp.py');
  const safeText = text.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
  const pyScript = `from gtts import gTTS\nt = "${safeText}"\nt = t[:500] if len(t) > 500 else t\ngTTS(text=t, lang="${lang}", slow=False).save("${destPath.replace(/\\\\/g, '\\\\\\\\')}")\nprint("TTS saved:", len(t), "chars")\n`;
  writeFileSync(scriptPath, pyScript, 'utf8');
  const r = spawnSync('python', [scriptPath], { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) throw new Error('gTTS failed: ' + (r.stderr || r.stdout || '').slice(0, 200));
}

async function processScript(scriptId) {
  const scriptPath = resolve(ROOT, 'scripts', 'pending', 'xianxia', `${scriptId}.json`);
  const script = JSON.parse(readFileSync(scriptPath, 'utf-8'));
  if (script.status === 'produced') {
    return { id: scriptId, status: 'already_produced' };
  }

  log(`=== ${scriptId}: ${script.title} ===`);
  const tmpDir = resolve(TEMP_DIR, scriptId);
  mkdirSync(tmpDir, { recursive: true });

  const clips = [];
  const shots = script.shots || [];

  // Extract keywords from shot prompts for better Pexels search
  const keywordQueries = [
    'dark fantasy warrior', 'ancient china warrior', 'storm rain night', 'forest fog moonlight',
    'martial arts training', 'warrior silhouette', 'pagoda temple night', 'mist mountain dawn',
    'fantasy sword fight', 'candle light meditation', 'desert landscape wind', 'mountain peak clouds',
  ];

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const prompt = shot.prompt || '';
    // Extract key visual elements (remove camera directions)
    let query = prompt
      .replace(/—.*$/gm, '')  // Remove camera directions
      .replace(/[.,!?]/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 6)
      .join(' ');

    const clipPath = resolve(tmpDir, `clip${i + 1}.mp4`);
    let success = false;

    // Try extracted query first, then keyword pool
    const queriesToTry = [query, keywordQueries[i % keywordQueries.length], 'fantasy cinematic dramatic', 'warrior martial arts'];
    for (const q of queriesToTry) {
      if (success) break;
      try {
        log(`  Shot ${i + 1}: Searching Pexels for "${q}"...`);
        const videoUrl = await searchPexels(q);
        await downloadVideo(videoUrl, clipPath);
        const size = statSync(clipPath).size;
        log(`  Shot ${i + 1}: Downloaded ${(size / 1024 / 1024).toFixed(2)} MB`);
        clips.push({ path: clipPath, duration: shot.duration || 6 });
        success = true;
      } catch (e) {
        log(`  Shot ${i + 1}: Failed "${q}": ${e.message}`);
      }
    }
    if (!success) {
      log(`  Shot ${i + 1}: All queries failed for this shot`);
    }
  }

  if (clips.length === 0) throw new Error('No clips downloaded');

  // Create concat list
  const concatList = resolve(tmpDir, 'concat.txt');
  const concatContent = clips.map(c => `file '${c.path.replace(/\\/g, '/')}'`).join('\n');
  writeFileSync(concatList, concatContent, 'utf8');

  // Concat clips
  const concatPath = resolve(tmpDir, 'concat_raw.mp4');
  ff(['-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', concatPath]);

  // Generate TTS
  const narrationText = shots.map(s => s.narration).filter(Boolean).join(' ');
  const ttsPath = resolve(tmpDir, 'narration.mp3');
  await generateTTS(narrationText, ttsPath, 'vi');

  // Mux video + audio
  const outputPath = resolve(OUTPUT_DIR, `${scriptId}.mp4`);
  const targetDuration = parseInt(script.concept?.duration_seconds) || 30;
  ff(['-y',
    '-i', concatPath,
    '-i', ttsPath,
    '-t', String(targetDuration),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-vf', `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,fps=30`,
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest',
    outputPath
  ]);

  const size = statSync(outputPath).size;
  log(`  Output: ${(size / 1024 / 1024).toFixed(2)} MB, ${targetDuration}s`);

  if (size < 1024 * 1024) throw new Error('File too small: ' + size);

  script.status = 'produced';
  script.video_path = outputPath;
  script.produced_at = new Date().toISOString();
  writeFileSync(scriptPath, JSON.stringify(script, null, 2));

  return { id: scriptId, status: 'produced', size };
}

(async () => {
  try {
    const result = await processScript('XIANYX-51');
    log('Result:', JSON.stringify(result));
  } catch (e) {
    log('Error:', e.message);
  }
})();
