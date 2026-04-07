/**
 * scripts/gen-6-pexels.mjs
 * Generate 6 daily videos using Pexels stock footage + ElevenLabs TTS + FFmpeg.
 * 
 * Pipeline per video:
 *   1. Load script JSON from scripts/pending/
 *   2. Search Pexels for 2 video clips matching tags/visual_scene
 *   3. Download clips (FFmpeg, trimmed to ~2.5s each)
 *   4. Generate ElevenLabs TTS audio (Liam voice)
 *   5. Concatenate clips + mux TTS audio → MP4
 *   6. Save to output_topic/videos/{id}.mp4
 *
 * Usage: node scripts/gen-6-pexels.mjs [scriptId1] [scriptId2] ...
 *   Defaults to 6 scripts: WC-01 WC-02 WC-03 WC-04 WC-05 WC-06
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
    // Strip inline comments
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

// ElevenLabs voice for Gen Z energetic content (Liam — verified working per MEMORY.md)
const VOICE_ID = 'TX3LPaxmHKxFdv7VOQHJ'; // Liam - energetic Gen Z

const SCRIPTS_DIR = resolve(ROOT, 'scripts', 'pending');
const OUTPUT_DIR  = resolve(ROOT, 'output_topic', 'videos');
const TEMP_DIR    = resolve(ROOT, 'output', '_temp_pexels');

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(TEMP_DIR, { recursive: true });

function log(prefix, ...args) {
  console.log(`[${new Date().toISOString().slice(11,19)}][${prefix}]`, ...args);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// HTTP helpers (without node:fetch dependency)
// ---------------------------------------------------------------------------
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const mod = isHttps ? https : http;
    const headers = {
      ...(options.headers ?? {}),
      ...(options.json ? { 'Accept': 'application/json' } : {}),
    };
    const reqOptions = { ...options, headers, method: options.method ?? 'GET' };
    delete reqOptions.json;
    const req = mod.request(url, reqOptions, (res) => {
      if (headers['Accept'] === 'application/json') {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('JSON parse: ' + d.slice(0,200))); } });
      } else {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function pexelsSearch(query, perPage = 5) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait`;
  const data = await httpRequest(url, {
    headers: { Authorization: PEXELS_KEY },
    json: true,
  });
  return data.videos ?? [];
}

async function downloadVideo(videoUrl, outPath) {
  const buf = await httpRequest(videoUrl, { method: 'GET' });
  writeFileSync(outPath, buf);
  return buf.length;
}

async function generateTTS(text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text.slice(0, 5000),
      stability: 0.5,
      similarity_boost: 0.75,
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------
// FFmpeg helpers
// ---------------------------------------------------------------------------
function ffmpeg(args, cwd) {
  const r = spawnSync('ffmpeg', ['-y', ...args], {
    cwd: cwd ?? ROOT,
    encoding: 'utf-8',
    timeout: 120000,
  });
  if (r.status !== 0) throw new Error(`FFmpeg error: ${r.stderr.slice(-500)}`);
  return r;
}

function getVideoDuration(filePath) {
  const r = spawnSync('ffprobe', [
    '-v', 'quiet', '-print_format', 'json',
    '-show_format', filePath,
  ], { encoding: 'utf-8' });
  if (r.status !== 0) return 6;
  try {
    const d = JSON.parse(r.stdout);
    return parseFloat(d.format?.duration ?? 6);
  } catch { return 6; }
}

function trimVideo(inputPath, outputPath, start, duration) {
  ffmpeg([
    '-ss', String(start), '-i', inputPath,
    '-t',  String(duration),
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-an',
    '-r', '30',
    outputPath,
  ]);
}

function concatenateVideos(clipPaths, concatListPath, outputPath) {
  const listContent = clipPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
  writeFileSync(concatListPath, listContent, 'utf-8');
  ffmpeg([
    '-f', 'concat', '-safe', '0', '-i', concatListPath,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac',
    outputPath,
  ]);
}

function muxAudioAdd(videoPath, audioPath, outputPath) {
  ffmpeg([
    '-i', videoPath, '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest',
    outputPath,
  ]);
}

// ---------------------------------------------------------------------------
// Main video generation for one script
// ---------------------------------------------------------------------------
async function generateVideoForScript(scriptId) {
  const scriptPath = resolve(SCRIPTS_DIR, `${scriptId}.json`);
  if (!existsSync(scriptPath)) {
    log(scriptId, '❌ Script not found:', scriptPath);
    return { id: scriptId, status: 'skipped', reason: 'script_not_found' };
  }

  const script = JSON.parse(readFileSync(scriptPath, 'utf-8'));
  log(scriptId, '📋 Loaded:', script.title ?? scriptId);

  const outFile = resolve(OUTPUT_DIR, `${scriptId}.mp4`);
  if (existsSync(outFile)) {
    log(scriptId, '⏭️  Already exists, skipping:', outFile);
    return { id: scriptId, status: 'skipped', reason: 'already_exists' };
  }

  // Step 1: Search Pexels
  const searchTags = script.tags?.join(' ') ?? script.visual_scene?.slice(0, 100) ?? script.title ?? scriptId;
  log(scriptId, '🔍 Pexels search:', searchTags.slice(0, 80));

  let videos;
  try {
    videos = await pexelsSearch(searchTags, 6);
  } catch (e) {
    log(scriptId, '❌ Pexels search failed:', e.message);
    return { id: scriptId, status: 'failed', reason: 'pexels_search_failed', error: e.message };
  }

  if (videos.length === 0) {
    // Try broader search
    try {
      videos = await pexelsSearch(script.channel ?? 'lifestyle', 6);
    } catch (e) {
      log(scriptId, '❌ Pexels fallback search failed:', e.message);
      return { id: scriptId, status: 'failed', reason: 'pexels_search_failed', error: e.message };
    }
  }

  log(scriptId, `📹 Found ${videos.length} Pexels videos`);

  // Get video files — prefer portrait/vertical videos
  const videoFiles = videos[0]?.video_files ?? [];
  // Sort by width: prefer 1080x1920 or similar portrait
  videoFiles.sort((a, b) => Math.abs(a.width - 1080) - Math.abs(b.width - 1080));
  const bestFiles = videoFiles.slice(0, 3); // top 3 closest to portrait

  if (bestFiles.length === 0) {
    log(scriptId, '❌ No downloadable video files found');
    return { id: scriptId, status: 'failed', reason: 'no_video_files' };
  }

  // Step 2: Download clips (2 clips)
  const clipPaths = [];
  const CLIP_DURATION = 2.5;
  const downloadDir = resolve(TEMP_DIR, scriptId);
  mkdirSync(downloadDir, { recursive: true });

  for (let i = 0; i < Math.min(2, bestFiles.length); i++) {
    const file = bestFiles[i];
    const downloadUrl = file.link;
    const rawPath = resolve(downloadDir, `clip${i}_raw.mp4`);
    const trimmedPath = resolve(downloadDir, `clip${i}.mp4`);

    log(scriptId, `📥 Downloading clip ${i+1}: ${(file.file_size_kb ?? '?')}KB, ${file.width}x${file.height}`);

    try {
      await downloadVideo(downloadUrl, rawPath);
      const dur = getVideoDuration(rawPath);
      const startTime = Math.max(0, (dur - CLIP_DURATION) * Math.random());
      trimVideo(rawPath, trimmedPath, startTime, CLIP_DURATION);
      clipPaths.push(trimmedPath);
      log(scriptId, `✅ Clip ${i+1} ready (${dur.toFixed(1)}s source, start=${startTime.toFixed(1)}s)`);
    } catch (e) {
      log(scriptId, `⚠️  Clip ${i+1} failed: ${e.message}, trying next file...`);
      // Try next file
      if (i + 1 < bestFiles.length) {
        i++; // try next best file
      }
    }
  }

  if (clipPaths.length === 0) {
    log(scriptId, '❌ Could not download any clips');
    return { id: scriptId, status: 'failed', reason: 'download_failed' };
  }

  // If only 1 clip, duplicate it
  if (clipPaths.length === 1) {
    clipPaths.push(clipPaths[0]);
    log(scriptId, '📹 Duplicating clip for 2-clip sequence');
  }

  // Step 3: Generate TTS
  const ttsText = script.script ?? script.title ?? '';
  const audioPath = resolve(downloadDir, 'audio.mp3');
  log(scriptId, '🎙️  Generating TTS...');

  try {
    const audioBuf = await generateTTS(ttsText);
    writeFileSync(audioPath, audioBuf);
    log(scriptId, `✅ TTS done (${(audioBuf.length / 1024).toFixed(0)}KB)`);
  } catch (e) {
    log(scriptId, `❌ TTS failed: ${e.message}`);
    return { id: scriptId, status: 'failed', reason: 'tts_failed', error: e.message };
  }

  // Step 4: Concatenate clips
  const concatList = resolve(downloadDir, 'concat.txt');
  const concatenatedVideo = resolve(downloadDir, 'video_no_audio.mp4');
  log(scriptId, '🎬 Concatenating clips...');

  try {
    concatenateVideos(clipPaths, concatList, concatenatedVideo);
    log(scriptId, `✅ Concatenated (${clipPaths.length} clips)`);
  } catch (e) {
    log(scriptId, `❌ Concatenation failed: ${e.message}`);
    return { id: scriptId, status: 'failed', reason: 'concat_failed', error: e.message };
  }

  // Step 5: Add audio
  log(scriptId, '🔊 Adding audio...');
  try {
    muxAudioAdd(concatenatedVideo, audioPath, outFile);
    log(scriptId, `✅ Final video: ${outFile}`);
  } catch (e) {
    log(scriptId, `❌ muxAudioAdd failed: ${e.message}`);
    return { id: scriptId, status: 'failed', reason: 'mux_failed', error: e.message };
  }

  // Verify output
  const finalDur = getVideoDuration(outFile);
  const finalSize = statSync(outFile).size;
  log(scriptId, `✅ DONE — ${(finalSize/1024/1024).toFixed(1)}MB, ${finalDur.toFixed(1)}s`);

  return {
    id: scriptId,
    status: 'done',
    output: outFile,
    sizeMb: +(finalSize / 1024 / 1024).toFixed(2),
    duration: +finalDur.toFixed(2),
    clips: clipPaths.length,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const DEFAULT_SCRIPTS = ['WC-01', 'WC-02', 'WC-03', 'WC-04', 'WC-05', 'WC-06'];
const scriptIds = process.argv.slice(2).filter(Boolean);
const toProcess = scriptIds.length > 0 ? scriptIds : DEFAULT_SCRIPTS;

log('START', `Processing ${toProcess.length} scripts: ${toProcess.join(', ')}`);
log('PEXELS_KEY', PEXELS_KEY ? `set (${PEXELS_KEY.slice(0,8)}...)` : 'MISSING');
log('ELEVENLABS_KEY', ELEVENLABS_KEY ? 'set' : 'MISSING');

const results = [];
for (const id of toProcess) {
  // eslint-disable-next-line no-await-in-loop
  const result = await generateVideoForScript(id);
  results.push(result);
  // Brief pause between videos to avoid rate limits
  // eslint-disable-next-line no-await-in-loop
  await sleep(2000);
}

log('SUMMARY', '==========');
for (const r of results) {
  const icon = r.status === 'done' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌';
  log('SUMMARY', `${icon} ${r.id}: ${r.status}${r.reason ? ` (${r.reason})` : ''}${r.sizeMb ? ` — ${r.sizeMb}MB` : ''}`);
}

const done = results.filter(r => r.status === 'done').length;
const failed = results.filter(r => r.status === 'failed').length;
log('DONE', `${done}/${toProcess.length} videos generated, ${failed} failed`);
