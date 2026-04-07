/**
 * scripts/save-openclaw-session.js
 * 
 * Uses CDP (Chrome DevTools Protocol) via WebSocket to extract cookies from
 * the currently running OpenClaw Chrome browser and save them as a
 * Playwright-compatible session state file.
 * 
 * Uses Node.js 24+ built-in WebSocket.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CDP_HOST = '127.0.0.1';
const CDP_PORT = 18800;
const TIKTOK_TAB_TITLE = 'TikTok Studio';

const SESSION_PATH = resolve(__dirname, '..', '.tiktok-session.json');

function log(...args) {
  console.log(`[save-session] ${new Date().toISOString().slice(11,19)}`, ...args);
}

function cdpRequest(ws, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`CDP ${method} timeout`)), 15000);
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', handler);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function getCdpTabs(ws) {
  const result = await cdpRequest(ws, 1, 'Target.getTargets', {});
  return result.targetInfos || [];
}

async function attachToTab(ws, tabId) {
  const resp = await cdpRequest(ws, 2, 'Target.attachToTarget', { targetId: tabId, flatten: true });
  return resp.sessionId;
}

async function getCookies(ws, sessionId) {
  const cookies = await cdpRequest(ws, 3, 'Network.getAllCookies', {}, sessionId);
  return cookies.cookies || [];
}

async function getLocalStorage(ws, sessionId) {
  try {
    const result = await cdpRequest(ws, 4, 'Runtime.evaluate', {
      expression: `JSON.stringify({...localStorage})`,
      returnByValue: true
    }, sessionId);
    const parsed = JSON.parse(result.result.value || '{}');
    return parsed;
  } catch {
    return {};
  }
}

async function main() {
  log('Connecting to OpenClaw Chrome CDP...');
  
  const wsUrl = `ws://${CDP_HOST}:${CDP_PORT}`;
  const ws = new WebSocket(wsUrl);
  
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  
  log('Getting tabs...');
  const tabs = await getCdpTabs(ws);
  
  log('Available tabs:');
  tabs.forEach(t => log(`  [${t.type}] ${t.title}: ${t.url.slice(0, 80)}`));
  
  const tiktokTab = tabs.find(t => 
    t.type === 'page' && t.url.includes('tiktok.com') && t.title.includes('TikTok')
  );
  
  if (!tiktokTab) {
    throw new Error('TikTok tab not found in OpenClaw browser');
  }
  
  log(`Found TikTok tab: ${tiktokTab.title} (${tiktokTab.targetId})`);
  
  const sessionId = await attachToTab(ws, tiktokTab.targetId);
  log(`Attached. SessionId: ${sessionId}`);
  
  // Get cookies
  log('Extracting cookies...');
  const cookies = await getCookies(ws, sessionId);
  log(`Total cookies: ${cookies.length}`);
  
  // Filter to TikTok cookies
  const tiktokCookies = cookies.filter(c => 
    c.domain.includes('tiktok.com') || c.domain.includes('tiktok')
  );
  log(`TikTok cookies: ${tiktokCookies.length}`);
  if (tiktokCookies.length > 0) {
    log('Cookie names:', tiktokCookies.map(c => c.name).slice(0, 10).join(', '));
  }
  
  // Get localStorage
  log('Getting localStorage...');
  const localStorage = await getLocalStorage(ws, sessionId);
  
  ws.close();
  
  // Build Playwright-compatible storageState
  const storageState = {
    cookies: tiktokCookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: c.expires,
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite: c.sameSite || 'lax'
    })),
    origins: [{
      origin: 'https://www.tiktok.com',
      localStorage: Object.entries(localStorage).map(([name, value]) => ({ name, value: String(value) }))
    }]
  };
  
  // Save
  mkdirSync(dirname(SESSION_PATH), { recursive: true });
  writeFileSync(SESSION_PATH, JSON.stringify(storageState, null, 2));
  log(`Session saved to ${SESSION_PATH}`);
  log(`Cookies: ${storageState.cookies.length}, Origins: ${storageState.origins.length}`);
  
  // Verify
  log('\nVerifying with Playwright...');
  const { chromium } = await import('playwright');
  
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ storageState: SESSION_PATH });
    const page = await ctx.newPage();
    
    await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    const url = page.url();
    const isLoggedIn = !url.includes('/login') && !url.includes('/auth');
    
    log(`URL after restore: ${url}`);
    log(`Logged in: ${isLoggedIn}`);
    
    if (isLoggedIn) {
      log('✅ Session verified successfully!');
    } else {
      log('⚠️  Session restored but NOT logged in. Cookies may be stale.');
    }
    
    await browser.close();
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    log(`Verification error: ${err.message}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
