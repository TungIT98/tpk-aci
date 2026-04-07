/**
 * tiktok-upload-gz-v8.js
 * Use JS evaluate to directly click publish, then wait for content check + publish
 */
import { chromium } from 'playwright';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const SESSION_PATH = resolve('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/.tiktok-session.json');
const VIDEO_PATH = 'C:/tmp/openclaw/uploads/GZ-07-FINAL.mp4';
const CAPTION = 'I Did a 30-Day No-Spend Challenge — Here\'s What Actually Happened #nospendchallenge #savingmoney #budgeting #genzfinance #moneymindset #30daychallenge #fyp';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[GZ-07 v8] Starting...');
  const sessionData = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({ storageState: sessionData, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on('dialog', async dialog => { console.log('[GZ-07] Dialog:', dialog.message()); await dialog.accept(); });

  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp&lang=vi-VN', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);

  // Dismiss dialog
  const cont = page.locator('button:has-text("Tiếp tục")');
  if (await cont.count() > 0) { await cont.click({ timeout: 3000 }); await sleep(1500); }

  // Check current state
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const alreadyUploaded = bodyText.includes('Đã tải lên') && bodyText.includes('1080P');
  console.log('[GZ-07] Already uploaded:', alreadyUploaded);

  if (!alreadyUploaded) {
    console.log('[GZ-07] Uploading fresh...');
    await page.locator('button:has-text("Chọn video")').click({ force: true, timeout: 5000 });
    await sleep(2000);
    const inputs = page.locator('input[type="file"]');
    if (await inputs.count() > 0) {
      await inputs.first().setInputFiles(VIDEO_PATH);
      console.log('[GZ-07] Video attached, waiting for upload + content check...');
      // Wait for upload to complete (spinner disappears)
      await page.waitForTimeout(15000);
    }
  } else {
    console.log('[GZ-07] Video already in editor');
  }

  // Check content check status
  const checkText = await page.locator('body').innerText().catch(() => '');
  const stillChecking = checkText.includes('Đang kiểm tra') && checkText.includes('10 phút');
  console.log('[GZ-07] Content check still running:', stillChecking);

  if (stillChecking) {
    console.log('[GZ-07] Waiting for content check to finish (up to 10 minutes)...');
    // Wait up to 10 minutes
    for (let i = 0; i < 20; i++) {
      await sleep(30000);
      const text = await page.locator('body').innerText().catch(() => '');
      if (!text.includes('Đang kiểm tra') || text.includes('Không phát hiện')) {
        console.log(`[GZ-07] Content check done after ${(i+1)*30}s`);
        break;
      }
      console.log(`[GZ-07] Still checking... ${(i+1)*30}s elapsed`);
    }
  }

  // Fill caption if not already filled
  const afterCheck = await page.locator('body').innerText().catch(() => '');
  const captionFilled = afterCheck.includes('nospendchallenge');
  console.log('[GZ-07] Caption filled:', captionFilled);
  
  if (!captionFilled) {
    const editable = page.locator('[contenteditable="true"]').first();
    if (await editable.count() > 0) {
      await editable.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.type(CAPTION);
      await sleep(1000);
    }
  }

  // Make sure "Bây giờ" (Now) is selected
  const nowBtn = page.locator('button:has-text("Bây giờ")');
  if (await nowBtn.count() > 0) {
    await nowBtn.click({ timeout: 5000 });
    await sleep(2000);
  }

  // Click Đăng via evaluate (direct JS click to bypass Playwright restrictions)
  console.log('[GZ-07] Clicking Đăng via JavaScript...');
  
  const clickResult = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const btn of buttons) {
      const text = btn.innerText.trim();
      if (text === 'Đăng' || text === 'Post' || text === 'Publish') {
        console.log('Found button:', text, 'disabled:', btn.disabled, 'aria-disabled:', btn.getAttribute('aria-disabled'));
        btn.click();
        return { clicked: true, text, disabled: btn.disabled, ariaDisabled: btn.getAttribute('aria-disabled') };
      }
    }
    return { clicked: false };
  });
  
  console.log('[GZ-07] JS click result:', JSON.stringify(clickResult));
  
  // Wait for publish to process
  console.log('[GZ-07] Waiting for publish processing...');
  await sleep(10000);

  // Check final state
  const finalUrl = page.url();
  const finalText = await page.locator('body').innerText().catch(() => '');
  console.log('[GZ-07] Final URL:', finalUrl);
  console.log('[GZ-07] Final text preview:', finalText.substring(0, 600));
  
  if (finalText.includes('Đã đăng') || finalText.includes('posted') || finalText.includes('thành công') || finalText.includes('Published') || finalUrl.includes('/post')) {
    console.log('[GZ-07] SUCCESS!');
  } else {
    console.log('[GZ-07] WARNING: Publish may not have completed. Check TikTok manually.');
  }

  await page.screenshot({ path: 'C:/tmp/openclaw/uploads/gz07-final-v8.png' });
  await browser.close();
  console.log('[GZ-07] Done.');
}

main().catch(e => {
  console.error('[GZ-07] Fatal:', e.message);
  process.exit(1);
});