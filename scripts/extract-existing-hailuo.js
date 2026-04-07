// extract-existing-hailuo.js - Try to find and connect to existing Hailuo Chrome tab
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');

function log(...args) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args); }

async function tryCDP(port) {
  const http = await import('http');
  try {
    const data = await new Promise((res, rej) => {
      const req = http.get(`http://127.0.0.1:${port}/json/version`, (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => { try { res(JSON.parse(d)); } catch { rej(new Error('Invalid')); } });
      });
      req.on('error', rej);
      req.setTimeout(3000, () => { req.destroy(); rej(new Error('Timeout')); });
    });
    return data;
  } catch { return null; }
}

async function main() {
  log('=== Scanning for existing Hailuo Chrome tabs ===');
  
  // Try common CDP ports
  const ports = [9222, 9223, 9224, 9333, 18800, 9225];
  let cdpInfo = null;
  let activePort = null;
  
  for (const port of ports) {
    const info = await tryCDP(port);
    if (info) {
      log(`Found Chrome on port ${port}: ${info.Browser}`);
      cdpInfo = info;
      activePort = port;
      break;
    }
  }
  
  if (!cdpInfo) {
    log('No Chrome CDP found on common ports');
    log('Starting fresh browser for Hailuo login...');
    
    const browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    await page.goto('https://hailuoai.video', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    const url = page.url();
    if (url.includes('login')) {
      log('Redirected to login - please log in manually');
      log('Press ENTER after logging in...');
      await new Promise(r => process.stdin.once('data', () => {}));
    }
    
    // Save session
    const state = await context.storageState();
    mkdirSync(resolve(ROOT), { recursive: true });
    writeFileSync(SESSION_PATH, JSON.stringify(state, null, 2));
    log(`Session saved with ${state.cookies.length} cookies`);
    
    // Verify
    const { HailuoApp } = await import('../lib/hailuo-app.js');
    const app = new HailuoApp({ headless: true, sessionPath: SESSION_PATH });
    await app.init();
    const authOk = await app.testAuth();
    log(`testAuth result: ${authOk}`);
    await app.close();
    
    await browser.close();
    return;
  }
  
  log(`Connecting to Chrome CDP at ws://127.0.0.1:${activePort}...`);
  const browser = await chromium.connectOverCDP(cdpInfo.webSocketDebuggerUrl);
  
  const ctx = browser.contexts()[0];
  if (!ctx) {
    log('No browser context found');
    await browser.close();
    return;
  }
  
  // Find Hailuo pages
  const pages = await ctx.pages();
  log(`Found ${pages.length} pages`);
  for (const p of pages) {
    log('  URL:', p.url().slice(0, 80));
  }
  
  let hailuoPage = pages.find(p => p.url().includes('hailuo'));
  if (!hailuoPage) {
    log('No Hailuo page found. Opening new one...');
    hailuoPage = await ctx.newPage();
    await hailuoPage.goto('https://hailuoai.video', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    if (hailuoPage.url().includes('login')) {
      log('Please log in in the opened window, then press ENTER');
      await new Promise(r => process.stdin.once('data', () => {}));
    }
  }
  
  // Check if logged in
  const url = hailuoPage.url();
  log('Hailuo page URL:', url);
  
  const loggedIn = !url.includes('login');
  log(`Logged in: ${loggedIn}`);
  
  if (loggedIn) {
    // Extract session
    const state = await ctx.storageState();
    mkdirSync(resolve(ROOT), { recursive: true });
    writeFileSync(SESSION_PATH, JSON.stringify(state, null, 2));
    log(`Session saved: ${state.cookies.length} cookies`);
    
    // Verify
    const { HailuoApp } = await import('../lib/hailuo-app.js');
    const app = new HailuoApp({ headless: true, sessionPath: SESSION_PATH });
    await app.init();
    const authOk = await app.testAuth();
    log(`testAuth: ${authOk ? 'PASS' : 'FAIL'}`);
    await app.close();
  }
  
  await browser.close();
}

main().catch(err => {
  log('Error:', err.message);
  process.exit(1);
});
