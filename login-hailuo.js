import { chromium } from 'playwright';
import { resolve } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const ROOT = resolve('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI');
const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');
const HAILUO_URL = 'https://hailuoai.video';

async function main() {
  console.log('Starting fresh browser for Hailuo login...');

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--lang=en-US',
    ],
  });

  const page = (await context.pages())[0] || await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  // Navigate to Hailuo
  console.log('Navigating to Hailuo...');
  await page.goto(HAILUO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  console.log('Current URL:', page.url());
  console.log('\n=== INSTRUCTIONS ===');
  console.log('1. Look at the browser window');
  console.log('2. Click "Sign In" and log in to your Hailuo account');
  console.log('3. Wait until you see your account/avatar (NOT "Sign In")');
  console.log('4. Press ENTER in this terminal to save session\n');

  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  // Get cookies BEFORE closing browser
  console.log('\nExtracting cookies...');
  const cookies = await context.cookies();
  console.log('Total cookies:', cookies.length);

  // Filter to hailuo cookies
  const hailuoCookies = cookies.filter(c => c.domain.includes('hailuo'));
  console.log('Hailuo cookies:', hailuoCookies.length);
  for (const c of hailuoCookies) {
    console.log('  ', c.name, '|', c.domain, '| httpOnly:', c.httpOnly);
  }

  // Save session in Playwright storageState format
  const storageState = await context.storageState();
  console.log('\nSession storage state keys:', Object.keys(storageState));
  console.log('Cookies in storageState:', storageState.cookies?.length || 0);

  writeFileSync(SESSION_PATH, JSON.stringify(storageState, null, 2), 'utf-8');
  console.log('Session saved to:', SESSION_PATH);

  // Also save as backup
  const backupPath = SESSION_PATH + '.fresh.json';
  writeFileSync(backupPath, JSON.stringify(storageState, null, 2), 'utf-8');
  console.log('Backup saved to:', backupPath);

  await context.close();
  console.log('\nDone!');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
