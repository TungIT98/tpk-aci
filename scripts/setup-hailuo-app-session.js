/**
 * scripts/setup-hailuo-app-session.js
 *
 * One-time setup script to authenticate with the Hailuo App and save
 * the session (cookies + localStorage) so future Playwright runs can
 * reuse it without manual login.
 *
 * Usage:
 *   node scripts/setup-hailuo-app-session.js
 *
 * What it does:
 *   1. Launches a visible browser pointed at hailuoai.video
 *   2. Lets you log in manually (or uses existing session)
 *   3. Saves the session to .hailuo-session.json
 *   4. Confirms the saved session works
 *
 * After running this once, lib/hailuo-app.js will auto-load the session.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Load env
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
const HAILUO_URL   = env.HAILUO_APP_URL     || 'https://hailuoai.video';

async function main() {
  console.log('='.repeat(60));
  console.log('Hailuo App — Session Setup');
  console.log('='.repeat(60));
  console.log();
  console.log(`Target: ${HAILUO_URL}`);
  console.log(`Session will be saved to: ${SESSION_PATH}`);
  console.log();

  // Check for existing session
  if (existsSync(SESSION_PATH)) {
    console.log('✓ Session file already exists:', SESSION_PATH);
    try {
      const data = JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));
      const cookieCount = data.cookies?.length ?? 0;
      console.log(`  Contains ${cookieCount} cookies.`);
      console.log();
      console.log('To use the existing session, just run your pipeline.');
      console.log('To refresh the session, delete the file and re-run this script.');
    } catch {
      console.log('  (File exists but is not valid JSON — will be replaced)');
    }
    console.log();
  }

  // Check if Playwright is available
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (e) {
    console.error('Playwright not found. Install it with:');
    console.error('  npm install playwright');
    console.error('  npx playwright install chromium');
    process.exit(1);
  }

  const { chromium } = playwright;

  console.log('Launching browser (visible mode — NOT headless)...');
  console.log();
  console.log('INSTRUCTIONS:');
  console.log('  1. A browser window will open at hailuoai.video');
  console.log('  2. Log in to your Hailuo account if not already logged in');
  console.log('  3. Once you see your account / credits visible, come back here');
  console.log('  4. Press ENTER to save the session');
  console.log();
  console.log('  (Or just press ENTER now if you are already logged in)');
  console.log();

  // Launch in non-headless mode so user can see/interact
  // Anti-detection args to avoid bot blocking
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--lang=en-US',
    ],
    // Remove automation indicators
    ignoreHTTPSErrors: true,
  });

  // Inject anti-detection script to hide Playwright
  const page = (await context.pages())[0] || await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.navigator.chrome = { runtime: {} };
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  });

  // Navigate to Hailuo
  console.log('Navigating to Hailuo App...');
  await page.goto(HAILUO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for user to be ready
  console.log();
  console.log('Browser opened. Please log in or verify you are logged in.');
  console.log('When ready, press ENTER in this terminal to save the session.');
  console.log();

  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  // Verify BEFORE saving
  console.log('Verifying login state...');
  const url = page.url();
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const hasSignIn = bodyText.includes('Sign In') || url.includes('login');
  const hasAvatar = await page.locator('[class*="avatar"], [class*="user-avatar"], [class*="account"]').count() > 0;

  if (hasSignIn && !hasAvatar) {
    console.warn('⚠ WARNING: Not logged in (still shows "Sign In").');
    console.warn('  1. Click "Sign In" in the browser');
    console.warn('  2. Log in with your Hailuo account');
    console.warn('  3. Press ENTER again to save');
    console.warn('  Re-running verification...');
    // Let user try again
    await context.close();
    // Relaunch
    return main();
  }

  console.log('✓ Logged in - saving session...');

  // Save session
  const state = await context.storageState();
  const { writeFileSync, mkdirSync } = await import('fs');
  mkdirSync(resolve(ROOT), { recursive: true });
  writeFileSync(SESSION_PATH, JSON.stringify(state, null, 2), 'utf-8');

  const cookieCount = state.cookies?.length ?? 0;
  const origin = state.origins?.[0]?.origin ?? 'unknown';

  console.log();
  console.log('='.repeat(60));
  console.log('✓ Session saved successfully!');
  console.log(`  Path:     ${SESSION_PATH}`);
  console.log(`  Cookies:  ${cookieCount}`);
  console.log(`  Origin:   ${origin}`);
  console.log('='.repeat(60));
  console.log();

  // Report credits
  try {
    await page.goto(HAILUO_URL + '/account', { timeout: 15000 });
    await page.waitForLoadState('domcontentloaded');
    await new Promise(r => setTimeout(r, 2000));
    const creditEls = await page.$$('[class*="credit"], [class*="point"]');
    if (creditEls.length > 0) {
      const text = await creditEls[0].innerText().catch(() => '');
      console.log(`✓ Account credits visible: "${text.trim()}"`);
    }
  } catch { /* optional */ }

  await context.close();

  console.log();
  console.log('Setup complete! You can now run the video pipeline without manual login.');
  console.log();
  console.log('Next step: run your video generation:');
  console.log('  node -e "import(\'./lib/hailuo-app.js\').then(m => ...)"');
}

main().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
