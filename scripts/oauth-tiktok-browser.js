/**
 * scripts/oauth-tiktok-browser.js
 *
 * Extract TikTok session from Chrome (via CDP) and complete OAuth flow.
 *
 * PREREQUISITES:
 *   1. Chrome must be running with remote debugging enabled:
 *        chrome.exe --remote-debugging-port=9222
 *
 *   2. You must be logged in to TikTok in that Chrome window:
 *        https://www.tiktok.com
 *
 *   3. Run this script:
 *        node scripts/oauth-tiktok-browser.js
 *
 * This connects to your real Chrome session via CDP, navigates to the
 * TikTok OAuth page (where you're already logged in), waits for the
 * redirect to localhost:8080, captures the auth code, and saves tokens.
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { fileURLToPath as _fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  const env = {};
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

function saveEnv(env) {
  const lines = readFileSync(resolve(ROOT, '.env'), 'utf-8').split('\n');
  const out = lines.map(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    const eq = t.indexOf('=');
    if (eq === -1) return line;
    const key = t.slice(0, eq).trim();
    if (key in env) return `${key}=${env[key]}`;
    return line;
  });
  writeFileSync(resolve(ROOT, '.env'), out.join('\n'), 'utf-8');
}

async function getAuthUrl(redirectUri) {
  const env = loadEnv();
  const CLIENT_ID = env.TIKTOK_CLIENT_KEY;
  const scopes = 'video.upload,video.publish,video.manage,user.info.basic';
  return `https://www.tiktok.com/v2/auth/authorize/?client_key=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=tkp-oauth`;
}

async function exchangeCode(code, redirectUri) {
  const env = loadEnv();
  const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY,
      client_secret: env.TIKTOK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!r.ok) throw new Error('Token exchange failed: ' + r.status + ' ' + await r.text());
  return r.json();
}

async function main() {
  const CDP_PORT = parseInt(process.env.TIKTOK_CDP_PORT || '9222');
  const redirectUri = 'http://localhost:8080/callback';

  console.log('='.repeat(60));
  console.log('TikTok OAuth — Chrome CDP Mode');
  console.log('='.repeat(60));
  console.log();
  console.log(`CDP Port:     ${CDP_PORT}`);
  console.log(`Redirect URI: ${redirectUri}`);
  console.log();

  // Step 1: Connect to Chrome via CDP
  console.log('[1/5] Connecting to Chrome via Chrome DevTools Protocol...');
  let chromeEndpoint;
  try {
    const http2 = await import('http');
    const data = await new Promise((res, rej) => {
      const req = http2.get(`http://localhost:${CDP_PORT}/json/version`, (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => { try { res(JSON.parse(d)); } catch { rej(new Error('Invalid JSON')); } });
      });
      req.on('error', rej);
      req.setTimeout(5000, () => { req.destroy(); rej(new Error('Connection timeout')); });
    });
    chromeEndpoint = data.webSocketDebuggerUrl;
    console.log(`  Chrome version: ${data.Browser || 'unknown'}`);
  } catch (err) {
    console.error();
    console.error('ERROR: Cannot connect to Chrome.');
    console.error('Start Chrome with:');
    console.error('  chrome.exe --remote-debugging-port=9222');
    console.error();
    process.exit(1);
  }

  // Step 2: Connect Playwright to Chrome via CDP
  console.log('[2/5] Connecting Playwright to Chrome session...');
  let browser;
  try {
    browser = await chromium.connectOverCDP(chromeEndpoint);
  } catch (err) {
    console.error('ERROR: CDP connection failed:', err.message);
    process.exit(1);
  }

  const context = browser.contexts()[0];
  if (!context) {
    console.error('ERROR: No browser context found.');
    await browser.close();
    process.exit(1);
  }

  let page = (await context.pages())[0];
  if (!page) page = await context.newPage();

  // Step 3: Navigate to TikTok to check login status
  console.log('[3/5] Checking TikTok login status...');
  await page.goto('https://www.tiktok.com', { waitUntil: 'networkidle', timeout: 30000 });
  const tiktokUrl = page.url();
  console.log(`  Current URL: ${tiktokUrl}`);

  if (tiktokUrl.includes('login') || tiktokUrl.includes('signin')) {
    console.error();
    console.error('ERROR: Chrome is not logged in to TikTok.');
    console.error('Please:');
    console.error('  1. Open https://www.tiktok.com in Chrome');
    console.error('  2. Log in to your TikTok account');
    console.error('  3. Re-run this script');
    await browser.close();
    process.exit(1);
  }
  console.log('  Logged in to TikTok in Chrome ✅');

  // Step 4: Navigate to OAuth authorization URL
  console.log('[4/5] Navigating to TikTok OAuth authorization page...');
  const authUrl = await getAuthUrl(redirectUri);
  console.log(`  Auth URL: ${authUrl}`);

  // Intercept redirect to localhost
  let capturedCode = null;
  let serverClosed = false;

  // Start HTTP server to capture redirect
  const server = http.createServer((req, res) => {
    try {
      const urlObj = new URL(req.url, redirectUri);
      const codeParam = urlObj.searchParams.get('code');
      const errorParam = urlObj.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (errorParam) {
        res.end('<html><body><h2>Error</h2><p>You can close this window.</p></body></html>');
        server.close();
        serverClosed = true;
        return;
      }
      if (codeParam) {
        capturedCode = codeParam;
        res.end('<html><body><h2>Success!</h2><p>Authorization complete. You can close this window.</p></body></html>');
        server.close();
        serverClosed = true;
        return;
      }
      res.end('<html><body><p>Waiting...</p></body></html>');
    } catch {
      res.writeHead(500);
      res.end();
    }
  });

  await new Promise(resolve => server.listen(8080, resolve));
  console.log('  Callback server listening on http://localhost:8080');

  try {
    await page.goto(authUrl, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('  OAuth page loaded. Current URL:', page.url());

    // Poll for up to 2 minutes for redirect
    const startTime = Date.now();
    while (!capturedCode && Date.now() - startTime < 120000) {
      await new Promise(r => setTimeout(r, 1000));
      const currentUrl = page.url();
      if (currentUrl.includes('localhost:8080')) {
        try {
          const urlObj = new URL(currentUrl);
          const c = urlObj.searchParams.get('code');
          if (c) { capturedCode = c; break; }
        } catch {}
      }
      // Check if redirected away from TikTok
      if (!currentUrl.includes('tiktok.com') && !currentUrl.includes('douyin')) {
        console.log('  Redirected away from TikTok. Checking URL...');
        try {
          const urlObj = new URL(currentUrl);
          const c = urlObj.searchParams.get('code');
          if (c) { capturedCode = c; break; }
        } catch {}
      }
    }

    if (!capturedCode) {
      console.error('  Timed out waiting for authorization. Current URL:', page.url());
      // Try to get code from URL anyway
      try {
        const urlObj = new URL(page.url());
        const c = urlObj.searchParams.get('code');
        if (c) capturedCode = c;
      } catch {}
    }
  } finally {
    if (!serverClosed) server.close();
  }

  if (!capturedCode) {
    console.error();
    console.error('ERROR: Could not capture authorization code.');
    console.error('If you see the TikTok authorization page, please click "Authorize".');
    console.error('If redirected, check the URL for a ?code= parameter.');
    await browser.close();
    process.exit(1);
  }

  console.log('  Authorization code captured ✅');

  // Step 5: Exchange code for tokens
  console.log('[5/5] Exchanging code for access token...');
  const tokens = await exchangeCode(capturedCode, redirectUri);
  console.log('  Tokens received:', JSON.stringify(tokens, null, 2));

  const env = loadEnv();
  env.TIKTOK_ACCESS_TOKEN = tokens.access_token;
  if (tokens.refresh_token) env.TIKTOK_REFRESH_TOKEN = tokens.refresh_token;
  saveEnv(env);

  await browser.close();

  console.log();
  console.log('='.repeat(60));
  console.log('TikTok OAuth COMPLETE! ✅');
  console.log('  Access token saved to .env');
  console.log('  TikTok upload pipeline is now ready!');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
