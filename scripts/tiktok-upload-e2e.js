#!/usr/bin/env node
/**
 * scripts/tiktok-upload-e2e.js
 *
 * E2E test for TikTok browser upload automation (lib/upload/tiktok-browser.js).
 * Tests: init -> isLoggedIn -> upload -> result.
 *
 * Usage:
 *   node scripts/tiktok-upload-e2e.js                           # uses test video from --video arg or first outputs/*.mp4
 *   node scripts/tiktok-upload-e2e.js --video outputs/WC-01/final.mp4 --caption "Test upload #tiktok"
 *   node scripts/tiktok-upload-e2e.js --headless=false         # watch browser
 *   node scripts/tiktok-upload-e2e.js --probe                   # just probe the upload page
 *
 * Prerequisites:
 *   node scripts/setup-tiktok-session.js  (must be done once)
 *
 * Reports to:
 *   output/tiktok-e2e-report.json
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(ROOT, 'output');

// ---------------------------------------------------------------------------
// Env / CLI
// ---------------------------------------------------------------------------

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

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [key, val] = arg.replace(/^--/, '').split('=');
    return [key, val ?? true];
  })
);

const SESSION_PATH = env.TIKTOK_SESSION_PATH || resolve(ROOT, '.tiktok-session.json');
const HEADLESS = args.headless !== undefined
  ? args.headless !== 'false'
  : true;
const PROBE_ONLY = args.probe !== undefined;

// Find a test video if none specified
function findTestVideo() {
  // Scan outputs/ for any final.mp4
  try {
    const dirs = readdirSync(resolve(ROOT, 'outputs')).filter(d =>
      !d.startsWith('.') && !d.startsWith('QC')
    );
    for (const dir of dirs) {
      const fp = resolve(ROOT, 'outputs', dir, 'final.mp4');
      if (existsSync(fp)) return fp;
    }
  } catch { /* no outputs dir */ }

  // Fallback to any mp4 in outputs/
  try {
    function findMp4(dir) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (entry.endsWith('.mp4')) return full;
        try {
          const sub = findMp4(full);
          if (sub) return sub;
        } catch { /* not a dir */ }
      }
      return null;
    }
    return findMp4(resolve(ROOT, 'output')) || findMp4(resolve(ROOT, 'outputs'));
  } catch { /* ok */ }

  return null;
}

const TEST_VIDEO = args.video || args.path || findTestVideo();
const TEST_CAPTION = args.caption || 'Testing TikTok browser upload automation #test #automation';
const TEST_TAGS = args.tags ? args.tags.split(',').map(t => t.trim()) : ['test', 'automation', 'tiktok'];
const USERNAME = env.TIKTOK_USERNAME || 'thanhtungtran364@gmail.com';

