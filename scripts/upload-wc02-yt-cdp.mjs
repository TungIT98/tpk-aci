#!/usr/bin/env node
/**
 * Upload WC-02 to YouTube via CDP connected Chrome
 */
import { chromium } from 'playwright';

const VIDEO_PATH = 'C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\output\\WC-02-fresh.mp4';
const TITLE = 'The Entire Bar Falls Silent';
const DESCRIPTION = `⚽ The Entire Bar Falls Silent

The ball gets passed. Then again. Then suddenly everyone's on their feet. Nobody breathes. The keeper stretches. The striker shoots. The net ripples. And then — absolute mayhem.

Beers spill. Strangers grab each other. Someone screams so loud the windows shake.

The bar has become a church and we are all preaching the same sermon: WE SCORED! ⚽

#worldcup #football #sportsbar #celebration #goals #soccer #fyp #viral`;

async function main() {
  console.log('[YouTube] Connecting to Chrome via CDP...');
  // Get the actual WS endpoint
  const versionData = await fetch('http://localhost:9223/json/version');
  const { webSocketDebuggerUrl } = await versionData.json();
  console.log('[YouTube] WS endpoint:', webSocketDebuggerUrl);
  const browser = await chromium.connect(webSocketDebuggerUrl);
  console.log('[YouTube] Connected!');
  
  const context = browser.contexts()[0] || await browser.newContext();
  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();
  
  console.log('[YouTube] Navigating to YouTube Studio...');
  await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/videos/upload?d=ud', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  const url = page.url();
  console.log('[YouTube] URL:', url);
  
  if (url.includes('/login')) {
    console.log('[YouTube] NOT LOGGED IN!');
    await browser.close();
    process.exit(1);
  }
  
  const fileInput = page.locator('input[type="file"]').first();
  const inputCount = await fileInput.count();
  console.log('[YouTube] File input found:', inputCount > 0);
  
  if (inputCount === 0) {
    console.log('[YouTube] No file input - taking screenshot');
    await page.screenshot({ path: 'C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\outputs\\yt-no-input.png' });
    await browser.close();
    process.exit(1);
  }
  
  await fileInput.setInputFiles(VIDEO_PATH);
  console.log('[YouTube] File set, waiting for upload...');
  
  await page.waitForTimeout(20000);
  
  const newUrl = page.url();
  console.log('[YouTube] URL after upload:', newUrl);
  
  // Fill title
  const titleInput = page.locator('#title-input, input[name="title"], #title, textarea').first();
  if (await titleInput.count() > 0) {
    await titleInput.fill(TITLE);
    console.log('[YouTube] Title filled');
  }
  
  await page.waitForTimeout(5000);
  await browser.close();
  console.log('[YouTube] DONE');
}

main().catch(e => { console.error('[YouTube] Error:', e.message); process.exit(1); });
