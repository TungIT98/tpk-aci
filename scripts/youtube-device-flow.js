/**
 * scripts/youtube-device-flow.js
 * Google OAuth via Device Flow - NO redirect needed
 * Works for devices that can't run a web server
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { spawn } from 'child_process';

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

const DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

async function requestDeviceCode(clientId) {
  const r = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube'
    }),
  });
  if (!r.ok) throw new Error(`Device code request failed: ${r.status}`);
  return r.json();
}

async function pollForToken(clientId, deviceCode, interval) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });
  return r.json();
}

async function main() {
  console.log('\n========================================');
  console.log('YOUTUBE DEVICE FLOW OAUTH');
  console.log('========================================\n');

  const env = loadEnv();
  const clientId = env.YOUTUBE_CLIENT_ID;
  const clientSecret = env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('ERROR: YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be set in .env');
    process.exit(1);
  }

  // Step 1: Request device code
  console.log('1. Requesting device code from Google...\n');

  let deviceData;
  try {
    deviceData = await requestDeviceCode(clientId);
  } catch (err) {
    console.error('❌ Failed to request device code:', err.message);
    process.exit(1);
  }

  console.log('2. PLEASE DO THE FOLLOWING:\n');
  console.log('   📱 On your PHONE or ANOTHER DEVICE:');
  console.log(`   🌐 Go to: ${deviceData.verification_url}`);
  console.log(`   📋 Enter code: ${deviceData.user_code}\n`);
  console.log(`   ⏰ This code expires in ${Math.floor(deviceData.expires_in / 60)} minutes\n`);

  // Try to open browser automatically
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', deviceData.verification_url], { detached: true, stdio: 'ignore', shell: true });
    }
  } catch (e) {}

  console.log('3. Waiting for authorization...\n');

  // Step 2: Poll for token
  const intervalMs = deviceData.interval * 1000 || 5000;
  const deadline = Date.now() + deviceData.expires_in * 1000;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, intervalMs));

    try {
      const tokenData = await pollForToken(clientId, deviceData.device_code, intervalMs);

      if (tokenData.access_token) {
        console.log('\n✅ AUTHORIZATION SUCCESSFUL!\n');

        // Save tokens
        saveEnv('YOUTUBE_ACCESS_TOKEN', tokenData.access_token);
        if (tokenData.refresh_token) {
          saveEnv('YOUTUBE_REFRESH_TOKEN', tokenData.refresh_token);
          console.log('   Refresh token saved!');
        }

        console.log('   Access token expires in:', tokenData.expires_in, 'seconds');

        // Verify
        console.log('\n4. Verifying...');
        const verifyResp = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
          { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
        );
        const data = await verifyResp.json();
        if (data.items && data.items[0]) {
          console.log(`   ✅ Verified! Channel: "${data.items[0].snippet.title}"`);
        }

        console.log('\n========================================');
        console.log('✅ YOUTUBE OAUTH COMPLETE!');
        console.log('========================================');
        console.log('\nUploads are now fully automatic.\n');
        return;
      }

      if (tokenData.error === 'authorization_pending') {
        process.stdout.write('.');
        continue;
      }

      if (tokenData.error === 'slow_down') {
        console.log('\n   Polling too fast, slowing down...');
        continue;
      }

      console.log('\n❌ Authorization error:', tokenData.error_description || tokenData.error);
      process.exit(1);

    } catch (err) {
      console.error('\n❌ Polling error:', err.message);
      process.exit(1);
    }
  }

  console.error('\n❌ Code expired. Please run again and authorize faster.');
  process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
