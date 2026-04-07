/**
 * tiktok-upload-gz-v3.js
 * Upload GZ-07 to TikTok - PUBLISH step
 */
import { chromium } from 'playwright';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const SESSION_PATH = resolve('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/.tiktok-session.json');
const CAPTION = 'I Did a 30-Day No-Spend Challenge — Here\'s What Actually Happened #nospendchallenge #savingmoney #budgeting #genzfinance #moneymindset #30daychallenge #fyp';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('[GZ-07 Publish] Starting...');

  const sessionData = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    storageState: sessionData,
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  page.on('dialog', async dialog => {
    console.log('[GZ-07] Dialog:', dialog.message());
    await dialog.accept();
  });

  // Go directly to TikTok Studio upload page
  console.log('[GZ-07] Navigating to TikTok Studio...');
  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp&lang=vi-VN', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);

  // Dismiss "Tiếp tục" if dialog appears
  try {
    const cont = page.locator('button:has-text("Tiếp tục")').first();
    if (await cont.count() > 0) {
      await cont.click({ timeout: 3000 });
      await sleep(1500);
    }
  } catch(e) {}

  // If a video is still in editor from v2 run, detect and publish
  // Otherwise upload fresh
  const pageText = await page.locator('body').innerText().catch(() => '');
  
  if (pageText.includes('Đã tải lên') || pageText.includes('GZ-07')) {
    console.log('[GZ-07] Video already in editor from previous session');
    
    // Fill in caption if empty or placeholder
    // Find the caption/description textarea
    const textarea = page.locator('textarea, div[contenteditable="true"]').first();
    if (await textarea.count() > 0) {
      const currentVal = await textarea.inputValue().catch(() => '');
      if (!currentVal || currentVal === 'GZ-07-FINAL') {
        console.log('[GZ-07] Filling caption...');
        await textarea.click();
        // Select all and replace
        await page.keyboard.press('Control+a');
        await page.keyboard.type(CAPTION);
        await sleep(1000);
      }
    }
    
    // Look for publish button
    console.log('[GZ-07] Looking for publish button...');
    const publishBtn = page.locator('button:has-text("Đăng"), button:has-text("Post"), button:has-text("Publish")').first();
    if (await publishBtn.count() > 0) {
      console.log('[GZ-07] Found publish button, clicking...');
      await publishBtn.click({ timeout: 5000 });
      await sleep(5000);
      console.log('[GZ-07] Publish clicked!');
    } else {
      console.log('[GZ-07] No publish button found yet, checking for "Bây giờ" button...');
      const nowBtn = page.locator('button:has-text("Bây giờ")').first();
      if (await nowBtn.count() > 0) {
        console.log('[GZ-07] Clicking "Bây giờ" (Now)...');
        await nowBtn.click({ timeout: 3000 });
        await sleep(2000);
        // Now look for publish again
        const pb2 = page.locator('button:has-text("Đăng"), button:has-text("Post")').first();
        if (await pb2.count() > 0) {
          await pb2.click({ timeout: 5000 });
          await sleep(5000);
        }
      }
    }
  } else {
    // Need to upload fresh
    console.log('[GZ-07] No prior upload detected, uploading fresh...');
    
    // Find select button
    const selectBtn = page.locator('button:has-text("Chọn video"), button:has-text("Select video")').first();
    if (await selectBtn.count() > 0) {
      await selectBtn.click({ force: true, timeout: 5000 });
      await sleep(2000);
    }
    
    const inputs = await page.locator('input[type="file"]').all();
    if (inputs.length > 0) {
      console.log('[GZ-07] Attaching video...');
      await inputs[0].setInputFiles('C:/tmp/openclaw/uploads/GZ-07-FINAL.mp4');
      await sleep(8000);
      
      // Fill caption
      const textarea = page.locator('textarea, div[contenteditable="true"]').first();
      if (await textarea.count() > 0) {
        await textarea.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.type(CAPTION);
        await sleep(1000);
      }
      
      // Publish
      const pb = page.locator('button:has-text("Đăng"), button:has-text("Post")').first();
      if (await pb.count() > 0) {
        await pb.click({ timeout: 5000 });
        await sleep(5000);
      }
    }
  }

  // Final state check
  const finalText = await page.locator('body').innerText().catch(() => '');
  console.log('[GZ-07] Final page state:', finalText.substring(0, 1000));
  
  // Look for URL in page
  const url = page.url();
  console.log('[GZ-07] Final URL:', url);
  
  await browser.close();
  console.log('[GZ-07] Done.');
}

main().catch(e => {
  console.error('[GZ-07] Fatal error:', e.message);
  process.exit(1);
});