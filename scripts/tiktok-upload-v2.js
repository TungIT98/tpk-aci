#!/usr/bin/env node
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SESSION_PATH = resolve(ROOT, '.tiktok-session.json');

async function uploadVideo(videoPath, caption) {
  console.log('Upload:', videoPath.split('/').pop());
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ storageState: SESSION_PATH, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto('https://www.tiktok.com/upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  await page.locator('input[type="file"]').first().setInputFiles(videoPath);
  console.log('Uploaded, waiting 60s for processing...');
  await page.waitForTimeout(60000);
  
  const captionArea = page.locator('div[contenteditable="true"]').first();
  if (await captionArea.count() > 0) {
    await captionArea.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(caption, { delay: 20 });
    console.log('Caption filled');
  }
  await page.waitForTimeout(3000);
  
  const btn = page.locator('button').filter({ hasText: /Post|Đăng/ }).first();
  if (await btn.count() > 0) {
    await btn.click();
    await page.waitForTimeout(20000);
  }
  console.log('Final URL:', page.url());
  await browser.close();
}

// PW-06
const VIDEO_PATH_06 = resolve(ROOT, 'scripts', 'output', 'PW-06', 'PW-06.mp4');
const CAPTION_06 = '2PM slump hit different after learning this 💡 The skills you build compound faster than any job title. Save this for your next afternoon crash. #genz #productivity #worklife #careertips #skills #afternoonslump';

// PW-11
const VIDEO_PATH_11 = resolve(ROOT, 'output_topic', 'videos', 'PW-11.mp4');
const CAPTION_11 = 'Saying no at work feels risky. But research proves the opposite — people who set boundaries are seen as MORE competent. The 3-part formula: 1. Acknowledge 2. Decline clearly 3. Redirect Every yes to someone else is a no to your own priorities. #genz #workboundaries #career #communication #professionalskills';

// GZ-SPECIAL
const VIDEO_PATH_GZ = resolve(ROOT, 'output', 'videos', 'GZ-SPECIAL-final.mp4');
const CAPTION_GZ = 'Everyone says yes to the $10K raise. Nobody does the math. $10K extra sounds great. But spread across 500 extra work hours = $20/hr extra. If your hourly rate is already $50/hr... you are taking a pay cut. 3 questions to ask before you say yes: 1. What is my actual hourly rate after this? 2. What is this costing my health? 3. Can I negotiate the terms instead? More money is not always more value. #genz #salary #worklifebalance #career #negotiation #hourlyrate';

const arg = process.argv[2] || 'all';
if (arg === 'pw06') await uploadVideo(VIDEO_PATH_06, CAPTION_06);
else if (arg === 'pw11') await uploadVideo(VIDEO_PATH_11, CAPTION_11);
else if (arg === 'gz') await uploadVideo(VIDEO_PATH_GZ, CAPTION_GZ);
else { await uploadVideo(VIDEO_PATH_06, CAPTION_06); }
