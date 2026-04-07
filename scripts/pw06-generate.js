#!/usr/bin/env node
/**
 * Generate PW-06 using hailuo-app.js
 * PW-06: Gen Z Productivity (afternoon slump → skills/compounding)
 */

import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

const PROMPT = `Person at desk at 2pm rubbing eyes, looking at screen with confusion [Medium shot]. Transition: brain cross-section graphic overlay [Static]. Person stands, stretches, walks to window with coffee [Tracking shot following person]. Cut back to desk: same person, now energized, typing rapidly [Push in on hands/keyboard]. Clock showing 2pm morphs to 4pm with output visible [Montage of completed work]. Modern office, afternoon light, warm tones, professional setting, cinematic cut.`;

const ASPECT = '16:9';
const OUTPUT_DIR = resolve(__dirname, 'output', 'PW-06');
const SESSION_PATH = resolve(__dirname, '.hailuo-session.json');

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const { HailuoApp } = await import('../lib/hailuo-app.js');
  
  const app = new HailuoApp({
    headless: false,  // Use visible browser to avoid redirect
    sessionPath: SESSION_PATH,
    downloadDir: OUTPUT_DIR,
    timeoutMs: 60000,
  });
  
  console.log('Initializing HailuoApp...');
  await app.init();
  
  const credits = await app.getCredits();
  console.log('Credits:', JSON.stringify(credits));
  
  console.log('\nNavigating to create page...');
  await app._navigateToCreate();
  
  console.log('\nFinding prompt input...');
  const textarea = await app._findPromptInput();
  if (!textarea) {
    console.error('ERROR: Could not find prompt input');
    await app.close();
    process.exit(1);
  }
  
  console.log('Filling prompt...');
  await textarea.click();
  await textarea.evaluate((el, text) => {
    el.textContent = text;
    el.innerHTML = '<p>' + text + '</p>';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, PROMPT);
  
  console.log('Submitting...');
  const btn = await app._findSubmitButton();
  if (btn) {
    await btn.click();
    console.log('Submitted!');
  } else {
    console.error('ERROR: Could not find submit button');
    await app.close();
    process.exit(1);
  }
  
  console.log('\nWaiting for video completion...');
  const videoUrl = await app._waitForCompletion({ maxWaitMs: 600000 });
  console.log('Video URL:', videoUrl);
  
  // Download video
  console.log('\nDownloading video...');
  const downloadPath = await app._downloadVideo(videoUrl, 'PW-06.mp4');
  console.log('Downloaded to:', downloadPath);
  
  await app.close();
  console.log('\n✅ PW-06 generated successfully!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
