#!/usr/bin/env node
/**
 * oauth-tiktok-callback-server.js
 * Standalone callback server for TikTok OAuth.
 * Start this BEFORE clicking the OAuth URL.
 * Usage: node scripts/oauth-tiktok-callback-server.js
 */
import http from 'http';
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
  const content = readFileSync(resolve(ROOT, '.env'), 'utf-8');
  const lines = content.split('\n').map(line => {
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

async function exchangeCode(code, redirectUri) {
  const { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET } = loadEnv();
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    client_secret: TIKTOK_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  const resp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return resp.json();
}

const PORT = 8080;
const REDIRECT_URI = 'http://localhost:8080/callback';

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const code = urlObj.searchParams.get('code');
  const error = urlObj.searchParams.get('error');
  const state = urlObj.searchParams.get('state');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h2>OAuth Error</h2><p>' + error + '</p><p>You can close this window.</p></body></html>');
    server.close();
    console.error('OAuth error:', error);
    process.exit(1);
  }

  if (code) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h2>Success!</h2><p>Authorization code captured. Closing...</p></body></html>');
    server.close();
    console.log('Auth code received:', code);
    console.log('Exchanging for tokens...');
    try {
      const tokens = await exchangeCode(code, REDIRECT_URI);
      console.log('Tokens:', JSON.stringify(tokens, null, 2));
      const env = loadEnv();
      env.TIKTOK_ACCESS_TOKEN = tokens.access_token;
      if (tokens.refresh_token) env.TIKTOK_REFRESH_TOKEN = tokens.refresh_token;
      saveEnv(env);
      console.log('Tokens saved to .env ✅');
      console.log('TikTok OAuth complete! You can close this window.');
    } catch (e) {
      console.error('Token exchange failed:', e);
      process.exit(1);
    }
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<html><body><p>Waiting for TikTok OAuth callback...</p></body></html>');
});

server.listen(PORT, () => {
  console.log(`\n✅ Callback server listening on http://localhost:${PORT}`);
  console.log('Waiting for TikTok to redirect with the auth code...\n');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Close other apps and try again.`);
  } else {
    console.error('Server error:', e);
  }
  process.exit(1);
});
