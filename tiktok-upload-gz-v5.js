/**
 * tiktok-upload-gz-v5.js
 * Upload GZ-07 to TikTok - find the correct post button
 */
import { chromium } from 'playwright';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const SESSION_PATH = resolve('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/.tiktok-session.json');
const CAPTION = 'I Did a 30-Day No-Spend Challenge — Here\'s What Actually Happened #nospendchallenge #savingmoney #budgeting #genzfinance #moneymindset #30daychallenge #fyp';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[GZ-07 v5] Starting...');
  const sessionData = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({ storageState: sessionData, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('dialog', async dialog => { console.log('[GZ-07] Dialog:', dialog.message()); await dialog.accept(); });

  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp&lang=vi-VN', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);

  // Dismiss dialog
  try {
    const cont = page.locator('button:has-text("Tiếp tục")').first();
    if (await cont.count() > 0) { await cont.click({ timeout: 3000 }); await sleep(1500); }
  } catch(e) {}

  // Check current state
  const pageText = await page.locator('body').innerText().catch(() => '');
  console.log('[GZ-07] Page has uploaded video:', pageText.includes('Đã tải lên'));
  
  // Take screenshot for debugging
  await page.screenshot({ path: 'C:/tmp/openclaw/uploads/gz07-upload-state.png' });
  console.log('[GZ-07] Screenshot saved');

  // Get ALL buttons, inputs, textareas, and other interactive elements
  const buttons = await page.locator('button').all();
  console.log(`[GZ-07] Total buttons: ${buttons.length}`);
  for (let i = 0; i < buttons.length; i++) {
    const txt = await buttons[i].innerText().catch(() => '').then(t => t.trim());
    const disabled = await buttons[i].getAttribute('disabled').catch(() => null);
    const aria = await buttons[i].getAttribute('aria-disabled').catch(() => null);
    const classes = await buttons[i].getAttribute('class').catch(() => '');
    if (txt) console.log(`  [${i}] "${txt}" disabled=${disabled !== null} aria-disabled=${aria} class=${classes.substring(0, 60)}`);
  }

  // Also check for inputs and textareas
  const textareas = await page.locator('textarea').all();
  console.log(`[GZ-07] Textareas: ${textareas.length}`);
  for (let i = 0; i < textareas.length; i++) {
    const val = await textareas[i].inputValue().catch(() => '');
    const ph = await textareas[i].getAttribute('placeholder').catch(() => '');
    console.log(`  [${i}] placeholder="${ph}" value="${val.substring(0, 80)}"`);
  }

  // Check for divs with contenteditable
  const editable = await page.locator('[contenteditable="true"]').all();
  console.log(`[GZ-07] Editable divs: ${editable.length}`);
  for (let i = 0; i < editable.length; i++) {
    const text = await editable[i].innerText().catch(() => '');
    const role = await editable[i].getAttribute('role').catch(() => '');
    console.log(`  [${i}] role="${role}" text="${text.substring(0, 80)}"`);
  }

  // Now fill the caption - find the description field
  // The description field seems to be "GZ-07-FINAL" (from v4 output)
  // This means the description textarea might be filled but with placeholder
  console.log('[GZ-07] Filling description/caption...');
  
  // Try clicking on the description area first
  const descLabels = page.locator('text=/Mô tả|Description|Caption|Title/i').all();
  if (await descLabels.count() > 0) {
    console.log('[GZ-07] Found description labels, clicking one...');
    await descLabels[0].click({ timeout: 3000 }).catch(() => {});
    await sleep(1000);
  }

  // Try using Tab to navigate and fill
  await page.keyboard.press('Tab');
  await sleep(500);

  // Type caption
  await page.keyboard.type(CAPTION, { delay: 50 });
  await sleep(1000);
  
  // Check textarea after typing
  const taAfter = await page.locator('textarea').first();
  const taVal = await taAfter.inputValue().catch(() => 'N/A');
  console.log('[GZ-07] Caption after typing:', taVal.substring(0, 100));

  // Now try to publish - look for button by looking at bottom of page
  // TikTok Studio typically has a prominent blue "Đăng" button
  console.log('[GZ-07] Looking for publish button again...');
  
  // Try clicking by aria-label or data-e2e
  const publishByE2e = page.locator('[data-e2e], [aria-label*="Đăng"], [aria-label*="Post"], [aria-label*="Publish"]').all();
  if (await publishByE2e.count() > 0) {
    console.log('[GZ-07] Found publish element by e2e/aria');
    for (let i = 0; i < publishByE2e.count(); i++) {
      const tag = await publishByE2e[i].evaluate(el => el.tagName);
      const txt = await publishByE2e[i].innerText().catch(() => '');
      console.log(`  ${tag}: "${txt}"`);
    }
  }

  // Try clicking "Bây giờ" first then looking for post
  const nowBtn = page.locator('button:has-text("Bây giờ")').first();
  if (await nowBtn.count() > 0) {
    console.log('[GZ-07] Clicking "Bây giờ" (post timing)...');
    await nowBtn.click({ timeout: 3000 });
    await sleep(2000);
  }

  // Final publish attempt - click the first enabled button with text Đăng
  console.log('[GZ-07] Looking for enabled Đăng button...');
  const allBtns = await page.locator('button').all();
  for (const btn of allBtns) {
    const txt = await btn.innerText().catch(() => '').then(t => t.trim());
    const disabled = await btn.getAttribute('disabled').catch(() => null);
    if (txt.includes('Đăng') || txt.includes('Post') || txt.includes('Publish')) {
      console.log(`[GZ-07] Found: "${txt}" disabled=${disabled !== null}`);
      if (disabled === null) {
        console.log(`[GZ-07] CLICKING: ${txt}`);
        await btn.click({ timeout: 10000 });
        await sleep(5000);
        break;
      }
    }
  }

  const finalText = await page.locator('body').innerText().catch(() => '');
  console.log('[GZ-07] Final:', finalText.substring(0, 500));
  console.log('[GZ-07] URL:', page.url());
  
  await browser.close();
  console.log('[GZ-07] Done.');
}

main().catch(e => {
  console.error('[GZ-07] Fatal:', e.message);
  process.exit(1);
});