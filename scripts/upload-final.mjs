/**
 * scripts/upload-final.mjs
 * Upload TikTok video with navigation detection
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function log(...args) {
  console.log(`[upload-final] ${new Date().toISOString().slice(11,19)}`, ...args);
}

async function main() {
  const videoId = process.argv[2] || 'GZ-01';
  const videoPath = resolve(ROOT, 'outputs', videoId, 'final.mp4');
  const caption = process.argv[3] || 'AI Video Generator Test #ai #automation #fyp #tiktok2026';

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    storageState: resolve(ROOT, '.tiktok-session.json'),
    viewport: { width: 1280, height: 900 }
  });
  const page = await ctx.newPage();

  try {
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);

    if (page.url().includes('/login')) {
      log('Session expired!');
      await browser.close();
      return;
    }

    log(`URL: ${page.url()}`);

    // Upload file
    await page.locator('input[type="file"]').first().setInputFiles(videoPath);
    log('File set');

    // Wait for processing
    await page.waitForTimeout(12000);

    // Fill caption
    const captionEl = page.locator('[data-e2e="video-desc-input"], div[contenteditable="true"]').first();
    await captionEl.click();
    await captionEl.click({ clickCount: 3 });
    await captionEl.fill(caption);
    await page.waitForTimeout(2000);
    log(`Caption: ${caption}`);

    // Wait for potential TikTok to process caption
    await page.waitForTimeout(2000);

    // Find the POST button by exact text match
    log('Clicking "Đăng"...');
    await page.locator('button').filter({ hasText: /^Đăng$/ }).click({ force: true });
    log('Clicked "Đăng"');

    // Wait for navigation OR DOM change
    log('Waiting for post to complete...');
    
    // Wait up to 15 seconds, checking every 3 seconds for URL change
    let attempts = 0;
    let finalUrl = page.url();
    while (attempts < 5) {
      await page.waitForTimeout(3000);
      const newUrl = page.url();
      if (newUrl !== finalUrl) {
        log(`URL changed to: ${newUrl}`);
        finalUrl = newUrl;
        break;
      }
      attempts++;
      log(`Still on ${page.url()}, waiting... (${attempts}/5)`);
    }

    finalUrl = page.url();
    const finalText = (await page.locator('body').innerText().catch(() => '')).slice(0, 500);
    
    log(`Final URL: ${finalUrl}`);
    
    // Look for the post URL pattern
    const isPosted = 
      (finalUrl.includes('/video/') && !finalUrl.includes('upload')) ||
      finalUrl.includes('@fai20128');

    if (isPosted) {
      log(`✅ SUCCESS! Video posted at: ${finalUrl}`);
      writeFileSync(resolve(ROOT, 'outputs', videoId, 'published.txt'),
        `Published at: ${finalUrl}\n${new Date().toISOString()}\nCaption: ${caption}`);
    } else {
      // Maybe post succeeded but we're back on upload page for next video
      // Check if form was cleared
      const formCleared = !(finalText.includes(videoPath.split(/[/\\]/).pop()));
      log(`Form cleared: ${formCleared}`);
      log(`Final text: ${finalText.slice(0, 300)}`);
      
      if (formCleared) {
        log('✅ SUCCESS! Form was cleared (video posted, fresh form shown)');
        writeFileSync(resolve(ROOT, 'outputs', videoId, 'published.txt'),
          `Posted (form cleared)\n${new Date().toISOString()}\nCaption: ${caption}`);
      } else {
        log('⚠️  Upload may have failed');
      }
    }

    await page.waitForTimeout(20000);
    await browser.close();

  } catch (err) {
    log(`Error: ${err.message}`);
    await page.screenshot({ path: resolve(ROOT, 'outputs', videoId, `error-${Date.now()}.png`) }).catch(() => {});
    await browser.close();
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
