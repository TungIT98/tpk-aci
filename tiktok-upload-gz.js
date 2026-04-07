/**
 * tiktok-upload-gz.js
 * Upload GZ-07 to TikTok using Playwright with existing session
 */
import { chromium } from 'playwright';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const SESSION_PATH = resolve('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/.tiktok-session.json');
const VIDEO_PATH = 'C:/tmp/openclaw/uploads/GZ-07-FINAL.mp4';
const CAPTION = 'I Did a 30-Day No-Spend Challenge — Here\'s What Actually Happened #nospendchallenge #savingmoney #budgeting #genzfinance #moneymindset #30daychallenge #fyp';

async function main() {
  console.log('[GZ-07 Upload] Starting...');

  if (!existsSync(SESSION_PATH)) {
    console.error('ERROR: No session file at', SESSION_PATH);
    process.exit(1);
  }
  if (!existsSync(VIDEO_PATH)) {
    console.error('ERROR: Video not found at', VIDEO_PATH);
    process.exit(1);
  }

  const sessionData = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));
  console.log('[GZ-07 Upload] Restoring session from', SESSION_PATH);

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    storageState: sessionData,
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // Go to TikTok Studio upload
  console.log('[GZ-07 Upload] Navigating to TikTok Studio...');
  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp&lang=vi-VN', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Check if logged in
  const url = page.url();
  if (url.includes('/login')) {
    console.error('ERROR: Not logged in. Session may have expired.');
    await browser.close();
    process.exit(1);
  }
  console.log('[GZ-07 Upload] Logged in. URL:', url);

  // Click "Tiếp tục" to dismiss the edit-in-progress dialog if present
  const continueBtn = page.locator('button:has-text("Tiếp tục"), button:has-text("Continue")').first();
  if (await continueBtn.count() > 0) {
    console.log('[GZ-07 Upload] Dismissing edit-in-progress dialog...');
    await continueBtn.click();
    await page.waitForTimeout(1000);
  }

  // Look for the file input element and set files
  console.log('[GZ-07 Upload] Looking for file input...');

  // TikTok Studio uses a hidden file input - try to find and attach
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    console.log('[GZ-07 Upload] Found file input, attaching video...');
    await fileInput.setInputFiles(VIDEO_PATH);
    await page.waitForTimeout(5000);
    console.log('[GZ-07 Upload] File attached.');
  } else {
    // Try clicking the "Chọn video" button first, then find input
    console.log('[GZ-07 Upload] No file input found via locator, trying button click...');
    const selectBtn = page.locator('button:has-text("Chọn video"), button:has-text("Select video")').first();
    if (await selectBtn.count() > 0) {
      console.log('[GZ-07 Upload] Clicking select button...');
      // Use force click to bypass any overlay
      await selectBtn.click({ force: true, timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // After clicking, input should appear
    const fileInputAfter = page.locator('input[type="file"]').first();
    if (await fileInputAfter.count() > 0) {
      console.log('[GZ-07 Upload] Found file input after button click, attaching...');
      await fileInputAfter.setInputFiles(VIDEO_PATH);
      await page.waitForTimeout(5000);
    } else {
      // Fallback: evaluate JS to set the file input
      console.log('[GZ-07 Upload] Trying JS fallback to attach file...');
      await page.evaluate((videoPath) => {
        const input = document.querySelector('input[type="file"]');
        if (input) {
          // Create a DataTransfer and set files
          const dt = new DataTransfer();
          const file = new File([], videoPath.split('/').pop(), { type: 'video/mp4' });
          // Can't actually set file content this way - need real File object
          console.log('File input found but cannot set files via JS');
        }
      }, VIDEO_PATH);
    }
  }

  // Wait for upload to process and check state
  console.log('[GZ-07 Upload] Checking upload progress...');
  await page.waitForTimeout(5000);

  // Take snapshot to see what's on screen
  const bodyText = await page.locator('body').innerText().catch(() => '');
  console.log('[GZ-07 Upload] Page text preview:', bodyText.substring(0, 500));

  await browser.close();
  console.log('[GZ-07 Upload] Done.');
}

main().catch(e => {
  console.error('[GZ-07 Upload] Error:', e.message);
  process.exit(1);
});