/**
 * Generate TTS for movie review pilot using Node.js
 */
import { TTSProvider } from '../../lib/tts.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  // Read script
  const scriptPath = resolve(__dirname, 'script.txt');
  const script = await import('fs').then(fs => fs.readFileSync(scriptPath, 'utf-8'));

  // Remove markdown headers
  const lines = script.split('\n');
  const contentLines = lines.filter(line => !line.startsWith('#'));
  const text = contentLines.join('\n');

  console.log(`Script length: ${text.length} characters`);

  // Use TTS
  const tts = new TTSProvider();

  const outputPath = resolve(__dirname, 'review_voiceover.mp3');

  try {
    console.log('Generating TTS (ElevenLabs -> MiniMax -> SAPI fallback)...');
    const audioBuffer = await tts.speakWithFailover(text, {
      onProgress: (msg) => console.log(msg)
    });

    if (Buffer.isBuffer(audioBuffer)) {
      writeFileSync(outputPath, audioBuffer);
      console.log(`TTS generated: ${outputPath} (${audioBuffer.length} bytes)`);
    } else {
      // MiniMax returns { audio_url, duration_s }
      console.log(`MiniMax TTS result: ${JSON.stringify(audioBuffer)}`);
    }
  } catch (e) {
    console.error('TTS Error:', e.message);
  }
}

main().catch(console.error);
