/**
 * scripts/oauth-localhost.js
 * OAuth flow using localhost redirect - works for local development
 *
 * Usage: node scripts/oauth-localhost.js
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
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
  if (!found) {
    newLines.push(key + '=' + value);
  }
  writeFileSync(envPath, newLines.join('\n'));
}

const YT_TOKEN_URL = 'https://oauth2.googleapis.com/token';

async function startServer() {
  return new Promise((resolve) => {
    let server;
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 300000); // 5 min timeout

    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:3000');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>❌ Authorization Failed</h1><p>' + error + '</p></body></html>');
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ success: false, error });
        }
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>✅ Authorization Successful!</h1><p>You can close this window. Check the console.</p></body></html>');
        server.close();
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ success: true, code });
        }
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Waiting...</h1></body></html>');
    });

    server.listen(3000, '127.0.0.1', () => {
      console.log('Callback server running on http://localhost:3000');
      if (!resolved) resolve(server);
    });

    server.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(null);
      }
    });
  });
}

async function exchangeCode(code, redirectUri, clientId, clientSecret) {
  const r = await fetch(YT_TOKEN_URL, {
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
    throw new Error(`Token exchange failed: ${r.status} — ${txt}`);
  }
  return r.json();
}

async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const r = await fetch(YT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Token refresh failed: ${r.status} — ${txt}`);
  }
  return r.json();
}

async function main() {
  console.log('\n========================================');
  console.log('YOUTUBE OAUTH SETUP (localhost redirect)');
  console.log('========================================\n');

  const env = loadEnv();
  const clientId = env.YOUTUBE_CLIENT_ID;
  const clientSecret = env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('ERROR: YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env');
    process.exit(1);
  }

  // Check existing token
  if (env.YOUTUBE_REFRESH_TOKEN) {
    console.log('Checking existing refresh token...');
    try {
      const tokens = await refreshAccessToken(env.YOUTUBE_REFRESH_TOKEN, clientId, clientSecret);
      console.log('✅ Existing refresh token is still valid!');
      console.log('   No OAuth setup needed - uploads will work automatically.\n');
      process.exit(0);
    } catch (err) {
      console.log('⚠️  Existing token expired/invalid. Need new authorization.\n');
    }
  }

  const redirectUri = 'http://localhost:3000';

  // Build OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
  ].join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  // Start callback server FIRST
  console.log('1. Starting callback server on localhost:3000...');
  const server = await startServer();
  if (!server) {
    console.error('Failed to start server. Is port 3000 already in use?');
    process.exit(1);
  }

  // Open browser
  console.log('2. Opening browser for OAuth...\n');
  console.log('URL:', authUrl.toString());

  // Try to open browser
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', authUrl.toString()], { stdio: 'ignore', detached: true, shell: true });
    } else if (process.platform === 'darwin') {
      spawn('open', [authUrl.toString()]);
    } else {
      spawn('xdg-open', [authUrl.toString()]);
    }
  } catch (err) {
    console.log('\n⚠️  Could not open browser automatically.');
    console.log('   Please open this URL manually:\n');
    console.log(authUrl.toString());
  }

  console.log('\n3. Waiting for authorization...');
  console.log('   (Sign in with thanhtungtran364@gmail.com and click Allow)\n');

  // Wait for callback
  const result = await new Promise((resolve) => {
    server.on('close', () => resolve({ success: false, error: 'Server closed' }));
  });

  if (!result || !result.success) {
    console.error('❌ Authorization failed or timed out.');
    process.exit(1);
  }

  console.log('✅ Received authorization code!');
  console.log('\n4. Exchanging for tokens...\n');

  let tokens;
  try {
    tokens = await exchangeCode(result.code, redirectUri, clientId, clientSecret);
  } catch (err) {
    console.error('❌ Token exchange failed:', err.message);
    process.exit(1);
  }

  console.log('✅ Tokens received!');
  console.log(`   Access token expires in: ${tokens.expires_in}s`);

  if (tokens.refresh_token) {
    console.log('   Saving refresh_token to .env...');
    saveEnv('YOUTUBE_REFRESH_TOKEN', tokens.refresh_token);
  } else {
    console.log('⚠️  No new refresh token returned');
  }

  saveEnv('YOUTUBE_ACCESS_TOKEN', tokens.access_token);

  // Verify
  console.log('\n5. Verifying...');
  try {
    const verifyResp = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const data = await verifyResp.json();
    if (data.items && data.items[0]) {
      console.log(`   ✅ Verified! Channel: "${data.items[0].snippet.title}"`);
    }
  } catch (err) {
    console.log('   ⚠️  Verification request failed:', err.message);
  }

  console.log('\n========================================');
  console.log('✅ YOUTUBE OAUTH SETUP COMPLETE!');
  console.log('========================================');
  console.log('\nUploads are now fully automatic.\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