function log(...a) {
  console.log(`[${new Date().toISOString().slice(11,19)}]`, ...a);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const REPORT_PATH = resolve(OUTPUT_DIR, 'tiktok-e2e-report.json');
let report = {
  timestamp: new Date().toISOString(),
  videoPath: TEST_VIDEO,
  caption: TEST_CAPTION,
  headless: HEADLESS,
  sessionPath: SESSION_PATH,
  stages: {},
  passed: [],
  failed: [],
  errors: [],
  skipped: [],
};

function saveReport() {
  try { mkdirSync(OUTPUT_DIR, { recursive: true }); } catch { /* ok */ }
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

function stage(name, status, extra = {}) {
  report.stages[name] = { status, ...extra };
  if (status === 'PASS') report.passed.push(name);
  else if (status === 'FAIL') report.failed.push(name);
  else if (status === 'SKIP') report.skipped.push(name);
  saveReport();
  log(`${status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'SKIP' ? '⊘' : '⚠'} ${name}: ${status}`, extra.error || '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  console.log('══════════════════════════════════════════');
  console.log(' TikTok Browser Upload — E2E Test');
  console.log('══════════════════════════════════════════');
  console.log(`Video:    ${TEST_VIDEO || '(none found)'}`);
  console.log(`Caption:  ${TEST_CAPTION.slice(0, 60)}...`);
  console.log(`Headless: ${HEADLESS}`);
  console.log(`Session:  ${SESSION_PATH}`);
  console.log(`Probe:    ${PROBE_ONLY}`);
  console.log();

  // Check session
  if (!existsSync(SESSION_PATH)) {
    console.error('ERROR: No session file found.');
    console.error('  Run first: node scripts/setup-tiktok-session.js');
    process.exit(1);
  }
  log('✓ Session file found');

  // Check video
  if (!TEST_VIDEO) {
    console.error('ERROR: No video file specified and none found in outputs/');
    console.error('  Usage: node scripts/tiktok-upload-e2e.js --video <path>');
    process.exit(1);
  }
  if (!existsSync(TEST_VIDEO)) {
    console.error(`ERROR: Video file not found: ${TEST_VIDEO}`);
    process.exit(1);
  }
  log(`✓ Video file: ${TEST_VIDEO}`);

  // Import TikTokBrowser
  let TikTokBrowser;
  try {
    ({ TikTokBrowser } = await import('../lib/upload/tiktok-browser.js'));
  } catch (e) {
    console.error('ERROR: Could not import TikTokBrowser from lib/upload/tiktok-browser.js');
    console.error(e.message);
    process.exit(1);
  }

  const uploader = new TikTokBrowser({
    sessionPath: SESSION_PATH,
    username: USERNAME,
    headless: HEADLESS,
    timeoutMs: 60_000,
  });

  // Stage 1: Init
  log('\nSTAGE 1: Initializing TikTokBrowser...');
  try {
    await uploader.init();
    stage('init', 'PASS');
  } catch (e) {
    stage('init', 'FAIL', { error: e.message });
    console.error('✗ init() failed:', e.message);
    await uploader.close();
    process.exit(1);
  }

  // Stage 2: Login check
  log('\nSTAGE 2: Checking login status...');
  try {
    const loggedIn = await uploader.isLoggedIn();
    if (loggedIn) {
      stage('login', 'PASS', { loggedIn: true });
      log('✓ isLoggedIn() = true');
    } else {
      stage('login', 'FAIL', { loggedIn: false, hint: 'Session may be expired. Run: node scripts/setup-tiktok-session.js' });
      log('✗ isLoggedIn() = false — session may be expired');
      log('  Fix: node scripts/setup-tiktok-session.js');
      await uploader.close();
      process.exit(1);
    }
  } catch (e) {
    stage('login', 'ERROR', { error: e.message });
    log('✗ isLoggedIn() error:', e.message);
    await uploader.close();
    process.exit(1);
  }

  // Stage 3: Navigate to upload page + probe
  if (PROBE_ONLY) {
    log('\nSTAGE 3: Probing upload page (--probe mode)...');
    try {
      await uploader._page.goto('https://www.tiktok.com/upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      const probe = await uploader._probeCurrentPage('upload');
      stage('upload-page-probe', 'PASS', probe);
    } catch (e) {
      stage('upload-page-probe', 'ERROR', { error: e.message });
    }
    await uploader.close();
    console.log('\nProbe complete. Report saved to:', REPORT_PATH);
    process.exit(0);
  }

  // Stage 4: Upload
  log('\nSTAGE 4: Uploading video to TikTok...');
  try {
    const result = await uploader.upload({
      videoPath: TEST_VIDEO,
      caption: TEST_CAPTION,
      tags: TEST_TAGS,
    });

    if (result.success) {
      stage('upload', 'PASS', { url: result.url });
      log(`✓ Upload PASSED: ${result.url}`);
    } else {
      stage('upload', 'FAIL', { error: result.error, url: result.url });
      log(`✗ Upload FAILED: ${result.error}`);
    }
  } catch (e) {
    stage('upload', 'ERROR', { error: e.message });
    log('✗ upload() threw:', e.message);
  }

  await uploader.close();

  // Summary
  console.log('\n══════════════════════════════════════════');
  console.log(' E2E Summary');
  console.log('══════════════════════════════════════════');
  console.log(`Stages:   ${report.passed.length} passed, ${report.failed.length} failed, ${report.skipped.length} skipped`);
  if (report.stages.upload) {
    console.log(`Upload:   ${report.stages.upload.status}`);
  }
  console.log(`Report:   ${REPORT_PATH}`);
  console.log();

  saveReport();

  if (report.failed.length > 0) {
    console.log('Failing stages:', report.failed.join(', '));
    process.exit(1);
  } else {
    console.log('All stages passed!');
    process.exit(0);
  }
})();
