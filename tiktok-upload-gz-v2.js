/**
 * tiktok-upload-gz-v2.js
 * Upload GZ-07 to TikTok using Playwright - direct file input approach
 */
import { chromium } from 'playwright';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const SESSION_PATH = resolve('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/.tiktok-session.json');
const VIDEO_PATH = 'C:/tmp/openclaw/uploads/GZ-07-FINAL.mp4';
const CAPTION = 'I Did a 30-Day No-Spend Challenge — Here\'s What Actually Happened #nospendchallenge #savingmoney #budgeting #genzfinance #moneymindset #30daychallenge #fyp';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('[GZ-07 Upload v2] Starting...');

  if (!existsSync(SESSION_PATH)) {
    console.error('ERROR: No session file');
    process.exit(1);
  }
  if (!existsSync(VIDEO_PATH)) {
    console.error('ERROR: Video not found at', VIDEO_PATH);
    process.exit(1);
  }

  const sessionData = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    storageState: sessionData,
    viewport: { width: 1280, height: 800 },
    // Accept dialogs / alerts
  });

  const page = await context.newPage();
  
  // Catch any dialogs (e.g. edit-in-progress warning)
  page.on('dialog', async dialog => {
    console.log('[GZ-07] Dialog:', dialog.message());
    await dialog.accept();
  });

  console.log('[GZ-07] Navigating to TikTok Studio...');
  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp&lang=vi-VN', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);

  // Dismiss any popup dialogs first
  console.log('[GZ-07] Checking URL:', page.url());
  
  // Try clicking "Tiếp tục" if edit-in-progress dialog is showing
  try {
    const contBtn = page.locator('button:has-text("Tiếp tục")').first();
    if (await contBtn.count() > 0) {
      console.log('[GZ-07] Clicking Tiếp tục...');
      await contBtn.click({ timeout: 3000 });
      await sleep(2000);
    }
  } catch(e) {
    console.log('[GZ-07] No dialog to dismiss:', e.message);
  }

  // Strategy: Click "Chọn video" button, then immediately set files on any file input that appears
  console.log('[GZ-07] Looking for select-video button...');
  
  const selectBtn = page.locator('button:has-text("Chọn video"), button:has-text("Select video"), button:has-text("Upload")').first();
  
  if (await selectBtn.count() > 0) {
    console.log('[GZ-07] Found select button. Clicking with force...');
    
    // Click the button which triggers the hidden file input creation
    await selectBtn.click({ force: true, timeout: 5000 }).catch(e => console.log('[GZ-07] Click failed:', e.message));
    
    // Wait a moment for input to appear
    await sleep(2000);
    
    // Now find any file inputs and set files
    const inputs = await page.locator('input[type="file"]').all();
    console.log('[GZ-07] Found', inputs.length, 'file input(s)');
    
    if (inputs.length > 0) {
      for (const input of inputs) {
        const isHidden = await input.getAttribute('type') === 'file';
        console.log('[GZ-07] Attaching video to input...');
        try {
          await input.setInputFiles(VIDEO_PATH);
          console.log('[GZ-07] File attached!');
          await sleep(8000); // wait for upload processing
        } catch(e) {
          console.log('[GZ-07] setInputFiles failed:', e.message);
        }
      }
    } else {
      // Try creating an input and triggering upload via JS
      console.log('[GZ-07] No inputs found. Trying JS injection...');
      await page.evaluate(async (videoPath) => {
        // Find any clickable upload trigger
        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
        console.log('Found', buttons.length, 'buttons/divs');
        
        // Try to find the hidden file input
        const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
        console.log('Found', fileInputs.length, 'file inputs');
        
        // Check if any are display:none or visibility:hidden
        fileInputs.forEach((input, i) => {
          const style = window.getComputedStyle(input);
          console.log(`Input ${i}: display=${style.display}, visibility=${style.visibility}, opacity=${style.opacity}`);
        });
      }, VIDEO_PATH);
    }
  } else {
    console.log('[GZ-07] Could not find select button');
  }

  // Check state
  await sleep(3000);
  const text = await page.locator('body').innerText().catch(() => '');
  console.log('[GZ-07] Page state (truncated):', text.substring(0, 800));

  await browser.close();
  console.log('[GZ-07] Done.');
}

main().catch(e => {
  console.error('[GZ-07] Fatal error:', e.message, e.stack);
  process.exit(1);
});