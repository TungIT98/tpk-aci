/**
 * scripts/upload-via-cdp.mjs
 * 
 * Uses Playwright to connect to OpenClaw Chrome via CDP and upload a video
 * to TikTok using the browser's existing authenticated session.
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function log(...args) {
  console.log(`[upload-cdp] ${new Date().toISOString().slice(11,19)}`, ...args);
}

async function main() {
  const videoId = process.argv[2] || 'GZ-01';
  const videoPath = resolve(ROOT, 'outputs', videoId, 'final.mp4');
  
  log(`Video: ${videoPath}`);
  
  // Connect to OpenClaw browser via CDP
  const CDP_URL = 'http://127.0.0.1:18800';
  const versionResp = await fetch(`${CDP_URL}/json/version`);
  const versionData = await versionResp.json();
  
  log('Connected to browser via CDP');
  
  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx = browser.contexts()[0];
  
  // Find or create TikTok upload page
  let page = ctx.pages().find(p => p.url().includes('tiktokstudio/upload'));
  if (!page) {
    page = await ctx.newPage();
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  } else {
    await page.bringToFront();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }
  
  log(`Page URL: ${page.url()}`);
  
  // Find the hidden file input
  const fileInput = page.locator('input[type="file"]').first();
  const inputCount = await page.locator('input[type="file"]').count();
  log(`File inputs found: ${inputCount}`);
  
  if (inputCount === 0) {
    // Click the select video button first
    log('No file input visible, clicking "Chọn video" button...');
    await page.locator('button:has-text("Chọn video"), [class*="upload"]').first().click();
    await page.waitForTimeout(1000);
  }
  
  // Check again for file input
  const input2Count = await page.locator('input[type="file"]').count();
  log(`File inputs after click: ${input2Count}`);
  
  if (input2Count > 0) {
    // Use Playwright's setInputFiles (works with hidden inputs!)
    log(`Setting file: ${videoPath}`);
    await fileInput.setInputFiles(videoPath);
    
    // Wait for processing
    log('Waiting for video to process...');
    await page.waitForTimeout(5000);
    
    // Look for caption field
    const captionSelectors = [
      'div[contenteditable="true"]',
      'textarea[placeholder*="aption"]',
      'textarea[placeholder*="escribe"]',
      '[data-e2e="video-desc-input"]'
    ];
    
    let captionField = null;
    for (const sel of captionSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        captionField = page.locator(sel).first();
        log(`Found caption field: ${sel}`);
        break;
      }
    }
    
    if (captionField) {
      const caption = 'AI Video Generator #ai #video #automation #fyp';
      await captionField.click();
      await captionField.fill(caption);
      log(`Caption filled: ${caption}`);
      await page.waitForTimeout(1000);
    } else {
      log('Caption field not found');
    }
    
    // Find and click post button
    const postSelectors = [
      'button:has-text("Đăng"), button:has-text("Post"), button:has-text("Publish")',
      '[data-e2e*="post"]',
      'button[class*="post"]'
    ];
    
    let posted = false;
    for (const sel of postSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0) {
        const btnText = await btn.innerText().catch(() => '');
        log(`Found post button: "${btnText}"`);
        try {
          await btn.click({ timeout: 5000 });
          posted = true;
          log('Post button clicked!');
          break;
        } catch (e) {
          log(`Click failed: ${e.message}`);
        }
      }
    }
    
    if (posted) {
      await page.waitForTimeout(5000);
      const finalUrl = page.url();
      log(`Upload result URL: ${finalUrl}`);
      
      if (!finalUrl.includes('/upload')) {
        log('✅ Upload appears successful!');
        writeFileSync(resolve(ROOT, 'outputs', videoId, 'published.txt'), 
          `Published at: ${finalUrl}\n${new Date().toISOString()}`);
      } else {
        log('⚠️  May still be on upload page - check manually');
      }
    }
  } else {
    log('Could not find file input - TikTok UI may have changed');
  }
  
  await page.waitForTimeout(2000);
  await browser.close();
  log('Done');
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
