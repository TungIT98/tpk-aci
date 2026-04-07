/**
 * scripts/oauth-manual.js
 * Opens OAuth URL, user manually authorizes, then pastes final URL
 */

import { spawn } from 'child_process';
import http from 'http';
import { readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

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
      return line.split('=')[0] + '=' + value;
    }
    return line;
  });
  if (!found) newLines.push(key + '=' + value);
  writeFileSync(envPath, newLines.join('\n'));
}

const env = loadEnv();
const clientId = env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=http%3A%2F%2Flocalhost%3A3000&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.upload+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube&access_type=offline&prompt=consent`;

async function main() {
  console.log('\n========================================');
  console.log('YOUTUBE OAUTH - MANUAL METHOD');
  console.log('========================================\n');

  // Start server to capture code
  console.log('1. Starting callback server on port 3000...');

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost:3000');
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    res.writeHead(200, { 'Content-Type': 'text/html' });

    if (error) {
      res.end('<html><body><h1>❌ Error</h1><p>' + error + '</p></body></html>');
      console.log('\n❌ Authorization error:', error);
      process.exit(1);
    }

    if (code) {
      res.end('<html><body><h1>✅ Success! Code received!</h1><p>You can close this window.</p></body></html>');
      server.close();

      // Exchange code for tokens
      console.log('\n✅ Got authorization code!');
      console.log('\n2. Exchanging for tokens...\n');

      const clientId = env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
      const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';

      fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }).then(r => r.json()).then(tokens => {
        if (tokens.access_token) {
          console.log('✅ Tokens received!');
          saveEnv('YOUTUBE_ACCESS_TOKEN', tokens.access_token);
          if (tokens.refresh_token) {
            saveEnv('YOUTUBE_REFRESH_TOKEN', tokens.refresh_token);
            console.log('✅ Refresh token saved!');
          }

          // Verify
          return fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
          }).then(r => r.json()).then(data => {
            if (data.items && data.items[0]) {
              console.log(`\n✅ Verified! Channel: "${data.items[0].snippet.title}"`);
            }
            console.log('\n========================================');
            console.log('✅ OAUTH COMPLETE!');
            console.log('========================================\n');
          });
        } else {
          console.log('❌ Token exchange failed:', JSON.stringify(tokens));
        }
      }).catch(err => {
        console.error('❌ Error:', err.message);
      });
      return;
    }

    res.end('<html><body><h1>Waiting...</h1></body></html>');
  });

  await new Promise(resolve => server.listen(3000, '127.0.0.1', resolve));
  console.log('   Server ready!\n');

  // Open browser
  console.log('2. Opening browser for OAuth...\n');
  console.log('   URL:', authUrl);
  console.log('\n   → Sign in with: thanhtungtran364@gmail.com');
  console.log('   → Click "Allow"');
  console.log('   → You will be redirected to localhost:3000\n');

  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', authUrl], { detached: true, stdio: 'ignore', shell: true });
  }

  console.log('3. Waiting for authorization...\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
