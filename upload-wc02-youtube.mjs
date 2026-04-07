/**
 * upload-wc02-youtube.mjs - Upload WC-02 to YouTube via Playwright browser
 */
import { chromium } from 'playwright';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const BASE_DIR = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI';
const SESSION_PATH = resolve(BASE_DIR, '.youtube-session.json');
const VIDEO_PATH = resolve(BASE_DIR, 'uploads/WC-02.mp4');

const TITLE = 'The Entire Bar Falls Silent';
const DESCRIPTION = `The ball gets passed. Then again. Then suddenly everyone's on their feet...

#viral #sports #amazing #football #basketball #incredible #wow`;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[WC-02 YouTube] Starting...');
  console.log('[WC-02 YouTube] Video:', VIDEO_PATH);
  console.log('[WC-02 YouTube] File exists:', existsSync(VIDEO_PATH));

  if (!existsSync(VIDEO_PATH)) {
    console.error('[WC-02 YouTube] ERROR: Video not found!');
    process.exit(1);
  }

  let sessionData = null;
  try {
    sessionData = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));
    console.log('[WC-02 YouTube] Session loaded, cookies:', sessionData.cookies?.length || 0);
  } catch (e) {
    console.log('[WC-02 YouTube] No session file, starting fresh');
  }

  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const context = sessionData 
    ? await browser.newContext({ storageState: sessionData, viewport: { width: 1280, height: 800 } })
    : await browser.newContext({ viewport: { width: 1280, height: 800 } });
  
  const page = await context.newPage();
  page.on('dialog', async dialog => { 
    console.log('[WC-02 YouTube] Dialog:', dialog.message()); 
    await dialog.accept(); 
  });

  console.log('[WC-02 YouTube] Navigating to YouTube Studio...');
  await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/videos/upload?d=ud', { 
    waitUntil: 'domcontentloaded',
    timeout: 20000 
  });
  await sleep(5000);
  
  console.log('[WC-02 YouTube] URL:', page.url());
  
  // Check if we got redirected to login
  const currentUrl = page.url();
  const isLoggedIn = !currentUrl.includes('accounts.google.com') && !currentUrl.includes('login');
  console.log('[WC-02 YouTube] Logged in:', isLoggedIn);

  if (!isLoggedIn) {
    console.log('[WC-02 YouTube] WARNING: Redirected to login. YouTube session appears expired.');
    console.log('[WC-02 YouTube] Current URL:', currentUrl);
    await page.screenshot({ path: resolve(BASE_DIR, 'wc02-yt-login.png') });
    await browser.close();
    console.log('[WC-02 YouTube] YouTube OAuth needs re-authentication. Session expired.');
    process.exit(1);
  }

  // Try to find file input
  console.log('[WC-02 YouTube] Looking for file input...');
  const fileInput = page.locator('input[type="file"]').first();
  const isVisible = await fileInput.isVisible().catch(() => false);
  console.log('[WC-02 YouTube] File input visible:', isVisible);
  
  if (!isVisible) {
    console.log('[WC-02 YouTube] File input not found. Page might be in wrong state.');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log('[WC-02 YouTube] Page text preview:', bodyText.substring(0, 500));
    await page.screenshot({ path: resolve(BASE_DIR, 'wc02-yt-page.png') });
    await browser.close();
    process.exit(1);
  }

  console.log('[WC-02 YouTube] Uploading video...');
  await fileInput.setInputFiles(VIDEO_PATH, { timeout: 10000 });
  console.log('[WC-02 YouTube] File set, waiting for processing...');
  
  // Wait for upload to start processing
  await page.waitForTimeout(10000);
  
  // Check for title input and fill it
  const titleInput = page.locator('#title-input, input[name="title"], #title, [aria-label*="title" i]').first();
  const titleVisible = await titleInput.isVisible().catch(() => false);
  console.log('[WC-02 YouTube] Title input visible:', titleVisible);
  
  if (titleVisible) {
    await titleInput.fill(TITLE);
    console.log('[WC-02 YouTube] Title filled');
  }

  // Try to find description textarea
  const descInput = page.locator('#description-input, textarea[name="description"], #description, [aria-label*="description" i]').first();
  const descVisible = await descInput.isVisible().catch(() => false);
  console.log('[WC-02 YouTube] Description input visible:', descVisible);
  
  if (descVisible) {
    await descInput.fill(DESCRIPTION);
    console.log('[WC-02 YouTube] Description filled');
  }

  // Look for NEXT button and click it
  await page.waitForTimeout(3000);
  const nextBtn = page.locator('button:has-text("Tiếp"), button:has-text("Next"), button:has-text("Tiếp tục")').first();
  if (await nextBtn.isVisible().catch(() => false)) {
    await nextBtn.click();
    console.log('[WC-02 YouTube] Clicked Next');
    await page.waitForTimeout(3000);
  }

  // Look for "Not for kids" or similar radio buttons and select "No"
  const notForKidsSection = page.locator('text=/Not made for kids/i, text=/Không dành cho trẻ em/i').first();
  if (await notForKidsSection.isVisible().catch(() => false)) {
    const noRadio = page.locator('[aria-label*="No" i], [aria-label*="Không" i]').first();
    if (await noRadio.isVisible().catch(() => false)) {
      await noRadio.click();
      console.log('[WC-02 YouTube] Set Not for kids = No');
    }
  }

  // Look for PUBLIC button and click it
  const publicBtn = page.locator('button:has-text("Public"), button:has-text("Công khai"), button[id*="public" i]').first();
  if (await publicBtn.isVisible().catch(() => false)) {
    await publicBtn.click();
    console.log('[WC-02 YouTube] Set visibility to Public');
    await page.waitForTimeout(2000);
  }

  // Look for PUBLISH/Done button
  const publishBtn = page.locator('button:has-text("Publish"), button:has-text("Đăng tải"), button:has-text("Done"), button:has-text("Xong")').first();
  if (await publishBtn.isVisible().catch(() => false)) {
    await publishBtn.click();
    console.log('[WC-02 YouTube] Clicked Publish');
    await page.waitForTimeout(5000);
  }

  console.log('[WC-02 YouTube] Final URL:', page.url());
  const finalText = await page.locator('body').innerText().catch(() => '');
  const success = finalText.includes('Posted') || finalText.includes('published') || 
                 finalText.includes('Đã đăng') || page.url().includes('/edit');
  console.log('[WC-02 YouTube] SUCCESS:', success);

  await page.screenshot({ path: resolve(BASE_DIR, 'wc02-yt-result.png') });
  await browser.close();
  
  if (!success) {
    console.log('[WC-02 YouTube] WARNING: Upload may not have completed.');
    console.log('[WC-02 YouTube] Page text:', finalText.substring(0, 500));
    process.exit(1);
  }
  
  console.log('[WC-02 YouTube] Done.');
}

main().catch(e => {
  console.error('[WC-02 YouTube] Fatal:', e.message);
  process.exit(1);
});
