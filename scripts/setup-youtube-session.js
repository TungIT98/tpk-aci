/**
 * scripts/setup-youtube-session.js
 * Setup YouTube browser session for automated uploads
 *
 * Run this once to log in and save session:
 *   node scripts/setup-youtube-session.js
 *
 * This will:
 * 1. Open YouTube in browser
 * 2. Wait for you to log in manually
 * 3. Save session to .youtube-session.json
 *
 * After setup, upload-yt-playwright.mjs can use this session
 */

import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_PATH = resolve(__dirname, '..', '.youtube-session.json');

async function main() {
  console.log('=== YouTube Session Setup ===');
  console.log('This will open a browser for you to log in to YouTube.');
  console.log('Session will be saved to: .youtube-session.json');
  console.log('');

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-notifications',
      '--disable-web-security',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--lang=en-US',
      '--start-maximized'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York'
  });

  // Stealth: Remove webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  try {
    // Go to YouTube
    console.log('Opening YouTube...');
    await page.goto('https://www.youtube.com', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check if already logged in
    const url = page.url();
    if (!url.includes('/login')) {
      console.log('Already logged in! Saving session...');
    } else {
      console.log('Please log in to YouTube in the browser...');
      console.log('Waiting for login (or 5 minutes timeout)...');

      // Wait for login (up to 5 minutes)
      await page.waitForFunction(() => {
        return !window.location.href.includes('/login');
      }, { timeout: 300000 }).catch(() => {
        console.log('Login timeout - please log in manually');
      });
    }

    // Save session
    const dir = dirname(SESSION_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const state = await context.storageState();
    writeFileSync(SESSION_PATH, JSON.stringify(state));

    console.log('');
    console.log('✅ Session saved to: .youtube-session.json');
    console.log('You can now close the browser.');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    // Keep browser open for manual login if needed
    console.log('Press Ctrl+C to close...');
    // await browser.close();
  }
}

main();
