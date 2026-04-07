/**
 * HAILUO PILOT GENERATOR - Tạo Pilot Video hoàn chỉnh
 *
 * Kết hợp Hailuo Web cho video + MiniMax TTS cho audio
 *
 * Usage:
 *   node scripts/hailuo-pilot.js --script ./output/pilot-review/script.txt --output ./output/pilot-review/pilot.mp4
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execSync } from 'child_process';
import https from 'https';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(ROOT, 'output', 'pilot-review');
const TEMP_DIR = resolve(OUTPUT_DIR, 'temp');

// Ensure directories exist
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });

// Load env
function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  try {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();

// ============================================
// MINIMAX TTS
// ============================================

const API_KEY = env.MINI_MAX_API_KEY || env.ANTHROPIC_TOKEN_KEY || '';

function generateTTS(text, options = {}) {
  const { voiceId = 'Vietnamese_kindhearted_girl', model = 'speech-2.8-hd', speed = 1 } = options;

  return new Promise((resolve, reject) => {
    const payload = {
      model,
      text,
      stream: false,
      voice_setting: { voice_id: voiceId, speed, pitch: 0, vol: 1 },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 }
    };

    const data = JSON.stringify(payload);

    const req = https.request({
      hostname: 'api.minimax.io',
      path: '/v1/t2a_v2',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const result = JSON.parse(body);
          if (result.data && result.data.audio) {
            resolve(Buffer.from(result.data.audio, 'hex'));
          } else {
            reject(new Error('No audio in response'));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ============================================
// HAILUO VIDEO (using existing session approach)
// ============================================

async function generateHailuoVideo(prompt, outputFile) {
  const { chromium } = require('playwright');
  const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');

  if (!existsSync(SESSION_PATH)) {
    throw new Error('Session not found. Run: node scripts/hailuo-web.js setup-session');
  }

  const session = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(session.cookies || []);
  const page = await context.newPage();

  try {
    console.log(`   🎬 "${prompt.slice(0, 40)}..."`);

    await page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const textarea = page.locator('#video-create-textarea');
    await textarea.click();
    await textarea.fill(prompt);

    await page.waitForTimeout(1000);

    const oldUrls = await page.evaluate(() => {
      const urls = new Set();
      document.querySelectorAll('video').forEach(v => { if (v.src) urls.add(v.src); });
      return [...urls];
    });

    const createBtn = page.locator('button[type="submit"], button.new-color-btn-bg').first();
    await createBtn.click();

    let videoUrl = null;
    for (let i = 0; i < 18 && !videoUrl; i++) {
      await page.waitForTimeout(10000);
      videoUrl = await page.evaluate((old) => {
        const vids = document.querySelectorAll('video');
        for (const v of vids) {
          if (v.src && !v.src.startsWith('about:') && !old.includes(v.src)) return v.src;
        }
        return null;
      }, oldUrls);
      if (!videoUrl) process.stdout.write('.');
    }
    console.log();

    if (videoUrl) {
      const response = await page.goto(videoUrl);
      const buffer = await response.body();
      writeFileSync(outputFile, buffer);
      console.log(`   ✅ Saved: ${buffer.length} bytes`);
      return buffer.length;
    }

    return 0;

  } finally {
    await browser.close();
  }
}

// ============================================
// FFmpeg helpers
// ============================================

function runFFmpeg(cmd) {
  console.log('   Running FFmpeg...');
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error('   FFmpeg error:', e.message);
    return false;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);

  let scriptPath = '';
  let outputPath = '';
  let numClips = 4;
  let duration = 60;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--script' || args[i] === '-s') scriptPath = args[++i];
    else if (args[i] === '--output' || args[i] === '-o') outputPath = args[++i];
    else if (args[i] === '--clips' || args[i] === '-c') numClips = parseInt(args[++i]);
    else if (args[i] === '--duration' || args[i] === '-d') duration = parseInt(args[++i]);
  }

  if (!scriptPath) {
    console.log(`
🎬 HAILUO PILOT GENERATOR
=========================

Usage:
  node scripts/hailuo-pilot.js --script ./script.txt [--output ./output.mp4] [--clips 4] [--duration 60]

Options:
  --script, -s     Script file path (required)
  --output, -o     Output video path
  --clips, -c      Number of clips to generate (default: 4)
  --duration, -d   Target duration in seconds (default: 60)
`);
    return;
  }

  console.log('\n🎬 HAILUO PILOT GENERATOR');
  console.log('========================\n');

  // 1. Read script
  console.log('📄 Step 1: Reading script...');
  let scriptText = readFileSync(scriptPath, 'utf-8');

  // Remove markdown headers
  const lines = scriptText.split('\n');
  const contentLines = lines.filter(line => !line.startsWith('#'));
  scriptText = contentLines.join('\n').trim();

  console.log(`   Script length: ${scriptText.length} chars`);

  // 2. Generate TTS
  console.log('\n🎤 Step 2: Generating TTS voiceover...');
  try {
    const audioBuffer = await generateTTS(scriptText);
    const voiceoverPath = resolve(TEMP_DIR, 'voiceover.mp3');
    writeFileSync(voiceoverPath, audioBuffer);
    console.log(`   ✅ Voiceover saved: ${audioBuffer.length} bytes`);

    // Get duration
    const dur = execSync(`ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voiceoverPath}"`, { encoding: 'utf8' }).trim();
    console.log(`   Duration: ${dur} seconds`);
  } catch (e) {
    console.error('   ❌ TTS error:', e.message);
    return;
  }

  // 3. Generate video clips
  console.log('\n🎬 Step 3: Generating video clips...');

  // Generate contextually relevant prompts based on script content
  const videoPrompts = [
    'Epic sci-fi movie scene with alien planet floating mountains blue sky, cinematic 3D animation',
    'Underwater scene with bioluminescent creatures coral reefs alien ocean, cinematic lighting',
    'Beautiful alien forest with giant trees and floating rocks, ethereal atmosphere',
    'Battle scene with alien warriors and military spaceships, dramatic cinematic lighting',
    'Emotional scene with blue alien characters in romantic setting, dramatic close-up',
    'Futuristic technology interface with holographic displays, sci-fi atmosphere'
  ].slice(0, numClips);

  const clipPaths = [];
  for (let i = 0; i < videoPrompts.length; i++) {
    const clipPath = resolve(TEMP_DIR, `clip_${i}.mp4`);
    const size = await generateHailuoVideo(videoPrompts[i], clipPath);
    if (size > 0) {
      clipPaths.push(clipPath);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  if (clipPaths.length === 0) {
    console.log('   ❌ No clips generated');
    return;
  }

  console.log(`   ✅ Generated ${clipPaths.length} clips`);

  // 4. Concatenate clips
  console.log('\n🔗 Step 4: Concatenating clips...');

  // Create concat list
  const concatListPath = resolve(TEMP_DIR, 'concat_list.txt');
  let concatContent = '';
  for (const clip of clipPaths) {
    concatContent += `file '${clip}'\n`;
  }
  writeFileSync(concatListPath, concatContent);

  const videoConcatPath = resolve(TEMP_DIR, 'video_concat.mp4');

  if (!runFFmpeg(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${videoConcatPath}"`)) {
    return;
  }

  const videoDuration = execSync(`ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoConcatPath}"`, { encoding: 'utf8' }).trim();
  console.log(`   ✅ Video duration: ${videoDuration} seconds`);

  // 5. Loop video to match voiceover
  console.log('\n🔄 Step 5: Looping video to match voiceover...');
  const voiceoverPath = resolve(TEMP_DIR, 'voiceover.mp3');
  const voiceoverDuration = execSync(`ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${voiceoverPath}"`, { encoding: 'utf8' }).trim();

  const loopedVideoPath = resolve(TEMP_DIR, 'video_looped.mp4');

  // Calculate loop count
  const loopCount = Math.ceil(parseFloat(voiceoverDuration) / parseFloat(videoDuration)) + 1;

  if (!runFFmpeg(`ffmpeg -y -stream_loop ${loopCount} -i "${videoConcatPath}" -t ${voiceoverDuration} -c copy "${loopedVideoPath}"`)) {
    return;
  }

  // 6. Combine video + audio
  console.log('\n🎬 Step 6: Combining video + audio...');
  const finalOutput = outputPath || resolve(OUTPUT_DIR, `pilot_${Date.now()}.mp4`);

  if (!runFFmpeg(`ffmpeg -y -i "${loopedVideoPath}" -i "${voiceoverPath}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${finalOutput}"`)) {
    return;
  }

  // Get final file size
  const finalSize = execSync(`stat -c %s "${finalOutput}" 2>/dev/null || wc -c "${finalOutput}" | awk '{print $1}'`, { encoding: 'utf8' }).trim();

  console.log('\n✅ PILOT VIDEO COMPLETE!');
  console.log('======================');
  console.log(`📁 Output: ${finalOutput}`);
  console.log(`📊 Size: ${(parseInt(finalSize) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`⏱️  Duration: ${voiceoverDuration} seconds`);
  console.log(`🎬 Clips: ${clipPaths.length}`);

  // Cleanup temp files
  console.log('\n🧹 Cleaning up temp files...');
  try {
    for (const clip of clipPaths) {
      require('fs').unlinkSync(clip);
    }
    require('fs').unlinkSync(concatListPath);
    require('fs').unlinkSync(videoConcatPath);
    require('fs').unlinkSync(loopedVideoPath);
    require('fs').unlinkSync(voiceoverPath);
  } catch (e) {}

  console.log('✅ Done!');
}

main().catch(e => {
  console.error('❌ Fatal error:', e.message);
  process.exit(1);
});
