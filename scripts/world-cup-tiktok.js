#!/usr/bin/env node
/**
 * scripts/world-cup-tiktok.js
 * World Cup TikTok video pipeline — creates 12s videos and uploads to TikTok.
 *
 * Flow:
 *   1. Read WC-0X.json script
 *   2. Split multi-shot prompt into 2 clips (build-up + climax)
 *   3. Generate each clip via HailuoApp browser automation
 *   4. Concatenate both clips → 12s final video
 *   5. Upload to TikTok
 *
 * Usage:
 *   node scripts/world-cup-tiktok.js WC-01          Create WC-01 video
 *   node scripts/world-cup-tiktok.js WC-01 --skip-upload  Create video only (no upload)
 *   node scripts/world-cup-tiktok.js all            Create all WC-0X videos
 *
 * Prerequisites:
 *   - HailuoApp session: node scripts/setup-hailuo-app-session.js
 *   - TikTok OAuth: node scripts/oauth-tiktok.js --auto
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(resolve(ROOT, '.env'), 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  } catch { /* ignore */ }
  return env;
}

const env = loadEnv();

// ---------------------------------------------------------------------------
// FFmpeg helpers
// ---------------------------------------------------------------------------

async function ffmpeg(args, { quiet = true } = {}) {
  const cmd = `ffmpeg -y ${quiet ? '-loglevel error ' : ''}${args}`;
  try {
    const { stderr } = await execAsync(cmd, { timeout: 300_000 });
    return { stderr };
  } catch (err) {
    throw new Error(`FFmpeg failed:\n  CMD: ${cmd}\n  STDERR: ${err.stderr ?? err.message}`);
  }
}

/**
 * Concatenate two video files into one using FFmpeg.
 * Handles different codecs/formats by re-encoding.
 */
async function concatenateVideos(clip1Path, clip2Path, outputPath) {
  console.log(`[FFmpeg] Concatenating clips → ${basename(outputPath)}`);

  // Use filter_complex for reliable concatenation
  await ffmpeg(
    `-i "${clip1Path}" -i "${clip2Path}" ` +
    `-filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]" ` +
    `-map "[outv]" -map "[outa]" ` +
    `-c:v libx264 -preset fast -crf 23 ` +
    `-c:a aac -b:a 128k ` +
    `-r 30 ` +
    `"${outputPath}"`
  );

  // Verify output duration
  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${outputPath}"`,
    { timeout: 30_000 }
  );
  const duration = parseFloat(stdout.trim());
  console.log(`[FFmpeg] Output duration: ${duration.toFixed(1)}s`);
  return duration;
}

// ---------------------------------------------------------------------------
// Prompt splitter — split a multi-shot prompt into 2 clips
// ---------------------------------------------------------------------------

/**
 * Split a multi-shot Hailuo prompt into two 6-second clip prompts.
 *
 * Strategy:
 *   - Look for "[Static shot", "[Tracking shot", "[Push in", "[Pull out" as shot delimiters
 *   - Group consecutive shots into 2 approximately equal halves
 *   - Each half becomes one 6-second clip
 */
