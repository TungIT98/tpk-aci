/**
 * upload-wc02-tiktok.mjs - Upload WC-02 to TikTok
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI';

const SESSION_PATH = resolve(BASE_DIR, '.tiktok-session.json');
const VIDEO_PATH = resolve(BASE_DIR, 'uploads/WC-02.mp4');
const CAPTION = `The ball gets passed. Then again. Then suddenly everyone's on their feet...

#viral #sports #amazing #fyp #football #basketball #incredible #wow`;

const TITLE = 'The Entire Bar Falls Silent';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[WC-02] Starting TikTok upload...');
  console.log('[WC-02] Video:', VIDEO_PATH);
  console.log('[WC-02] File exists:', existsSync(VIDEO_PATH));

  if (!existsSync(VIDEO_PATH)) {
    console.error('[WC-02] ERROR: Video file not found!');
    process.exit(1);
  }

  const sessionData = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));
  console.log('[WC-02] Session loaded, cookies:', sessionData.cookies?.length || 0);

  const browser = await chromium.launch({ 
    headless: false, 
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] 
  });
  const context = await browser.newContext({ 
    storageState: sessionData, 
    viewport: { width: 1280, height: 800 } 
  });
  const page = await context.newPage();
  page.on('dialog', async dialog => { 
    console.log('[WC-02] Dialog:', dialog.message()); 
    await dialog.accept(); 
  });

  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp&lang=vi-VN', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);

  // Dismiss "Tiếp tục" dialog if present
  const cont = page.locator('button:has-text("Tiếp tục")');
  if (await cont.count() > 0) { 
    await cont.click({ timeout: 3000 }); 
    await sleep(1500); 
  }

  // Check current state
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const alreadyUploaded = bodyText.includes('Đã tải lên') && bodyText.includes('1080P');
  console.log('[WC-02] Already uploaded:', alreadyUploaded);

  if (!alreadyUploaded) {
    console.log('[WC-02] Uploading fresh...');
    const chooseBtn = page.locator('button:has-text("Chọn video")');
    if (await chooseBtn.count() > 0) {
      await chooseBtn.click({ force: true, timeout: 5000 });
      await sleep(2000);
    }
    
    const inputs = page.locator('input[type="file"]');
    if (await inputs.count() > 0) {
      await inputs.first().setInputFiles(VIDEO_PATH);
      console.log('[WC-02] Video attached, waiting for upload...');
      await page.waitForTimeout(15000);
    } else {
      console.log('[WC-02] ERROR: Could not find file input');
      await page.screenshot({ path: resolve(BASE_DIR, 'wc02-upload-error.png') });
      await browser.close();
      process.exit(1);
    }
  } else {
    console.log('[WC-02] Video already in editor');
  }

  // Wait for content check
  const checkText = await page.locator('body').innerText().catch(() => '');
  const stillChecking = checkText.includes('Đang kiểm tra') && checkText.includes('10 phút');
  console.log('[WC-02] Content check still running:', stillChecking);

  if (stillChecking) {
    console.log('[WC-02] Waiting for content check (up to 10 min)...');
    for (let i = 0; i < 20; i++) {
      await sleep(30000);
      const text = await page.locator('body').innerText().catch(() => '');
      if (!text.includes('Đang kiểm tra') || text.includes('Không phát hiện')) {
        console.log(`[WC-02] Content check done after ${(i+1)*30}s`);
        break;
      }
      console.log(`[WC-02] Still checking... ${(i+1)*30}s elapsed`);
    }
  }

  // Fill caption
  const afterCheck = await page.locator('body').innerText().catch(() => '');
  const captionFilled = afterCheck.includes('on their feet');
  console.log('[WC-02] Caption filled:', captionFilled);
  
  if (!captionFilled) {
    const editable = page.locator('[contenteditable="true"]').first();
    if (await editable.count() > 0) {
      await editable.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.type(CAPTION);
      await sleep(1000);
    }
  }

  // Select "Bây giờ" (Now)
  const nowBtn = page.locator('button:has-text("Bây giờ")');
  if (await nowBtn.count() > 0) {
    await nowBtn.click({ timeout: 5000 });
    await sleep(2000);
  }

  // Click Đăng via JS evaluate
  console.log('[WC-02] Clicking Đăng...');
  const clickResult = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const btn of buttons) {
      const text = btn.innerText.trim();
      if (text === 'Đăng' || text === 'Post' || text === 'Publish') {
        btn.click();
        return { clicked: true, text, disabled: btn.disabled };
      }
    }
    return { clicked: false };
  });
  console.log('[WC-02] JS click result:', JSON.stringify(clickResult));
  
  await sleep(10000);

  // Check final state
  const finalUrl = page.url();
  const finalText = await page.locator('body').innerText().catch(() => '');
  console.log('[WC-02] Final URL:', finalUrl);
  
  const success = finalText.includes('Đã đăng') || finalText.includes('posted') || 
                  finalText.includes('thành công') || finalText.includes('Published') || 
                  finalUrl.includes('/post');
  console.log('[WC-02] SUCCESS:', success);

  if (!success) {
    console.log('[WC-02] WARNING: Publish may not have completed.');
    console.log('[WC-02] Final text preview:', finalText.substring(0, 500));
  }

  await page.screenshot({ path: resolve(BASE_DIR, 'wc02-tiktok-result.png') });
  await browser.close();
  console.log('[WC-02] Done.');
  
  if (!success) process.exit(1);
}

main().catch(e => {
  console.error('[WC-02] Fatal:', e.message);
  process.exit(1);
});
