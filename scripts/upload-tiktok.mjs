/**
 * scripts/upload-tiktok.mjs
 * TikTok browser upload using saved session - WORKING VERSION
 * 
 * Key insight: Use dispatchEvent(new MouseEvent(...)) for the Post button,
 * NOT Playwright's .click() which doesn't trigger React event handlers.
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function log(...args) {
  console.log(`[tiktok-upload] ${new Date().toISOString().slice(11,19)}`, ...args);
}

async function uploadTikTok(videoId, caption) {
  const videoPath = resolve(ROOT, 'outputs', videoId, 'final.mp4');
  if (!caption) caption = 'AI Video Generator #ai #automation #fyp #tiktok';

  log(`Starting upload: ${videoId}`);
  log(`Video: ${videoPath}`);
  log(`Caption: ${caption}`);

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    storageState: resolve(ROOT, '.tiktok-session.json'),
    viewport: { width: 1280, height: 900 }
  });
  const page = await ctx.newPage();

  try {
    // Navigate to upload page
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(6000);

    if (page.url().includes('/login')) {
      log('Session expired!');
      return { success: false, error: 'Session expired' };
    }

    log(`Upload page loaded: ${page.url()}`);

    // Upload file
    await page.locator('input[type="file"]').first().setInputFiles(videoPath);
    log('File uploaded to input');

    // Wait for video processing
    log('Waiting for video to process (12s)...');
    await page.waitForTimeout(12000);

    // Fill caption
    const captionEl = page.locator('div[contenteditable="true"]').first();
    await captionEl.click();
    await captionEl.click({ clickCount: 3 });
    await captionEl.fill(caption);
    log(`Caption filled: ${caption}`);
    await page.waitForTimeout(2000);

    // CLICK POST BUTTON USING NATIVE DOM EVENT (React doesn't respond to Playwright click)
    log('Clicking "Đăng" using native MouseEvent...');
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dangBtn = btns.find(b => b.innerText?.trim() === 'Đăng');
      if (!dangBtn) return 'NOT FOUND';
      dangBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return 'CLICKED';
    });
    log(`Click result: ${clicked}`);

    // Wait for navigation to /content page (success indicator)
    log('Waiting for redirect to /content...');
    await page.waitForFunction(
      () => window.location.pathname.includes('/content') || window.location.pathname.includes('/video'),
      { timeout: 20000 }
    ).catch(() => {
      // If no navigation, check current URL
    });

    const finalUrl = page.url();
    log(`Final URL: ${finalUrl}`);

    // Verify video is in content list
    await page.waitForTimeout(3000);
    const pageText = (await page.locator('body').innerText().catch(() => ''));
    const videoPosted = pageText.includes(caption.slice(0, 30)) || pageText.includes('Nội dung đang được xét');

    if (finalUrl.includes('/content') || finalUrl.includes('/video') || videoPosted) {
      log('✅ SUCCESS! Video posted!');
      writeFileSync(resolve(ROOT, 'outputs', videoId, 'published.txt'),
        `Published at: ${finalUrl}\n${new Date().toISOString()}\nCaption: ${caption}`);
      return { success: true, url: finalUrl, caption };
    } else {
      log('⚠️  Upload status unclear');
      return { success: false, error: 'Status unclear after post' };
    }

  } catch (err) {
    log(`Error: ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

async function main() {
  const videoId = process.argv[2] || 'GZ-01';
  const caption = process.argv[3] || null;

  const result = await uploadTikTok(videoId, caption);

  if (result.success) {
    log(`✅ Done! ${JSON.stringify(result)}`);
  } else {
    log(`❌ Failed: ${result.error}`);
    process.exit(1);
  }
}

main();
