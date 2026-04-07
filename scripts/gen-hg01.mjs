/**
 * scripts/gen-hg01.mjs
 * Generate HG-01 video using HailuoApp
 */

import { HailuoApp } from '../lib/hailuo-app.js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function log(...args) {
  console.log(`[gen-hg01] ${new Date().toISOString().slice(11,19)}`, ...args);
}

async function main() {
  const outputDir = resolve(ROOT, 'outputs', 'HG-01');
  mkdirSync(outputDir, { recursive: true });
  log(`Output dir: ${outputDir}`);

  const prompt = `Beautiful athletic girl with ponytail, wearing sports bra and gym shorts, flexing legs in front of mirror at gym [Static shot]. Squats down, lifts heavy barbell [Tracking shot following movement]. Muscles flex, confident smile at camera [Push in on face]. Shows before/after transformation photos on phone [Pull out to reveal modern gym setting]. Modern gym with neon lights, motivational atmosphere, cinematic lighting, 9:16 portrait.`;

  log(`Prompt: ${prompt.slice(0, 80)}...`);
  log('Starting HailuoApp...');

  const app = new HailuoApp({
    downloadDir: outputDir,
    headless: false, // Visible for debugging
  });

  try {
    await app.init();
    log('HailuoApp initialized');

    log('Generating video (may take 2-3 minutes)...');
    const result = await app.generateVideo({
      prompt,
      aspectRatio: '9:16',
      duration: 6,
    });

    log(`Generation result: ${JSON.stringify(result)}`);

    if (result.success && result.videoPath) {
      log(`✅ Video saved to: ${result.videoPath}`);
      writeFileSync(resolve(outputDir, 'generation-result.json'), JSON.stringify(result, null, 2));
    } else {
      log(`❌ Generation failed: ${result.error}`);
    }

  } catch (err) {
    log(`Error: ${err.message}`);
  } finally {
    await app.close();
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
