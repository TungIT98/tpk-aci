/**
 * scripts/regen-tkp135-v4.js
 * 
 * FIXED APPROACH:
 * 1. Submit prompt
 * 2. Wait for blob URL to appear in network responses
 * 3. When blob appears, wait 10s for video element to be ready
 * 4. Use page.route() to intercept the video fetch and save to file
 *    (route.fulfill with modified response containing video data)
 * 
 * Actually: Use page.route() to intercept when the video blob is fetched,
 * and simultaneously save the response body.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';

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

async function generateSingleVideo(app, prompt, filename) {
  const page = app._page;
  mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const outputPath = resolve(OUTPUT_DIR, filename);
  
  // Set up download tracking
  let downloadResolve, downloadReject;
  let videoData = null;
  
  // Set up route interception BEFORE submission
  // Intercept blob URLs - capture their response body
  const blobInterceptors = [];
  
  await page.route('blob:**', async (route, request) => {
    try {
      // Fetch the actual blob response
      const resp = await route.fetch();
      const buffer = await resp.body();
      const ct = resp.headers()['content-type'] || 'video/mp4';
      videoData = { buffer, contentType: ct };
      log(`  Blob intercepted: ${(buffer.length / 1024 / 1024).toFixed(1)}MB ${ct}`);
      await route.fulfill({ status: 200, contentType: ct, body: buffer });
    } catch (e) {
      log(`  Blob intercept error: ${e.message}`);
      await route.abort();
    }
  });
  
  // Navigate to create page
  log('  Navigating to create page...');
  await page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(3000);
  
  // Fill prompt
  const textarea = page.locator('div[contenteditable]').first();
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await sleep(300);
  await page.keyboard.type(prompt.slice(0, 500), { delay: 30 });
  await sleep(500);
  log('  Prompt filled');
  
  // Submit
  await page.evaluate(() => {
    const btn = document.querySelector('button.new-color-btn-bg');
    btn?.scrollIntoView({ block: 'center' });
    btn?.click();
  });
  log('  Submit clicked, waiting for video...');
  
  // Wait for blob interception or video element with blob
  const deadline = Date.now() + 15 * 60 * 1000;
  
  while (!videoData && Date.now() < deadline) {
    await sleep(2000);
    
    // Check if video blob appeared via page evaluation
    const hasBlob = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      return videos.some(v => v.src.startsWith('blob:') || v.currentSrc.startsWith('blob:'));
    });
    
    if (hasBlob && !videoData) {
      log('  Blob URL found on page, waiting for download...');
      // Give it time to load the blob fully
      await sleep(10000);
      
      if (videoData) {
        log(`  Video data captured: ${(videoData.buffer.length / 1024 / 1024).toFixed(1)}MB`);
        break;
      }
    }
    
    const elapsed = Math.round((Date.now() - (deadline - 15 * 60 * 1000)) / 1000);
    log(`  [${elapsed}s] Waiting for video...${videoData ? ' GOT IT' : ''}`);
  }
  
  if (!videoData) {
    throw new Error('Video generation timeout (>15min) - no blob data captured');
  }
  
  // Remove the route interceptor
  await page.unroute('blob:**');
  
  // Save video data to file
  writeFileSync(outputPath, Buffer.from(videoData.buffer));
  const sizeMb = (videoData.buffer.length / 1024 / 1024).toFixed(1);
  log(`  Saved ${sizeMb}MB → ${outputPath}`);
  
  return { localPath: outputPath, url: 'blob:captured', sizeMb };
}

async function main() {
  log('=== TKP-135: Generate 6 Videos (v4 - Blob Interception) ===');
  
  if (!existsSync(SESSION_PATH)) {
    log('ERROR: No Hailuo session. Run: node scripts/hailuo-auto-login.js');
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
    log('ERROR: Not logged in. Run: node scripts/hailuo-auto-login.js');
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
      
      // Quick hash (first 64KB)
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

  const reportPath = resolve(ROOT, 'output', 'TKP-135-v4-report.json');
  writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  log(`Report: ${reportPath}`);

  await app.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  log('CRASH:', err.message);
  process.exit(1);
});
