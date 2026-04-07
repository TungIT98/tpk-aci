#!/usr/bin/env node
/**
 * Upload PW-06 to TikTok - keyboard typing approach
 */
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const VIDEO_PATH = 'C:/tmp/openclaw/uploads/PW-06.mp4';
const SESSION_PATH = resolve(ROOT, '.tiktok-session.json');

const CAPTION = `2PM slump hit different after learning this 💡

The skills you build compound faster than any job title.

Save this for your next afternoon crash. #genz #productivity #worklife #careertips #skills #afternoonslump`;

async function main() {
  console.log('Starting upload for PW-06...');
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({ storageState: SESSION_PATH, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto('https://www.tiktok.com/upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());

  // Set input files
  const fi = page.locator('input[type="file"]').first();
  await fi.setInputFiles(VIDEO_PATH);
  console.log('Set input files, waiting 30s...');
  await page.waitForTimeout(30000);
  console.log('URL:', page.url());

  if (page.url().includes('/@')) {
    console.log('✅ Posted directly!', page.url());
    await browser.close();
    return;
  }

  // Type caption using keyboard
  const captionArea = page.locator('div[contenteditable="true"]').first();
  if (await captionArea.count() > 0) {
    console.log('Found caption area, typing...');
    await captionArea.click();
    await page.keyboard.press('Control+A');
    await page.waitForTimeout(500);
    await page.keyboard.type(CAPTION, { delay: 30 });
    console.log('Typed caption');
    await page.waitForTimeout(3000);
  }

  // Find and click post
  const btn = page.locator('button').filter({ hasText: /Post|Đăng|Tải lên/ }).first();
  if (await btn.count() > 0) {
    console.log('Clicking post button...');
    await btn.click();
    await page.waitForTimeout(15000);
    console.log('Final URL:', page.url());
    if (!page.url().includes('upload')) {
      console.log('✅ Posted successfully!');
    }
  } else {
    console.log('Post button not found');
  }

  await browser.close();
  console.log('Done!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
