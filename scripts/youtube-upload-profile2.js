/**
 * youtube-upload-profile2.js
 * Upload WC videos to YouTube using the Profile 2 browser (hailuo session)
 * Profile 2 has both Hailuo AND YouTube cookies
 */
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const UPLOAD_DIR = 'C:/tmp/openclaw/uploads';

const VIDEOS = [
  { file: 'WC-01.mp4', title: 'When Your Team Scores at the World Cup 😱⚽' },
  { file: 'WC-02.mp4', title: 'The Entire Bar Falls Silent 😨⚽' },
  { file: 'WC-03.mp4', title: 'Watching the World Cup at Home Hit Different 🏠⚽' },
  { file: 'WC-04.mp4', title: 'The Flag Wave That Gave Me Chills 🏳️🏳️⚽' },
  { file: 'WC-05.mp4', title: 'The Bus to the Stadium Was Already a Party 🚌⚽' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function uploadVideo(page, videoPath, title) {
  console.log(`\n  Uploading: ${title}`);
  
  // Navigate to YouTube Studio upload page
  await page.goto('https://studio.youtube.com/channel/upload', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(4000);
  
  // Find file input - YouTube Studio uses hidden file input
  const fileInput = page.locator('input[type=file]').first();
  const inputCount = await fileInput.count();
  
  if (inputCount === 0) {
    // Try clicking upload button first
    console.log('  No file input visible, trying upload button...');
    await page.click('button:has-text("Tải video lên"), button:has-text("Upload videos")');
    await sleep(3000);
  }
  
  // Now try to set the file
  const filePath = resolve(UPLOAD_DIR, videoPath);
  if (!existsSync(filePath)) {
    console.error(`  File not found: ${filePath}`);
    return false;
  }
  
  try {
    await fileInput.setInputFiles(filePath, { timeout: 10000 });
    console.log('  File selected!');
  } catch(e) {
    console.error(`  setInputFiles failed: ${e.message.slice(0, 100)}`);
    return false;
  }
  
  // Wait for upload to start
  await sleep(15000);
  
  // Check if upload succeeded
  const body = await page.textContent('body');
  if (body.includes('không thể xử lý') || body.includes('cannot process')) {
    console.error('  ERROR: Video processing failed!');
    return false;
  }
  
  // Fill title
  console.log('  Filling title...');
  const titleInput = page.locator('input[name="title"], #title-input, textarea').first();
  if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await titleInput.clear();
    await titleInput.fill(title);
    console.log('  Title filled');
  }
  
  // Click "Not for kids"  
  try {
    await page.locator('text=Không, nội dung này không dành cho trẻ em').click({ timeout: 3000 });
    console.log('  Set not-for-kids');
  } catch {}
  
  // Click Next (twice)
  for (let i = 0; i < 2; i++) {
    try {
      await page.locator('button:has-text("Tiếp"), button:has-text("Next")').first().click({ timeout: 3000 });
      await sleep(2000);
      console.log(`  Next ${i+1} clicked`);
    } catch {}
  }
  
  // Set Public
  try {
    const pubRadio = page.locator('[role="radio"]').filter({ hasText: /Công khai|Public/ }).first();
    if (await pubRadio.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pubRadio.click();
      console.log('  Set Public');
    }
  } catch {}
  
  // Click Publish
  try {
    await page.locator('button:has-text("Xuất bản"), button:has-text("Publish"), button:has-text("Đăng")').click({ timeout: 5000 });
    console.log('  Publish clicked!');
    await sleep(5000);
  } catch(e) {
    console.log('  Publish:', e.message.slice(0, 50));
  }
  
  const url = page.url();
  console.log(`  Done! URL: ${url}`);
  return true;
}

async function main() {
  console.log('=== YouTube Upload (Profile 2) ===\n');
  
  // Launch browser with Profile 2 (Hailuo session + YouTube cookies)
  const browser = await chromium.launch({
    headless: false,
    args: ['--profile-directory=Profile 2']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  
  // First check YouTube login status
  await page.goto('https://www.youtube.com/upload', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(3000);
  const ytBody = await page.textContent('body');
  console.log('YouTube upload page:', ytBody.includes('Upload') || ytBody.includes('Tải'));
  
  const results = [];
  for (const v of VIDEOS) {
    console.log(`\n=== Uploading ${v.file}: "${v.title}" ===`);
    try {
      const ok = await uploadVideo(page, v.file, v.title);
      results.push({ file: v.file, status: ok ? 'ok' : 'failed' });
    } catch(e) {
      console.error(`  Failed: ${e.message}`);
      results.push({ file: v.file, status: 'error' });
    }
    await sleep(5000);
  }
  
  await browser.close();
  console.log('\n\n=== SUMMARY ===');
  results.forEach(r => console.log(`${r.file}: ${r.status}`));
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
