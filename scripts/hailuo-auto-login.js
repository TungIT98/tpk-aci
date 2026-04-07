// hailuo-auto-login.js - Try to programmatically log in to Hailuo
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');
const HAILUO_URL = 'https://hailuoai.video';

// Credentials (from MEMORY.md)
const EMAIL = 'thanhtungtran364@gmail.com';
const PASSWORD = 'Nova2026';

function log(...args) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args); }

async function main() {
  log('=== Hailuo Auto Login ===');
  
  const { chromium } = await import('playwright');
  
  log('Launching headless browser...');
  const context = await chromium.launchPersistentContext('', {
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  
  const page = (await context.pages())[0] || await context.newPage();
  
  // Navigate to Hailuo
  log('Going to Hailuo...');
  await page.goto(HAILUO_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));
  
  log('URL:', page.url().slice(0, 80));
  
  // Check if already logged in
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const alreadyLoggedIn = !page.url().includes('login') && (
    bodyText.includes('Credits') || 
    bodyText.includes('My Videos') ||
    bodyText.includes('Account')
  );
  
  if (alreadyLoggedIn) {
    log('Already logged in!');
  } else {
    log('Need to log in...');
    
    // Try to find and fill login form
    // Look for email/password fields
    const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="mail" i]');
    const passwordInput = await page.$('input[type="password"]');
    
    if (emailInput && passwordInput) {
      log('Found login form. Filling...');
      await emailInput.fill(EMAIL);
      await new Promise(r => setTimeout(r, 500));
      await passwordInput.fill(PASSWORD);
      await new Promise(r => setTimeout(r, 500));
      
      // Find and click submit
      const submitBtn = await page.$('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("登")');
      if (submitBtn) {
        await submitBtn.click();
        log('Submit clicked. Waiting for navigation...');
        await new Promise(r => setTimeout(r, 5000));
        log('URL after login:', page.url().slice(0, 80));
      } else {
        log('Could not find submit button');
      }
    } else {
      log('Could not find login form. Dumping page content...');
      const inputs = await page.locator('input').evaluateAll(els => els.map(e => ({ type: e.type, placeholder: e.placeholder, name: e.name })));
      log('Inputs:', JSON.stringify(inputs.slice(0, 10)));
    }
  }
  
  // Check final state
  const finalUrl = page.url();
  const finalBody = await page.locator('body').innerText().catch(() => '');
  log('Final URL:', finalUrl.slice(0, 80));
  log('Final body snippet:', finalBody.slice(0, 200));
  
  // Save session regardless
  log('Saving session...');
  const state = await context.storageState();
  mkdirSync(resolve(ROOT), { recursive: true });
  writeFileSync(SESSION_PATH, JSON.stringify(state, null, 2));
  log(`Saved ${state.cookies?.length || 0} cookies to ${SESSION_PATH}`);
  
  await context.close();
  
  // Verify with HailuoApp
  log('\nVerifying with HailuoApp...');
  const { HailuoApp } = await import('../lib/hailuo-app.js');
  const app = new HailuoApp({ headless: true, sessionPath: SESSION_PATH });
  await app.init();
  const loggedIn = await app.isLoggedIn();
  log('HailuoApp.isLoggedIn():', loggedIn);
  await app.close();
  
  if (loggedIn) {
    log('✅ SUCCESS! Hailuo session saved and verified.');
  } else {
    log('⚠️  Session saved but HailuoApp cannot log in. Manual login may be needed.');
    log('   Run: node scripts/setup-hailuo-app-session.js');
  }
}

main().catch(err => {
  log('Error:', err.message);
  process.exit(1);
});
