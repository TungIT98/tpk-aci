import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const videoPath = resolve(__dirname, 'outputs', 'xianxia', 'XIANYX-04', 'final.mp4');
const caption = 'She kept a butterfly in jade for fifteen years 🦋 The day it stirred, her voice finally answered back... #xianxia #chinesefantasy #butterfly #epic #fantasy #dramatic #underdog';

console.log('Video path:', videoPath);
console.log('Exists:', existsSync(videoPath));

const CDP_URL = 'ws://127.0.0.1:18800/devtools/browser/e9df6b01-0ee7-4b7c-86ce-b6b09f362eba';

const browser = await chromium.connectOverCDP(CDP_URL);
const ctx = browser.contexts()[0];
const page = await ctx.newPage();

try {
  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  if (page.url().includes('/login')) {
    console.log('Session expired!');
    await browser.close();
    process.exit(1);
  }

  console.log('URL:', page.url());

  // Upload file
  await page.locator('input[type="file"]').first().setInputFiles(videoPath);
  console.log('File set');

  await page.waitForTimeout(3000);
  await page.locator('[contenteditable]').first().fill(caption);
  console.log('Caption filled');

  await page.waitForTimeout(2000);

  // Find and click post button
  const allBtns = await page.locator('button').all();
  let postBtn = null;
  for (const btn of allBtns) {
    const text = await btn.textContent();
    if (text && text.trim() === 'Đăng') {
      postBtn = btn;
      break;
    }
  }

  if (postBtn) {
    await postBtn.click();
    console.log('Post clicked');
    await page.waitForTimeout(10000);
    console.log('Final URL:', page.url());
    console.log('SUCCESS');
  } else {
    console.log('Post button not found');
  }
} catch(e) {
  console.error('Error:', e.message);
}

await browser.close();
