#!/usr/bin/env node
/**
 * Upload PW-11 to TikTok - with long wait for processing
 */
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const VIDEO_PATH = resolve(ROOT, 'output_topic', 'videos', 'PW-11.mp4');
const SESSION_PATH = resolve(ROOT, '.tiktok-session.json');

const CAPTION = `Saying no at work feels risky. But research proves the opposite — people who set boundaries are seen as MORE competent.

The 3-part formula:
1. Acknowledge
2. Decline clearly
3. Redirect

Every yes to someone else is a no to your own priorities. #genz #workboundaries #career #communication #professionalskills`;

async function main() {
  console.log('Starting upload for PW-11...');
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({ storageState: SESSION_PATH, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto('https://www.tiktok.com/upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());

  const fi = page.locator('input[type="file"]').first();
  await fi.setInputFiles(VIDEO_PATH);
  console.log('Upload started, waiting for processing...');
  
  // Wait for TikTok to process video
  await page.waitForFunction(() => {
    return document.querySelector('video') !== null || 
           document.body.innerText.includes('video') ||
           document.body.innerText.includes('preview');
  }, { timeout: 65000 }).catch(() => console.log('Preview timeout, continuing...'));
  
  console.log('URL after upload wait:', page.url());
  
  // Fill caption using keyboard
  const captionArea = page.locator('div[contenteditable="true"]').first();
  if (await captionArea.count() > 0) {
    try {
      await captionArea.click();
      await page.keyboard.press('Control+A');
      await page.waitForTimeout(300);
      await page.keyboard.type(CAPTION, { delay: 20 });
      console.log('Caption typed');
      await page.waitForTimeout(3000);
    } catch(e) { console.log('Caption error:', e.message); }
  }

  const btn = page.locator('button').filter({ hasText: /Post|Đăng/ }).first();
  if (await btn.count() > 0) {
    try {
      await btn.click();
      console.log('Post clicked, waiting 30s...');
      await page.waitForTimeout(30000);
      console.log('Final URL:', page.url());
      if (page.url().includes('/@')) {
        console.log('✅ Posted!', page.url());
      } else {
        console.log('Still on upload page');
      }
    } catch(e) { console.log('Post error:', e.message); }
  }

  await browser.close();
  console.log('Done!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
