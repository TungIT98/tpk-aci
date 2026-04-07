/**
 * scripts/upload-gz11-gz06.js
 * Upload GZ-11 and GZ-06 to YouTube via Playwright CDP + setInputFiles
 */

import { chromium } from 'playwright';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const UPLOAD_DIR = 'C:/tmp/openclaw/uploads';
const CDP_URL = 'http://127.0.0.1:18800';

const VIDEOS = [
  {
    id: 'GZ-11',
    file: 'GZ-11.mp4',
    title: 'I Ghosted 50 Networking Events. Here\'s What Happened Instead.',
    description: 'I ghosted 50 networking events. Here is what happened. I showed up, handed out business cards, said let us connect, and nothing came of it. 50 events, zero meaningful relationships. So I stopped going to events and replaced them with three things that actually work. One: personalized DMs to three people per week. Two: one piece of content per week about what I actually know. Three: one monthly virtual coffee with someone new. Quality beats quantity every time.\n\n#networking #career #linkedin #professionaldevelopment',
    privacy: 'unlisted'
  },
  {
    id: 'GZ-06',
    file: 'GZ-06.mp4',
    title: 'Why Gen Z Gets Promotions Faster (And How To Copy Their System)',
    description: 'Gen Z keeps getting promoted before you, and it is not a coincidence. They learned a promotion strategy nobody taught older generations. It is simple: visibility plus results equals advancement. Most people do the work and assume their manager notices. Gen Z does the work and tells their manager what they did. They send weekly updates. They ask for feedback quarterly. That is not annoying. That is a system. And it works.\n\n#career #genz #promotion #workplace #success',
    privacy: 'unlisted'
  }
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function uploadVideo(browser, video) {
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  
  const fullPath = resolve(UPLOAD_DIR, video.file);
  
  console.log(`\n=== Uploading ${video.id}: ${video.title} ===`);
  console.log(`  File: ${fullPath}`);

  try {
    // Navigate to YouTube upload
    console.log('  Step 1: Navigate to upload...');
    await page.goto('https://www.youtube.com/upload', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(5000);
    console.log('  URL:', page.url());

    // Set file on the file input
    console.log('  Step 2: Set file via setInputFiles...');
    const fileInput = page.locator('input[type=file]').first();
    const count = await page.locator('input[type=file]').count();
    console.log('  File inputs found:', count);
    await fileInput.setInputFiles(fullPath, { timeout: 10000 });
    console.log('  File set OK');

    // Wait for upload to complete
    console.log('  Step 3: Wait for title input...');
    await page.waitForSelector('#title-input, input[name="title"], #textbox', { timeout: 90000 });
    console.log('  Upload complete, filling details...');

    // Fill title
    await sleep(2000);
    const titleInput = page.locator('#title-input, input[name="title"]').first();
    await titleInput.click({ clickCount: 3 });
    await titleInput.fill(video.title);
    console.log('  Title set');

    // Fill description
    const descInput = page.locator('#description-input, textarea[name="description"]').first();
    await descInput.click({ clickCount: 3 });
    await descInput.fill(video.description);
    console.log('  Description set');

    // Set privacy (look for radio button or select)
    // Try to find "Not made for kids" option
    const radios = await page.locator('input[type=radio]').all();
    console.log('  Radio buttons:', radios.length);
    for (const radio of radios) {
      const label = await page.locator(`label[for="${await radio.getAttribute('id')}"]`).textContent().catch(() => '');
      const aria = await radio.getAttribute('aria-label') || '';
      if (aria.includes('not made for kids') || label.includes('không')) {
        await radio.click();
        console.log('  Set privacy: not kids');
        break;
      }
    }

    // Click Next/Continue buttons
    console.log('  Step 4: Click Next...');
    const nextBtn = page.locator('button:has-text("Tiếp"), button:has-text("Next"), button:has-text("Tiếp theo")').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await sleep(3000);
    }

    // Another Next
    const nextBtn2 = page.locator('button:has-text("Tiếp"), button:has-text("Next")').first();
    if (await nextBtn2.isVisible()) {
      await nextBtn2.click();
      await sleep(2000);
    }

    // Save/public
    console.log('  Step 5: Publish...');
    const saveBtn = page.locator('button:has-text("Xuất bản"), button:has-text("Publish"), button:has-text("Lưu")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await sleep(5000);
      console.log('  ✅ Published!');
    } else {
      console.log('  Save button not visible, taking screenshot...');
      await page.screenshot({ path: `C:/tmp/openclaw/uploads/${video.id}-debug.png` });
    }

    // Get video URL
    const url = page.url();
    console.log('  Final URL:', url);

    await page.close();
    return { id: video.id, url, status: 'uploaded' };

  } catch (e) {
    console.error('  ERROR:', e.message.slice(0, 200));
    try {
      await page.screenshot({ path: `C:/tmp/openclaw/uploads/${video.id}-error.png` });
    } catch {}
    await page.close();
    return { id: video.id, error: e.message };
  }
}

async function main() {
  console.log('=== YouTube Upload via Playwright CDP ===');
  console.log('Connecting to CDP:', CDP_URL);
  
  const browser = await chromium.connectOverCDP(CDP_URL);
  console.log('Connected to browser');

  const results = [];
  for (const video of VIDEOS) {
    const result = await uploadVideo(browser, video);
    results.push(result);
    await sleep(3000); // delay between uploads
  }

  console.log('\n=== Results ===');
  for (const r of results) {
    if (r.url) console.log(`✅ ${r.id}: ${r.url}`);
    else console.log(`❌ ${r.id}: ${r.error}`);
  }

  // Save results
  writeFileSync('C:/tmp/openclaw/uploads/yt-upload-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to C:/tmp/openclaw/uploads/yt-upload-results.json');
  
  await browser.close();
}

main().catch(e => { console.error('CRASH:', e.message); process.exit(1); });
