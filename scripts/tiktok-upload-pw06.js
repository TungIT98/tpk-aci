#!/usr/bin/env node
/**
 * Upload PW-06 to TikTok using browser automation
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const VIDEO_PATH = resolve(ROOT, 'scripts', 'output', 'PW-06', 'PW-06.mp4');
const SESSION_PATH = resolve(ROOT, '.tiktok-session.json');

const TAGS = ['#genz', '#productivity', '#afternoonslump', '#skills', '#career', '#worklife'];
const CAPTION = `2PM slump hit different after learning this 💡

The skills you build compound faster than any job title.

Save this for your next afternoon crash. #genz #productivity #worklife #careertips #skills #afternoonslump`;

async function main() {
  console.log('Starting TikTok upload for PW-06...');
  console.log('Video:', VIDEO_PATH);
  console.log('Caption:', CAPTION.substring(0, 80) + '...');
  
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  
  const context = await browser.newContext({
    storageState: SESSION_PATH,
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  console.log('Opening TikTok...');
  await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  console.log('Current URL:', page.url());
  
  // Check if logged in
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const isLoggedIn = !bodyText.includes('Log in') && !bodyText.includes('Sign up');
  console.log('Logged in:', isLoggedIn);
  
  if (!isLoggedIn) {
    console.log('Need to log in. Please log in manually.');
    console.log('Press ENTER when done...');
    process.stdin.once('data', () => {});
    await page.waitForTimeout(3000);
  }
  
  // Navigate to upload
  console.log('Navigating to upload page...');
  await page.goto('https://www.tiktok.com/upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  console.log('Upload page URL:', page.url());
  
  // Find file input
  const fileInput = page.locator('input[type="file"]');
  const inputCount = await fileInput.count();
  console.log('File inputs found:', inputCount);
  
  if (inputCount > 0) {
    console.log('Uploading video...');
    await fileInput.first().setInputFiles(VIDEO_PATH);
    console.log('Waiting for upload...');
    await page.waitForTimeout(10000);
    
    // Check if upload succeeded
    const currentUrl = page.url();
    console.log('URL after upload:', currentUrl);
    
    // Type caption
    console.log('Looking for caption input...');
    const captionArea = page.locator('[data-e2e="upload-title-container"] textarea, [contenteditable="true"]').first();
    if (await captionArea.count() > 0) {
      console.log('Filling caption...');
      await captionArea.click();
      await captionArea.fill(CAPTION);
    }
    
    console.log('Waiting before posting...');
    await page.waitForTimeout(5000);
    
    // Find and click post button
    const postBtn = page.locator('button:has-text("Post"), button:has-text("Đăng")').first();
    if (await postBtn.count() > 0) {
      console.log('Clicking Post button...');
      await postBtn.click();
      await page.waitForTimeout(5000);
      console.log('URL after post:', page.url());
    }
    
  } else {
    console.log('No file input found. TikTok upload UI may have changed.');
    console.log('Current URL:', page.url());
  }
  
  await browser.close();
  console.log('\n✅ TikTok upload complete!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
