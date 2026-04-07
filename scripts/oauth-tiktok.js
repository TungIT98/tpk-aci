#!/usr/bin/env node
/**
 * scripts/oauth-tiktok.js
 * Complete TikTok OAuth setup — exchange auth code for tokens and save to .env.
 *
 * Usage:
 *   node scripts/oauth-tiktok.js --auto              Automated: opens browser, captures callback, done!
 *   node scripts/oauth-tiktok.js --url [redirect_uri]  Generate auth URL (manual step 1)
 *   node scripts/oauth-tiktok.js <auth_code> [redirect_uri]  Exchange code for tokens (manual step 2)
 *
 * The --auto mode is recommended: it opens TikTok in a browser, waits for you to authorize,
 * captures the code automatically, and saves tokens to .env — no manual copy/paste needed.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const env = {};
  for (const line of readFileSync(resolve(ROOT, '.env'), 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

function saveEnv(env) {
  const lines = readFileSync(resolve(ROOT, '.env'), 'utf-8').split('\n').map(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    const eq = t.indexOf('=');
    if (eq === -1) return line;
    const key = t.slice(0, eq).trim();
    if (key in env) return `${key}=${env[key]}`;
    return line;
  });
  writeFileSync(resolve(ROOT, '.env'), lines.join('\n'), 'utf-8');
}

async function getAuthUrl(redirectUri) {
  const { getAuthUrl: fn } = await import('../lib/upload/tiktok.js');
  return fn(redirectUri || 'http://localhost:8080/callback');
}

async function exchangeCode(code, redirectUri) {
  const { exchangeAuthCode } = await import('../lib/upload/tiktok.js');
  return exchangeAuthCode(code, redirectUri || 'http://localhost:8080/callback');
}

async function refreshToken() {
  const { refreshAccessToken } = await import('../lib/upload/tiktok.js');
  return refreshAccessToken();
}

const args = process.argv.slice(2);

// ---------------------------------------------------------------------------
// Auto mode: HTTP callback server + Playwright browser
// ---------------------------------------------------------------------------
async function autoOAuth() {
  const http = await import('http');
  const { chromium } = await import('playwright');

  const redirectUri = 'http://localhost:8080/callback';
  const url = await getAuthUrl(redirectUri);

  console.log('\n=== TikTok OAuth — Auto Mode ===\n');
  console.log('Opening TikTok in browser...');
  console.log('If not logged in, log in and authorize the TKP app.');
  console.log('This script will capture the code automatically.\n');

  // Start local HTTP server to capture the OAuth redirect
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlObj = new URL(req.url, redirectUri);
        const codeParam = urlObj.searchParams.get('code');
        const errorParam = urlObj.searchParams.get('error');
        const stateParam = urlObj.searchParams.get('state');

        res.writeHead(200, { 'Content-Type': 'text/html' });
        if (errorParam) {
          res.end('<html><body><h2>OAuth Error</h2><p>You can close this window.</p></body></html>');
          server.close();
          reject(new Error('TikTok OAuth error: ' + errorParam));
          return;
        }
        if (codeParam) {
          res.end('<html><body><h2>Success!</h2><p>Authorization code captured. You can close this window.</p></body></html>');
          server.close();
          resolve(codeParam);
          return;
        }
        res.end('<html><body><p>Waiting for authorization...</p></body></html>');
      } catch (e) {
        reject(e);
      }
    });

    server.listen(8080, async () => {
      console.log('Callback server listening on http://localhost:8080');
      console.log('Opening TikTok authorization page...\n');

      let browser;
      try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        // Listen for the redirect URL
        page.on('framedata', async (frame) => { });
        let capturedCode = null;
        let done = false;

        // Intercept responses to catch the redirect to localhost
        page.on('response', async (response) => {
          if (done) return;
          const respUrl = response.url();
          if (respUrl.startsWith(redirectUri) || respUrl.includes('localhost:8080')) {
            try {
              const urlObj = new URL(respUrl);
              const c = urlObj.searchParams.get('code');
              if (c) {
                done = true;
                capturedCode = c;
                server.close();
              }
            } catch { }
          }
        });

        // Also check navigation
        page.on('navigation', async (nav) => {
          if (done) return;
          const navUrl = nav.url;
          if (navUrl.startsWith(redirectUri) || navUrl.includes('localhost:8080')) {
            try {
              const urlObj = new URL(navUrl);
              const c = urlObj.searchParams.get('code');
              if (c) {
                done = true;
                capturedCode = c;
                server.close();
              }
            } catch { }
          }
        });

        await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
        console.log('TikTok auth page loaded. Waiting for authorization...');
        console.log('(Log in and click "Authorize" if prompted)\n');

        // Poll for up to 5 minutes
        const startTime = Date.now();
        while (!capturedCode && Date.now() - startTime < 300000) {
          if (done && capturedCode) break;
          await new Promise(r => setTimeout(r, 1000));
          // Check current URL
          const currentUrl = page.url();
          if (currentUrl.startsWith(redirectUri) || currentUrl.includes('localhost:8080')) {
            try {
              const urlObj = new URL(currentUrl);
              const c = urlObj.searchParams.get('code');
              if (c) {
                capturedCode = c;
                done = true;
                break;
              }
            } catch { }
          }
        }

        await browser.close();

        if (!capturedCode) {
          server.close();
          reject(new Error('Timed out waiting for authorization. Please try --url mode instead.'));
          return;
        }

        resolve(capturedCode);
      } catch (e) {
        if (browser) await browser.close().catch(() => {});
        server.close();
        reject(e);
      }
    });

    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        console.error('\nPort 8080 is in use. Close any other apps using it, or use --url mode instead.\n');
      }
      reject(e);
    });
  });

  console.log('\nAuthorization code captured!\n');
  console.log(`Exchanging code for tokens (redirect_uri=${redirectUri})...`);
  const tokens = await exchangeCode(code, redirectUri);
  console.log('Tokens received:', JSON.stringify(tokens, null, 2));

  const env = loadEnv();
  env.TIKTOK_ACCESS_TOKEN = tokens.access_token;
  if (tokens.refresh_token) env.TIKTOK_REFRESH_TOKEN = tokens.refresh_token;
  saveEnv(env);
  console.log('\nTokens saved to .env');
  console.log('TikTok OAuth setup complete! ✅');
}

if (args[0] === '--auto') {
  autoOAuth().catch(e => { console.error('Auto OAuth failed:', e.message); process.exit(1); });
} else if (args[0] === '--url') {
  const redirectUri = args[1] || 'http://localhost:8080/callback';
  const url = await getAuthUrl(redirectUri);
  console.log('\n=== TikTok OAuth Authorization URL ===\n');
  console.log(url);
  console.log('\n1. Visit the URL above in your browser');
  console.log('2. Authorize the TKP app');
  console.log('3. Copy the ?code=XXX from the redirect URL');
  console.log(`4. Run: node scripts/oauth-tiktok.js <code> ${redirectUri}\n`);
  console.log('Or use --auto for fully automated browser-based OAuth:\n');
  console.log('  node scripts/oauth-tiktok.js --auto\n');
} else if (args[0] === '--refresh') {
  console.log('Refreshing TikTok access token...');
  const tokens = await refreshToken();
  console.log('New tokens received:', JSON.stringify(tokens, null, 2));
  const env = loadEnv();
  env.TIKTOK_ACCESS_TOKEN = tokens.access_token;
  if (tokens.refresh_token) env.TIKTOK_REFRESH_TOKEN = tokens.refresh_token;
  saveEnv(env);
  console.log('Tokens saved to .env');
} else if (args[0]) {
  const code = args[0];
  const redirectUri = args[1] || 'http://localhost:8080/callback';
  console.log(`Exchanging auth code with redirect_uri=${redirectUri}...`);
  const tokens = await exchangeCode(code, redirectUri);
  console.log('Tokens received:', JSON.stringify(tokens, null, 2));

  const env = loadEnv();
  env.TIKTOK_ACCESS_TOKEN = tokens.access_token;
  if (tokens.refresh_token) env.TIKTOK_REFRESH_TOKEN = tokens.refresh_token;
  saveEnv(env);
  console.log('\nTokens saved to .env');
  console.log('TikTok OAuth setup complete!');
} else {
  console.log(`Usage:
  node scripts/oauth-tiktok.js --auto                 Automated browser OAuth (recommended)
  node scripts/oauth-tiktok.js --url [redirect_uri]   Generate auth URL (manual mode)
  node scripts/oauth-tiktok.js <code> [redirect_uri]   Exchange auth code for tokens (after --url)
  node scripts/oauth-tiktok.js --refresh               Refresh current access token`);
}
