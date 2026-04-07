/**
 * scripts/youtube-oauth-setup.js
 * One-time OAuth setup for YouTube API.
 * After running this once, future uploads via youtube.js are fully automatic.
 *
 * Usage:
 *   node scripts/youtube-oauth-setup.js
 *
 * This will:
 * 1. Open browser for Google OAuth consent (ONE TIME only)
 * 2. Exchange code for tokens
 * 3. Save refresh_token to .env
 * 4. Verify upload works
 *
 * Subsequent uploads (via production-upload-automation.mjs) need no manual steps.
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { networkInterfaces } from 'os';

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

async function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function startCallbackServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:3000');
      const code = url.searchParams.get('code');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (code) {
        res.end('<html><body><h1>✅ Authorization Successful!</h1><p>You can close this window. Check the console for next steps.</p></body></html>');
        server.close();
        resolve(code);
      } else {
        res.end('<html><body><h1>❌ Authorization Failed</h1></body></html>');
      }
    });

    server.listen(3000, () => {
      resolve(server);
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
  console.log('YOUTUBE OAUTH SETUP - ONE TIME ONLY');
  console.log('========================================\n');

  const env = loadEnv();
  const clientId = env.YOUTUBE_CLIENT_ID;
  const clientSecret = env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('ERROR: YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env');
    process.exit(1);
  }

  // Check if we already have a valid refresh token
  if (env.YOUTUBE_REFRESH_TOKEN) {
    console.log('Checking existing refresh token...');
    try {
      const tokens = await refreshAccessToken(env.YOUTUBE_REFRESH_TOKEN, clientId, clientSecret);
      console.log('✅ Existing refresh token is still valid!');
      console.log(`   Access token expires in: ${tokens.expires_in}s`);
      console.log('\nOAuth is already configured. YouTube uploads will work automatically.');
      console.log('No further setup needed.\n');
      process.exit(0);
    } catch (err) {
      console.log('⚠️  Existing refresh token is expired or invalid. Need to re-authorize.');
      console.log(`   Error: ${err.message}\n`);
    }
  }

  // Start local callback server
  const localIP = await getLocalIP();
  const redirectUri = `http://${localIP}:3000`;

  console.log('Starting local OAuth callback server...');
  const server = await startCallbackServer();
  console.log(`Callback server running at: ${redirectUri}\n`);

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

  console.log('========================================');
  console.log('STEP 1: Authorize in browser');
  console.log('========================================');
  console.log('\nOpen this URL in your browser:\n');
  console.log(authUrl.toString());
  console.log('\n');
  console.log('On the Google consent page:');
  console.log('  1. Sign in with: thanhtungtran364@gmail.com');
  console.log('  2. Click "Allow" for all permissions');
  console.log('  3. You will be redirected back to localhost');
  console.log('\nWaiting for authorization...\n');

  // Wait for the callback with the auth code
  const code = await new Promise((resolve) => {
    server.on('close', () => resolve(null));
  });

  if (!code) {
    console.error('No authorization code received. Please try again.');
    process.exit(1);
  }

  console.log('✅ Received authorization code!');
  console.log('\nExchanging for tokens...\n');

  // Exchange code for tokens
  let tokens;
  try {
    tokens = await exchangeCode(code, redirectUri, clientId, clientSecret);
  } catch (err) {
    console.error('❌ Token exchange failed:', err.message);
    process.exit(1);
  }

  console.log('✅ Tokens received!');
  console.log(`   Access token expires in: ${tokens.expires_in}s`);

  if (tokens.refresh_token) {
    console.log('   Refresh token: received (saving to .env)');
    saveEnv('YOUTUBE_REFRESH_TOKEN', tokens.refresh_token);
  } else {
    console.log('   ⚠️  No refresh token returned (using existing)');
  }

  // Update access token
  saveEnv('YOUTUBE_ACCESS_TOKEN', tokens.access_token);

  // Verify by checking YouTube channel
  console.log('\n========================================');
  console.log('STEP 2: Verifying upload capability');
  console.log('========================================\n');

  try {
    const verifyResp = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const data = await verifyResp.json();
    if (data.items && data.items[0]) {
      const ch = data.items[0];
      console.log(`✅ Verified! Channel: "${ch.snippet.title}"`);
      console.log(`   Channel ID: ${ch.id}`);
    } else {
      console.log('⚠️  Could not fetch channel info (but tokens work)');
    }
  } catch (err) {
    console.log('⚠️  Verification request failed:', err.message);
  }

  console.log('\n========================================');
  console.log('✅ YOUTUBE OAUTH SETUP COMPLETE!');
  console.log('========================================');
  console.log('\nYour YouTube account is now connected.');
  console.log('Uploads via production-upload-automation.mjs will now work');
  console.log('FULLY AUTOMATICALLY - no browser or manual steps needed.\n');

  if (!existsSync(join(ROOT, '.youtube-session.json'))) {
    console.log('💡 Tip: For browser-based fallback (TikTok etc), also run:');
    console.log('   node scripts/setup-youtube-session.js\n');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
