/**
 * MINIMAX TTS SKILL - Text-to-Speech sử dụng MiniMax API
 *
 * Sử dụng MiniMax Speech 2.8 HD cho Vietnamese TTS chất lượng cao
 *
 * Usage:
 *   node scripts/minimax-tts.js speak "Hello world" --output ./hello.mp3
 *   node scripts/minimax-tts.js speak-file ./script.txt --output ./output.mp3
 *   node scripts/minimax-tts.js voices
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import https from 'https';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(ROOT, 'output', 'tts');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

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
const API_KEY = env.MINI_MAX_API_KEY || env.ANTHROPIC_TOKEN_KEY || '';
const BASE_URL = 'api.minimax.io';

// Available Vietnamese voice IDs
const VIETNAMESE_VOICES = {
  'Vietnamese_kindhearted_girl': 'Vietnamese - Kindhearted Girl (Recommended)',
  'Vietnamese_friendly_boy': 'Vietnamese - Friendly Boy',
  'Vietnamese_sweet_girl': 'Vietnamese - Sweet Girl',
  'Vietnamese_calm_woman': 'Vietnamese - Calm Woman',
  'Vietnamese_casual_man': 'Vietnamese - Casual Man'
};

// Default voice
const DEFAULT_VOICE = 'Vietnamese_kindhearted_girl';

/**
 * Generate TTS using MiniMax API
 */
function generateTTS(text, options = {}) {
  const {
    voiceId = DEFAULT_VOICE,
    model = 'speech-2.8-hd',
    speed = 1,
    pitch = 0,
    vol = 1,
    outputFormat = 'mp3',
    sampleRate = 32000,
    bitrate = 128000
  } = options;

  return new Promise((resolve, reject) => {
    const payload = {
      model,
      text,
      stream: false,
      voice_setting: {
        voice_id: voiceId,
        speed,
        pitch,
        vol
      },
      audio_setting: {
        sample_rate: sampleRate,
        bitrate,
        format: outputFormat,
        channel: 1
      }
    };

    const data = JSON.stringify(payload);

    const options = {
      hostname: BASE_URL,
      path: '/v1/t2a_v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    };

    console.log(`🎤 Generating TTS...`);
    console.log(`   Model: ${model}`);
    console.log(`   Voice: ${voiceId}`);
    console.log(`   Text length: ${text.length} chars`);

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(body);

            if (result.data && result.data.audio) {
              console.log(`   ✅ Audio generated (${result.data.audio.length} hex chars)`);
              resolve(Buffer.from(result.data.audio, 'hex'));
            } else {
              reject(new Error('No audio in response: ' + body.slice(0, 200)));
            }
          } catch (e) {
            reject(new Error('Failed to parse response: ' + e.message));
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

/**
 * Speak text and save to file
 */
async function speak(text, options = {}) {
  const { outputPath, voiceId, model, speed, pitch } = options;

  const audioBuffer = await generateTTS(text, { voiceId, model, speed, pitch });

  const output = outputPath || resolve(OUTPUT_DIR, `tts_${Date.now()}.mp3`);
  writeFileSync(output, audioBuffer);

  console.log(`💾 Saved: ${output} (${audioBuffer.length} bytes)`);

  return {
    success: true,
    path: output,
    size: audioBuffer.length
  };
}

/**
 * Speak from file
 */
async function speakFile(filePath, options = {}) {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  let text = readFileSync(filePath, 'utf-8');

  // Remove markdown headers
  const lines = text.split('\n');
  const contentLines = lines.filter(line => !line.startsWith('#'));
  text = contentLines.join('\n').trim();

  console.log(`📄 Reading from: ${filePath}`);
  console.log(`   Text length: ${text.length} chars`);

  const { outputPath, voiceId, model, speed, pitch } = options;

  const audioBuffer = await generateTTS(text, { voiceId, model, speed, pitch });

  const output = outputPath || resolve(OUTPUT_DIR, `tts_${Date.now()}.mp3`);
  writeFileSync(output, audioBuffer);

  console.log(`💾 Saved: ${output} (${audioBuffer.length} bytes)`);

  return {
    success: true,
    path: output,
    size: audioBuffer.length,
    textLength: text.length
  };
}

/**
 * List available voices
 */
function listVoices() {
  console.log(`
🎭 AVAILABLE VIETNAMESE VOICES
=============================

Default voice: ${DEFAULT_VOICE}

`);

  for (const [id, name] of Object.entries(VIETNAMESE_VOICES)) {
    const marker = id === DEFAULT_VOICE ? ' (DEFAULT)' : '';
    console.log(`  ${id}${marker}`);
    console.log(`    ${name}\n`);
  }

  console.log(`
USAGE:
  node scripts/minimax-tts.js voices
  node scripts/minimax-tts.js speak "Hello" --output ./hello.mp3
  node scripts/minimax-tts.js speak-file ./script.txt --output ./output.mp3 --voice Vietnamese_friendly_boy

OPTIONS:
  --output, -o    Output file path
  --voice, -v     Voice ID (default: Vietnamese_kindhearted_girl)
  --model, -m     Model (default: speech-2.8-hd)
  --speed, -s     Speed 0.5-2 (default: 1)
  --pitch, -p     Pitch -12 to 12 (default: 0)
`);
}

/**
 * CLI Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help') {
    listVoices();
    return;
  }

  if (command === 'voices') {
    listVoices();
    return;
  }

  if (command === 'speak') {
    let text = '';
    let outputPath = '';
    let voiceId = DEFAULT_VOICE;
    let speed = 1;
    let pitch = 0;
    let model = 'speech-2.8-hd';

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--output' || args[i] === '-o') outputPath = args[++i];
      else if (args[i] === '--voice' || args[i] === '-v') voiceId = args[++i];
      else if (args[i] === '--model' || args[i] === '-m') model = args[++i];
      else if (args[i] === '--speed' || args[i] === '-s') speed = parseFloat(args[++i]);
      else if (args[i] === '--pitch' || args[i] === '-p') pitch = parseInt(args[++i]);
      else if (!text) text = args[i];
    }

    if (!text) {
      console.log('Usage: node scripts/minimax-tts.js speak "text" [--output path] [--voice voiceId]');
      return;
    }

    const result = await speak(text, { outputPath, voiceId, model, speed, pitch });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'speak-file') {
    let filePath = '';
    let outputPath = '';
    let voiceId = DEFAULT_VOICE;
    let speed = 1;
    let pitch = 0;
    let model = 'speech-2.8-hd';

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--output' || args[i] === '-o') outputPath = args[++i];
      else if (args[i] === '--voice' || args[i] === '-v') voiceId = args[++i];
      else if (args[i] === '--model' || args[i] === '-m') model = args[++i];
      else if (args[i] === '--speed' || args[i] === '-s') speed = parseFloat(args[++i]);
      else if (args[i] === '--pitch' || args[i] === '-p') pitch = parseInt(args[++i]);
      else if (!filePath) filePath = args[i];
    }

    if (!filePath) {
      console.log('Usage: node scripts/minimax-tts.js speak-file ./script.txt [--output path]');
      return;
    }

    try {
      const result = await speakFile(filePath, { outputPath, voiceId, model, speed, pitch });
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.error('Error:', e.message);
    }
    return;
  }

  console.log(`Unknown command: ${command}`);
  console.log('Run without arguments for help');
}

main().catch(e => {
  console.error('❌ Fatal error:', e.message);
  process.exit(1);
});
