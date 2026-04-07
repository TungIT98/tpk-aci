#!/usr/bin/env node
/**
 * mux-xianyx-vietnamese.cjs
 * Assemble XIANYX video: concat shots + Vietnamese TTS + background music
 *
 * Usage: node mux-xianyx-vietnamese.cjs XIANYX-42
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const WORKDIR = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI';
const MINIMAX_API_KEY = 'sk-cp-JKcLn8JXdkygpTgwCS72isp9Zz7AswQeFdh5uKnvk0vngQHaLa6NVBOwSZ8v6xZybbPM3ck-L1UmOYff7EsliddMUK4Hk-za3N0-wUWse_Nsj--6J_n9XPw';
const MINIMAX_BASE_URL = 'https://api.minimax.io';
const FFMPEG = 'C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe';

const videoId = process.argv[2];
if (!videoId) { console.error('Usage: node mux-xianyx-vietnamese.cjs XIANYX-42'); process.exit(1); }

const scriptPath = path.join(WORKDIR, 'scripts', 'pending', 'xianxia', `${videoId}.json`);
const shotsDir = path.join(WORKDIR, 'output', 'xianxia', videoId);
const outputDir = path.join(WORKDIR, 'output_topic', 'videos');
const tempDir = path.join(WORKDIR, 'output', `_temp_${videoId}`);

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

// Load script
const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
const narration = script.audio.narration;
const bgMusic = script.audio.bg_music || '';
console.log(`[${videoId}] Narration: ${narration.length} chars`);
console.log(`[${videoId}] Title: ${script.metadata.youtube_title}`);

// ============================================================
// STEP 1: Generate Vietnamese TTS via MiniMax API
// ============================================================
function minimaxTTS(text, outputPath) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'speech-2.8-hd',
      text: text,
      stream: false,
      voice_setting: {
        voice_id: '1', // Vietnamese-friendly voice (tested working)
        speed: 1.0,
        vol: 1,
        pitch: 0
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1
      },
      language_boost: 'auto',
      output_format: 'hex'
    });

    const options = {
      hostname: 'api.minimax.io',
      path: '/v1/t2a_v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + MINIMAX_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data?.audio) {
            const buf = Buffer.from(json.data.audio, 'hex');
            fs.writeFileSync(outputPath, buf);
            console.log(`[${videoId}] TTS saved: ${buf.length} bytes`);
            resolve(buf.length);
          } else {
            console.log(`[${videoId}] TTS response:`, JSON.stringify(json).substring(0, 200));
            reject(new Error('No audio in response'));
          }
        } catch(e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// ============================================================
// STEP 2: Concatenate raw shots
// ============================================================
function concatShots() {
  const shots = [1, 2, 3, 4, 5];
  const clipPaths = [];

  for (const i of shots) {
    const p = path.join(shotsDir, `raw_shot_${i}.mp4`);
    if (!fs.existsSync(p)) {
      console.log(`[${videoId}] Shot ${i} not found, skipping`);
      continue;
    }
    const size = fs.statSync(p).size;
    if (size < 50000) {
      console.log(`[${videoId}] Shot ${i} too small (${size} bytes), skipping`);
      continue;
    }
    clipPaths.push(p);
  }

  if (clipPaths.length === 0) throw new Error('No valid clips');

  if (clipPaths.length === 1) {
    return clipPaths[0];
  }

  // Scale + trim each clip to 6s, then concat
  const scaledPaths = [];
  for (let i = 0; i < clipPaths.length; i++) {
    const out = path.join(tempDir, `scaled_${i}.mp4`);
    const dur = i < 5 ? 6 : 6; // each shot 6s
    try {
      execSync(`"${FFMPEG}" -y -i "${clipPaths[i]}" -t 6 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -preset fast -crf 23 -an "${out}"`, { stdio: 'pipe' });
      scaledPaths.push(out);
      console.log(`[${videoId}] Shot ${i+1} scaled`);
    } catch(e) {
      console.log(`[${videoId}] Shot ${i+1} scale failed: ${e.message.substring(0, 100)}`);
    }
  }

  if (scaledPaths.length === 0) throw new Error('No scaled clips');

  // Concat
  const listPath = path.join(tempDir, 'list.txt');
  fs.writeFileSync(listPath, scaledPaths.map(p => `file '${p}'`).join('\n'));
  const concatPath = path.join(tempDir, 'concat.mp4');
  execSync(`"${FFMPEG}" -y -f concat -safe 0 -i "${listPath}" -c copy "${concatPath}"`, { stdio: 'pipe' });
  console.log(`[${videoId}] Concat done: ${fs.statSync(concatPath).size} bytes`);
  return concatPath;
}

// ============================================================
// STEP 3: Get video duration (using ffprobe)
// ============================================================
const FFPROBE = FFMPEG.replace('ffmpeg.exe', 'ffprobe.exe');
function getDuration(file) {
  try {
    const out = execSync(`"${FFPROBE}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`, { encoding: 'utf8', timeout: 10000 });
    const dur = parseFloat(out.trim());
    if (!isNaN(dur) && dur > 0) return dur;
  } catch(e) {
    console.log(`[${videoId}] duration parse error: ${e.message.substring(0, 50)}`);
  }
  return 30;
}

// ============================================================
// STEP 4: Trim TTS to video duration
// ============================================================
function trimAudio(ttsPath, videoPath, outPath) {
  const dur = getDuration(videoPath);
  console.log(`[${videoId}] Video duration: ${dur.toFixed(1)}s`);
  try {
    execSync(`"${FFMPEG}" -y -i "${ttsPath}" -t ${dur} -c:a copy "${outPath}"`, { stdio: 'pipe' });
    console.log(`[${videoId}] TTS trimmed to ${dur}s`);
  } catch(e) {
    console.log(`[${videoId}] TTS trim failed: ${e.message.substring(0, 100)}, using original`);
    fs.copyFileSync(ttsPath, outPath);
  }
}

// ============================================================
// STEP 5: Mix audio (narration + background music)
// ============================================================
function mixAudio(videoPath, ttsPath, outPath) {
  // Generate bg music placeholder (use silence for now, music generation requires separate API)
  const silencePath = path.join(tempDir, 'silence.mp3');
  try {
    execSync(`"${FFMPEG}" -y -f lavfi -i anullsrc=r=32000:cl=mono -t 30 -c:a mp3 "${silencePath}"`, { stdio: 'pipe' });
  } catch(e) {}

  // Mix: narration at 100%, bg at 35%
  try {
    execSync(`"${FFMPEG}" -y -i "${videoPath}" -i "${ttsPath}" -i "${silencePath}" -filter_complex "[1:a]volume=1.0[tts];[2:a]volume=0.35[bg];[tts][bg]amix=inputs=2:duration=longest[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 128k "${outPath}"`, { stdio: 'pipe' });
    console.log(`[${videoId}] Audio mixed`);
  } catch(e) {
    console.log(`[${videoId}] Mix failed: ${e.message.substring(0, 100)}, copying original`);
    fs.copyFileSync(videoPath, outPath);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const outputFile = path.join(outputDir, `${videoId}.mp4`);

  if (fs.existsSync(outputFile) && fs.statSync(outputFile).size > 100000) {
    console.log(`[${videoId}] Already exists: ${fs.statSync(outputFile).size} bytes`);
    process.exit(0);
  }

  // TTS
  const ttsPath = path.join(tempDir, 'tts.mp3');
  try {
    await minimaxTTS(narration, ttsPath);
  } catch(e) {
    console.log(`[${videoId}] TTS failed: ${e.message}, using silence`);
    execSync(`"${FFMPEG}" -y -f lavfi -i anullsrc=r=32000:cl=mono -t 30 -c:a mp3 "${ttsPath}"`, { stdio: 'pipe' });
  }

  // Concat
  let concatPath;
  try {
    concatPath = concatShots();
  } catch(e) {
    console.log(`[${videoId}] Concat failed: ${e.message}`);
    process.exit(1);
  }

  // Trim TTS
  const ttsTrimPath = path.join(tempDir, 'tts_trim.mp3');
  trimAudio(ttsPath, concatPath, ttsTrimPath);

  // Mix and output
  const finalPath = path.join(tempDir, 'final.mp4');
  mixAudio(concatPath, ttsTrimPath, finalPath);

  // Copy to output
  fs.copyFileSync(finalPath, outputFile);
  console.log(`[${videoId}] Output: ${outputFile} (${fs.statSync(outputFile).size} bytes)`);

  // Update JSON
  script.status = 'produced';
  script.videoFile = outputFile;
  script.produced_at = new Date().toISOString() + 'Z';
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2, 'utf8'));
  console.log(`[${videoId}] JSON updated`);
}

main().catch(e => { console.error(`[${videoId}] Error:`, e.message); process.exit(1); });
