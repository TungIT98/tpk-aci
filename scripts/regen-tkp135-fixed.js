/**
 * scripts/regen-tkp135-fixed.js
 * FIXED: Detect video from network responses, not DOM polling.
 * After submit, intercept network responses for the actual video URL.
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

async function waitForVideoUrlFromNetwork(page, maxWaitMs = 15 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + maxWaitMs;
    let resolved = false;
    
    // Listen for network responses
    const handler = async (resp) => {
      if (resolved) return;
      
      const url = resp.url();
      const status = resp.status();
      
      // Look for video blob or MP4 responses
      if (status === 200 && (url.includes('.mp4') || url.includes('blob:'))) {
        try {
          const contentType = resp.headers()['content-type'] || '';
          if (contentType.includes('video') || contentType.includes('mpeg') || 
              url.includes('.mp4') || url.includes('blob:')) {
            if (!resolved) {
              resolved = true;
              page.off('response', handler);
              log(`  Video response detected: ${url.slice(-60)}`);
              resolve(url);
            }
          }
        } catch {}
      }
      
      // Also check for 201 job responses that might contain video URLs
      if (status === 201 && url.includes('hailuo')) {
        try {
          const text = await resp.text().catch(() => '');
          log(`  201 job response: ${text.slice(0, 100)}`);
        } catch {}
      }
    };
    
    page.on('response', handler);
    
    // Timeout check
    const checkInterval = setInterval(() => {
      if (resolved) {
        clearInterval(checkInterval);
        return;
      }
      if (Date.now() > deadline) {
        resolved = true;
        clearInterval(checkInterval);
        page.off('response', handler);
        reject(new Error('Video generation timed out (>15min)'));
      }
    }, 5000);
  });
}

async function generateSingleVideo(app, prompt, filename) {
  const page = app._page;
  const OUTPUT_DIR = resolve(ROOT, 'output', 'videos');
  mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Navigate to create page
  log('  Navigating to create page...');
  await page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(3000);
  
  // Fill prompt using proper contenteditable handling
  const textarea = page.locator('div[contenteditable]').first();
  
  // Clear existing content first
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await sleep(500);
  
  // Type the prompt (simulate real typing)
  await textarea.click();
  // Use evaluate to set content and trigger events properly
  await textarea.evaluate(el => {
    el.focus();
    el.textContent = '';
    el.dispatchEvent(new Event('focus', { bubbles: true }));
  });
  
  // Type character by character to simulate real input
  for (const char of prompt.slice(0, 500)) {
    await page.keyboard.type(char, { delay: 5 });
  }
  await sleep(500);
  
  log('  Prompt filled');
  
  // Click submit
  const submitBtn = page.locator('button.new-color-btn-bg').first();
  const btnText = await submitBtn.innerText().catch(() => '');
  log(`  Submitting (button: "${btnText}")...`);
  
  // Start waiting for video BEFORE clicking
  const videoUrlPromise = waitForVideoUrlFromNetwork(page);
  
  await submitBtn.click({ force: true });
  log('  Submit clicked, waiting for video response...');
  
  // Wait for video to come through network
  let videoUrl;
  try {
    videoUrl = await videoUrlPromise;
  } catch (e) {
    throw new Error(`Video generation failed: ${e.message}`);
  }
  
  log(`  Video ready: ${videoUrl.slice(-60)}`);
  
  // Download
  const outputPath = resolve(OUTPUT_DIR, filename);
  log(`  Downloading...`);
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outputPath, buf);
  const sizeMb = (buf.length / 1024 / 1024).toFixed(1);
  log(`  Downloaded ${sizeMb}MB → ${outputPath}`);
  
  return { localPath: outputPath, url: videoUrl, sizeMb };
}

async function main() {
  log('=== TKP-135: Generate 6 Videos (Network-Intercept Fix) ===');
  
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
      
      // Quick hash check (first 64KB)
      const { createHash } = await import('crypto');
      const sample = readFileSync(localPath).slice(0, 65536);
      const hash = createHash('md5').update(sample).digest('hex');
      log(`  Hash: ${hash}`);
      
      // Update script
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
    if (r.status === 'success') log(`  ✓ ${r.id} ${r.sizeMb}MB hash=${r.hash?.slice(0,8)}... ${r.elapsed_s}s`);
    else log(`  ✗ ${r.id} → ${r.error}`);
  }

  const reportPath = resolve(ROOT, 'output', 'TKP-135-fixed-report.json');
  writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  log(`Report: ${reportPath}`);

  await app.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  log('CRASH:', err.message);
  process.exit(1);
});
