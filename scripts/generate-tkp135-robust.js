/**
 * scripts/generate-tkp135-robust.js
 * Robustly generate 6 videos for TKP-135 with proper completion detection.
 * Key fix: Before each submission, clear any existing video on the page,
 * so completion detection finds the NEW video, not a cached one.
 * 
 * Run: node scripts/generate-tkp135-robust.js
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

async function waitForNewVideo(page, previousVideoUrl, maxWaitMs = 15 * 60 * 1000, pollMs = 5000) {
  const deadline = Date.now() + maxWaitMs;
  log(`  Waiting for NEW video (previous: ${previousVideoUrl ? previousVideoUrl.slice(-20) : 'none'})...`);
  
  while (Date.now() < deadline) {
    // Check for any video element
    const videoSelectors = [
      'video[src*=".mp4"]',
      'video[src*="blob"]', 
      'a[href*=".mp4"]',
      'a[href*="/download"]',
    ];
    
    for (const sel of videoSelectors) {
      try {
        const count = await page.locator(sel).count();
        if (count > 0) {
          const el = page.locator(sel).first();
          let src = await el.getAttribute(sel.startsWith('a') ? 'href' : 'src').catch(() => null);
          
          if (src && src !== previousVideoUrl && (src.includes('.mp4') || src.includes('blob') || src.includes('video'))) {
            log(`  ✓ New video detected: ${src.slice(-50)}`);
            return src;
          }
        }
      } catch { /* try next */ }
    }
    
    // Also check for progress bar / processing indicator
    const status = await page.locator('[class*="progress"], [class*="processing"], [class*="generating"], [role="progressbar"]').count();
    const elapsed = Math.round((Date.now() - (deadline - maxWaitMs)) / 1000);
    log(`  [${elapsed}s] ${status > 0 ? 'Processing...' : 'Waiting for video...'}`);
    
    await new Promise(r => setTimeout(r, pollMs));
  }
  
  throw new Error('Video generation timed out');
}

async function generateSingleVideo(app, prompt, filename, aspectRatio = '9:16') {
  const { chromium } = await import('playwright');
  const page = app._page;
  const OUTPUT_DIR = resolve(ROOT, 'output', 'videos');
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Get URL of any existing video BEFORE submission
  let previousVideoUrl = null;
  try {
    const existingVideo = await page.locator('video[src], a[href*=".mp4"]').first();
    if (await existingVideo.count() > 0) {
      const tag = await existingVideo.evaluate(el => el.tagName);
      previousVideoUrl = await existingVideo.getAttribute(tag === 'A' ? 'href' : 'src').catch(() => null);
      log(`  Existing video found before submit: ${previousVideoUrl ? previousVideoUrl.slice(-30) : 'none'}`);
    }
  } catch { /* no existing video */ }

  // Submit the prompt
  await app._fillPromptAndSubmit({ prompt, aspectRatio });
  log('  Prompt submitted, waiting for new video...');

  // Wait for the NEW video to appear
  const videoUrl = await waitForNewVideo(page, previousVideoUrl);
  
  // Download
  const outputPath = resolve(OUTPUT_DIR, filename);
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFileSync } = await import('fs');
  writeFileSync(outputPath, buf);
  log(`  Downloaded ${(buf.length/1024/1024).toFixed(1)}MB → ${outputPath}`);
  
  return { localPath: outputPath, url: videoUrl };
}

async function main() {
  log('=== TKP-135: Generate 6 Topic Videos (Robust) ===');
  
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
      const { localPath, url } = await generateSingleVideo(app, prompt, filename, '9:16');
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      
      // Verify: check file exists and has reasonable size
      const fs = await import('fs');
      const stats = fs.statSync(localPath);
      if (stats.size < 500_000) {
        throw new Error(`Video too small (${stats.size} bytes) - likely corrupt`);
      }
      
      log(`✓ ${scriptId} generated in ${elapsed}s`);
      
      // Update script
      script.status = 'produced';
      script.local_path = localPath;
      script.video_url = url;
      script.generated_at = new Date().toISOString();
      writeFileSync(scriptPath, JSON.stringify(script, null, 2));
      
      results.push({ id: scriptId, status: 'success', path: localPath, sizeMb: (stats.size/1024/1024).toFixed(1), elapsed_s: elapsed });
      
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
    if (r.status === 'success') log(`  ✓ ${r.id} ${r.sizeMb}MB ${r.elapsed_s}s`);
    else log(`  ✗ ${r.id} → ${r.error}`);
  }

  const reportPath = resolve(ROOT, 'output', 'TKP-135-robust-report.json');
  writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  log(`Report: ${reportPath}`);

  await app.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  log('CRASH:', err.message);
  process.exit(1);
});
