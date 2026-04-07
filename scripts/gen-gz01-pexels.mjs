/**
 * scripts/gen-gz01-pexels.mjs
 * Generate GZ-01 using Pexels + MiniMax TTS + FFmpeg
 * GZ-01: "I Made $10K Last Month From a Skill I Learned in 3 Months"
 */

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync, spawn } from 'child_process';
import https from 'https';

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
const MINIMAX_KEY = env.ANTHROPIC_TOKEN_KEY ?? '';
const MINIMAX_BASE = 'https://api.minimax.io';
const OUTPUT_DIR = resolve(ROOT, 'output_topic', 'videos');
const TEMP_DIR = resolve(ROOT, 'output', '_temp_gz01');

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(TEMP_DIR, { recursive: true });

function log(...args) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args); }

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const mod = isHttps ? https : require('http');
    const headers = { ...(options.headers ?? {}) };
    if (!headers['Accept'] && !options.raw) headers['Accept'] = 'application/json';
    const req = mod.request(url, { ...options, headers, method: options.method ?? 'GET' }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (options.raw) { resolve(d); return; }
        try { resolve(JSON.parse(d)); } catch { reject(new Error(d)); }
      });
    });
    req.on('error', reject);
    req.end(options.body ? JSON.stringify(options.body) : undefined);
  });
}

function download(url, outPath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : require('http');
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
  const r = spawnSync('ffmpeg', ['-y', ...args], { timeout: 180000, shell: true });
  if (r.status !== 0) {
    const err = r.stderr?.toString() || '';
    throw new Error('FFmpeg failed: ' + err.slice(-300));
  }
}

function getDuration(filePath) {
  const out = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', filePath
  ], { encoding: 'utf8', timeout: 15000 });
  return parseFloat(out.stdout.toString().trim() || '0');
}

