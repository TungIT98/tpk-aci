/**
 * scripts/upload-youtube-hg01.mjs - v3
 * Upload HG-01 video to YouTube via Playwright CDP + setInputFiles
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function log(...args) {
  console.log(`[yt-upload] ${new Date().toISOString().slice(11,19)}`, ...args);
}

async function main() {
  const videoId = 'HG-01';
  const videoPath = resolve(ROOT, 'outputs', videoId, 'final.mp4');
  const title = 'Girl shows her gym transformation 💪🔥';
  const description = 'She used to skip leg day. Then she found her why. 6 months of consistency.\n\n#fitness #gym #transformation #motivation';

  log(`Video: ${videoPath}`);

  const CDP_URL = 'http://127.0.0.1:18800';
  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx = browser.contexts()[0];
  
  const page = await ctx.newPage();
  
  // Navigate to YouTube upload
  await page.goto('https://www.youtube.com/upload', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  await page.waitForTimeout(6000);
  log(`URL: ${page.url()}`);

  const count = await page.locator('input[type="file"]').count();
  log(`File inputs: ${count}`);

  if (count > 0) {
    // Use Playwright's setInputFiles (works with hidden inputs!)
    log('Setting file via setInputFiles...');
    await page.locator('input[type="file"]').first().setInputFiles(videoPath);
    log('File set!');

    // Wait for processing
    log('Waiting 15s for upload processing...');
    await page.waitForTimeout(15000);

    // Check for title field
    const pageText = (await page.locator('body').innerText().catch(() => '')).slice(0, 500);
    log(`Page text: ${pageText.slice(0, 300)}`);

    // Try filling title using JS (YouTube uses Angular/React, contenteditable)
    await page.evaluate((t) => {
      // Find title input - YouTube Studio has #title input
      const inputs = document.querySelectorAll('input, textarea, div[contenteditable="true"]');
      for (const el of inputs) {
        const ph = el.getAttribute('placeholder') || '';
        const id = el.id || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        if (ph.toLowerCase().includes('title') || id.toLowerCase().includes('title') || ariaLabel.toLowerCase().includes('title')) {
          // It's a contenteditable or input
          if (el.getAttribute('contenteditable') === 'true') {
            el.innerText = t;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            el.value = t;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return 'Title set';
        }
      }
      return 'Title input not found';
    }, title);
    log('Title attempt done');

    await page.waitForTimeout(2000);

    // Click Next
    const nextBtn = page.locator('button').filter({ hasText: /^Tiếp$/ }).first();
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      log('Clicked "Tiếp"');
      await page.waitForTimeout(3000);
    }

    // Click Publish
    const publishBtn = page.locator('button').filter({ hasText: /^Xuất bản$/ }).first();
    if (await publishBtn.count() > 0) {
      await publishBtn.click();
      log('Clicked "Xuất bản"');
      await page.waitForTimeout(5000);
    }

    const finalUrl = page.url();
    log(`Final URL: ${finalUrl}`);

    const isSuccess = finalUrl.includes('/watch') || 
                      pageText.includes('Đã xuất bản') || 
                      pageText.includes('Published') ||
                      !pageText.includes('Nội dung của kênh');

    if (isSuccess) {
      log('✅ YouTube upload appears successful!');
      writeFileSync(resolve(ROOT, 'outputs', videoId, 'youtube-published.txt'),
        `YouTube: ${finalUrl}\nTitle: ${title}\n${new Date().toISOString()}`);
    } else {
      log('⚠️  Upload may have failed');
    }
  } else {
    log('No file input found');
    await page.screenshot({ path: resolve(ROOT, 'outputs', videoId, 'yt-debug.png') });
  }

  await page.waitForTimeout(10000);
  await browser.close();
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
