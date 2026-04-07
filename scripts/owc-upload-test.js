/**
 * owc-upload-test.js - Upload WC-01 using OpenClaw browser (which is logged in)
 */
import { HailuoApp } from '../lib/hailuo-app.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const UPLOAD_PATH = 'C:/tmp/openclaw/uploads/WC-01.mp4';

async function main() {
  const app = new HailuoApp({ headless: false });
  await app.init();
  console.log('HailuoApp inited, browser ready');

  // Navigate to YouTube Studio
  await app._page.goto('https://studio.youtube.com/channel/upload', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(5000);

  // Click upload button
  await app._page.click('button:has-text("Tải video lên"), button:has-text("Upload videos")');
  console.log('Clicked upload button');
  await sleep(3000);

  // Find file input and upload
  const fileInput = app._page.locator('input[type=file]').first();
  const cnt = await fileInput.count();
  console.log('File inputs:', cnt);
  if (cnt > 0) {
    await fileInput.setInputFiles(UPLOAD_PATH);
    console.log('File set:', UPLOAD_PATH);
  } else {
    console.log('ERROR: No file input found!');
    await app.close();
    return;
  }

  // Wait for upload
  console.log('Waiting for upload...');
  await sleep(20000);

  // Check status
  const body = await app._page.textContent('body');
  console.log('Has error:', body.includes('không thể xử lý'));
  console.log('Has title input:', body.includes('Tiêu đề') || body.includes('title'));
  console.log('Has done:', body.includes('Đã hoàn tất'));

  // Try to fill title
  const titleInput = app._page.locator('input[name="title"]').first();
  if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await titleInput.fill('When Your Team Scores at the World Cup 😱⚽');
    console.log('Title filled');
  }

  // Try to set not-for-kids
  try {
    await app._page.locator('text=Không, nội dung này không dành cho trẻ em').click({ timeout: 2000 });
    console.log('Set not-for-kids');
  } catch {}

  await sleep(3000);
  await app.close();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
