/**
 * gen-gz02.js - Produce GZ-02_morning-scroll video
 * Pexels stock + ElevenLabs TTS + FFmpeg pipeline
 */
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import https from 'https';
import http from 'http';
import { createWriteStream } from 'fs';
import { TTSProvider } from './lib/tts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, 'output_topic', 'videos');
const TEMP = 'C:/tmp/openclaw/uploads';
const SCRIPT_ID = 'GZ-02_morning-scroll';

mkdirSync(OUTPUT, { recursive: true });
mkdirSync(TEMP, { recursive: true });

// FFmpeg path
const FFMPEG = 'C:\\New folder\\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\\bin\\ffmpeg.exe';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { file.close(); reject(err); });
  });
}

async function run() {
  const tts = new TTSProvider();

  // Shot plan: [pexels_id, start_time, duration, label]
  // shot1: 0-5s  → scrolling phone in bed
  // shot2: 5-22s → morning routine productive
  // shot3: 22-35s → phone locked + morning walk
  // shot4: 35-48s → motivation speaking to camera
  const shots = [
    { id: 8810534, start: 0, duration: 5,  label: 'shot1_scroll' },    // 1080x1920, 8s
    { id: 7657789, start: 0, duration: 17, label: 'shot2_productive' }, // 1080x1920, 8s
    { id: 8052407, start: 0, duration: 13, label: 'shot3_locked' },      // 1080x1920, 10s
    { id: 8136210, start: 0, duration: 13, label: 'shot4_cta' },         // 1080x1920, 13s
  ];

  // Download Pexels videos
  const pexelsKey = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa';
  const clipPaths = [];

  for (const shot of shots) {
    const dest = `${TEMP}/${shot.label}.mp4`;
    if (!existsSync(dest)) {
      console.log(`Downloading shot ${shot.label} (ID=${shot.id})...`);
      // Get video file
      const resp = await fetch(`https://api.pexels.com/videos/videos/${shot.id}`,
        { headers: { Authorization: pexelsKey } });
      const data = await resp.json();
      const videoFile = data['video_files'].find(f => f.width === 1080) || data['video_files'][0];
      console.log(`  -> ${videoFile.link}`);
      await downloadFile(videoFile.link, dest);
    } else {
      console.log(`Shot ${shot.label} already exists, skipping download`);
    }

    // Trim to required duration
    const trimmed = `${TEMP}/${shot.label}_trim.mp4`;
    const ffmpegResult = spawnSync(FFMPEG, [
      '-ss', String(shot.start),
      '-i', `${TEMP}/${shot.label}.mp4`,
      '-t', String(shot.duration),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
      '-r', '30',
      '-y', trimmed
    ], { encoding: 'utf-8' });
    if (ffmpegResult.status !== 0) {
      console.error(`FFmpeg trim failed for ${shot.label}:`, ffmpegResult.stderr);
    } else {
      console.log(`  Trimmed ${shot.label}: ${shot.duration}s`);
    }
    clipPaths.push(trimmed);
  }

  // Generate concat list
  const concatList = `${TEMP}/concat_list.txt`;
  writeFileSync(concatList, clipPaths.map(p => `file '${p}'`).join('\n'));

  // Concatenate clips
  const concatenated = `${TEMP}/GZ-02_concat.mp4`;
  const concatResult = spawnSync(FFMPEG, [
    '-f', 'concat', '-safe', '0',
    '-i', concatList,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-y', concatenated
  ], { encoding: 'utf-8' });
  if (concatResult.status !== 0) {
    console.error('Concat failed:', concatResult.stderr);
  } else {
    console.log('Clips concatenated successfully');
  }

  // Generate TTS narration
  const narration = `Scrolling TikTok for 45 minutes before work isn't a morning routine. It's a slow drain on your potential. The average Gen Z worker loses 2 to 3 hours daily to passive phone use before noon. You're warming up your brain to scroll — not to create. Your first hour programs your entire day. The 45-minute difference looks like this: 20 minutes movement — walk, workout, stretch. 15 minutes learning — podcast, article, YouTube course. 10 minutes planning — three priorities. That's peak performance mode by 9am. No motivation required. You don't have to want to do it. You just have to not open your phone for 45 minutes. That's it. One decision at 6am changes your entire day. Your phone can make you rich or broke — your choice. First hour of your day equals first hour of your life. Follow for more unfiltered success content that doesn't waste your time.`;

  console.log('Generating ElevenLabs TTS (josh voice, growth channel)...');
  let audioPath = `${TEMP}/GZ-02_audio.mp3`;
  try {
    const audioBuffer = await tts.speakForChannel('growth', { text: narration, provider: 'elevenlabs' });
    writeFileSync(audioPath, Buffer.from(audioBuffer));
    console.log(`TTS generated: ${audioPath}`);
  } catch (err) {
    console.error('ElevenLabs TTS failed:', err.message);
    // Fallback to MiniMax
    try {
      console.log('Trying MiniMax TTS...');
      const result = await tts.minimax({ text: narration, speed: 1.1 });
      if (result.audio_url) {
        await downloadFile(result.audio_url, audioPath);
      }
    } catch (err2) {
      console.error('MiniMax TTS also failed:', err2.message);
    }
  }

  // Combine video + audio
  const finalPath = `${OUTPUT}/GZ-02_morning-scroll.mp4`;
  const finalResult = spawnSync(FFMPEG, [
    '-i', concatenated,
    '-i', audioPath,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-shortest',
    '-y', finalPath
  ], { encoding: 'utf-8' });
  if (finalResult.status !== 0) {
    console.error('Final mux failed:', finalResult.stderr);
  } else {
    console.log(`Final video: ${finalPath}`);
  }
}

run().catch(console.error);
