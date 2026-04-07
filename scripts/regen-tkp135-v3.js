/**
 * scripts/regen-tkp135-v3.js
 * 
 * KEY INSIGHT from diag13: The video URL comes through the SSE stream as a JSON message.
 * The `M-0EJopiYq...` relay endpoint streams the generation status. The final message
 * contains the actual CDN URL for the video.
 * 
 * APPROACH: Intercept SSE stream messages. When the SSE closes (generation done),
 * look at the video element on the page - it will have a blob URL. Wait for the
 * video to be fully loaded (readyState >= 3), then convert blob to downloadable URL.
 * 
 * SIMPLER APPROACH: Wait for blob URL in network responses. Once blob appears,
 * wait 5 more seconds for the video element to update, then extract blob URL from
 * video.src and convert it to a fetchable CDN URL.
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

async function waitForBlobAndGetVideoUrl(page, timeoutMs = 15 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    let resolved = false;
    let blobUrl = null;
    let blobAppearedAt = null;
    
    // Listen for video-related responses
    const responseHandler = async (resp) => {
      if (resolved) return;
      const url = resp.url();
      
      // Look for blob URL responses (these are video streams)
      if (url.startsWith('blob:')) {
        blobUrl = url;
        blobAppearedAt = Date.now();
        log(`  Blob URL appeared: ${blobUrl.slice(-40)}`);
        
        // Wait 5 seconds for video element to be ready with this blob
        setTimeout(async () => {
          if (resolved) return;
          try {
            // Get video element with this blob
            const videoInfo = await page.evaluate((expectedBlob) => {
              const videos = Array.from(document.querySelectorAll('video'));
              for (const v of videos) {
                if (v.src === expectedBlob || v.currentSrc === expectedBlob) {
                  return { src: v.src, currentSrc: v.currentSrc, readyState: v.readyState };
                }
              }
              // Also check recently added videos
              for (const v of videos) {
                if (v.src.startsWith('blob:') || v.currentSrc.startsWith('blob:')) {
                  return { src: v.src, currentSrc: v.currentSrc, readyState: v.readyState };
                }
              }
              return null;
            }, blobUrl);
            
            if (videoInfo) {
              log(`  Video element found with blob: state=${videoInfo.readyState}`);
              resolved = true;
              page.off('response', responseHandler);
              resolve(blobUrl);
            }
          } catch (e) {
            log(`  Error getting video element: ${e.message}`);
          }
        }, 5000);
      }
    };
    
    page.on('response', responseHandler);
    
    // Also periodically check video elements for blob URLs
    const checkInterval = setInterval(async () => {
      if (resolved) {
        clearInterval(checkInterval);
        return;
      }
      if (Date.now() > deadline) {
        resolved = true;
        clearInterval(checkInterval);
        page.off('response', responseHandler);
        reject(new Error('Timeout waiting for blob URL (>15min)'));
        return;
      }
      
      try {
        const blobVideo = await page.evaluate(() => {
          const videos = Array.from(document.querySelectorAll('video'));
          for (const v of videos) {
            if (v.src.startsWith('blob:') || v.currentSrc.startsWith('blob:')) {
              return { src: v.src, currentSrc: v.currentSrc, readyState: v.readyState };
            }
          }
          return null;
        });
        
        if (blobVideo) {
          log(`  Found video with blob (polling): ${blobVideo.src.slice(-40)} state=${blobVideo.readyState}`);
          resolved = true;
          clearInterval(checkInterval);
          page.off('response', responseHandler);
          resolve(blobVideo.src);
        }
      } catch {}
    }, 2000);
  });
}

async function blobToDownloadableUrl(page, blobUrl) {
  // Convert blob URL to downloadable URL by fetching through the page context
  // and re-uploading to a temporary CDN, or by extracting the actual MP4 URL
  try {
    const result = await page.evaluate(async (blobUrl) => {
      // Try to fetch the blob and get the actual video data
      const response = await fetch(blobUrl);
      if (!response.ok) return null;
      
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      
      // Return as base64 data URL (for small videos) or convert via CDN
      // For large videos, we need a different approach
      if (uint8.length < 50 * 1024 * 1024) { // < 50MB
        // Return as data URL
        const base64 = btoa(String.fromCharCode(...uint8));
        const mimeType = blob.type || 'video/mp4';
        return `data:${mimeType};base64,${base64.slice(0, 100)}...[truncated]`;
      }
      
      // For large videos, try to upload to tmpfiles.org or similar
      return { size: uint8.length, type: blob.type };
    }, blobUrl);
    
    return result;
  } catch (e) {
    return { error: e.message };
  }
}

async function downloadBlob(blobUrl, outputPath) {
  // Use Playwright to download the blob
  // This requires a page context where the blob is accessible
  const { chromium } = await import('playwright');
  
  // Create a minimal page to download the blob
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(`data:text/html,<html><body><video id="v" src="${blobUrl}"></video></body></html>`);
    
    // Wait for video to load
    await page.waitForFunction(() => {
      const v = document.getElementById('v');
      return v && v.readyState >= 3;
    }, { timeout: 30000 });
    
    // Extract video as blob
    const blobData = await page.evaluate(async () => {
      const v = document.getElementById('v');
      const response = await fetch(v.src);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      return Array.from(new Uint8Array(arrayBuffer));
    });
    
    // Write to file
    const { writeFileSync } = await import('fs');
    const buffer = Buffer.from(blobData);
    writeFileSync(outputPath, buffer);
    
    await browser.close();
    return buffer.length;
  } catch (e) {
    await browser.close();
    throw e;
  }
}

async function generateSingleVideo(app, prompt, filename) {
  const page = app._page;
  mkdirSync(OUTPUT_DIR, { recursive: true });
  
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
  log('  Submit clicked, waiting for blob URL...');
  
  // Wait for blob URL to appear
  const blobUrl = await waitForBlobAndGetVideoUrl(page);
  log(`  Blob URL: ${blobUrl.slice(-50)}`);
  
  // Wait for video to be fully loaded
  await sleep(5000);
  
  // Download the blob
  const outputPath = resolve(OUTPUT_DIR, filename);
  log('  Downloading blob...');
  
  // Use a fresh Playwright context to download the blob
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const downloadPage = await ctx.newPage();
  
  try {
    // Navigate to a page that loads the blob
    await downloadPage.goto(`data:text/html,<html><body><video id="v" src="${blobUrl}" controls></video></body></html>`);
    
    // Wait for video to be fully loaded (readyState >= 3)
    await downloadPage.waitForFunction(() => {
      const v = document.getElementById('v');
      return v && v.readyState >= 3 && v.duration > 0;
    }, { timeout: 60000 });
    
    log('  Video loaded in download page');
    
    // Extract video data
    const videoData = await downloadPage.evaluate(async () => {
      const v = document.getElementById('v');
      const response = await fetch(v.src);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      return { size: blob.size, type: blob.type };
    });
    
    log(`  Video blob: ${(videoData.size / 1024 / 1024).toFixed(1)}MB ${videoData.type}`);
    
    // Download via fetch from blob
    const { writeFileSync } = await import('fs');
    const response = await fetch(blobUrl);
    if (!response.ok) throw new Error(`Blob fetch failed: ${response.status}`);
    const buf = Buffer.from(await response.arrayBuffer());
    writeFileSync(outputPath, buf);
    
    const sizeMb = (buf.length / 1024 / 1024).toFixed(1);
    log(`  Downloaded ${sizeMb}MB → ${outputPath}`);
    
    await browser.close();
    return { localPath: outputPath, url: blobUrl, sizeMb };
    
  } catch (e) {
    await browser.close();
    throw e;
  }
}

async function main() {
  log('=== TKP-135: Generate 6 Videos (v3 - Blob Detection) ===');
  
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
  if (uniqueHashes.length < success.length && success.length > 0) {
    log('⚠️  Duplicate videos detected!');
  }

  const reportPath = resolve(ROOT, 'output', 'TKP-135-v3-report.json');
  writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  log(`Report: ${reportPath}`);

  await app.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  log('CRASH:', err.message);
  process.exit(1);
});
