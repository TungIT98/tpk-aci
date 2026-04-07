#!/usr/bin/env node
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const VIDEO_PATH = 'C:/tmp/openclaw/uploads/PW-06.mp4';
const SESSION_PATH = resolve(ROOT, '.tiktok-session.json');

async function main() {
  console.log('Starting debug upload for PW-06...');
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({ storageState: SESSION_PATH, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('response', resp => {
    if (resp.url().includes('upload') || resp.url().includes('post') || resp.url().includes('video')) {
      console.log('RESPONSE:', resp.status(), resp.url());
    }
  });

  await page.goto('https://www.tiktok.com/upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());

  // Check initial state
  const initialHtml = await page.content();
  console.log('Has video preview before upload:', initialHtml.includes('video-preview') || initialHtml.includes('preview'));

  // Set input files
  const fi = page.locator('input[type="file"]').first();
  console.log('File input found:', await fi.count() > 0);
  await fi.setInputFiles(VIDEO_PATH);
  console.log('Set input files, waiting 45s for processing...');
  
  // Wait longer for video processing
  await page.waitForTimeout(45000);
  console.log('URL after 45s:', page.url());
  
  // Check page content
  const html = await page.content();
  console.log('Has video preview after upload:', html.includes('video-preview') || html.includes('preview'));
  console.log('Has error:', html.includes('error') || html.includes('Error') || html.includes('thất bại'));
  console.log('Has success:', html.includes('success') || html.includes('thành công') || html.includes('đã đăng'));
  
  // Check for any overlay/dialog
  const dialog = page.locator('dialog, [role="dialog"]').first();
  if (await dialog.count() > 0) {
    const dialogText = await dialog.innerText().catch(() => 'could not get text');
    console.log('Dialog found:', dialogText.substring(0, 200));
  }

  await browser.close();
  console.log('Debug complete!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
