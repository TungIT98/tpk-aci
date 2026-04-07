/**
 * scripts/upload-youtube-simple.js
 * Upload YouTube using Playwright with browser binary bundled in playwright
 */

import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

async function main() {
  const videoPath = resolve(ROOT, 'outputs/WC-01/final.mp4');
  const title = 'WC-01 Test Upload';
  const description = 'Test description';

  console.log('[YouTube] Starting upload...');
  console.log('[YouTube] Video:', videoPath);
  console.log('[YouTube] Exists:', existsSync(videoPath));

  if (!existsSync(videoPath)) {
    console.error('[YouTube] Video file not found!');
    process.exit(1);
  }

  let browser;
  try {
    console.log('[YouTube] Launching browser...');

    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    // Remove webdriver detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    console.log('[YouTube] Navigating to YouTube Studio...');
    await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/videos/upload?d=ud', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('[YouTube] Waiting...');
    await page.waitForTimeout(8000);

    const url = page.url();
    console.log('[YouTube] URL:', url);

    if (url.includes('/login')) {
      console.error('[YouTube] Not logged in!');
      await browser.close();
      process.exit(1);
    }

    console.log('[YouTube] Looking for file input...');

    // Find file input
    let fileInput = null;
    for (const sel of ['input[type="file"]', 'input[type=file]']) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        fileInput = page.locator(sel).first();
        console.log('[YouTube] Found:', sel);
        break;
      }
    }

    if (!fileInput) {
      console.error('[YouTube] File input not found!');
      await page.screenshot({ path: join(ROOT, 'error.png') });
      console.log('[YouTube] Screenshot saved');
      await browser.close();
      process.exit(1);
    }

    console.log('[YouTube] Uploading...');
    await fileInput.setInputFiles(videoPath);

    console.log('[YouTube] Waiting for upload...');
    await page.waitForTimeout(20000);

    const finalUrl = page.url();
    console.log('[YouTube] Final URL:', finalUrl);

    console.log('\n✅ Done! Check YouTube Studio for your upload.\n');

    await browser.close();

  } catch (err) {
    console.error('[YouTube] Error:', err.message);
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
}

main();
