// fix-wc-audio.mjs - Add audio to WC-01 through WC-05
// Usage: node scripts/fix-wc-audio.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, '..');

function loadEnv() {
  const env = {};
  const envPath = resolve(workspaceRoot, '.env');
  try {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim().split('#')[0].trim(); // strip inline comments
      env[key] = val;
    }
  } catch (e) { /* use process.env */ }
  return env;
}

const env = loadEnv();
const ELEVENLABS_KEY = env.ELEVENLABS_API_KEY || '';
// Correct voice IDs for this ElevenLabs account
// Liam - Energetic, Social Media Creator (perfect for TikTok/shorts Gen Z content)
const VOICE_ID = 'TX3LPaxmHKxFdv7VOQHJ';

const wcIds = ['WC-01', 'WC-02', 'WC-03', 'WC-04', 'WC-05'];

async function generateTTS(text, outputPath) {
  console.log(`[TTS] Generating audio for text (${text.length} chars)...`);
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      voice_settings: {
        stability: 0.35,
        similarity_boost: 0.85,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${await response.text()}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputPath, buffer);
  console.log(`[TTS] Saved: ${outputPath} (${buffer.length} bytes)`);
  return buffer;
}

function runFFmpeg(args) {
  const result = spawnSync('ffmpeg', args, { 
    cwd: workspaceRoot,
    encoding: 'utf-8',
    shell: true,
  });
  if (result.status !== 0) {
    console.error('[FFmpeg Error]', result.stderr.substring ? result.stderr.substring(0, 500) : result.stderr);
    return false;
  }
  return true;
}

async function main() {
  console.log('=== Fix WC Audio Pipeline ===\n');
  
  if (!ELEVENLABS_KEY) {
    console.error('[ERROR] ELEVENLABS_API_KEY not found in .env');
    process.exit(1);
  }

  for (const id of wcIds) {
    // Add delay between requests to avoid ElevenLabs rate limiting
    await new Promise(r => setTimeout(r, 2000));
    
    console.log(`\n=== Processing ${id} ===`);
    
    const scriptPath = resolve(workspaceRoot, 'scripts', 'pending', `${id}.json`);
    if (!existsSync(scriptPath)) {
      console.log(`[SKIP] Script not found: ${scriptPath}`);
      continue;
    }

    const script = JSON.parse(readFileSync(scriptPath, 'utf-8'));
    const text = script.script;
    console.log(`[INFO] Script preview: ${text.substring(0, 60)}...`);

    const outputDir = resolve(workspaceRoot, 'outputs', id);
    const ttsPath = resolve(outputDir, 'narration.mp3');
    const finalPath = resolve(outputDir, 'final.mp4');
    const finalVoicePath = resolve(outputDir, 'final_with_voice.mp4');

    // Step 1: Generate TTS
    try {
      await generateTTS(text, ttsPath);
    } catch (e) {
      console.error(`[ERROR] TTS failed for ${id}: ${e.message}`);
      continue;
    }

    // Step 2: Verify final.mp4 exists
    if (!existsSync(finalPath)) {
      console.log(`[SKIP] final.mp4 not found for ${id}`);
      continue;
    }

    // Step 3: Mix audio with video
    // Since final.mp4 has NO audio track, use -map 1:a to take the TTS narration
    // -shortest ensures output doesn't extend beyond video
    console.log('[FFmpeg] Mixing audio with video...');
    const mixed = runFFmpeg([
      '-y',
      '-i', finalPath,
      '-i', ttsPath,
      '-map', '0:v',
      '-map', '1:a',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      finalVoicePath,
    ]);

    if (mixed) {
      console.log(`[OK] Created: ${finalVoicePath}`);
      
      // Step 4: Verify audio stream exists
      const probeResult = spawnSync(
        'ffprobe', 
        ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name', '-of', 'csv=p=0', finalVoicePath],
        { encoding: 'utf-8', cwd: workspaceRoot }
      );
      console.log('[Verify] Streams:', probeResult.stdout.trim());
    } else {
      console.error(`[ERROR] FFmpeg failed for ${id}`);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(e => { console.error(e); process.exit(1); });
