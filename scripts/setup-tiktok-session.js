#!/usr/bin/env node
/**
 * scripts/setup-tiktok-session.js
 *
 * One-time setup to authenticate with TikTok and save the browser session.
 * Run once, or whenever the session expires.
 *
 * Usage:
 *   node scripts/setup-tiktok-session.js
 *
 * What it does:
 *   1. Opens TikTok in a visible browser (headless=false)
 *   2. Waits for you to log in manually
 *   3. Confirms you're logged in
 *   4. Saves session to .tiktok-session.json
 *
 * After setup, TikTok uploads via lib/upload/tiktok-browser.js will be
 * fully automated using the saved session.
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { TikTokBrowser } from '../lib/upload/tiktok-browser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
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

const env = loadEnv();
const SESSION_PATH = env.TIKTOK_SESSION_PATH || resolve(ROOT, '.tiktok-session.json');
const USERNAME = env.TIKTOK_USERNAME || 'thanhtungtran364@gmail.com';
const PASSWORD = env.TIKTOK_PASSWORD || '';

function log(...args) {
  console.log(`[setup] ${new Date().toISOString().slice(11,19)}`, ...args);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   TikTok Browser Session Setup            ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log();
  console.log('This script will:');
  console.log('  1. Open TikTok in a VISIBLE browser (not headless)');
  console.log('  2. Wait for you to log in at www.tiktok.com');
  console.log('  3. Confirm login and save your session');
  console.log();
  console.log(`Target account: ${USERNAME}`);
  console.log(`Session file:   ${SESSION_PATH}`);
  console.log();

  // Check if session already exists
  if (existsSync(SESSION_PATH)) {
    console.log('✅ Session file already exists.');
    const uploader = new TikTokBrowser({ sessionPath: SESSION_PATH, headless: false });
    await uploader.init();
    const loggedIn = await uploader.isLoggedIn();
    if (loggedIn) {
      console.log('✅ Session is valid — you are logged in!');
      console.log('   No action needed. The saved session can be used for automated uploads.');
      await uploader.close();
      process.exit(0);
    } else {
      console.log('⚠️  Session file exists but appears expired. Re-logging in...');
    }
  }

  const uploader = new TikTokBrowser({
    sessionPath: SESSION_PATH,
    username: USERNAME,
    password: PASSWORD,
    headless: false, // Always visible for manual auth
  });

  await uploader.init();
  console.log();
  console.log('Browser opened — please log in to TikTok in the browser window.');
  console.log('Navigate to: https://www.tiktok.com');
  console.log();
  console.log('Once logged in, come back here and press ENTER to save the session...');
  console.log('(Or close the browser to cancel)');

  // Wait for user to press Enter, OR detect login automatically
  while (true) {
    await sleep(3000);
    const loggedIn = await uploader.isLoggedIn();
    if (loggedIn) {
      log('Detected login — saving session...');
      await uploader.saveSession();
      console.log();
      console.log('✅ Session saved successfully!');
      console.log(`   ${SESSION_PATH}`);
      console.log();
      console.log('You can now run automated TikTok uploads with:');
      console.log('   node lib/upload/tiktok-browser.js --video <path> --caption "<caption>"');
      break;
    }

    // Check if browser was closed
    if (!uploader._context || uploader._context.pages().length === 0) {
      console.log('Browser closed — setup cancelled.');
      break;
    }
  }

  await uploader.close();
  process.exit(0);
})();
