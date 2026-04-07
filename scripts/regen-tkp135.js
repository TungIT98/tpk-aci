/**
 * scripts/regen-tkp135.js
 * Fix: Ensure each submission waits for a NEW video, not a cached one.
 * Strategy: Before submit, note any existing video URL. After submit, keep polling
 * until a DIFFERENT video URL appears (not the same cached one).
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

async function getAnyVideoUrl(page) {
  const selectors = [
    { sel: 'a[href*=".mp4"]', attr: 'href' },
    { sel: 'video[src*=".mp4"]', attr: 'src' },
    { sel: 'video[src*="blob"]', attr: 'src' },
  ];
  for (const { sel, attr } of selectors) {
    try {
      const count = await page.locator(sel).count();
      if (count > 0) {
        const val = await page.locator(sel).first().getAttribute(attr).catch(() => null);
        if (val && (val.includes('.mp4') || val.includes('blob'))) return val;
      }
    } catch {}
  }
  return null;
}

async function waitForDifferentVideo(page, previousUrl, maxWaitMs = 15 * 60 * 1000, pollMs = 5000) {
  const deadline = Date.now() + maxWaitMs;
  const prev = previousUrl || '';
  log(`  Waiting for video different from: ${prev.slice(-30) || 'none'}`);
  
  while (Date.now() < deadline) {
    const url = await getAnyVideoUrl(page);
    if (url && url !== previousUrl) {
      log(`  ✓ NEW video appeared: ${url.slice(-50)}`);
      return url;
    }
    
    // Check for progress / processing
    let status = '';
    try {
      const prog = await page.locator('[class*="progress"], [class*="processing"], [class*="generating"], [role="progressbar"]').count();
      const loadingEl = await page.locator('[class*="loading"], [class*="spinner"]').count();
      status = prog > 0 ? 'Processing...' : loadingEl > 0 ? 'Loading...' : 'Waiting...';
    } catch {}
    
    const elapsed = Math.round((Date.now() - (deadline - maxWaitMs)) / 1000);
    log(`  [${elapsed}s] ${status}`);
    await sleep(pollMs);
  }
  throw new Error('Video generation timed out (>15min)');
}

async function main() {
  log('=== TKP-135: Regenerate 6 Videos (Fixed Completion Detection) ===');
  
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

  // Track the last known video URL to detect new ones
  let lastVideoUrl = null;
  
  // Get initial video URL (from previous session) before any new submissions
  lastVideoUrl = await getAnyVideoUrl(app._page);
  log(`Initial cached video: ${lastVideoUrl ? lastVideoUrl.slice(-30) : 'none'}`);

  const results = [];
  
  for (const scriptId of SCRIPTS) {
    log(`\n${'='.repeat(50)}`);
    log(`Processing: ${scriptId}`);
    
    const scriptPath = resolve(SCRIPT_DIR, `${scriptId}.json`);
    const script = JSON.parse(readFileSync(scriptPath, 'utf-8'));
    log(`Title: ${script.title}`);
    
    const prompt = script.prompt_for_hailuo;
    const filename = `${scriptId}.mp4`;
    
    // Navigate to a FRESH create page to avoid cached video confusion
    log('  Navigating to fresh create page...');
    try {
      await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(3000);
    } catch (e) {
      log(`  Nav warning: ${e.message.slice(0, 80)}`);
    }
    
    // Get video URL BEFORE this submission (should be same as lastVideoUrl)
    const beforeUrl = await getAnyVideoUrl(app._page);
    log(`  Before submit video: ${beforeUrl ? beforeUrl.slice(-30) : 'none'}`);
    
    try {
      const startTime = Date.now();
      
      // Submit the prompt
      log('  Filling prompt...');
      await app._fillPromptAndSubmit({ prompt, aspectRatio: '9:16' });
      log('  Prompt submitted, waiting for NEW video...');
      
      // Wait for a DIFFERENT video URL than before submission
      const beforeSubmitUrl = beforeUrl; // the URL visible before this job
      let newVideoUrl = null;
      let attempt = 0;
      
      // Poll until we see a different URL or timeout
      while (attempt < 180) { // 180 × 5s = 15 min max
        await sleep(5000);
        const currentUrl = await getAnyVideoUrl(app._page);
        
        // Check if there's a NEW video (different from beforeSubmitUrl)
        if (currentUrl && currentUrl !== beforeSubmitUrl) {
          newVideoUrl = currentUrl;
          break;
        }
        
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const status = await app._getGenerationStatus().catch(() => null);
        log(`  [${elapsed}s] ${status || 'Waiting for new video...'}`);
        attempt++;
      }
      
      if (!newVideoUrl) {
        throw new Error('No new video appeared after submission (timeout)');
      }
      
      log(`  Video ready: ${newVideoUrl.slice(-50)}`);
      
      // Download
      const outputPath = resolve(OUTPUT_DIR, filename);
      log(`  Downloading...`);
      const { writeFileSync: wfs } = await import('fs');
      const res = await fetch(newVideoUrl);
      if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      wfs(outputPath, buf);
      
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const sizeMb = (buf.length / 1024 / 1024).toFixed(1);
      log(`  ✓ ${scriptId} generated in ${elapsed}s (${sizeMb}MB)`);
      
      // Verify hash (first 64KB)
      const { createHash } = await import('crypto');
      const { readFileSync: rfs } = await import('fs');
      const sample = rfs(outputPath).slice(0, 65536);
      const hash = createHash('md5').update(sample).digest('hex');
      log(`  Hash: ${hash}`);
      
      // Update last known URL
      lastVideoUrl = newVideoUrl;
      
      // Update script
      script.status = 'produced';
      script.local_path = outputPath;
      script.video_url = newVideoUrl;
      script.generated_at = new Date().toISOString();
      script.hash_64k = hash;
      wfs(scriptPath, JSON.stringify(script, null, 2));
      
      results.push({ id: scriptId, status: 'success', path: outputPath, sizeMb, hash, elapsed_s: elapsed });
      
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
    if (r.status === 'success') log(`  ✓ ${r.id} ${r.sizeMb}MB hash=${r.hash.slice(0,8)}... ${r.elapsed_s}s`);
    else log(`  ✗ ${r.id} → ${r.error}`);
  }

  const reportPath = resolve(ROOT, 'output', 'TKP-135-regen-report.json');
  writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  log(`Report: ${reportPath}`);

  await app.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  log('CRASH:', err.message);
  process.exit(1);
});
