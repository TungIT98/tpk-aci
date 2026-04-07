/**
 * scripts/youtube-oauth-playwright.js
 * OAuth via Playwright - simulates user clicking in browser
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const envPath = join(ROOT, '.env');
  try {
    const env = {};
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return env;
  } catch { return process.env; }
}

function saveEnv(key, value) {
  const envPath = join(ROOT, '.env');
  const content = readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');
  let found = false;
  const newLines = lines.map(line => {
    if (line.startsWith(key + '=')) {
      found = true;
      return key + '=' + value;
    }
    return line;
  });
  if (!found) newLines.push(key + '=' + value);
  writeFileSync(envPath, newLines.join('\n'));
}

async function waitForCallback(server, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Timeout waiting for callback'));
    }, timeoutMs);

    server.on('request', (req, res) => {
      const url = new URL(req.url, 'http://localhost:3000');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (error) {
        res.end('<html><body><h1>❌ Failed</h1></body></html>');
        clearTimeout(timeout);
        reject(new Error(error));
        return;
      }

      if (code) {
        res.end('<html><body><h1>✅ Success! You can close this window.</h1></body></html>');
        server.close();
        clearTimeout(timeout);
        resolve(code);
      }
    });
  });
}

async function exchangeCode(code, redirectUri, clientId, clientSecret) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Exchange failed: ${r.status} — ${txt}`);
  }
  return r.json();
}

async function main() {
  console.log('\n========================================');
  console.log('YOUTUBE OAUTH VIA PLAYWRIGHT');
  console.log('========================================\n');

  const env = loadEnv();
  const clientId = env.YOUTUBE_CLIENT_ID;
  const clientSecret = env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = 'http://localhost:3000';

  if (!clientId || !clientSecret) {
    console.error('Missing credentials in .env');
    process.exit(1);
  }

  // Start callback server
  console.log('1. Starting callback server...');
  const server = http.createServer();
  await new Promise(resolve => server.listen(3000, '127.0.0.1', resolve));
  console.log('   Server running on http://localhost:3000\n');

  // Build auth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('2. Opening browser for OAuth...');

  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Remove webdriver detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Navigate to auth URL
    await page.goto(authUrl.toString(), { waitUntil: 'domcontentloaded' });
    console.log('   Browser opened\n');

    // Wait for redirect to callback
    console.log('3. Waiting for you to sign in and authorize...\n');

    // Wait for URL to change to callback
    try {
      await page.waitForURL('http://localhost:3000/**', { timeout: 300000 });
    } catch (e) {
      console.error('❌ Timeout waiting for authorization');
      await browser.close();
      server.close();
      process.exit(1);
    }

    const url = page.url();
    const code = new URL(url, 'http://localhost:3000').searchParams.get('code');

    if (!code) {
      console.error('❌ No authorization code received');
      await browser.close();
      server.close();
      process.exit(1);
    }

    console.log('✅ Received authorization code!\n');
    await browser.close();

    // Exchange code for tokens
    console.log('4. Exchanging for tokens...');
    let tokens;
    try {
      tokens = await exchangeCode(code, redirectUri, clientId, clientSecret);
    } catch (err) {
      console.error('❌ Token exchange failed:', err.message);
      process.exit(1);
    }

    console.log('   ✅ Tokens received!');
    console.log('   Access token expires in:', tokens.expires_in, 'seconds\n');

    // Save tokens
    if (tokens.refresh_token) {
      saveEnv('YOUTUBE_REFRESH_TOKEN', tokens.refresh_token);
      console.log('   ✅ Refresh token saved to .env');
    }
    saveEnv('YOUTUBE_ACCESS_TOKEN', tokens.access_token);

    // Verify
    console.log('\n5. Verifying...');
    const verifyResp = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const data = await verifyResp.json();
    if (data.items && data.items[0]) {
      console.log(`   ✅ Verified! Channel: "${data.items[0].snippet.title}"`);
    }

    console.log('\n========================================');
    console.log('✅ YOUTUBE OAUTH COMPLETE!');
    console.log('========================================');
    console.log('\nUploads are now fully automatic!\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (browser) await browser.close();
    server.close();
    process.exit(1);
  }

  server.close();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
