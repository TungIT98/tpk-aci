/**
 * youtube-upload-topic.js - Upload topic videos to YouTube using Profile 2 browser
 */
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const UPLOAD_DIR = 'C:/tmp/openclaw/uploads';

const VIDEOS = [
  { file: 'TECH-01.mp4',  title: 'AI Just Changed Everything Forever 🤯 #AI #TechNews' },
  { file: 'COM-01.mp4',   title: 'POV: When Your Text Finally Gets Seen 😂 #comedy #text' },
  { file: 'LIFE-01.mp4',  title: 'Day in My Life: Productivity Mode Activated ✨ #lifestyle #dayinmylife' },
  { file: 'MOT-01.mp4',   title: 'Nobody Believed in Me. Now Look at Me 💪 #motivation #success' },
  { file: 'MOVIE-01.mp4', title: 'The Plot Twist That Broke The Internet 🎬 #movie #plot' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function uploadVideo(page, videoPath, title) {
  const filePath = resolve(UPLOAD_DIR, videoPath);
  if (!existsSync(filePath)) {
    console.error(`  File not found: ${filePath}`);
    return false;
  }

  console.log(`  Navigating to upload...`);
  await page.goto('https://studio.youtube.com/channel/upload', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(5000);

  // Set file on input
  const fileInput = page.locator('input[type=file]').first();
  try {
    await fileInput.setInputFiles(filePath, { timeout: 10000 });
    console.log(`  File selected: ${videoPath}`);
  } catch(e) {
    console.error(`  setInputFiles failed: ${e.message.slice(0, 100)}`);
    return false;
  }

  // Wait for upload
  console.log(`  Waiting for upload...`);
  await sleep(20000);

  // Check for errors
  const body = await page.textContent('body');
  if (body.includes('không thể xử lý') || body.includes('cannot process')) {
    console.error(`  Processing error!`);
    return false;
  }

  // Fill title
  const titleInput = page.locator('input[name="title"], #title-input, textarea').first();
  if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await titleInput.clear();
    await titleInput.fill(title);
    console.log(`  Title filled`);
  }

  // Not for kids
  try {
    await page.locator('text=Không, nội dung này không dành cho trẻ em').click({ timeout: 3000 });
    console.log(`  Not for kids`);
  } catch {}

  // Next x2
  for (let i = 0; i < 2; i++) {
    try {
      await page.locator('button:has-text("Tiếp"), button:has-text("Next")').first().click({ timeout: 3000 });
      await sleep(2000);
    } catch {}
  }

  // Public
  try {
    const pub = page.locator('[role="radio"]').filter({ hasText: /Public|Công khai/ }).first();
    if (await pub.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pub.click();
    }
  } catch {}

  // Publish
  try {
    await page.locator('button:has-text("Xuất bản"), button:has-text("Publish"), button:has-text("Đăng")').first().click({ timeout: 5000 });
    console.log(`  Publish clicked!`);
    await sleep(5000);
  } catch(e) {
    console.log(`  Publish: ${e.message.slice(0, 50)}`);
  }

  const url = page.url();
  console.log(`  Done: ${url}`);
  return true;
}

async function main() {
  console.log('=== YouTube Topic Upload ===\n');

  // Check YouTube cookies in Profile 2
  const browser = await chromium.launch({
    headless: false,
    args: ['--profile-directory=Profile 2', '--no-sandbox', '--disable-dev-shm-usage']
  });

  // Try with Default profile if Profile 2 doesn't work
  let context;
  try {
    context = await browser.newContext();
  } catch(e) {
    console.log('Profile 2 failed, trying Default...');
    const browser2 = await chromium.launch({
      headless: false,
      args: ['--profile-directory=Default', '--user-data-dir=C:/Users/PC/AppData/Local/Google/Chrome/User Data', '--no-sandbox']
    });
    context = await browser2.newContext();
  }

  const page = await context.newPage();
  await page.goto('https://www.youtube.com/upload', { timeout: 15000 });
  await sleep(5000);

  const ytCookies = await context.cookies('https://www.youtube.com');
  console.log(`YouTube cookies: ${ytCookies.length}`);
  if (ytCookies.length === 0) {
    console.error('No YouTube cookies! OAuth not available.');
    await browser.close();
    return;
  }

  const results = [];
  for (const v of VIDEOS) {
    console.log(`\n=== ${v.file}: "${v.title}" ===`);
    try {
      const ok = await uploadVideo(page, v.file, v.title);
      results.push({ file: v.file, status: ok ? 'ok' : 'failed' });
    } catch(e) {
      console.error(`  Error: ${e.message}`);
      results.push({ file: v.file, status: 'error' });
    }
    await sleep(5000);
  }

  await browser.close();
  console.log('\n\n=== SUMMARY ===');
  results.forEach(r => console.log(`${r.file}: ${r.status}`));
}

main().catch(e => { console.error(e); process.exit(1); });
