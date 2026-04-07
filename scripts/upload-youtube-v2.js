/**
 * upload-youtube-v2.js - Simplified YouTube upload via Playwright
 * Step by step: open upload page, set file, fill form, publish
 */
import { chromium } from 'playwright';
import { resolve } from 'path';

const UPLOAD_DIR = 'C:/tmp/openclaw/uploads';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function uploadVideo(page, idx) {
  const titles = [
    'When Your Team Scores at the World Cup 😱⚽',
    'The Entire Bar Falls Silent 😨⚽',
    'Watching the World Cup at Home Hit Different 🏠⚽',
    'The Flag Wave That Gave Me Chills 🏳️🏳️⚽',
    'The Bus to the Stadium Was Already a Party 🚌⚽',
  ];
  const file = `WC-0${idx}.mp4`;
  const title = titles[idx - 1];
  const fullPath = resolve(UPLOAD_DIR, file);

  console.log(`\n=== Uploading ${file}: ${title} ===`);

  // 1. Go directly to upload URL
  console.log('  Step 1: Navigate to upload...');
  await page.goto('https://www.youtube.com/upload', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(3000);

  // 2. Set file on the file input
  console.log('  Step 2: Set file...');
  try {
    const fileInput = page.locator('input[type=file]').first();
    await fileInput.setInputFiles(fullPath, { timeout: 5000 });
    console.log('  File set OK');
  } catch (e) {
    console.log('  File input error:', e.message.slice(0, 100));
    return false;
  }

  // 3. Wait for upload to complete
  console.log('  Step 3: Wait for upload...');
  try {
    // Wait for the title input to appear (indicates upload is done)
    await page.waitForSelector('input[name="title"], #title-input, textarea', { timeout: 60000 });
    console.log('  Upload appears complete');
  } catch (e) {
    console.log('  Upload may have failed:', e.message.slice(0, 100));
  }
  await sleep(3000);

  // 4. Check for processing error
  const bodyText = await page.textContent('body');
  if (bodyText.includes('không thể xử lý') || bodyText.includes('cannot process') || bodyText.includes('unsupported')) {
    console.log('  ERROR: Video processing failed!');
    return false;
  }

  // 5. Fill title
  console.log('  Step 4: Fill title...');
  const titleInput = page.locator('input[name="title"]').first();
  if (await titleInput.isVisible({ timeout: 3000 })) {
    await titleInput.fill(title);
    console.log('  Title filled');
  }

  // 6. Click "Not for kids"  
  try {
    await page.locator('text=Không, nội dung này không dành cho trẻ em').click({ timeout: 3000 });
    console.log('  Set not-for-kids');
  } catch {}

  // 7. Click Next (twice)
  try {
    await page.locator('button:has-text("Tiếp")').first().click({ timeout: 3000 });
    console.log('  Clicked Next 1');
    await sleep(2000);
  } catch {}
  try {
    await page.locator('button:has-text("Tiếp")').first().click({ timeout: 3000 });
    console.log('  Clicked Next 2');
    await sleep(2000);
  } catch {}

  // 8. Click Publish
  try {
    await page.locator('button:has-text("Xuất bản")').click({ timeout: 3000 });
    console.log('  Clicked Publish!');
    await sleep(3000);
  } catch (e) {
    console.log('  Publish error:', e.message.slice(0, 50));
  }

  // 9. Get URL
  const url = page.url();
  console.log(`  Current URL: ${url}`);
  return url.includes('youtu.be') || url.includes('/video/');
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  for (let i = 1; i <= 5; i++) {
    const ok = await uploadVideo(page, i);
    console.log(`  Result: ${ok ? 'OK' : 'FAILED'}`);
    await sleep(3000);
  }

  await browser.close();
  console.log('\n=== DONE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
