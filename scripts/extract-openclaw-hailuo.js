// extract-openclaw-hailuo.js - Extract Hailuo session from OpenClaw browser CDP
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const HAILUO_URL = 'https://hailuoai.video';
const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');

function log(...args) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args); }

async function main() {
  log('Connecting to OpenClaw Chrome CDP (port 18800)...');
  
  const http = await import('http');
  let cdpUrl;
  try {
    const data = await new Promise((res, rej) => {
      const req = http.get('http://127.0.0.1:18800/json/version', (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => { try { res(JSON.parse(d)); } catch { rej(new Error('Invalid JSON')); } });
      });
      req.on('error', rej);
      req.setTimeout(8000, () => { req.destroy(); rej(new Error('Connection timeout')); });
    });
    cdpUrl = data.webSocketDebuggerUrl;
    log('Connected to:', data.Browser);
    log('WebSocket:', cdpUrl.slice(0, 60) + '...');
  } catch (e) {
    log('ERROR: Cannot connect to CDP:', e.message);
    process.exit(1);
  }

  const { chromium } = await import('playwright');
  
  let browser;
  try {
    browser = await chromium.connectOverCDP(cdpUrl);
    log('Connected via Playwright CDP');
  } catch (e) {
    log('ERROR: Playwright CDP connect failed:', e.message);
    process.exit(1);
  }
  
  const context = browser.contexts()[0];
  if (!context) {
    log('ERROR: No browser context found');
    await browser.close();
    process.exit(1);
  }
  
  // Find Hailuo tab
  const pages = await context.pages();
  log(`Total pages: ${pages.length}`);
  for (const p of pages) {
    log('  Page URL:', p.url().slice(0, 80));
  }
  
  let hailuoPage = pages.find(p => p.url().includes('hailuo'));
  if (!hailuoPage) {
    log('Hailuo page not found. Creating new page...');
    hailuoPage = await context.newPage();
    await hailuoPage.goto(HAILUO_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 3000));
    log('New page URL:', hailuoPage.url());
  } else {
    log('Found existing Hailuo page:', hailuoPage.url().slice(0, 80));
  }
  
  // Check login status
  const currentUrl = hailuoPage.url();
  if (currentUrl.includes('login') || currentUrl.includes('signin')) {
    log('⚠️  Hailuo requires login. Please log in manually in the OpenClaw browser window.');
    log('Waiting 60 seconds for manual login...');
    await new Promise(r => setTimeout(r, 60000));
    log('Login wait done. Current URL:', hailuoPage.url());
  }
  
  // Extract storage state
  log('Extracting session state...');
  const state = await context.storageState();
  
  mkdirSync(resolve(ROOT), { recursive: true });
  writeFileSync(SESSION_PATH, JSON.stringify(state, null, 2));
  
  log('Session saved:', SESSION_PATH);
  log('Cookies:', state.cookies?.length || 0);
  log('Origins:', state.origins?.length || 0);
  
  // Test
  log('\nTesting session...');
  await browser.close();
  
  const { HailuoApp } = await import('../lib/hailuo-app.js');
  const app = new HailuoApp({ headless: true, sessionPath: SESSION_PATH });
  await app.init();
  const loggedIn = await app.isLoggedIn();
  log('HailuoApp logged in:', loggedIn);
  await app.close();
  
  if (!loggedIn) {
    log('⚠️  Session extracted but HailuoApp is NOT logged in.');
    process.exit(1);
  }
  
  log('✅ SUCCESS: Session extracted and verified!');
}

main().catch(err => {
  log('Error:', err.message);
  process.exit(1);
});
