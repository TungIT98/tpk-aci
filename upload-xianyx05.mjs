import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const videoPath = resolve(__dirname, 'output', 'xianxia', 'XIANYX-05', 'final_new2.mp4');
const caption = 'He buried the dead for 3 years in silence. Until he found the grave no living person was meant to see 👁️🔥 #xianxia #gravekeeper #seereye #cultivation #darkfantasy #supernatural #mystery';

console.log('Video path:', videoPath);
console.log('Exists:', existsSync(videoPath));

const CDP_URL = 'ws://127.0.0.1:18800/devtools/browser/3238f575-e049-45a9-996d-16e4415c6696';

const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 90000 });
console.log('Connected, contexts:', browser.contexts().length);

const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(5000);
console.log('URL:', page.url());

try {
  if (page.url().includes('/login')) {
    console.log('Session expired!');
    await browser.close();
    process.exit(1);
  }

  await page.locator('input[type="file"]').first().setInputFiles(videoPath);
  console.log('File set');

  await page.waitForTimeout(3000);
  await page.locator('[contenteditable]').first().fill(caption);
  console.log('Caption filled');

  await page.waitForTimeout(2000);

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
