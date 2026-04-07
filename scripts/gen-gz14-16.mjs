/**
 * gen-gz14-16.mjs - Generate GZ-14, GZ-15, GZ-16 using Pexels + gTTS + FFmpeg
 */

import { readFileSync, writeFileSync, mkdirSync, statSync, createWriteStream } from 'fs';
import { resolve, dirname } from 'path';
import { spawnSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PEXELS_KEY = process.env.PEXELS_API_KEY ?? '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa';
const OUTPUT_DIR = resolve(ROOT, 'output_topic', 'videos');
const TEMP = resolve(ROOT, 'output', '_temp_gz1416');
mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(TEMP, { recursive: true });

function log(...a) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...a); }

function httpRequest(url, headers = {}) {
  return new Promise((res, rej) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    const req = protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', ...headers } }, (resp) => {
      if (resp.statusCode >= 400) { rej(new Error('HTTP ' + resp.statusCode)); return; }
      const chunks = [];
      resp.on('data', c => chunks.push(c));
      resp.on('end', () => res(Buffer.concat(chunks)));
    });
    req.on('error', rej);
  });
}

function download(url, outPath) {
  return new Promise((res, rej) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    const req = protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (resp) => {
      if (resp.statusCode >= 400) { rej(new Error('HTTP ' + resp.statusCode)); return; }
      const ws = createWriteStream(outPath);
      resp.pipe(ws);
      ws.on('finish', () => res());
      ws.on('error', rej);
    });
    req.on('error', rej);
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
  const data = JSON.parse(await httpRequest(url, { Authorization: PEXELS_KEY }));
  return (data.videos || []).filter(v => v.width >= 1080 && v.duration >= 4 && v.duration <= 30);
}

function gTTS(text, outPath) {
  return new Promise((res, rej) => {
    const ttsTxt = resolve(TEMP, '_tts_input.txt');
    writeFileSync(ttsTxt, text);
    const pyScript = `from gtts import gTTS; gTTS(text=open(r"${ttsTxt}",'r').read(), lang="en", slow=False).save(r"${outPath}"); print("OK")`;
    const py = spawn('python', ['-c', pyScript], { timeout: 30000 });
    let err = '';
    py.stderr.on('data', c => err += c.toString());
    py.on('close', (code) => { if (code === 0) res(); else rej(new Error(err)); });
  });
}

async function generateOne(scriptId) {
  log(`\n=== Generating ${scriptId} ===`);
  const scriptPath = resolve(ROOT, 'scripts', 'pending', `${scriptId}.json`);
  const script = JSON.parse(readFileSync(scriptPath, 'utf-8'));
  
  const narration = script.audio?.narration || script.script;
  const targetDuration = script.duration_seconds || 6;
  
  // Search Pexels
  const searchTerms = [
    'resume professional success career laptop',
    'job interview confident professional business',
    'office work professional achievement business',
    'career growth success professional workplace'
  ];
  
  let clips = [];
  for (const term of searchTerms) {
    try {
      const results = await searchPexels(term, 5);
      log(`  ${term}: ${results.length} clips`);
      clips.push(...results);
      if (clips.length >= 3) break;
    } catch(e) { log(`  Error: ${e.message}`); }
  }
  
  // Deduplicate
  const seen = new Set();
  clips = clips.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
  if (clips.length === 0) throw new Error('No clips found');
  
  // Download top clips
  const downloaded = [];
  for (let i = 0; i < Math.min(clips.length, 3); i++) {
    const video = clips[i];
    const files = video.video_files.filter(f => f.height >= 720).sort((a, b) => b.height - a.height);
    const file = files[0] || video.video_files[0];
    const clipPath = resolve(TEMP, `${scriptId}_clip${i}.mp4`);
    log(`  Downloading clip ${i}: ${video.width}x${video.height}, ${video.duration}s`);
    await download(file.link, clipPath);
    const size = statSync(clipPath).size;
    downloaded.push({ path: clipPath, duration: video.duration, width: video.width, height: video.height });
    log(`    OK: ${(size/1024/1024).toFixed(1)}MB`);
  }
  
  // Process clips to 1080x1920
  const processed = [];
  for (let i = 0; i < downloaded.length; i++) {
    const clip = downloaded[i];
    const outPath = resolve(TEMP, `${scriptId}_proc${i}.mp4`);
    const dur = Math.min(clip.duration, targetDuration * 2 / downloaded.length);
    
    let vf;
    if (clip.height > clip.width) {
      vf = `scale=1080:-2:force_original_aspect_ratio=increase,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,trim=0:${dur},setpts=PTS-STARTPTS`;
    } else {
      vf = `crop=in_h*9/16:in_h,scale=1080:1920,trim=0:${dur},setpts=PTS-STARTPTS`;
    }
    
    runFFmpeg(['-i', clip.path, '-vf', vf, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-an', '-t', String(dur), outPath]);
    const actual = getDuration(outPath);
    processed.push({ path: outPath, duration: actual });
    log(`  Processed ${i}: ${actual.toFixed(1)}s`);
  }
  
  // Concat
  const concatPath = resolve(TEMP, `${scriptId}_concat.mp4`);
  const concatList = resolve(TEMP, `${scriptId}_list.txt`);
  writeFileSync(concatList, processed.map(p => `file '${p.path}'`).join('\n'));
  runFFmpeg(['-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', concatPath]);
  const videoDuration = processed.reduce((s, c) => s + c.duration, 0);
  log(`  Concatenated: ${videoDuration.toFixed(1)}s`);
  
  // Scale to 1080x1920 if needed
  const scaledPath = resolve(TEMP, `${scriptId}_scaled.mp4`);
  runFFmpeg(['-i', concatPath, '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black', '-c:v', 'libx264', '-preset', 'fast', '-r', '30', scaledPath]);
  
  // TTS
  const ttsPath = resolve(TEMP, `${scriptId}_tts.mp3`);
  await gTTS(narration, ttsPath);
  log(`  TTS generated`);
  
  // Trim TTS
  const finalVideoDur = getDuration(scaledPath);
  const ttsDur = getDuration(ttsPath);
  const ttsTrim = resolve(TEMP, `${scriptId}_tts_trim.mp3`);
  runFFmpeg(['-i', ttsPath, '-t', String(Math.min(ttsDur, finalVideoDur)), '-c:a', 'copy', ttsTrim]);
  
  // Mux
  const finalPath = resolve(OUTPUT_DIR, `${scriptId}.mp4`);
  runFFmpeg(['-i', scaledPath, '-i', ttsTrim, '-c:v', 'copy', '-c:a', 'aac', '-shortest', finalPath]);
  
  const size = statSync(finalPath).size;
  const finalDur = getDuration(finalPath);
  log(`  ✅ DONE: ${scriptId} = ${(size/1024/1024).toFixed(1)}MB, ${finalDur.toFixed(1)}s`);
  
  // Update script
  script.status = 'published';
  script.produced_at = new Date().toISOString();
  script.local_path = finalPath;
  writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  
  return finalPath;
}

async function main() {
  const ids = ['GZ-14', 'GZ-15', 'GZ-16'];
  for (const id of ids) {
    try {
      await generateOne(id);
    } catch(e) {
      log(`❌ ${id} failed: ${e.message}`);
    }
  }
  log('\nAll done!');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });