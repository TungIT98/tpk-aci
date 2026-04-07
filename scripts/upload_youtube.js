/**
 * scripts/upload_youtube.js
 * Upload VID-001 video to YouTube Studio using OpenClaw browser profile.
 * Uses the existing Chrome profile where Hailuo is already logged in.
 */
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync, readFileSync } from 'fs';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load environment
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

async function main() {
  console.log('=== YouTube Upload via OpenClaw Browser ===');
  const videoPath = resolve(ROOT, 'output/videos/VID-001-productivity-worker.mp4');
  if (!existsSync(videoPath)) {
    console.error('ERROR: Video not found at', videoPath);
    process.exit(1);
  }
  const videoSize = Math.round(statSync(videoPath).size / 1e6);
  console.log('Video:', videoPath, `(${videoSize} MB)`);
  
  // Use playwright with OpenClaw's Chrome profile
  const { chromium } = await import('playwright');
  const openclawProfile = 'C:/Users/PC/AppData/Roaming/openclaw/browser';
  
  let browser;
  try {
    browser = await chromium.launch({ 
      headless: false,
      args: ['--disable-web-security', '--allow-file-access-from-files']
    });
    console.log('Browser launched');
    
    // Try to use the OpenClaw profile
    let context;
    try {
      context = await browser.newContext({ 
        ignoreHTTPSErrors: true 
      });
      console.log('New context created');
    } catch (e) {
      console.log('Context failed:', e.message.substring(0, 100));
      throw e;
    }
    
    const page = await context.newPage();
    
    // Navigate to YouTube Studio
    await page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log('YouTube Studio URL:', page.url());
    
    if (page.url().includes('signin')) {
      console.log('NOT LOGGED IN - need to log in first');
      await browser.close();
      process.exit(1);
    }
    console.log('Logged in to YouTube ✓');
    
    // Navigate to upload
    await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/videos/upload?d=ud', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    console.log('Upload page URL:', page.url());
    
    // Find file input
    const fileInput = page.locator('input[type="file"]').first();
    const inputCount = await page.locator('input[type="file"]').count();
    console.log('File inputs found:', inputCount);
    
    if (inputCount > 0) {
      console.log('Setting file on input...');
      await fileInput.setInputFiles(videoPath);
      console.log('File set!');
      await page.waitForTimeout(8000);
      
      // Check URL - if upload started, URL will change
      console.log('URL after upload:', page.url());
      
      // Look for title input (indicates upload progress)
      const titleInput = page.locator('[id="title-input"], [placeholder="Thêm tiêu đề"]').first();
      if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Upload PROGRESS: Title input visible ✓');
      }
    } else {
      console.log('No file input found');
      // Try clicking upload button
      const buttons = await page.locator('button').all();
      for (const btn of buttons) {
        const text = await btn.innerText().catch(() => '');
        if (/tai|lên|upload|create/i.test(text)) {
          console.log('Found button:', text.trim().substring(0, 50));
        }
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message.substring(0, 300));
  } finally {
    if (browser) await browser.close().catch(() => {});
    console.log('Done');
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
