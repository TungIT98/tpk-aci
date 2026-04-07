/**
 * scripts/upload-tiktok-v3.mjs
 * TikTok upload - use locator click + wait for navigation
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function log(...args) {
  console.log(`[upload3] ${new Date().toISOString().slice(11,19)}`, ...args);
}

async function main() {
  const videoId = process.argv[2] || 'GZ-01';
  const videoPath = resolve(ROOT, 'outputs', videoId, 'final.mp4');
  const caption = process.argv[3] || 'AI Video Generator Test #ai #automation #fyp #tiktok2026';

  log(`Video: ${videoPath}`);
  log(`Caption: ${caption}`);

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    storageState: resolve(ROOT, '.tiktok-session.json'),
    viewport: { width: 1280, height: 900 }
  });
  const page = await ctx.newPage();

  try {
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
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

    // Fill caption using triple-click to select all then type
    log('Filling caption...');
    const captionEl = page.locator('[data-e2e="video-desc-input"], div[contenteditable="true"]').first();
    await captionEl.click();
    await captionEl.click({ clickCount: 3 }); // Select all
    await captionEl.fill(caption);
    log('Caption filled');
    await page.waitForTimeout(1000);

    // Now try to click the Post button - use full button text matching
    log('Looking for post button...');
    
    // Get all buttons with their full info
    const allButtons = await page.locator('button').evaluateAll(els => 
      els.map(e => ({ 
        text: e.innerText?.trim(), 
        disabled: e.disabled,
        class: e.className?.slice(0, 50)
      }))
    );
    
    log('All buttons:');
    allButtons.forEach((b, i) => log(`  [${i}] "${b.text}" disabled=${b.disabled} class=${b.class}`));

    // Find the "Đăng" button - it might have class indicating it's a primary button
    const dangBtn = page.locator('button.e1w6iovg0, button[class*="submit"], button[class*="primary"]').filter({ hasText: /Đăng|Post|Publish/i });
    const count = await dangBtn.count();
    log(`"Đăng" buttons: ${count}`);

    if (count > 0) {
      log('Clicking via locator...');
      await dangBtn.first().click();
      log('Clicked!');
    } else {
      // Fallback: click using text content
      log('Using text-based click...');
      await page.locator('button').filter({ hasText: /^Đăng$/ }).first().click({ force: true });
      log('Clicked via text!');
    }

    log('Waiting 10s after post...');
    await page.waitForTimeout(10000);

    const finalUrl = page.url();
    const finalText = (await page.locator('body').innerText().catch(() => '')).slice(0, 500);
    
    log(`Final URL: ${finalUrl}`);
    log(`Final text: ${finalText.slice(0, 300)}`);

    // Check for success indicators
    const posted = finalText.includes('Đã đăng') || finalText.includes('successfully') || finalText.includes('Posted') ||
      finalUrl.includes('@') || (!finalUrl.includes('upload') && finalUrl.includes('tiktok.com'));

    if (posted) {
      log('✅ SUCCESS!');
      writeFileSync(resolve(ROOT, 'outputs', videoId, 'published.txt'),
        `Published at: ${finalUrl}\n${new Date().toISOString()}\nCaption: ${caption}`);
    } else {
      // Try one more click if still on upload page
      log('Still on upload page, trying another approach...');
      const html = await page.content();
      const hasError = html.includes('error') || html.includes('failed') || html.includes('không thành công');
      if (hasError) {
        log('⚠️  Error detected in page');
      } else {
        log('No error detected - may still be processing');
      }
      
      writeFileSync(resolve(ROOT, 'outputs', videoId, 'upload-debug.txt'),
        `URL: ${finalUrl}\nText: ${finalText}\nCaption was: ${caption}\n${new Date().toISOString()}`);
    }

    await page.waitForTimeout(20000);
    await browser.close();

  } catch (err) {
    log(`Error: ${err.message}`);
    await page.screenshot({ path: resolve(ROOT, 'outputs', videoId, 'error-screenshot.png') }).catch(() => {});
    await browser.close();
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
