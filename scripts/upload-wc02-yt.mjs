#!/usr/bin/env node
/**
 * Upload WC-02 to YouTube using saved session
 */
import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const VIDEO_PATH = 'C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\output\\WC-02-fresh.mp4';
const SESSION_PATH = join(__dirname, '..', '.youtube-session.json');
const TITLE = 'The Entire Bar Falls Silent';
const DESCRIPTION = `⚽ The Entire Bar Falls Silent

The ball gets passed. Then again. Then suddenly everyone's on their feet. Nobody breathes. The keeper stretches. The striker shoots. The net ripples. And then — absolute mayhem.

Beers spill. Strangers grab each other. Someone screams so loud the windows shake.

The bar has become a church and we are all preaching the same sermon: WE SCORED! ⚽

#worldcup #football #sportsbar #celebration #goals #soccer #fyp #viral`;

async function main() {
  const tmpProfile = join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Profile 4');
  console.log('[YouTube] Video exists:', existsSync(VIDEO_PATH));
  console.log('[YouTube] Session exists:', existsSync(SESSION_PATH));

  let browser;
  try {
    const context = await chromium.launchPersistentContext(tmpProfile, {
      headless: false,
      viewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--profile-directory=Default']
    });
    const page = context.pages()[0] || await context.newPage();
    await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
    browser = { close: () => context.close() };

    console.log('[YouTube] Navigating...');
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
    console.log('[YouTube] File input found:', (await fileInput.count()) > 0);
    
    await fileInput.setInputFiles(VIDEO_PATH);
    console.log('[YouTube] File set, waiting for upload...');
    
    await page.waitForTimeout(20000);
    
    const newUrl = page.url();
    console.log('[YouTube] URL after upload:', newUrl);
    
    // Try to fill title
    const titleInput = page.locator('#title-input, input[name="title"], #title').first();
    if (await titleInput.count() > 0) {
      await titleInput.fill(TITLE);
      console.log('[YouTube] Title filled');
    }
    
    await browser.close();
    console.log('[YouTube] DONE');
  } catch(e) {
    console.error('[YouTube] Error:', e.message);
    if (browser) await browser.close();
  }
}

main();
