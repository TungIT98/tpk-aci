#!/usr/bin/env node
/**
 * Upload GZ-SPECIAL to TikTok using browser automation
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const VIDEO_PATH = resolve(ROOT, 'output', 'videos', 'GZ-SPECIAL-final.mp4');
const SESSION_PATH = resolve(ROOT, '.tiktok-session.json');

const TAGS = ['#genz', '#salary', '#worklifebalance', '#career', '#negotiation', '#hourlyrate'];
const CAPTION = `Everyone says yes to the $10K raise. Nobody does the math.

$10K extra sounds great. But spread across 500 extra work hours = $20/hr extra.

If your hourly rate is already $50/hr... you're taking a pay cut.

3 questions to ask before you say yes:
1. What is my actual hourly rate after this?
2. What is this costing my health?
3. Can I negotiate the terms instead?

More money isn't always more value. #genz #salary #worklifebalance #career #negotiation #hourlyrate`;

async function main() {
  console.log('Starting TikTok upload for GZ-SPECIAL...');
  console.log('Video:', VIDEO_PATH);
  
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  
  const context = await browser.newContext({
    storageState: SESSION_PATH,
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  console.log('Opening TikTok...');
  await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const isLoggedIn = !bodyText.includes('Log in') && !bodyText.includes('Sign up');
  console.log('Logged in:', isLoggedIn);
  
  console.log('Navigating to upload page...');
  await page.goto('https://www.tiktok.com/upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  console.log('Upload page URL:', page.url());
  
  const fileInput = page.locator('input[type="file"]');
  const inputCount = await fileInput.count();
  console.log('File inputs found:', inputCount);
  
  if (inputCount > 0) {
    console.log('Uploading video...');
    await fileInput.first().setInputFiles(VIDEO_PATH);
    console.log('Waiting for upload preview...');
    await page.waitForTimeout(20000);
    
    const currentUrl = page.url();
    console.log('URL after upload:', currentUrl);
    
    if (!currentUrl.includes('/@')) {
      console.log('Looking for caption input...');
      const selectors = [
        '[data-e2e="upload-title-container"] textarea',
        '[contenteditable="true"]',
        'div[contenteditable="true"]'
      ];
      
      for (const sel of selectors) {
        const el = page.locator(sel).first();
        if (await el.count() > 0) {
          try {
            await el.click({ timeout: 3000 });
            await el.fill(CAPTION, { timeout: 3000 });
            console.log('Filled caption with selector:', sel);
            break;
          } catch(e) { console.log('Selector failed:', sel, e.message); }
        }
      }
      
      await page.waitForTimeout(3000);
      const postBtn = page.locator('button:has-text("Post"), button:has-text("Đăng")').first();
      if (await postBtn.count() > 0) {
        console.log('Clicking Post button...');
        await postBtn.click();
        await page.waitForTimeout(10000);
        const postUrl = page.url();
        console.log('URL after post:', postUrl);
        if (!postUrl.includes('upload')) {
          console.log('✅ Posted successfully! URL:', postUrl);
        } else {
          console.log('⚠️ Still on upload page - checking for errors...');
          const err = await page.locator('[role="alert"], .error, .alert').first().textContent().catch(() => '');
          if (err) console.log('Error:', err);
        }
      }
    } else {
      console.log('✅ Video posted directly to profile URL:', currentUrl);
    }
  } else {
    console.log('No file input found.');
  }
  
  await browser.close();
  console.log('\n✅ Script complete!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
