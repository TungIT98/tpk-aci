#!/usr/bin/env node
/**
 * scripts/gen_vid001.js
 * Generate VID-001 video using Hailuo App browser automation.
 * Run with: node scripts/gen_vid001.js
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = 'C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI';

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
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
}

const env = loadEnv();
const { HailuoApp } = await import('../lib/hailuo-app.js');

const PROMPT = `Young professional sits at desk, stares at overflowing inbox [Static shot]. Opens laptop with sigh. Handles first email quickly [Tracking shot following hands on keyboard]. Smiles and marks complete [Push in on screen showing checkmark]. Handles second email, third email [Montage of quick wins]. Closes laptop satisfied, leans back [Pull out to show organized desk]. Modern office, bright morning light, productivity mood, dynamic camera movements.`;

async function main() {
  console.log('=== Hailuo VID-001 Generator ===');
  console.log('Prompt:', PROMPT.slice(0, 80) + '...');
  
  const app = new HailuoApp({
    headless: false, // Run visible so we can see it
    timeoutMs: 30000,
  });

  const output = { status: 'unknown', videoUrl: null, localPath: null, error: null, generatedAt: new Date().toISOString() };

  try {
    await app.init();
    console.log('✓ Browser initialized');

    const loggedIn = await app.isLoggedIn();
    if (!loggedIn) throw new Error('Not logged in. Run setup-hailuo-app-session.js first.');
    console.log('✓ Logged in');

    // Check credits
    const credits = await app.getCredits();
    console.log('✓ Credits:', JSON.stringify(credits));

    // Generate video - this handles the full flow including completion wait
    console.log('Submitting video generation (may take 3-10 minutes)...');
    const result = await app.generateVideo({
      prompt: PROMPT,
      aspectRatio: '16:9',
      filename: 'VID-001-productivity-worker.mp4',
      maxWaitMs: 15 * 60 * 1000, // 15 minutes max
    });
    
    output.status = 'success';
    output.localPath = result.localPath;
    output.videoUrl = result.url;
    console.log('✓ Video generated!');
    console.log('  Local path:', result.localPath);
    console.log('  URL:', result.url);

  } catch (err) {
    output.status = 'error';
    output.error = err.message;
    console.error('✗ Error:', err.message);
  } finally {
    await app.close();
    console.log('✓ Browser closed');
  }

  // Save output
  const outDir = resolve(ROOT, 'output', 'videos');
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, 'VID-001-result.json');
  writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log('Result saved to:', outFile);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
