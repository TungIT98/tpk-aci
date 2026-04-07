/**
 * scripts/regen-tkp135-v5.js
 * 
 * CORRECT APPROACH:
 * 1. Submit prompt
 * 2. Wait for blob URL to appear on video element
 * 3. Use page.evaluate() to fetch the blob from WITHIN the browser context
 *    (blob URLs can only be fetched within their creating context)
 * 4. Convert ArrayBuffer to Node.js Buffer and save
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

async function waitForBlobUrl(page, timeoutMs = 15 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs;
  
  while (Date.now() < deadline) {
    // Check for video element with blob src
    const blobInfo = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      for (const v of videos) {
        const src = v.src || v.currentSrc || '';
        if (src.startsWith('blob:')) {
          return {
            src,
            readyState: v.readyState,
            duration: v.duration,
            videoWidth: v.videoWidth,
            videoHeight: v.videoHeight,
          };
        }
      }
      return null;
    });
    
    if (blobInfo) {
      log(`  Blob found: ${blobInfo.src.slice(-40)} readyState=${blobInfo.readyState} duration=${blobInfo.duration?.toFixed(1)}s`);
      
      // Wait for video to be fully loaded
      if (blobInfo.readyState >= 3 && blobInfo.duration > 0) {
        log(`  Video fully loaded!`);
        return blobInfo.src;
      } else {
        // Wait for load
        log(`  Waiting for video to load...`);
        await sleep(5000);
        
        // Re-check
        const recheck = await page.evaluate((blobSrc) => {
          const videos = Array.from(document.querySelectorAll('video'));
          for (const v of videos) {
            if ((v.src === blobSrc || v.currentSrc === blobSrc) && v.readyState >= 3 && v.duration > 0) {
              return { src: v.src, readyState: v.readyState, duration: v.duration };
            }
          }
          return null;
        }, blobInfo.src);
        
        if (recheck) {
          log(`  Video ready!`);
          return blobInfo.src;
        }
      }
    }
    
    const elapsed = Math.round((Date.now() - (deadline - timeoutMs)) / 1000);
    if (elapsed % 15 === 0) {
      log(`  [${elapsed}s] Still waiting for blob...`);
    }
    await sleep(2000);
  }
  
  throw new Error('Timeout: No blob URL appeared on video element (>15min)');
}

async function downloadVideoFromBlob(page, blobUrl, outputPath) {
  log('  Extracting video bytes from blob...');
  
  const result = await page.evaluate(async (blobUrl) => {
    try {
      const response = await fetch(blobUrl);
      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      const contentType = response.headers.get('content-type') || 'video/mp4';
      const arrayBuffer = await response.arrayBuffer();
      
      return {
        success: true,
        contentType,
        size: arrayBuffer.byteLength,
        // Convert ArrayBuffer to base64 for transport
        // For large videos, we'll stream in chunks
        data: Array.from(new Uint8Array(arrayBuffer)),
      };
    } catch (e) {
      return { error: e.message };
    }
  }, blobUrl);
  
  if (result.error) {
    throw new Error(`Blob fetch failed: ${result.error}`);
  }
  
  log(`  Video bytes: ${(result.size / 1024 / 1024).toFixed(1)}MB ${result.contentType}`);
  
  // Convert to Buffer and save
  const buffer = Buffer.from(result.data);
  writeFileSync(outputPath, buffer);
  
  const sizeMb = (buffer.length / 1024 / 1024).toFixed(1);
  log(`  Saved ${sizeMb}MB → ${outputPath}`);
  
  return { sizeMb };
}

async function generateSingleVideo(app, prompt, filename) {
  const page = app._page;
  mkdirSync(OUTPUT_DIR, { recursive: true });
  
  const outputPath = resolve(OUTPUT_DIR, filename);
  
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
  log('  Submit clicked, waiting for blob...');
  
  // Wait for blob URL on video element
  const blobUrl = await waitForBlobUrl(page);
  log(`  Blob URL ready: ${blobUrl.slice(-50)}`);
  
  // Download from blob
  const { sizeMb } = await downloadVideoFromBlob(page, blobUrl, outputPath);
  
  return { localPath: outputPath, url: blobUrl, sizeMb };
}

async function main() {
  log('=== TKP-135: Generate 6 Videos (v5 - Blob Fetch) ===');
  
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

  const reportPath = resolve(ROOT, 'output', 'TKP-135-v5-report.json');
  writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  log(`Report: ${reportPath}`);

  await app.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  log('CRASH:', err.message);
  process.exit(1);
});
