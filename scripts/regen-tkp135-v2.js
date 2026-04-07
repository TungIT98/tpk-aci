/**
 * scripts/regen-tkp135-v2.js
 * 
 * ROOT CAUSE FIX: The completion detector finds PRE-EXISTING videos on the page
 * (from previous sessions) IMMEDIATELY after submit, before the new video is ready.
 * 
 * FIX: Wait for the page to transition to "processing" state, THEN wait for
 * completion, then detect the NEW video by comparing against pre-submission URLs.
 * 
 * Also: Since Hailuo may cache videos per prompt, we must wait for GENERATION
 * to complete before attempting download detection.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

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

function log(...args) {
  console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args);
}

const SCRIPTS = ['AESTH-01', 'COM-01', 'LIFE-01', 'MOT-01', 'MOVIE-01', 'TECH-01'];
const SCRIPT_DIR = resolve(ROOT, 'scripts', 'pending');
const OUTPUT_DIR = resolve(ROOT, 'output', 'videos');
const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getVideoUrls(page) {
  return page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    const links = Array.from(document.querySelectorAll('a[href*=".mp4"]'));
    return {
      videoSrcs: videos.map(v => v.src?.slice(-40) || ''),
      linkHrefs: links.map(a => a.href?.slice(-40) || ''),
    };
  });
}

async function waitForGenerationStart(page, timeoutMs = 30000) {
  // Wait for any loading/processing indicator to appear (confirms job started)
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // Check for loading indicators
    const loading = await page.evaluate(() => {
      const els = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="processing"], [class*="generating"], [class*="progress"]');
      return els.length;
    });
    if (loading > 0) {
      log('  Generation STARTED (loading indicator detected)');
      return true;
    }
    await sleep(1000);
  }
  log('  Warning: No loading indicator detected (job may still have started)');
  return true;
}

async function waitForNewVideo(page, beforeUrls, maxWaitMs = 15 * 60 * 1000) {
  const deadline = Date.now() + maxWaitMs;
  log(`  Waiting for new video (before=${beforeUrls.videoSrcs[0]?.slice(-20) || 'none'})...`);
  
  while (Date.now() < deadline) {
    const current = await getVideoUrls(page);
    
    // Check if any video URL is NEW (not in beforeUrls)
    const allBefore = [...beforeUrls.videoSrcs, ...beforeUrls.linkHrefs];
    const newVideos = current.videoSrcs.filter(src => src && !allBefore.some(b => b && b.includes(src.slice(0, 20))));
    
    if (newVideos.length > 0) {
      const newUrl = current.videoSrcs.find(src => src && !allBefore.some(b => b && b.includes(src.slice(0, 20))));
      log(`  NEW VIDEO DETECTED: ${newUrl?.slice(-40)}`);
      return `https://cdn.hailuoai.video/open-hailuo-video-web/public_assets/${newUrl}`;
    }
    
    // Check for download links
    const newLinks = current.linkHrefs.filter(h => h && !allBefore.some(b => b && b.includes(h.slice(0, 20))));
    if (newLinks.length > 0) {
      log(`  NEW LINK DETECTED: ${newLinks[0].slice(-40)}`);
      return newLinks[0].startsWith('http') ? newLinks[0] : `https://cdn.hailuoai.video/open-hailuo-video-web/public_assets/${newLinks[0]}`;
    }
    
    // Check for blob URLs
    const blobs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('video'))
        .map(v => v.src)
        .filter(s => s?.startsWith('blob:'));
    });
    const newBlob = blobs.find(b => !allBefore.includes(b));
    if (newBlob) {
      log(`  BLOB URL: ${newBlob.slice(-40)}`);
      // Blob can't be fetched directly; wait for the MP4 to appear
    }
    
    const elapsed = Math.round((Date.now() - (deadline - maxWaitMs)) / 1000);
    log(`  [${elapsed}s] Still waiting... (${current.videoSrcs.length} videos on page)`);
    await sleep(5000);
  }
  
  throw new Error('Timeout waiting for new video (>15min)');
}

async function generateSingleVideo(app, prompt, filename) {
  const page = app._page;
  mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Navigate to create page
  log('  Navigating to create page...');
  await page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(3000);
  
  // Capture video URLs BEFORE submission
  const beforeUrls = await getVideoUrls(page);
  log(`  Before: ${beforeUrls.videoSrcs.length} videos on page`);
  
  // Fill prompt
  const textarea = page.locator('div[contenteditable]').first();
  await textarea.evaluate(el => {
    el.textContent = '';
    el.focus();
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await textarea.fill(prompt.slice(0, 500));
  await sleep(500);
  log('  Prompt filled');
  
  // Submit
  const submitBtn = page.locator('button.new-color-btn-bg').first();
  await submitBtn.click({ force: true });
  log('  Submit clicked');
  
  // Wait for generation to START (loading indicator)
  await waitForGenerationStart(page);
  
  // Wait for NEW video to appear
  const videoUrl = await waitForNewVideo(page, beforeUrls);
  log(`  Video ready: ${videoUrl.slice(-60)}`);
  
  // Download
  const outputPath = resolve(OUTPUT_DIR, filename);
  log(`  Downloading...`);
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outputPath, buf);
  const sizeMb = (buf.length / 1024 / 1024).toFixed(1);
  log(`  Downloaded ${sizeMb}MB → ${outputPath}`);
  
  return { localPath: outputPath, url: videoUrl, sizeMb };
}

async function main() {
  log('=== TKP-135: Generate 6 Videos (v2 - Fixed Completion Detection) ===');
  
  if (!existsSync(SESSION_PATH)) {
    log('ERROR: No Hailuo session. Run: node scripts/setup-hailuo-app-session.js');
    process.exit(1);
  }

  let HailuoApp;
  try {
    ({ HailuoApp } = await import('../lib/hailuo-app.js'));
  } catch (e) {
    log('ERROR importing HailuoApp:', e.message);
    process.exit(1);
  }

  const app = new HailuoApp({ headless: true, sessionPath: SESSION_PATH, timeoutMs: 30_000 });
  await app.init();
  
  const loggedIn = await app.isLoggedIn();
  if (!loggedIn) {
    log('ERROR: Not logged in. Run: node scripts/setup-hailuo-app-session.js');
    await app.close();
    process.exit(1);
  }
  log('✓ Hailuo session valid');

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = [];
  
  for (const scriptId of SCRIPTS) {
    log(`\n${'='.repeat(50)}`);
    log(`Processing: ${scriptId}`);
    
    const scriptPath = resolve(SCRIPT_DIR, `${scriptId}.json`);
    const script = JSON.parse(readFileSync(scriptPath, 'utf-8'));
    log(`Title: ${script.title}`);
    
    const prompt = script.prompt_for_hailuo;
    const filename = `${scriptId}.mp4`;
    
    try {
      const startTime = Date.now();
      const { localPath, url, sizeMb } = await generateSingleVideo(app, prompt, filename);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      
      // Quick hash
      const { createHash } = await import('crypto');
      const sample = readFileSync(localPath).slice(0, 65536);
      const hash = createHash('md5').update(sample).digest('hex');
      log(`  Hash(64K): ${hash}`);
      
      script.status = 'produced';
      script.local_path = localPath;
      script.video_url = url;
      script.generated_at = new Date().toISOString();
      script.hash_64k = hash;
      writeFileSync(scriptPath, JSON.stringify(script, null, 2));
      
      results.push({ id: scriptId, status: 'success', path: localPath, sizeMb, hash, elapsed_s: elapsed });
      log(`✓ ${scriptId} done in ${elapsed}s`);
      
    } catch (e) {
      log(`✗ ${scriptId} failed: ${e.message}`);
      script.status = 'error';
      script.error = e.message;
      writeFileSync(scriptPath, JSON.stringify(script, null, 2));
      results.push({ id: scriptId, status: 'error', error: e.message });
    }
  }

  // Summary
  log('\n' + '='.repeat(50));
  log('GENERATION SUMMARY');
  const success = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'error');
  log(`Total: ${results.length} | Success: ${success.length} | Failed: ${failed.length}`);
  for (const r of results) {
    if (r.status === 'success') log(`  ✓ ${r.id} ${r.sizeMb}MB hash=${r.hash?.slice(0,8)} ${r.elapsed_s}s`);
    else log(`  ✗ ${r.id} → ${r.error}`);
  }

  const uniqueHashes = [...new Set(success.map(r => r.hash))];
  log(`\nUnique video hashes: ${uniqueHashes.length} / ${success.length}`);
  if (uniqueHashes.length < success.length && success.length > 0) {
    log('⚠️  WARNING: Duplicate videos detected!');
  }

  const reportPath = resolve(ROOT, 'output', 'TKP-135-v2-report.json');
  writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  log(`Report: ${reportPath}`);

  await app.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  log('CRASH:', err.message);
  process.exit(1);
});
