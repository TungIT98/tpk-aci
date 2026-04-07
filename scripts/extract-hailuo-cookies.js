/**
 * scripts/extract-hailuo-cookies.js
 *
 * Extract Hailuo App session cookies from an already-running Chrome browser
 * and save them to .hailuo-session.json so hailuo-app.js can reuse the session.
 *
 * PREREQUISITES:
 *   1. Open Chrome with remote debugging enabled:
 *        chrome.exe --remote-debugging-port=9222
 *      (Or open Chrome normally and pass --remote-debugging-port=9222)
 *
 *   2. Manually log in to https://hailuoai.video in that Chrome window
 *
 *   3. Run this script:
 *        node scripts/extract-hailuo-cookies.js
 *
 * OUTPUT:
 *   .hailuo-session.json  — Playwright storageState (cookies + localStorage)
 *
 * The saved session is auto-loaded by lib/hailuo-app.js on next run.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load env
function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  try {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();
const SESSION_PATH  = env.HAILUO_SESSION_PATH || resolve(ROOT, '.hailuo-session.json');
const HAILUO_URL    = env.HAILUO_APP_URL      || 'https://hailuoai.video';
const CDP_PORT      = parseInt(env.HAILUO_CDP_PORT || '9222');

async function main() {
  console.log('='.repeat(60));
  console.log('Hailuo Cookie Extractor — Chrome CDP');
  console.log('='.repeat(60));
  console.log();
  console.log(`Target URL:   ${HAILUO_URL}`);
  console.log(`CDP Port:     ${CDP_PORT}`);
  console.log(`Output file:  ${SESSION_PATH}`);
  console.log();

  // Step 1: Connect to Chrome via CDP
  console.log('[1/4] Connecting to Chrome via Chrome DevTools Protocol...');
  let chromeEndpoint;
  try {
    // Get the CDP websocket endpoint from Chrome's JSON endpoint
    const http = await import('http');
    const data = await new Promise((res, rej) => {
      const req = http.get(`http://localhost:${CDP_PORT}/json/version`, (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => { try { res(JSON.parse(d)); } catch { rej(new Error('Invalid JSON from Chrome')); } });
      });
      req.on('error', rej);
      req.setTimeout(5000, () => { req.destroy(); rej(new Error('Connection timeout')); });
    });
    chromeEndpoint = data.webSocketDebuggerUrl;
    console.log(`  Chrome version: ${data.Browser || 'unknown'}`);
    console.log(`  WebSocket URL: ${chromeEndpoint}`);
  } catch (err) {
    console.error();
    console.error('ERROR: Cannot connect to Chrome.');
    console.error('Make sure Chrome is running with --remote-debugging-port=9222');
    console.error();
    console.error('To start Chrome with remote debugging:');
    console.error('  Windows: chrome.exe --remote-debugging-port=9222');
    console.error('  Or: Start Chrome normally, then run this script and manually log in.');
    console.error();
    console.error(`Connection error: ${err.message}`);
    process.exit(1);
  }

  // Step 2: Connect Playwright to the existing Chrome session
  console.log('[2/4] Connecting Playwright to existing Chrome...');
  let browser;
  try {
    browser = await chromium.connectOverCDP(chromeEndpoint);
  } catch (err) {
    console.error('ERROR: Failed to connect via CDP:', err.message);
    console.error('Chrome may need to be restarted with --remote-debugging-port=9222');
    process.exit(1);
  }

  // Get the default context (first connection = first context)
  const context = browser.contexts()[0];
  if (!context) {
    console.error('ERROR: No browser context found. Is Chrome running?');
    await browser.close();
    process.exit(1);
  }

  // Get or create page
  let page = (await context.pages())[0];
  if (!page) {
    page = await context.newPage();
  }

  // Step 3: Navigate to Hailuo and capture cookies
  console.log('[3/4] Navigating to Hailuo App...');
  try {
    await page.goto(HAILUO_URL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log(`  Current URL: ${page.url()}`);

    // Check if we're on a login page
    const url = page.url();
    if (url.includes('login') || url.includes('signin') || url.includes('auth')) {
      console.error();
      console.error('WARNING: Redirected to login page. You must be logged in to Hailuo in Chrome.');
      console.error('Please:');
      console.error('  1. Log in to https://hailuoai.video manually in Chrome');
      console.error('  2. Re-run this script');
      await browser.close();
      process.exit(1);
    }
  } catch (err) {
    console.error('ERROR: Failed to navigate to Hailuo:', err.message);
    await browser.close();
    process.exit(1);
  }

  // Give the page a moment to settle
  await page.waitForTimeout(2000);

  // Step 4: Extract storage state and save
  console.log('[4/4] Extracting session and saving...');
  const state = await context.storageState();

  // Ensure output dir exists
  mkdirSync(resolve(ROOT, 'output', 'videos'), { recursive: true });
  mkdirSync(resolve(ROOT), { recursive: true });
  writeFileSync(SESSION_PATH, JSON.stringify(state, null, 2), 'utf-8');

  const cookieCount = state.cookies?.length ?? 0;
  const originCount = state.origins?.length ?? 0;

  console.log();
  console.log('='.repeat(60));
  console.log('SUCCESS!');
  console.log(`  Session file:  ${SESSION_PATH}`);
  console.log(`  Cookies:       ${cookieCount}`);
  console.log(`  Storage origins: ${originCount}`);
  console.log(`  Page URL:      ${page.url()}`);
  console.log('='.repeat(60));
  console.log();
  console.log('Verifying session...');
  const finalUrl = page.url();
  if (finalUrl.includes('login') || finalUrl.includes('signin')) {
    console.warn('WARNING: Browser appears to be on a login page.');
    console.warn('The extracted session may not include valid auth cookies.');
  } else {
    console.log('Page appears to be logged in. Session should be valid.');
  }

  await browser.close();
  console.log('\nDone. HailuoApp will now use this session automatically.');
  console.log('To test: node -e "import(\'./lib/hailuo-app.js\').then(m=>new m.HailuoApp().init().then(a=>a.isLoggedIn()).then(r=>console.log(\'logged in:\',r))).catch(console.error)"');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
