/**
 * tiktok-upload-gz-v6.js
 * Upload GZ-07 to TikTok - fix locator.count() issue
 */
import { chromium } from 'playwright';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const SESSION_PATH = resolve('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/.tiktok-session.json');
const VIDEO_PATH = 'C:/tmp/openclaw/uploads/GZ-07-FINAL.mp4';
const CAPTION = 'I Did a 30-Day No-Spend Challenge — Here\'s What Actually Happened #nospendchallenge #savingmoney #budgeting #genzfinance #moneymindset #30daychallenge #fyp';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[GZ-07 v6] Starting...');
  const sessionData = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({ storageState: sessionData, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('dialog', async dialog => { console.log('[GZ-07] Dialog:', dialog.message()); await dialog.accept(); });

  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp&lang=vi-VN', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);

  // Dismiss any dialog
  const cont = page.locator('button:has-text("Tiếp tục")');
  if (await cont.count() > 0) { await cont.click({ timeout: 3000 }); await sleep(1500); }

  // Check if video is already there
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const hasUpload = bodyText.includes('Đã tải lên') || bodyText.includes('GZ-07');
  console.log('[GZ-07] Video already uploaded:', hasUpload);

  if (!hasUpload) {
    console.log('[GZ-07] Uploading fresh video...');
    // Click "Chọn video" button
    const selectBtn = page.locator('button:has-text("Chọn video")');
    if (await selectBtn.count() > 0) {
      await selectBtn.click({ force: true, timeout: 5000 });
      await sleep(2000);
    }
    // Attach to file input
    const inputs = page.locator('input[type="file"]');
    if (await inputs.count() > 0) {
      await inputs.first().setInputFiles(VIDEO_PATH);
      console.log('[GZ-07] Video attached, waiting for upload...');
      await sleep(8000);
    }
  } else {
    console.log('[GZ-07] Video already in editor');
  }

  // Now fill in caption/description
  // The description field shows "GZ-07-FINAL" as placeholder
  console.log('[GZ-07] Filling caption...');
  
  // Click on description label
  const descLabel = page.locator('text=Mô tả').first();
  if (await descLabel.count() > 0) {
    await descLabel.click({ timeout: 3000 }).catch(e => console.log('Label click failed:', e.message));
    await sleep(1000);
  }

  // Try finding description textarea by placeholder
  const descTextarea = page.locator('textarea[placeholder*="Mô tả"], textarea[placeholder*="description"], textarea[placeholder*="Caption"]');
  if (await descTextarea.count() > 0) {
    console.log('[GZ-07] Found description textarea');
    await descTextarea.fill(CAPTION);
    await sleep(500);
  } else {
    // Try any visible textarea
    const allTextareas = page.locator('textarea');
    if (await allTextareas.count() > 0) {
      console.log('[GZ-07] Filling first textarea');
      await allTextareas.first().fill(CAPTION);
    } else {
      // Try contenteditable div
      const editable = page.locator('[contenteditable="true"]').first();
      if (await editable.count() > 0) {
        console.log('[GZ-07] Using contenteditable div');
        await editable.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.type(CAPTION);
      }
    }
  }

  await sleep(2000);

  // Click "Bây giờ" to set post timing to "Now"
  const nowBtn = page.locator('button:has-text("Bây giờ")');
  if (await nowBtn.count() > 0) {
    console.log('[GZ-07] Clicking "Bây giờ"...');
    await nowBtn.click({ timeout: 5000 });
    await sleep(2000);
  }

  // Now look for publish button "Đăng"
  console.log('[GZ-07] Looking for publish button...');
  
  // List all buttons again
  const allBtns = await page.locator('button').all();
  console.log(`[GZ-07] Total buttons: ${allBtns.length}`);
  for (let i = 0; i < allBtns.length; i++) {
    const txt = (await allBtns[i].innerText().catch(() => '')).trim();
    const disabled = await allBtns[i].getAttribute('disabled').catch(() => null);
    const ariaDis = await allBtns[i].getAttribute('aria-disabled').catch(() => null);
    if (txt) console.log(`  [${i}] "${txt}" disabled=${disabled !== null} aria-disabled=${ariaDis}`);
  }

  // Try to find enabled "Đăng" button
  const dangBtns = await page.locator('button:has-text("Đăng")').all();
  console.log(`[GZ-07] "Đăng" buttons found: ${dangBtns.length}`);
  for (const btn of dangBtns) {
    const disabled = await btn.getAttribute('disabled').catch(() => null);
    const ariaDis = await btn.getAttribute('aria-disabled').catch(() => null);
    const txt = (await btn.innerText().catch(() => '')).trim();
    console.log(`  "${txt}" disabled=${disabled !== null} aria-disabled=${ariaDis}`);
    if (disabled === null && ariaDis !== 'true') {
      console.log(`[GZ-07] CLICKING Đăng...`);
      await btn.click({ timeout: 10000 });
      await sleep(5000);
      console.log('[GZ-07] Publish clicked!');
      break;
    }
  }

  // Final state
  const finalText = await page.locator('body').innerText().catch(() => '');
  console.log('[GZ-07] Final URL:', page.url());
  console.log('[GZ-07] Final text preview:', finalText.substring(0, 600));
  
  if (finalText.includes('Đã đăng') || finalText.includes('posted') || finalText.includes('thành công') || page.url().includes('/post')) {
    console.log('[GZ-07] SUCCESS - Video published!');
  }

  await browser.close();
  console.log('[GZ-07] Done.');
}

main().catch(e => {
  console.error('[GZ-07] Fatal:', e.message);
  process.exit(1);
});