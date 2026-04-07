/**
 * lib/hailuo-chrome-cdp.js
 * Connect to existing Chrome with Hailuo login via Chrome DevTools Protocol (CDP)
 *
 * Setup:
 * 1. Open Chrome with: chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\Users\PC\AppData\Local\Google\Chrome\User Data"
 * 2. Login to Hailuo in this Chrome
 * 3. Run this script to generate videos
 *
 * Usage:
 *   node scripts/hailuo-chrome-cdp.js --prompt="your video prompt"
 */

import { chromium } from 'playwright';

const HAILUO_URL = 'https://hailuoai.video/create/text-to-video';
const DEBUGGING_PORT = 9222;

async function connectToChrome() {
  // Connect to existing Chrome via CDP
  const browser = await chromium.connectOverCDP(`http://localhost:${DEBUGGING_PORT}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();
  return { browser, page };
}

async function checkLoginState(page) {
  // Check for login modal by looking at cookies and page content
  const cookies = await page.context().cookies(['https://hailuoai.video']);

  // Check for Hailuo auth cookies
  const hasHailuoAuth = cookies.some(c =>
    c.name.includes('token') ||
    c.name.includes('session') ||
    c.name.includes('auth') ||
    c.name.includes('user')
  );

  // Check localStorage for user data
  const localStorageData = await page.evaluate(() => {
    return {
      hasUserId: !!window.localStorage.getItem('UNIQUE_USER_ID'),
      hasLoginModal: window.localStorage.getItem('loginGuideModalShow')
    };
  });

  return hasHailuoAuth || localStorageData.hasUserId;
}

async function waitForSlateEditor(page) {
  // Wait for the Slate editor to be visible
  const slateEditor = page.locator('[data-slate-editor="true"]').first();
  try {
    await slateEditor.waitFor({ state: 'visible', timeout: 15000 });
    return slateEditor;
  } catch (e) {
    return null;
  }
}

async function fillPrompt(page, prompt) {
  const slateEditor = await waitForSlateEditor(page);
  if (!slateEditor) {
    throw new Error('Slate editor not found');
  }

  await slateEditor.scrollIntoViewIfNeeded();
  await slateEditor.click();
  await page.waitForTimeout(300);

  // Select all and clear
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(200);

  // Type new prompt
  await page.keyboard.type(prompt);
  return slateEditor;
}

async function submitPrompt(page) {
  // Try Ctrl+Enter to submit
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(3000);

  // Check if a login modal appeared
  const pageText = await page.locator('body').innerText();
  if (pageText.includes('Continue with Google')) {
    throw new Error('Login required - session may have expired');
  }

  // Check for progress/generating state
  return pageText.includes('Generate') || pageText.includes('Generating');
}

async function generateVideo(prompt, aspectRatio = '9:16') {
  console.log(`[CDP] Connecting to Chrome on port ${DEBUGGING_PORT}...`);

  let browser;
  try {
    browser = await chromium.connectOverCDP(`http://localhost:${DEBUGGING_PORT}`);
  } catch (e) {
    console.error('[CDP] Cannot connect to Chrome. Is Chrome running with --remote-debugging-port=9222 ?');
    console.error('[CDP] Start Chrome with: chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\Users\\PC\\AppData\\Local\\Google\\Chrome\\User Data"');
    throw e;
  }

  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();

  console.log('[CDP] Connected to Chrome');
  console.log('[CDP] Navigating to Hailuo...');

  await page.goto(HAILUO_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Check login state
  const isLoggedIn = await checkLoginState(page);
  if (!isLoggedIn) {
    console.error('[CDP] Not logged in to Hailuo! Session cookies not found.');
    console.error('[CDP] Please login to Hailuo in Chrome first.');
    await browser.close();
    throw new Error('Not logged in');
  }
  console.log('[CDP] Hailuo page loaded, session active');

  // Find and fill prompt using Slate editor
  console.log('[CDP] Finding prompt input (Slate editor)...');
  try {
    await fillPrompt(page, prompt);
    console.log('[CDP] Prompt filled');
  } catch (e) {
    console.error('[CDP] Failed to fill prompt:', e.message);
    await browser.close();
    throw e;
  }

  // Submit prompt
  console.log('[CDP] Submitting prompt...');
  try {
    await submitPrompt(page);
    console.log('[CDP] Video generation started');
  } catch (e) {
    console.error('[CDP] Failed to submit:', e.message);
    await browser.close();
    throw e;
  }

  // Wait for video (simplified - just wait 60s)
  console.log('[CDP] Waiting 60s for video generation...');
  await page.waitForTimeout(60000);

  console.log('[CDP] Done - check Hailuo for your video');
  await browser.close();
}

// CLI
const args = process.argv.slice(2);
const promptArg = args.find(a => a.startsWith('--prompt='));

if (!promptArg) {
  console.log('Usage: node hailuo-chrome-cdp.js --prompt="your video description"');
  console.log('');
  console.log('First, start Chrome with remote debugging:');
  console.log('chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\Users\\PC\\AppData\\Local\\Google\\Chrome\\User Data"');
  console.log('');
  console.log('Then login to Hailuo in the Chrome that opens.');
  console.log('Finally run this script.');
  process.exit(1);
}

const prompt = promptArg.split('=').slice(1).join('=');

generateVideo(prompt)
  .then(() => console.log('[CDP] Video generation started'))
  .catch(e => { console.error('[CDP] Error:', e.message); process.exit(1); });
