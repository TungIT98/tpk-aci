#!/usr/bin/env node
/**
 * scripts/oauth-youtube.js — YouTube OAuth setup
 *
 * Usage:
 *   node scripts/oauth-youtube.js --url [redirect_uri]   Generate auth URL
 *   node scripts/oauth-youtube.js <code> [redirect_uri]  Exchange code for tokens
 *   node scripts/oauth-youtube.js --refresh              Refresh access token
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

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || loadEnv().YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || loadEnv().YOUTUBE_CLIENT_SECRET;

async function getAuthUrl(redirectUri) {
  const scopes = encodeURIComponent([
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
  ].join(' '));
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri || 'http://localhost:8080/callback',
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode(code, redirectUri) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: redirectUri || 'http://localhost:8080/callback',
      grant_type: 'authorization_code',
    }),
  });
  if (!r.ok) throw new Error('YouTube exchange failed: ' + r.status + ' ' + await r.text());
  return r.json();
}

async function refreshToken(refreshToken) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) throw new Error('YouTube refresh failed: ' + r.status);
  return r.json();
}

const args = process.argv.slice(2);

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET in .env');
  process.exit(1);
}

if (args[0] === '--url') {
  const redirectUri = args[1] || 'http://localhost:8080/callback';
  const url = await getAuthUrl(redirectUri);
  console.log('\n=== YouTube OAuth Authorization URL ===\n');
  console.log(url);
  console.log('\n1. Visit the URL above');
  console.log('2. Authorize the app');
  console.log('3. Copy the ?code=XXX from the redirect');
  console.log(`4. Run: node scripts/oauth-youtube.js <code> ${redirectUri}\n`);
} else if (args[0] === '--refresh') {
  const env = loadEnv();
  if (!env.YOUTUBE_REFRESH_TOKEN) { console.error('No YOUTUBE_REFRESH_TOKEN in .env'); process.exit(1); }
  const tokens = await refreshToken(env.YOUTUBE_REFRESH_TOKEN);
  console.log('Refreshed:', JSON.stringify(tokens));
  env.YOUTUBE_ACCESS_TOKEN = tokens.access_token;
  saveEnv(env);
  console.log('Saved to .env');
} else if (args[0]) {
  const code = args[0];
  const redirectUri = args[1] || 'http://localhost:8080/callback';
  console.log('Exchanging code...');
  const tokens = await exchangeCode(code, redirectUri);
  console.log('Tokens:', JSON.stringify(tokens, null, 2));
  const env = loadEnv();
  env.YOUTUBE_ACCESS_TOKEN = tokens.access_token;
  if (tokens.refresh_token) env.YOUTUBE_REFRESH_TOKEN = tokens.refresh_token;
  saveEnv(env);
  console.log('Saved to .env — YouTube OAuth complete!');
} else {
  console.log(`Usage:
  node scripts/oauth-youtube.js --url [redirect_uri]  Generate auth URL
  node scripts/oauth-youtube.js <code> [redirect_uri] Exchange code for tokens
  node scripts/oauth-youtube.js --refresh             Refresh access token`);
}
