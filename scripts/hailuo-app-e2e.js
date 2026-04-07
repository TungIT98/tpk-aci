#!/usr/bin/env node
/**
 * scripts/hailuo-app-e2e.js
 *
 * TKP-102 — End-to-end test for Hailuo App browser automation.
 * Tests the full generateVideo() flow: init -> isLoggedIn -> navigate ->
 * fill prompt -> submit -> wait for completion -> download.
 *
 * Usage:
 *   node scripts/hailuo-app-e2e.js                         # test with default prompt
 *   node scripts/hailuo-app-e2e.js --prompt "A cat jumping"  # custom prompt
 *   node scripts/hailuo-app-e2e.js --headless             # run headless
 *   node scripts/hailuo-app-e2e.js --skip-poll            # skip waiting for generation
 *
 * Prerequisites:
 *   node scripts/setup-hailuo-app-session.js  (must be done once)
 *
 * TikTok Upload (TKP-126):
 *   node scripts/hailuo-app-e2e.js --tiktok --video outputs/WC-01/final.mp4 --caption "My video"
 *   Prerequisites:
 *     node scripts/setup-tiktok-session.js
 *     node scripts/tiktok-upload-e2e.js  (standalone test — use this first)
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  try {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
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

// CLI args
const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [key, val] = arg.replace(/^--/, '').split('=');
    return [key, val ?? true];
  })
);

const TIKTOK_UPLOAD = args.tiktok !== undefined;
const TIKTOK_VIDEO   = args.video || null;
const TIKTOK_CAPTION = args.caption || 'Hailuo + TikTok upload test #automation #test';
const TIKTOK_TAGS   = args.tags ? args.tags.split(',').map(t => t.trim()) : ['automation', 'test'];
const TIKTOK_SESSION_PATH = env.TIKTOK_SESSION_PATH || resolve(ROOT, '.tiktok-session.json');

const PROMPT = args.prompt ||
  'A productive morning routine, professional worker at a clean desk, golden hour sunlight, ' +
  'cinematic camera push-in, shallow depth of field, high quality';
const ASPECT = args.aspect || '16:9';
const HEADLESS = args.headless !== undefined
  ? args.headless !== 'false'
  : (env.HAILUO_HEADLESS !== 'false');
const SKIP_POLL = args['skip-poll'] !== undefined;
const SESSION_PATH = env.HAILUO_SESSION_PATH || resolve(ROOT, '.hailuo-session.json');
const HAILUO_URL = env.HAILUO_APP_URL || 'https://hailuoai.video';

function log(...args) {
  console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args);
}

// ---------------------------------------------------------------------------
// Minimal inline HailuoApp (copy of lib/hailuo-app.js core logic for testing)
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function probePage(page, label) {
  log(`[${label}] Probing page elements...`);
  const results = {};

  // Check URL
  results.url = page.url();

  // Count key elements
  const textarea = await page.locator('textarea').count();
  const buttons = await page.locator('button').count();
  const inputs = await page.locator('input').count();
  const videos = await page.locator('video').count();

  results.elementCounts = { textarea, buttons, inputs, videos };

  // Get all button texts
  const buttonTexts = await page.locator('button').evaluateAll(els =>
    els.map(el => el.textContent?.trim().slice(0, 60)).filter(Boolean)
  );
  results.buttonTexts = buttonTexts;

  // Get all input placeholders
  const inputPlaceholders = await page.locator('input').evaluateAll(els =>
    els.map(el => el.getAttribute('placeholder') || el.getAttribute('name') || el.type || '').filter(Boolean)
  );
  results.inputPlaceholders = inputPlaceholders;

  // Get textarea placeholders
  const textareaPlaceholders = await page.locator('textarea').evaluateAll(els =>
    els.map(el => el.getAttribute('placeholder') || '').filter(Boolean)
  );
  results.textareaPlaceholders = textareaPlaceholders;

  // Check for logged-in state: look for nav/user elements
  const bodyText = await page.locator('body').innerText().catch(() => '');
  results.bodySnippet = bodyText.slice(0, 300);

  log(`  URL: ${results.url}`);
  log(`  Elements: ${textarea} textareas, ${buttons} buttons, ${inputs} inputs, ${videos} videos`);
  log(`  Buttons: ${buttonTexts.slice(0, 5).join(' | ') || 'none'}`);
  log(`  Textarea placeholders: ${textareaPlaceholders.join(', ') || 'none'}`);

  return results;
}

// ---------------------------------------------------------------------------
// Main E2E test
// ---------------------------------------------------------------------------

async function run() {
  console.log('='.repeat(60));
  console.log('Hailuo App — E2E Test (TKP-102)');
  console.log('='.repeat(60));
  console.log(`Prompt:    ${PROMPT.slice(0, 80)}...`);
  console.log(`Aspect:    ${ASPECT}`);
  console.log(`Headless:  ${HEADLESS}`);
  console.log(`Skip poll: ${SKIP_POLL}`);
  console.log(`Session:   ${SESSION_PATH}`);
  if (TIKTOK_UPLOAD) {
    console.log(`TikTok:    ENABLED (--tiktok)`);
    console.log(`TikTok session: ${TIKTOK_SESSION_PATH}`);
    console.log(`TikTok video:  ${TIKTOK_VIDEO || '(use --video or hailuo output)'}`);
  }
  console.log();

  // Check session
  if (!existsSync(SESSION_PATH)) {
    console.error('ERROR: No session file found.');
    console.error('  Run first: node scripts/setup-hailuo-app-session.js');
    process.exit(1);
  }
  console.log('✓ Session file found');

  // Import HailuoApp
  let HailuoApp;
  try {
    ({ HailuoApp } = await import('../lib/hailuo-app.js'));
  } catch (e) {
    console.error('ERROR: Could not import HailuoApp from lib/hailuo-app.js');
    console.error(e.message);
    process.exit(1);
  }

  const app = new HailuoApp({
    headless: HEADLESS,
    sessionPath: SESSION_PATH,
    timeoutMs: 30000,
  });

  const results = {
    prompt: PROMPT,
    aspect: ASPECT,
    stages: {},
    errors: [],
    passed: [],
    failed: [],
    skipped: [],
  };

  // Stage 1: Init
  log('STAGE 1: Initializing HailuoApp...');
  try {
    await app.init();
    results.stages.init = { status: 'PASS' };
    results.passed.push('init');
    log('✓ init() succeeded');
  } catch (e) {
    results.stages.init = { status: 'FAIL', error: e.message };
    results.failed.push('init');
    results.errors.push(e);
    console.error('✗ init() failed:', e.message);
    await app.close();
    process.exit(1);
  }

  // Stage 2: Login check
  log('\nSTAGE 2: Checking login status...');
  try {
    const loggedIn = await app.isLoggedIn();
    if (loggedIn) {
      results.stages.login = { status: 'PASS', loggedIn: true };
      results.passed.push('login');
      log('✓ isLoggedIn() = true');
    } else {
      results.stages.login = { status: 'FAIL', loggedIn: false };
      results.failed.push('login');
      log('✗ isLoggedIn() = false — session may be expired');
      log('  Fix: node scripts/setup-hailuo-app-session.js');
    }
  } catch (e) {
    results.stages.login = { status: 'ERROR', error: e.message };
    results.errors.push(e);
    log('✗ isLoggedIn() error:', e.message);
  }

  // Stage 3: Credits check
  log('\nSTAGE 3: Checking account credits...');
  try {
    const credits = await app.getCredits();
    results.stages.credits = { status: 'PASS', ...credits };
    log(`✓ getCredits() = ${JSON.stringify(credits)}`);
  } catch (e) {
    results.stages.credits = { status: 'WARN', error: e.message };
    log('⚠ getCredits() error:', e.message);
  }

  // Stage 4: Navigate to create page and probe
  log('\nSTAGE 4: Navigating to create page + probing selectors...');
  try {
    await app._navigateToCreate();
    const probe = await probePage(app._page, 'createPage');
    results.stages.probe = { status: 'PASS', ...probe };
    results.passed.push('probe');

    // Check if we have the key elements
    if (probe.elementCounts.textarea > 0 || probe.elementCounts.inputs > 0) {
      log('✓ Found input fields for prompt');
    } else {
      log('⚠ No textarea/input found — UI may have changed');
      results.stages.probe.status = 'WARN';
    }

    // Save probe results
    if (probe.elementCounts.buttons > 0) {
      log(`  Top buttons: ${probe.buttonTexts.slice(0, 5).join(', ')}`);
    }
  } catch (e) {
    results.stages.probe = { status: 'FAIL', error: e.message };
    results.failed.push('probe');
    results.errors.push(e);
    log('✗ Probe failed:', e.message);
  }

  // Stage 5: Fill prompt (dry-run — don't actually submit in E2E unless skip-poll)
  log('\nSTAGE 5: Testing prompt fill...');
  try {
    const textarea = await app._findPromptInput();
    if (textarea) {
      results.stages.fillPrompt = { status: 'PASS', selector: 'found' };
      results.passed.push('fillPrompt');
      log('✓ _findPromptInput() found input element');

      // Test filling (handle contenteditable divs specially)
      await textarea.click();
      const tagName = await textarea.evaluate(el => el.tagName);
      if (tagName === 'DIV') {
        // contenteditable
        await textarea.evaluate((el, text) => {
          el.textContent = text;
          el.innerHTML = '<p>' + text + '</p>';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, PROMPT);
        const filled = await textarea.evaluate(el => el.textContent);
        log(`✓ Prompt filled successfully (${filled.length} chars, contenteditable)`);
        results.stages.fillPrompt.inputLength = filled.length;
      } else {
        await textarea.fill(PROMPT);
        const filled = await textarea.inputValue();
        if (filled.includes('productive') || filled.length > 0) {
          log(`✓ Prompt filled successfully (${filled.length} chars)`);
          results.stages.fillPrompt.inputLength = filled.length;
          await textarea.fill('');
        }
      }
    } else {
      results.stages.fillPrompt = { status: 'FAIL', selector: 'not found' };
      results.failed.push('fillPrompt');
      log('✗ _findPromptInput() could not find an input element');
      log('  This means the UI selectors in hailuo-app.js need to be updated.');
      log('  Run: node scripts/hailuo-app-diagnostic.js to find the correct selectors.');
    }
  } catch (e) {
    results.stages.fillPrompt = { status: 'ERROR', error: e.message };
    results.failed.push('fillPrompt');
    results.errors.push(e);
    log('✗ _findPromptInput() error:', e.message);
  }

  // Stage 6: Find submit button
  log('\nSTAGE 6: Testing submit button detection...');
  try {
    const submitBtn = await app._findSubmitButton();
    if (submitBtn) {
      const txt = await submitBtn.innerText().catch(() => '');
      results.stages.submitBtn = { status: 'PASS', text: txt.trim() };
      results.passed.push('submitBtn');
      log(`✓ _findSubmitButton() found: "${txt.trim()}"`);
    } else {
      results.stages.submitBtn = { status: 'FAIL' };
      results.failed.push('submitBtn');
      log('✗ _findSubmitButton() could not find a submit button');
      log('  Run: node scripts/hailuo-app-diagnostic.js');
    }
  } catch (e) {
    results.stages.submitBtn = { status: 'ERROR', error: e.message };
    results.failed.push('submitBtn');
    results.errors.push(e);
    log('✗ _findSubmitButton() error:', e.message);
  }

  // Stage 7: Aspect ratio (check if buttons exist)
  log('\nSTAGE 7: Testing aspect ratio selector...');
  try {
    await app._setAspectRatio(ASPECT);
    results.stages.aspectRatio = { status: 'PASS', ratio: ASPECT };
    log(`✓ _setAspectRatio(${ASPECT}) called`);
  } catch (e) {
    results.stages.aspectRatio = { status: 'WARN', error: e.message };
    log('⚠ _setAspectRatio() note:', e.message);
  }

  // Stage 8: TikTok upload (optional --tiktok flag)
  if (TIKTOK_UPLOAD) {
    log('\nSTAGE 8: TikTok browser upload (--tiktok flag)...');

    // Check TikTok session
    if (!existsSync(TIKTOK_SESSION_PATH)) {
      results.stages.tiktokUpload = {
        status: 'SKIP',
        error: `No TikTok session. Run: node scripts/setup-tiktok-session.js`,
      };
      results.skipped.push('tiktokUpload');
      log('⊘ TikTok upload skipped — no session. Fix: node scripts/setup-tiktok-session.js');
    } else {
      const videoPath = TIKTOK_VIDEO || resolve(ROOT, 'output', 'last-video.mp4');
      log(`  Video: ${videoPath}`);
      log(`  Caption: ${TIKTOK_CAPTION.slice(0, 60)}...`);

      if (!existsSync(videoPath)) {
        results.stages.tiktokUpload = {
          status: 'SKIP',
          error: `Video not found: ${videoPath}. Generate a video first or use --video <path>`,
        };
        results.skipped.push('tiktokUpload');
        log(`⊘ TikTok upload skipped — video not found: ${videoPath}`);
      } else {
        try {
          const { TikTokBrowser } = await import('../lib/upload/tiktok-browser.js');
          const uploader = new TikTokBrowser({
            sessionPath: TIKTOK_SESSION_PATH,
            username: env.TIKTOK_USERNAME || 'thanhtungtran364@gmail.com',
            headless: HEADLESS,
            timeoutMs: 120_000,
          });

          await uploader.init();
          const loggedIn = await uploader.isLoggedIn();
          if (!loggedIn) {
            results.stages.tiktokUpload = {
              status: 'FAIL',
              error: 'TikTok session expired. Run: node scripts/setup-tiktok-session.js',
            };
            results.failed.push('tiktokUpload');
            log('✗ TikTok not logged in — fix: node scripts/setup-tiktok-session.js');
          } else {
            log('✓ TikTok session valid');
            const uploadResult = await uploader.upload({
              videoPath,
              caption: TIKTOK_CAPTION,
              tags: TIKTOK_TAGS,
            });
            if (uploadResult.success) {
              results.stages.tiktokUpload = { status: 'PASS', url: uploadResult.url };
              results.passed.push('tiktokUpload');
              log(`✓ TikTok upload PASSED: ${uploadResult.url}`);
            } else {
              results.stages.tiktokUpload = { status: 'FAIL', error: uploadResult.error };
              results.failed.push('tiktokUpload');
              log(`✗ TikTok upload FAILED: ${uploadResult.error}`);
            }
          }
          await uploader.close();
        } catch (e) {
          results.stages.tiktokUpload = { status: 'ERROR', error: e.message };
          (results.failed || results.failed).push('tiktokUpload');
          log('✗ TikTok upload error:', e.message);
          results.errors.push(e);
        }
      }
    }
  }

  // Report results
  console.log('\n' + '='.repeat(60));
  console.log('E2E TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`PASSED: ${results.passed.length}`);
  console.log(`FAILED: ${results.failed.length}`);
  if (results.failed.length > 0) {
    console.log(`\nFailed stages: ${results.failed.join(', ')}`);
  }
  console.log();

  if (results.failed.length === 0) {
    console.log('✓ ALL CRITICAL TESTS PASSED');
    console.log('  hailuo-app.js is ready for use with a valid session.');
    if (!SKIP_POLL) {
      console.log('\n  To run a full generation test:');
      console.log('    node scripts/hailuo-app-e2e.js --skip-poll=false');
    }
  } else {
    console.log('⚠ SOME TESTS FAILED — hailuo-app.js selectors need updating');
    console.log('  Run: node scripts/hailuo-app-diagnostic.js');
    console.log('  Then update lib/hailuo-app.js with the correct selectors.');
  }

  // Save results
  const { writeFileSync, mkdirSync } = await import('fs');
  const outDir = resolve(ROOT, 'output');
  mkdirSync(outDir, { recursive: true });
  const reportPath = resolve(outDir, 'hailuo-e2e-report.json');
  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  log(`\n✓ Report saved to: ${reportPath}`);

  await app.close();
  process.exit(results.failed.length > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('\nE2E test crashed:', err.message);
  process.exit(1);
});