async function searchPexels(query, perPage = 5) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait&duration_max=30`;
  const data = await httpRequest(url, { headers: { Authorization: PEXELS_KEY } });
  return (data.videos || []).filter(v => v.width >= 1080 && v.duration >= 5 && v.duration <= 30);
}

async function minimaxTTS(text) {
  // Clean text of problematic characters
  const cleanText = text.replace(/["'\n]/g, ' ').replace(/\s+/g, ' ').trim();
  const body = {
    model: 'speech-2.8-hd',
    text: cleanText,
    stream: false,
    voice_setting: {
      voice_id: 'male_qn_qingse',
      speed: 1.1,
      vol: 1.0,
      pitch: 0
    },
    output_format: {
      sample_rate: 32000,
      bitrate: 128000,
      format: 'mp3'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(MINIMAX_BASE + '/v1/t2a_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MINIMAX_KEY}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < 1000) { reject(new Error('TTS short: ' + buf.toString().slice(0, 200))); return; }
        resolve(buf);
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function gTTS(text, outPath) {
  return new Promise((resolve, reject) => {
    const safeText = text.replace(/"/g, '\\"').replace(/\n/g, ' ');
    const escapedPath = outPath.replace(/\\/g, '\\\\');
    const scriptContent = `from gtts import gTTS\ngTTS(text="${safeText}", lang="en", slow=False).save("${escapedPath}")\nprint("OK")`;
    const py = spawn('python', ['-c', scriptContent], { timeout: 30000 });
    let err = '';
    py.stderr.on('data', c => err += c.toString());
    py.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('gTTS failed: ' + err));
    });
  });
}

async function main() {
  const script = JSON.parse(readFileSync(resolve(ROOT, 'scripts', 'pending', 'GZ-01_10k-skill.json'), 'utf-8'));
  
  log('=== GZ-01 Pexels Generation ===');
  log('Title:', script.title);

  // Step 1: Search Pexels - focus on portrait clips (ideally already 1080x1920)
  const searchTerms = [
    'young person laptop coffee shop success career',
    'freelancer working laptop optimistic achievement',
    'side hustle laptop person entrepreneur confidence',
    'person laptop coffee shop excited happy work'
  ];

  let clips = [];
  for (const term of searchTerms) {
    log('Searching Pexels:', term);
    try {
      const results = await searchPexels(term, 5);
      log(`  Found ${results.length} clips`);
      clips.push(...results);
      if (clips.length >= 2) break;
    } catch(e) { log('  Search error:', e.message); }
  }

  if (clips.length === 0) { log('ERROR: No clips found'); process.exit(1); }

  // Deduplicate
  const seen = new Set();
  clips = clips.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });

  // Step 2: Download clips
  const downloadedClips = [];
  for (let i = 0; i < Math.min(clips.length, 3); i++) {
    const video = clips[i];
    // Prefer 1080x1920 clips, then highest resolution
    const files = video.video_files.filter(f => f.height >= 720);
    const hdFile = files.sort((a, b) => b.height - a.height)[0] || video.video_files[0];
    const clipPath = resolve(TEMP_DIR, `clip${i}.mp4`);
    log(`Downloading clip ${i} (${video.duration}s, ${video.width}x${video.height})...`);
    try {
      await download(hdFile.link, clipPath);
      const size = statSync(clipPath).size;
      downloadedClips.push({ path: clipPath, duration: video.duration, width: video.width, height: video.height });
      log(`  OK: ${(size/1024/1024).toFixed(1)}MB, ${video.duration}s`);
    } catch(e) { log(`  Failed: ${e.message}`); }
  }

  if (downloadedClips.length === 0) { log('ERROR: No clips downloaded'); process.exit(1); }

  // Step 3: Process clips to 1080x1920
  // Use portrait-optimized filter that handles both portrait and landscape sources
  const processedClips = [];
  for (let i = 0; i < downloadedClips.length; i++) {
    const clip = downloadedClips[i];
    const outPath = resolve(TEMP_DIR, `proc${i}.mp4`);
    const targetDuration = Math.min(clip.duration, 20);
    
    let vf;
    if (clip.height > clip.width) {
      // Already portrait - just scale to 1080x1920
      if (clip.width === 1080 && clip.height === 1920) {
        // Already exactly right
        vf = `trim=0:${targetDuration},setpts=PTS-STARTPTS`;
      } else {
        vf = `scale=1080:-2:force_original_aspect_ratio=increase,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,trim=0:${targetDuration},setpts=PTS-STARTPTS`;
      }
    } else {
      // Landscape - crop middle for portrait
      vf = `crop=in_h*9/16:in_h,scale=1080:1920,trim=0:${targetDuration},setpts=PTS-STARTPTS`;
    }
    
    runFFmpeg([
      '-i', clip.path,
      '-vf', vf,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
      '-an',
      '-t', String(targetDuration),
      outPath
    ]);
    const actualDuration = getDuration(outPath);
    processedClips.push({ path: outPath, duration: actualDuration });
    log(`  Processed clip ${i}: ${actualDuration.toFixed(1)}s`);
  }

  // Step 4: Concatenate clips
  const concatListPath = resolve(TEMP_DIR, 'concat.txt');
  writeFileSync(concatListPath, processedClips.map(p => `file '${p.path}'`).join('\n'));
  const videoOnlyPath = resolve(TEMP_DIR, 'video_concat.mp4');
  runFFmpeg(['-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', videoOnlyPath]);
  const videoDuration = processedClips.reduce((s, c) => s + c.duration, 0);
  log(`Concatenated video: ${videoDuration.toFixed(1)}s`);

  // Step 5: TTS - Full narration
  const narration = script.audio.narration;
  log(`Narration: ${narration.length} chars`);

  let ttsPath = resolve(TEMP_DIR, 'audio.mp3');
  try {
    log('Trying MiniMax TTS...');
    const ttsAudio = await minimaxTTS(narration);
    writeFileSync(ttsPath, ttsAudio);
    log(`MiniMax TTS: ${(ttsAudio.length/1024/1024).toFixed(1)}MB`);
  } catch(e) {
    log(`MiniMax failed (${e.message.slice(0,100)}), trying gTTS...`);
    await gTTS(narration, ttsPath);
    log('gTTS OK');
  }

  // Convert to wav
  const wavPath = resolve(TEMP_DIR, 'audio.wav');
  runFFmpeg(['-i', ttsPath, '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', wavPath]);
  const ttsDuration = getDuration(wavPath);
  log(`TTS duration: ${ttsDuration.toFixed(1)}s`);

  // Step 6: Loop video if TTS is longer
  let finalVideoPath = videoOnlyPath;
  if (ttsDuration > videoDuration + 0.5) {
    log(`Looping video (${videoDuration.toFixed(1)}s) to match TTS (${ttsDuration.toFixed(1)}s)...`);
    finalVideoPath = resolve(TEMP_DIR, 'video_looped.mp4');
    runFFmpeg([
      '-stream_loop', '-1', '-i', videoOnlyPath,
      '-i', ttsPath,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'ultrafast',
      '-c:a', 'aac',
      '-shortest',
      '-t', String(Math.ceil(ttsDuration) + 1),
      finalVideoPath
    ]);
  }

  // Step 7: Final mux
  const finalPath = resolve(OUTPUT_DIR, 'GZ-01.mp4');
  runFFmpeg(['-i', finalVideoPath, '-i', wavPath, '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-y', finalPath]);

  const size = statSync(finalPath).size;
  const finalDuration = getDuration(finalPath);
  log(`\n✅ GZ-01 DONE: ${(size/1024/1024).toFixed(1)}MB, ${finalDuration.toFixed(1)}s`);
  log(`→ ${finalPath}`);

  // Update script
  script.status = 'produced';
  script.video_path = finalPath;
  script.generated_at = new Date().toISOString();
  writeFileSync(resolve(ROOT, 'scripts', 'pending', 'GZ-01_10k-skill.json'), JSON.stringify(script, null, 2));
  log('Script updated');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
