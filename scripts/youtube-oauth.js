#!/usr/bin/env node
// YouTube OAuth flow - copy/paste URL approach (no callback server needed)
// Usage: node scripts/youtube-oauth.js

const https = require('https');
const readline = require('readline');
const fs = require('fs');

const envText = fs.readFileSync('.env', 'utf8');
const getVal = (k) => { const m = envText.match(new RegExp(k + '=([^\n]+)')); return m ? m[1].trim() : null; };

const client_id = getVal('YOUTUBE_CLIENT_ID');
const client_secret = getVal('YOUTUBE_CLIENT_SECRET');
const redirect_uri = 'http://localhost';

if (!client_id || !client_secret) {
  console.error('Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET in .env');
  process.exit(1);
}

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
  'client_id=' + encodeURIComponent(client_id) +
  '&redirect_uri=' + encodeURIComponent(redirect_uri) +
  '&response_type=code' +
  '&scope=' + encodeURIComponent('https://www.googleapis.com/auth/youtube.upload') +
  '&access_type=offline' +
  '&prompt=consent';

console.log('==========================================');
console.log('YOUTUBE OAUTH AUTHORIZATION');
console.log('==========================================\n');
console.log('STEP 1: Open this URL in your browser:\n');
console.log(authUrl + '\n');
console.log('STEP 2: Sign in with Google and click "Allow"\n');
console.log('STEP 3: You will be redirected to:');
console.log('  http://localhost/?code=XXXXX...');
console.log('  (This page will show "No code" — that\'s OK)\n');
console.log('STEP 4: Copy the FULL redirect URL from your browser address bar');
console.log('        and paste it below.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Paste the full redirect URL here: ', (redirectUrl) => {
  rl.close();

  try {
    const urlObj = new URL(redirectUrl);
    const code = urlObj.searchParams.get('code');
    if (!code) { console.error('No code found in URL!'); process.exit(1); }
    exchangeToken(code);
  } catch (e) {
    console.error('Invalid URL format:', e.message);
    process.exit(1);
  }
});

function exchangeToken(code) {
  const postData = require('querystring').stringify({
    client_id, client_secret,
    code, redirect_uri,
    grant_type: 'authorization_code'
  });

  const opts = {
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
  };

  const req = https.request(opts, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      const j = JSON.parse(d);
      if (j.access_token) {
        console.log('\n==========================================');
        console.log('SUCCESS! Tokens received.\n');
        console.log('YOUTUBE_ACCESS_TOKEN=' + j.access_token);
        console.log('YOUTUBE_REFRESH_TOKEN=' + j.refresh_token);
        console.log('expires_in=' + j.expires_in + ' seconds\n');
        console.log('Update your .env file with these values.');
        console.log('==========================================');
      } else {
        console.error('Error:', JSON.stringify(j, null, 2));
      }
    });
  });
  req.on('error', e => console.error('Request error:', e.message));
  req.write(postData);
  req.end();
}