function splitPromptForTwoClips(multiShotPrompt) {
  // Split on shot markers
  const shotMarkers = [
    '[Static shot', '[Tracking shot', '[Push in', '[Pull out',
    '[Wide shot', '[Close-up', '[Medium shot', '[Over-the-shoulder'
  ];

  // Find all shot boundaries
  let parts = [multiShotPrompt.trim()];
  for (const marker of shotMarkers) {
    const newParts = [];
    for (const part of parts) {
      const split = part.split(marker);
      newParts.push(split[0].trim());
      if (split.length > 1) {
        newParts.push(marker + split.slice(1).join(marker));
      }
    }
    parts = newParts.filter(p => p.length > 0);
  }

  // Remove the leading scene description from subsequent parts (keep shot directives)
  const sceneDesc = parts[0].split(/\[(Static|Tracking|Push|Pull|Wide|Close|Medium|Over)/)[0].trim();

  const clips = [];
  const midpoint = Math.ceil(parts.length / 2);

  // Clip 1: parts[0] through parts[midpoint-1]
  const clip1Parts = parts.slice(0, midpoint);
  clips.push(clip1Parts.join(' '));

  // Clip 2: scene description + parts[midpoint...]
  const clip2Parts = [sceneDesc, ...parts.slice(midpoint)];
  clips.push(clip2Parts.join(' '));

  console.log(`[PromptSplit] Split into ${parts.length} shots → 2 clips`);
  clips.forEach((c, i) => console.log(`  Clip ${i + 1}: ${c.slice(0, 100)}...`));

  return clips;
}

// ---------------------------------------------------------------------------
// HailuoApp wrapper (lazy import)
// ---------------------------------------------------------------------------

async function getHailuoApp() {
  const { HailuoApp } = await import('../lib/hailuo-app.js');
  const app = new HailuoApp({
    sessionPath:  env.HAILUO_SESSION_PATH || resolve(ROOT, '.hailuo-session.json'),
    downloadDir:  resolve(ROOT, 'output', 'worldcup'),
    headless:     env.HAILUO_HEADLESS !== 'false',
  });
  await app.init();
  return app;
}

// ---------------------------------------------------------------------------
// TikTok uploader (lazy import)
// ---------------------------------------------------------------------------

async function getTikTokUploader() {
  const { TikTokUploader } = await import('../lib/upload/tiktok.js');
  return new TikTokUploader();
}

// ---------------------------------------------------------------------------
// Main pipeline per script
// ---------------------------------------------------------------------------

async function processScript(scriptId, { skipUpload = false } = {}) {
  const scriptPath = resolve(ROOT, 'scripts', 'pending', `${scriptId}.json`);
  if (!existsSync(scriptPath)) {
    console.error(`[Error] Script not found: ${scriptPath}`);
    return false;
  }

  const script = JSON.parse(readFileSync(scriptPath, 'utf-8'));
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${script.id} — "${script.title}"`);
  console.log(`${'='.repeat(60)}`);

  // Ensure output dir
  const outDir = resolve(ROOT, 'output', script.id);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // Step 1: Split prompt
  const [clip1Prompt, clip2Prompt] = splitPromptForTwoClips(script.prompt_for_hailuo);

  // Step 2: Generate clips
  let clip1Path, clip2Path;

  try {
    const app = await getHailuoApp();

    console.log(`\n[Step 1] Generating Clip 1 (6s build-up)...`);
    const r1 = await app.generateVideo({
      prompt: clip1Prompt,
      aspectRatio: '9:16',
      filename: `${script.id}-clip1.mp4`,
    });
    clip1Path = r1.localPath;
    console.log(`  → Clip 1 saved: ${clip1Path}`);

    console.log(`\n[Step 2] Generating Clip 2 (6s climax)...`);
    const r2 = await app.generateVideo({
      prompt: clip2Prompt,
      aspectRatio: '9:16',
      filename: `${script.id}-clip2.mp4`,
    });
    clip2Path = r2.localPath;
    console.log(`  → Clip 2 saved: ${clip2Path}`);

    await app.close?.();
  } catch (err) {
    console.error(`[HailuoApp] Generation failed: ${err.message}`);
    // If clips already exist on disk, try to continue
    const alt1 = resolve(ROOT, 'output', 'worldcup', `${script.id}-clip1.mp4`);
    const alt2 = resolve(ROOT, 'output', 'worldcup', `${script.id}-clip2.mp4`);
    if (existsSync(alt1) && existsSync(alt2)) {
      clip1Path = alt1; clip2Path = alt2;
      console.log('[Recovery] Using previously generated clips from output/worldcup/');
    } else {
      throw err;
    }
  }

  // Step 3: Concatenate
  const finalPath = resolve(outDir, 'final_12s.mp4');
  console.log(`\n[Step 3] Concatenating → 12s final video...`);
  const duration = await concatenateVideos(clip1Path, clip2Path, finalPath);

  if (Math.abs(duration - 12) > 2) {
    console.warn(`[Warning] Final video is ${duration.toFixed(1)}s (expected ~12s)`);
  }

  // Copy clip1 as thumbnail candidate
  const thumbPath = resolve(outDir, 'thumbnail.jpg');
  try {
    await ffmpeg(`-i "${finalPath}" -vf "select=eq(n\\,0)" -vframes 1 "${thumbPath}"`, { quiet: true });
    console.log(`[Thumb] Extracted: ${thumbPath}`);
  } catch { /* non-fatal */ }

  console.log(`\n[Done] ${script.id} final video: ${finalPath}`);

  // Step 4: Upload to TikTok
  if (!skipUpload) {
    console.log(`\n[Step 4] Uploading to TikTok...`);
    try {
      const uploader = await getTikTokUploader();
      const result = await uploader.upload({
        videoPath: finalPath,
        title: script.title,
        description: script.script.slice(0, 150),
        tags: script.tags || [],
        thumbnailPath: existsSync(thumbPath) ? thumbPath : undefined,
        registryId: script.id,
      });
      console.log(`[TikTok] Uploaded! Result:`, JSON.stringify(result).slice(0, 200));
    } catch (err) {
      console.error(`[TikTok] Upload failed: ${err.message}`);
      console.log('[TikTok] Video saved locally. Upload manually when OAuth is configured.');
    }
  } else {
    console.log(`[Skip] Upload skipped (--skip-upload flag)`);
  }

  return true;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const skipUpload = args.includes('--skip-upload');
const filteredArgs = args.filter(a => !a.startsWith('--'));

async function main() {
  if (filteredArgs.length === 0) {
    console.error('Usage: node scripts/world-cup-tiktok.js <script-id> [--skip-upload]');
    console.error('       node scripts/world-cup-tiktok.js all [--skip-upload]');
    console.error('Examples:');
    console.error('  node scripts/world-cup-tiktok.js WC-01');
    console.error('  node scripts/world-cup-tiktok.js all --skip-upload');
    process.exit(1);
  }

  const targets = filteredArgs[0] === 'all'
    ? ['WC-01', 'WC-02', 'WC-03', 'WC-04', 'WC-05']
    : filteredArgs;

  console.log(`World Cup TikTok Pipeline`);
  console.log(`Scripts: ${targets.join(', ')}`);
  console.log(`Upload:  ${skipUpload ? 'DISABLED (--skip-upload)' : 'ENABLED'}`);
  console.log('');

  let success = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      const ok = await processScript(target, { skipUpload });
      if (ok) success++; else failed++;
    } catch (err) {
      console.error(`[FATAL] ${target}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Pipeline complete: ${success} succeeded, ${failed} failed`);
  console.log(`${'='.repeat(60)}`);
}

main().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});
