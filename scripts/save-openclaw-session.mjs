/**
 * scripts/save-openclaw-session.mjs
 * 
 * Saves TikTok browser session from OpenClaw Chrome using Playwright CDP.
 * Approach: Connect to browser CDP, navigate to TikTok, extract cookies.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_PATH = resolve(__dirname, '..', '.tiktok-session.json');

function log(...args) {
  console.log(`[save-session] ${new Date().toISOString().slice(11,19)}`, ...args);
}

async function main() {
  log('Connecting to OpenClaw Chrome via CDP...');
  
  // Connect to the browser's main CDP endpoint - Playwright will auto-discover tabs
  // We pass the base URL without a specific tab
  const CDP_URL = 'http://127.0.0.1:18800';
  
  // Try the /json/version endpoint to get the WebSocket debugger URL
  const versionResp = await fetch(`${CDP_URL}/json/version`);
  const versionData = await versionResp.json();
  log(`Browser: ${versionData.Browser}`);
  log(`WebSocket URL: ${versionData.webSocketDebuggerUrl}`);
  
  // Try connecting to the main browser debug port
  try {
    const browser = await chromium.connectOverCDP(CDP_URL);
    
    const ctx = browser.contexts()[0];
    const pages = ctx.pages();
    log(`Browser contexts: ${browser.contexts().length}`);
    log(`Pages in default context: ${pages.length}`);
    pages.forEach(p => log(`  ${p.url().slice(0, 80)}`));
    
    // Find or create TikTok page
    let page = pages.find(p => p.url().includes('tiktok.com'));
    
    if (!page) {
      log('No TikTok page found, creating new page...');
      page = await ctx.newPage();
      await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(3000);
    }
    
    log(`Working with page: ${page.url()}`);
    
    // Extract cookies
    const cookies = await ctx.cookies(['https://www.tiktok.com', 'https://tiktok.com']);
    log(`Cookies: ${cookies.length}`);
    
    // Extract localStorage
    let localStorageData = {};
    try {
      localStorageData = await page.evaluate(() => {
        const d = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          d[k] = localStorage.getItem(k);
        }
        return d;
      });
      log(`localStorage: ${Object.keys(localStorageData).length} items`);
    } catch (e) {
      log(`localStorage error: ${e.message}`);
    }
    
    const storageState = {
      cookies: cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite
      })),
      origins: [{
        origin: 'https://www.tiktok.com',
        localStorage: Object.entries(localStorageData).map(([name, value]) => ({ name, value: String(value) }))
      }]
    };
    
    mkdirSync(dirname(SESSION_PATH), { recursive: true });
    writeFileSync(SESSION_PATH, JSON.stringify(storageState, null, 2));
    log(`Saved to ${SESSION_PATH}`);
    
    // Verify
    log('Verifying...');
    const vBrowser = await chromium.launch({ headless: true });
    const vCtx = await vBrowser.newContext({ storageState: SESSION_PATH });
    const vPage = await vCtx.newPage();
    await vPage.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await vPage.waitForTimeout(2000);
    const url = vPage.url();
    const loggedIn = !url.includes('/login');
    log(`URL: ${url}`);
    log(`Logged in: ${loggedIn}`);
    if (loggedIn) log('✅ Session verified!'); else log('⚠️  Stale cookies');
    
    await vBrowser.close();
    await browser.close();
  } catch (err) {
    log(`CDP connect error: ${err.message}`);
    log('Trying alternative method...');
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
