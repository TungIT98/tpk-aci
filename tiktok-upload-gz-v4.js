/**
 * tiktok-upload-gz-v4.js
 * Upload GZ-07 to TikTok - PUBLISH step - find and click "Đăng" button
 */
import { chromium } from 'playwright';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const SESSION_PATH = resolve('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/.tiktok-session.json');
const CAPTION = 'I Did a 30-Day No-Spend Challenge — Here\'s What Actually Happened #nospendchallenge #savingmoney #budgeting #genzfinance #moneymindset #30daychallenge #fyp';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[GZ-07 v4] Starting...');
  const sessionData = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({ storageState: sessionData, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('dialog', async dialog => { console.log('[GZ-07] Dialog:', dialog.message()); await dialog.accept(); });

  console.log('[GZ-07] Going to TikTok Studio...');
  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp&lang=vi-VN', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);

  // Dismiss any dialog
  try {
    const cont = page.locator('button:has-text("Tiếp tục")').first();
    if (await cont.count() > 0) { await cont.click({ timeout: 3000 }); await sleep(1500); }
  } catch(e) {}

  // Check if video is already uploaded - look for "Đã tải lên" (Uploaded)
  const pageText = await page.locator('body').innerText().catch(() => '');
  
  if (pageText.includes('Đã tải lên')) {
    console.log('[GZ-07] Video already uploaded. Looking for publish button...');
    
    // Get all buttons on page to find "Đăng"
    const allButtons = await page.locator('button').all();
    console.log(`[GZ-07] Total buttons: ${allButtons.length}`);
    for (let i = 0; i < allButtons.length; i++) {
      const txt = await allButtons[i].innerText().catch(() => '');
      const disabled = await allButtons[i].getAttribute('disabled').catch(() => null);
      if (txt.trim()) console.log(`  [${i}] "${txt.trim()}" ${disabled !== null ? '(disabled)' : ''}`);
    }
    
    // Try to find and click the Đăng/Post button
    const publishBtn = page.locator('button:has-text("Đăng")').first();
    if (await publishBtn.count() > 0) {
      const isDisabled = await publishBtn.getAttribute('disabled').catch(() => null);
      console.log(`[GZ-07] Publish button found, disabled=${isDisabled !== null}`);
      console.log(`[GZ-07] Clicking publish...`);
      await publishBtn.click({ timeout: 10000 });
      await sleep(6000);
      console.log('[GZ-07] Publish clicked!');
    } else {
      console.log('[GZ-07] No "Đăng" button found. Trying "Post"...');
      const postBtn = page.locator('button:has-text("Post")').first();
      if (await postBtn.count() > 0) {
        await postBtn.click({ timeout: 10000 });
        await sleep(6000);
      }
    }
  } else {
    console.log('[GZ-07] No upload detected, uploading fresh...');
    const selectBtn = page.locator('button:has-text("Chọn video")').first();
    if (await selectBtn.count() > 0) {
      await selectBtn.click({ force: true, timeout: 5000 });
      await sleep(2000);
    }
    const inputs = await page.locator('input[type="file"]').all();
    if (inputs.length > 0) {
      await inputs[0].setInputFiles('C:/tmp/openclaw/uploads/GZ-07-FINAL.mp4');
      await sleep(8000);
      // Fill caption
      const ta = page.locator('textarea').first();
      if (await ta.count() > 0) {
        await ta.click(); await page.keyboard.press('Control+a'); await page.keyboard.type(CAPTION);
        await sleep(1000);
      }
      // Click publish
      const pb = page.locator('button:has-text("Đăng")').first();
      if (await pb.count() > 0) {
        await pb.click({ timeout: 10000 });
        await sleep(6000);
      }
    }
  }

  const finalText = await page.locator('body').innerText().catch(() => '');
  console.log('[GZ-07] Final state:', finalText.substring(0, 500));
  console.log('[GZ-07] URL:', page.url());
  
  // Look for success indicators
  if (finalText.includes('Đã đăng') || finalText.includes('posted') || finalText.includes('thành công') || finalText.includes('Published')) {
    console.log('[GZ-07] SUCCESS: Video published!');
  }
  
  await browser.close();
  console.log('[GZ-07] Done.');
}

main().catch(e => {
  console.error('[GZ-07] Fatal:', e.message);
  process.exit(1);
});