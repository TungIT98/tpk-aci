#!/usr/bin/env node
/**
 * scripts/regen-pw01.js
 * Regenerate PW-01 source video with correct portrait aspect ratio (9:16).
 * PW-01 was generated in landscape (16:9) due to channel config error.
 * This script regenerates just the source video and replaces pw01-video.mp4.
 *
 * Run with: node scripts/regen-pw01.js
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

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

// Video prompt matching the productivity_worker channel style
// (generic workspace scene - pw01-video.mp4 was stock-like)
const PROMPT = `Professional workspace scene. Young professional sits at modern desk, laptop open. Hands typing quickly on keyboard. Screen shows emails and task list. Person handles email, marks complete, smiles. Clean organized desk, morning light, cinematic soft lighting, camera push-in effect. Portrait/vertical format.`;

// Alternative: specific 2-minute rule scene
// const PROMPT_2MIN = `Office worker sits at desk staring at long to-do list. Decides to tackle smallest task first. Completes it in under 2 minutes, feels relief. Motivated to start next small task. Modern workspace, clean desk, natural lighting, vertical video format.`;

async function main() {
  console.log('=== PW-01 Portrait Regeneration ===');
  console.log('Issue: pw01-video.mp4 generated as 16:9 landscape instead of 9:16 portrait');
  console.log('Fix: Regenerate with aspectRatio: 9:16\n');

  const { HailuoApp } = await import('../lib/hailuo-app.js');

  const app = new HailuoApp({
    headless: false, // Run visible for monitoring
    timeoutMs: 30000,
  });

  const pw01Dir = resolve(ROOT, 'output', 'PW-01');
  const backupPath = resolve(pw01Dir, 'pw01-video-LANDSCAPE-BAK.mp4');
  const newVideoPath = resolve(pw01Dir, 'pw01-video.mp4');

  const output = {
    status: 'unknown',
    oldVideo: null,
    newVideoPath: null,
    error: null,
    generatedAt: new Date().toISOString(),
  };

  try {
    await app.init();
    console.log('✓ Browser initialized');

    const loggedIn = await app.isLoggedIn();
    if (!loggedIn) {
      throw new Error('Not logged in. Run setup-hailuo-app-session.js first.');
    }
    console.log('✓ Logged in');

    // Check credits
    const credits = await app.getCredits();
    console.log('✓ Credits:', JSON.stringify(credits));

    // Check if original video exists
    if (existsSync(newVideoPath)) {
      console.log(`\nBacking up original landscape video:`);
      console.log(`  ${newVideoPath} -> ${backupPath}`);
      const { copyFileSync } = await import('fs');
      copyFileSync(newVideoPath, backupPath);
      output.oldVideo = backupPath;
    }

    // Generate new video in portrait mode
    console.log('\nSubmitting video generation (9:16 portrait)...');
    console.log('Prompt:', PROMPT.slice(0, 80) + '...');
    const result = await app.generateVideo({
      prompt: PROMPT,
      aspectRatio: '9:16', // KEY FIX: portrait not landscape
      filename: 'pw01-video.mp4',
      maxWaitMs: 15 * 60 * 1000, // 15 minutes max
    });

    output.status = 'success';
    output.newVideoPath = result.localPath;
    console.log('✓ Video generated!');
    console.log('  Local path:', result.localPath);

    // Move downloaded file to PW-01 directory if needed
    if (result.localPath && result.localPath !== newVideoPath) {
      const { copyFileSync, unlinkSync } = await import('fs');
      console.log(`Copying ${result.localPath} -> ${newVideoPath}`);
      copyFileSync(result.localPath, newVideoPath);
      // Remove temp download
      try { unlinkSync(result.localPath); } catch {}
    }

    console.log('\n⚠ Next step: Re-run video assembly with new source:');
    console.log('   ffmpeg -i output/PW-01/pw01-video.mp4 -i output/PW-01/audio.mp3');
    console.log('          -c:v libx264 -c:a aac output/PW-01/assembled.mp4');

  } catch (err) {
    output.status = 'error';
    output.error = err.message;
    console.error('\n✗ Error:', err.message);
  } finally {
    await app.close();
    console.log('✓ Browser closed');
  }

  // Save output
  const outDir = resolve(ROOT, 'output', 'PW-01');
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, 'regen-pw01-result.json');
  writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log('\nResult saved to:', outFile);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});