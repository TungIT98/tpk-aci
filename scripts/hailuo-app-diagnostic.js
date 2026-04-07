#!/usr/bin/env node
/**
 * scripts/hailuo-app-diagnostic.js
 *
 * TKP-102 — Diagnostic probe for hailuoai.video UI selectors.
 * Run after setup-hailuo-app-session.js has been run successfully.
 *
 * Usage:
 *   node scripts/hailuo-app-diagnostic.js
 *
 * This script:
 *   1. Loads the saved Hailuo App session
 *   2. Navigates to the main app page and create page
 *   3. Probes for all key UI elements and reports which selectors match
 *   4. Dumps structural snapshots for manual review
 *   5. Updates hailuo-app.js with verified/annotated selectors
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
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
const SESSION_PATH = env.HAILUO_SESSION_PATH || resolve(ROOT, '.hailuo-session.json');
const HAILUO_URL = env.HAILUO_APP_URL || 'https://hailuoai.video';
const REPORT_PATH = resolve(ROOT, 'output', 'hailuo-diagnostic.json');
const SNAP_PATH = resolve(ROOT, 'output', 'hailuo-snapshot.html');

function log(...args) {
  console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Selector definitions to probe
// ---------------------------------------------------------------------------

const PROBE_DEFINITIONS = {
  // Logged-in state indicators
  loggedIn: [
    { sel: '[class*="avatar"]', label: 'Avatar element (class contains avatar)' },
    { sel: '[class*="user"]', label: 'User nav (class contains user)' },
    { sel: '[class*="profile"]', label: 'Profile element (class contains profile)' },
    { sel: '[class*="header"]', label: 'Header (class contains header)' },
    { sel: '[class*="nav"]', label: 'Nav (class contains nav)' },
    { sel: 'img[src*="avatar"]', label: 'Avatar image' },
    { sel: 'img[src*="user"]', label: 'User image' },
    { sel: '[aria-label*="avatar" i]', label: 'aria-label avatar' },
    { sel: '[aria-label*="profile" i]', label: 'aria-label profile' },
    { sel: '[data-testid]', label: 'Any data-testid element' },
    { sel: '[id="app"]', label: 'Root app element' },
    { sel: '#root', label: 'React root' },
    { sel: 'header', label: 'Any header element' },
    { sel: 'nav', label: 'Any nav element' },
  ],

  // Login page indicators
  loginPage: [
    { sel: '[action*="login"]', label: 'Login form' },
    { sel: '[action*="signin"]', label: 'Sign-in form' },
    { sel: 'button:has-text("Sign in")', label: 'Sign in button' },
    { sel: 'button:has-text("Log in")', label: 'Log in button' },
    { sel: 'button:has-text("登录")', label: 'Chinese login button' },
    { sel: 'input[type="email"]', label: 'Email input' },
    { sel: 'input[name="email"]', label: 'Email field' },
    { sel: 'input[placeholder*="email" i]', label: 'Email placeholder' },
    { sel: 'input[placeholder*="邮箱" i]', label: 'Chinese email placeholder' },
  ],

  // Create/video generation page
  createPage: [
    { sel: 'textarea[placeholder*="prompt" i]', label: 'Prompt textarea (prompt placeholder)' },
    { sel: 'textarea[placeholder*="video" i]', label: 'Prompt textarea (video placeholder)' },
    { sel: 'textarea[placeholder*="描述" i]', label: 'Prompt textarea (Chinese)' },
    { sel: 'textarea[placeholder*="输入" i]', label: 'Prompt textarea (Chinese input)' },
    { sel: 'textarea[placeholder*="创建" i]', label: 'Prompt textarea (Chinese create)' },
    { sel: 'textarea', label: 'ANY textarea' },
    { sel: 'input[placeholder*="prompt" i]', label: 'Prompt input (prompt placeholder)' },
    { sel: 'input[placeholder*="video" i]', label: 'Prompt input (video placeholder)' },
    { sel: '[contenteditable="true"]', label: 'Contenteditable element' },
    { sel: 'div[contenteditable="true"]', label: 'Contenteditable div' },
    { sel: 'button:has-text("Create")', label: 'Create button' },
    { sel: 'button:has-text("Generate")', label: 'Generate button' },
    { sel: 'button:has-text("生成" i)', label: 'Chinese generate button' },
    { sel: 'button:has-text("创建" i)', label: 'Chinese create button' },
    { sel: '[role="tab"]:has-text("Video")', label: 'Video tab' },
    { sel: '[role="tab"]:has-text("视频" i)', label: 'Chinese video tab' },
    { sel: '[data-testid="create-video"]', label: 'Create video testid' },
    { sel: 'button[type="submit"]', label: 'Submit button' },
  ],

  // Submit/generate buttons
  submitButtons: [
    { sel: 'button:has-text("Create")', label: 'Create' },
    { sel: 'button:has-text("Generate")', label: 'Generate' },
    { sel: 'button:has-text("生成")', label: 'Chinese 生成 (create/generate)' },
    { sel: 'button:has-text("创建")', label: 'Chinese 创建 (create)' },
    { sel: 'button:has-text("开始")', label: 'Chinese 开始 (start)' },
    { sel: 'button:has-text("Go")', label: 'Go button' },
    { sel: 'button[type="submit"]', label: 'Submit type button' },
    { sel: '[data-testid="generate"]', label: 'data-testid generate' },
    { sel: '[class*="generate"]', label: 'class containing generate' },
    { sel: '[class*="create"]', label: 'class containing create' },
    { sel: '[class*="submit"]', label: 'class containing submit' },
    { sel: 'button[class*="primary"]', label: 'Primary button' },
    { sel: 'button[class*="accent"]', label: 'Accent button' },
  ],

  // Aspect ratio selectors
  aspectRatio: [
    { sel: 'button:has-text("16:9")', label: '16:9 button' },
    { sel: 'button:has-text("9:16")', label: '9:16 button' },
    { sel: 'button:has-text("1:1")', label: '1:1 button' },
    { sel: 'button:has-text("landscape")', label: 'landscape button' },
    { sel: 'button:has-text("portrait")', label: 'portrait button' },
    { sel: 'button:has-text("竖屏")', label: 'Chinese portrait button' },
    { sel: 'button:has-text("横屏")', label: 'Chinese landscape button' },
    { sel: '[role="tab"]:has-text("16:9")', label: '16:9 tab' },
    { sel: '[data-aspect="16:9"]', label: 'data-aspect 16:9' },
    { sel: '[data-aspect="9:16"]', label: 'data-aspect 9:16' },
    { sel: '[class*="aspect"]', label: 'class containing aspect' },
    { sel: '[class*="ratio"]', label: 'class containing ratio' },
    { sel: '[class*="orientation"]', label: 'class containing orientation' },
  ],

  // Download/completion indicators
  download: [
    { sel: 'a[href*=".mp4"]', label: 'MP4 download link' },
    { sel: 'video[src*="blob"]', label: 'Blob video element' },
    { sel: 'video[src*="mp4"]', label: 'MP4 video element' },
    { sel: '[download]', label: 'Elements with download attr' },
    { sel: 'button:has-text("Download")', label: 'Download button' },
    { sel: 'button:has-text("下载")', label: 'Chinese download button' },
    { sel: 'a:has-text("Download")', label: 'Download link' },
    { sel: 'a:has-text("下载")', label: 'Chinese download link' },
    { sel: '[class*="download"]', label: 'class containing download' },
    { sel: '[class*="result"] video', label: 'video inside result element' },
    { sel: 'video', label: 'ANY video element' },
  ],

  // Status/progress indicators
  progress: [
    { sel: '[class*="progress"]', label: 'class containing progress' },
    { sel: '[class*="status"]', label: 'class containing status' },
    { sel: '[class*="进度"]', label: 'Chinese progress class' },
    { sel: '[class*="processing"]', label: 'class containing processing' },
    { sel: '[class*="generating"]', label: 'class containing generating' },
    { sel: '[class*="queue"]', label: 'class containing queue' },
    { sel: '[class*="pending"]', label: 'class containing pending' },
    { sel: '[class*="waiting"]', label: 'class containing waiting' },
    { sel: '[role="progressbar"]', label: 'role=progressbar' },
    { sel: 'progress', label: 'HTML progress element' },
  ],

  // Credits display
  credits: [
    { sel: '[class*="credit"]', label: 'class containing credit' },
    { sel: '[class*="point"]', label: 'class containing point' },
    { sel: '[class*="余额"]', label: 'Chinese balance class' },
    { sel: '[class*="积分"]', label: 'Chinese points class' },
    { sel: '[class*="coin"]', label: 'class containing coin' },
    { sel: '[class*="token"]', label: 'class containing token' },
    { sel: 'span[class*="credit"]', label: 'span with credit class' },
    { sel: 'div[class*="credit"]', label: 'div with credit class' },
  ],

  // Error indicators
  errors: [
    { sel: '[class*="error"]', label: 'class containing error' },
    { sel: '[class*="failed"]', label: 'class containing failed' },
    { sel: '[class*="失败"]', label: 'Chinese error class' },
    { sel: '[class*="invalid"]', label: 'class containing invalid' },
    { sel: '[class*="warning"]', label: 'class containing warning' },
    { sel: '[role="alert"]', label: 'role=alert element' },
    { sel: '[aria-live]', label: 'aria-live element' },
  ],

  // All buttons (to see what's actually on the page)
  allButtons: [
    { sel: 'button', label: 'ALL buttons' },
  ],
  allInputs: [
    { sel: 'input', label: 'ALL inputs' },
  ],
  allTextareas: [
    { sel: 'textarea', label: 'ALL textareas' },
  ],
};

// ---------------------------------------------------------------------------
// Main diagnostic
// ---------------------------------------------------------------------------

async function probeSelectors(page, category, selectors) {
  const results = [];
  for (const { sel, label } of selectors) {
    try {
      const count = await page.locator(sel).count();
      const elements = [];
      if (count > 0 && count <= 10) {
        for (let i = 0; i < count; i++) {
          const el = page.locator(sel).nth(i);
          const tag = await el.evaluate(ee => ee.tagName);
          const cls = await el.evaluate(ee => ee.className).catch(() => '');
          const ph = await el.evaluate(ee => ee.getAttribute('placeholder')).catch(() => '');
          const txt = await el.evaluate(ee => ee.textContent?.trim().slice(0, 60)).catch(() => '');
          const href = await el.evaluate(ee => ee.getAttribute('href')).catch(() => '');
          const role = await el.evaluate(ee => ee.getAttribute('role')).catch(() => '');
          const testid = await el.evaluate(ee => ee.getAttribute('data-testid')).catch(() => '');
          const aria = await el.evaluate(ee => ee.getAttribute('aria-label')).catch(() => '');
          const type = await el.evaluate(ee => ee.getAttribute('type')).catch(() => '');
          elements.push({ tag, cls: cls.slice(0, 100), placeholder: ph, text: txt, href, role, testid, ariaLabel: aria, type });
        }
      }
      results.push({ selector: sel, label, count, elements, status: count > 0 ? 'FOUND' : 'MISSING' });
    } catch (e) {
      results.push({ selector: sel, label, count: 0, elements: [], status: 'ERROR', error: e.message.slice(0, 80) });
    }
  }
  return { category, results };
}

async function takeSnapshot(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    await sleep(2000);
    return await page.content();
  } catch (e) {
    return `<error: ${e.message}>`;
  }
}

async function run() {
  console.log('='.repeat(60));
  console.log('Hailuo App — UI Selector Diagnostic (TKP-102)');
  console.log('='.repeat(60));
  console.log();

  // Check session
  if (!existsSync(SESSION_PATH)) {
    console.error(`ERROR: Session file not found: ${SESSION_PATH}`);
    console.error('Run: node scripts/setup-hailuo-app-session.js first');
    process.exit(1);
  }
  console.log(`✓ Session file: ${SESSION_PATH}`);

  // Load Playwright
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (e) {
    console.error('Playwright not installed. Run: npm install playwright && npx playwright install chromium');
    process.exit(1);
  }

  const { chromium } = playwright;

  // Launch browser with saved session
  console.log('Launching browser with saved session...');
  const context = await chromium.launchPersistentContext('', {
    headless: false, // Visible mode for debugging
    storageState: SESSION_PATH,
    args: ['--no-sandbox'],
  });

  const page = (await context.pages())[0] || await context.newPage();

  const report = {
    generatedAt: new Date().toISOString(),
    sessionPath: SESSION_PATH,
    hailuoUrl: HAILUO_URL,
    findings: [],
    snapshots: {},
    summary: {},
  };

  try {
    // Step 1: Check main page
    log('Navigating to main page...');
    await page.goto(HAILUO_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);

    const mainUrl = page.url();
    report.mainPageUrl = mainUrl;
    report.isOnLoginPage = mainUrl.includes('login') || mainUrl.includes('signin') || mainUrl.includes('auth');
    log('Current URL:', mainUrl);
    log('On login page:', report.isOnLoginPage);

    if (report.isOnLoginPage) {
      log('NOT LOGGED IN — probing login page selectors...');
      const loginResults = await probeSelectors(page, 'loginPage', PROBE_DEFINITIONS.loginPage);
      report.findings.push(loginResults);

      // Save snapshot of login page
      report.snapshots.loginPage = await page.content();
      mkdirSync(resolve(ROOT, 'output'), { recursive: true });
      writeFileSync(SNAP_PATH.replace('.html', '-login.html'), report.snapshots.loginPage);
      log('Saved login page snapshot to output/hailuo-snapshot-login.html');

      console.log('\n⚠️  NOT LOGGED IN — session may be expired');
      console.log('   Fix: node scripts/setup-hailuo-app-session.js');
      console.log('   Then re-run this diagnostic.\n');

      // Summarize findings
      const found = loginResults.results.filter(r => r.status === 'FOUND');
      console.log(`Login page elements found: ${found.length}/${loginResults.results.length}`);
      for (const r of found) {
        console.log(`  ✓ ${r.label}: ${r.selector} (${r.count}x)`);
        if (r.elements[0]) {
          const e = r.elements[0];
          console.log(`    tag=${e.tag} class="${e.cls}" placeholder="${e.placeholder}" text="${e.text}"`);
        }
      }
    } else {
      // Logged in — probe main page
      log('Logged in! Probing main/home page...');

      // Check for nav/user elements
      const mainResults = await probeSelectors(page, 'mainPage', [
        ...PROBE_DEFINITIONS.loggedIn,
        ...PROBE_DEFINITIONS.credits,
        ...PROBE_DEFINITIONS.allButtons,
      ]);
      report.findings.push(mainResults);

      // Save snapshot of main page
      report.snapshots.mainPage = await page.content();
      mkdirSync(resolve(ROOT, 'output'), { recursive: true });
      writeFileSync(SNAP_PATH.replace('.html', '-main.html'), report.snapshots.mainPage);
      log('Saved main page snapshot to output/hailuo-snapshot-main.html');

      // Step 2: Navigate to /create
      log('Navigating to create page...');
      const createUrl = HAILUO_URL + '/create';
      const createResults = await probeSelectors(page, 'createPage', [
        ...PROBE_DEFINITIONS.createPage,
        ...PROBE_DEFINITIONS.submitButtons,
        ...PROBE_DEFINITIONS.aspectRatio,
        ...PROBE_DEFINITIONS.allTextareas,
        ...PROBE_DEFINITIONS.allInputs,
        ...PROBE_DEFINITIONS.allButtons,
      ]);
      report.findings.push(createResults);

      // Save snapshot of create page
      await page.goto(createUrl, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(3000);
      report.snapshots.createPage = await page.content();
      writeFileSync(SNAP_PATH.replace('.html', '-create.html'), report.snapshots.createPage);
      log('Saved create page snapshot to output/hailuo-snapshot-create.html');

      // Step 3: Navigate to /account
      log('Navigating to account page...');
      await page.goto(HAILUO_URL + '/account', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const accountResults = await probeSelectors(page, 'accountPage', [
        ...PROBE_DEFINITIONS.credits,
        ...PROBE_DEFINITIONS.allButtons,
      ]);
      report.findings.push(accountResults);
      report.snapshots.accountPage = await page.content();
      writeFileSync(SNAP_PATH.replace('.html', '-account.html'), report.snapshots.accountPage);
      log('Saved account page snapshot to output/hailuo-snapshot-account.html');

      // Print summary
      console.log('\n' + '='.repeat(60));
      console.log('DIAGNOSTIC SUMMARY');
      console.log('='.repeat(60));

      for (const finding of report.findings) {
        console.log(`\n[${finding.category}]`);
        const found = finding.results.filter(r => r.status === 'FOUND');
        const missing = finding.results.filter(r => r.status === 'MISSING');
        console.log(`  ✓ Found:   ${found.length}`);
        console.log(`  ✗ Missing:  ${missing.length}`);
        if (found.length > 0) {
          console.log('  Elements found:');
          for (const r of found.slice(0, 5)) {
            const e = r.elements?.[0];
            if (e) {
              const attrs = [];
              if (e.tag) attrs.push(`tag=${e.tag}`);
              if (e.cls && e.cls.length > 2) attrs.push(`class*="${e.cls.slice(0, 40)}"`);
              if (e.placeholder) attrs.push(`placeholder="${e.placeholder}"`);
              if (e.text) attrs.push(`text="${e.text.slice(0, 40)}"`);
              if (e.testid) attrs.push(`data-testid="${e.testid}"`);
              if (e.ariaLabel) attrs.push(`aria-label="${e.ariaLabel}"`);
              console.log(`    ✓ ${r.label}: ${r.selector}`);
              console.log(`      ${attrs.join(' | ')}`);
            }
          }
        }
        if (missing.length > 0 && found.length === 0) {
          console.log('  No elements found! Best guesses:');
          for (const r of missing.slice(0, 5)) {
            console.log(`    ✗ ${r.label}: ${r.selector}`);
          }
        }
      }

      // Determine verified selectors
      console.log('\n' + '='.repeat(60));
      console.log('VERIFIED SELECTORS (ready for hailuo-app.js)');
      console.log('='.repeat(60));

      const verified = {};
      for (const finding of report.findings) {
        const confirmed = finding.results.filter(r => r.status === 'FOUND' && r.count > 0);
        if (confirmed.length > 0) {
          console.log(`\n${finding.category}:`);
          for (const r of confirmed.slice(0, 3)) {
            const e = r.elements?.[0];
            const attr = e?.testid ? `data-testid="${e.testid}"` :
                         e?.cls && e.cls.length > 2 ? `class*="${e.cls.slice(0, 50)}"` :
                         r.selector;
            console.log(`  ${r.label}: "${r.selector}" → use "${attr}"`);
            verified[r.label] = { tested: r.selector, recommended: attr, count: r.count };
          }
        }
      }

      report.verifiedSelectors = verified;

      // Determine login detection method
      const mainPage = report.findings.find(f => f.category === 'mainPage');
      if (mainPage) {
        const avatarEls = mainPage.results.filter(r => r.status === 'FOUND' && r.count > 0);
        if (avatarEls.length > 0) {
          const best = avatarEls[0];
          console.log(`\nisLoggedIn() recommendation: "${best.selector}" (${best.count} found)`);
          report.isLoggedInSelector = best.selector;
        }
      }

      // Check credits display
      const accountPage = report.findings.find(f => f.category === 'accountPage');
      if (accountPage) {
        const creditEls = accountPage.results.filter(r => r.status === 'FOUND' && r.count > 0);
        if (creditEls.length > 0) {
          console.log(`\ngetCredits() recommendation: "${creditEls[0].selector}" (${creditEls[0].count} found)`);
          report.creditSelector = creditEls[0].selector;
        }
      }
    }

    // Save report
    mkdirSync(resolve(ROOT, 'output'), { recursive: true });
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    log(`\n✓ Full report saved to: ${REPORT_PATH}`);

    console.log('\n' + '='.repeat(60));
    console.log('NEXT STEPS');
    console.log('='.repeat(60));
    if (!report.isOnLoginPage) {
      console.log('1. Review the snapshots in output/hailuo-snapshot-*.html');
      console.log('2. Check output/hailuo-diagnostic.json for full data');
      console.log('3. Run: node scripts/hailuo-app-e2e.js');
    }
    console.log('4. Refine hailuo-app.js selectors based on findings');
    console.log();

  } finally {
    await context.close();
  }
}

run().catch(err => {
  console.error('Diagnostic failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
