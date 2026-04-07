/**
 * tiktok-upload-gz-v7.js
 * Upload GZ-07 to TikTok - handle post-publish redirect
 */
import { chromium } from 'playwright';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const SESSION_PATH = resolve('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/.tiktok-session.json');
const VIDEO_PATH = 'C:/tmp/openclaw/uploads/GZ-07-FINAL.mp4';
const CAPTION = 'I Did a 30-Day No-Spend Challenge — Here\'s What Actually Happened #nospendchallenge #savingmoney #budgeting #genzfinance #moneymindset #30daychallenge #fyp';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[GZ-07 v7] Starting...');
  const sessionData = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({ storageState: sessionData, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('dialog', async dialog => { 
    console.log('[GZ-07] Dialog:', dialog.message()); 
    await dialog.accept(); 
  });

  // Listen for navigation
  let finalUrl = '';
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/post') || url.includes('/upload') && response.status() === 200) {
      console.log('[GZ-07] Response:', response.status(), url);
    }
  });

  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp&lang=vi-VN', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);

  // Dismiss dialog
  const cont = page.locator('button:has-text("Tiếp tục")');
  if (await cont.count() > 0) { await cont.click({ timeout: 3000 }); await sleep(1500); }

  // Upload fresh
  const selectBtn = page.locator('button:has-text("Chọn video")');
  if (await selectBtn.count() > 0) {
    await selectBtn.click({ force: true, timeout: 5000 });
    await sleep(2000);
  }
  const inputs = page.locator('input[type="file"]');
  if (await inputs.count() > 0) {
    await inputs.first().setInputFiles(VIDEO_PATH);
    console.log('[GZ-07] Video attached, waiting...');
    await sleep(8000);
  }

  // Fill caption via contenteditable
  const editable = page.locator('[contenteditable="true"]').first();
  if (await editable.count() > 0) {
    await editable.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type(CAPTION);
    await sleep(1000);
  }

  // Click "Bây giờ"
  const nowBtn = page.locator('button:has-text("Bây giờ")');
  if (await nowBtn.count() > 0) {
    await nowBtn.click({ timeout: 5000 });
    await sleep(2000);
  }

  // Find and CLICK the first enabled "Đăng" button (index 23)
  console.log('[GZ-07] Looking for Đăng button...');
  const allBtns = await page.locator('button').all();
  let clicked = false;
  for (let i = 0; i < allBtns.length; i++) {
    const txt = (await allBtns[i].innerText().catch(() => '')).trim();
    const disabled = await allBtns[i].getAttribute('disabled').catch(() => null);
    const ariaDis = await allBtns[i].getAttribute('aria-disabled').catch(() => null);
    if (txt === 'Đăng' || txt.includes('Đăng')) {
      console.log(`[GZ-07] Found Đăng at index ${i}, disabled=${disabled}, aria-disabled=${ariaDis}`);
      if (disabled === null && ariaDis !== 'true') {
        console.log(`[GZ-07] CLICKING Đăng button at index ${i}...`);
        await allBtns[i].click({ force: true, timeout: 15000 });
        console.log('[GZ-07] Clicked!');
        clicked = true;
        break;
      }
    }
  }

  if (!clicked) {
    console.log('[GZ-07] ERROR: Could not click Đăng button');
    await browser.close();
    process.exit(1);
  }

  // Wait for processing (TikTok may show a spinner or redirect)
  console.log('[GZ-07] Waiting for publish to process...');
  await sleep(8000);

  // Check URL - does it redirect to video view?
  const currentUrl = page.url();
  console.log('[GZ-07] URL after publish:', currentUrl);
  
  // Wait more for redirect
  await sleep(5000);
  const newUrl = page.url();
  console.log('[GZ-07] URL after extra wait:', newUrl);

  // Take screenshot
  await page.screenshot({ path: 'C:/tmp/openclaw/uploads/gz07-final-state.png' });
  console.log('[GZ-07] Screenshot saved');

  // Final page text
  const finalText = await page.locator('body').innerText().catch(() => '');
  const hasSuccess = finalText.includes('Đã đăng') || finalText.includes('posted') || finalText.includes('thành công') || finalText.includes('Published');
  console.log('[GZ-07] Success indicators found:', hasSuccess);
  console.log('[GZ-07] Final text:', finalText.substring(0, 800));

  await browser.close();
  console.log('[GZ-07] Done.');
}

main().catch(e => {
  console.error('[GZ-07] Fatal:', e.message);
  process.exit(1);
});