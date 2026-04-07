/**
 * scripts/hailuo-session-fix.js
 * 
 * PURPOSE: Fix the Hailuo session for TKP-135 video generation.
 * 
 * PROBLEM: The Hailuo session cookies expired. When submitting video generation,
 * Hailuo redirects to login instead of generating.
 * 
 * SIGNS OF ISSUE:
 * - After clicking submit button, page shows "Continue with Google" / "Continue with Apple" buttons
 * - This means the session cookies are invalid for API authentication
 * 
 * ROOT CAUSE:
 * - Session cookies expired (last session was from 2026-03-27)
 * - The avatar images on the page are cached from previous session
 * - isLoggedIn() returns true incorrectly (DOM check, not auth check)
 * 
 * HOW TO FIX:
 * 1. Run: node scripts/hailuo-session-fix.js
 * 2. The script will open a browser window to hailuoai.video
 * 3. If redirected to login → Log in manually with Google account
 * 4. After logged in, the script will save the session
 * 5. Then re-run: node scripts/regen-tkp135-v5.js
 * 
 * MANUAL RECOVERY:
 * 1. Open Chrome/Edge → Go to hailuoai.video → Log in with thanhtungtran364@gmail.com
 * 2. Install EditThisCookie Chrome extension or export cookies manually
 * 3. Copy cookies to .hailuo-session.json
 * 
 * ALTERNATIVE - USE HAILUO DIRECT API:
 * If you have Hailuo API key, set HAILUO_API_KEY in .env and use:
 * curl -X POST https://api.hailuoai.io/v1/video/generate \
 *   -H "Authorization: Bearer $HAILUO_API_KEY" \
 *   -d '{"prompt": "...", "duration": 6}'
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');

async function main() {
  console.log('=== Hailuo Session Fix Utility ===\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  console.log('Opening hailuoai.video...');
  await page.goto('https://hailuoai.video', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('Current URL:', page.url());
  
  if (page.url().includes('login') || page.url().includes('signin')) {
    console.log('\n⚠️  Login required. Please log in manually in the browser window.');
    console.log('   Use Google account: thanhtungtran364@gmail.com');
    console.log('   After logging in, wait 10 seconds.');
    console.log('   Press ENTER in this terminal when done...');
    
    await new Promise(r => {
      process.stdin.once('data', () => r());
    });
  } else {
    console.log('\n✓ Already logged in!');
  }
  
  // Verify
  await page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  
  // Try submitting to verify
  const textarea = page.locator('div[contenteditable]').first();
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('test session', { delay: 30 });
  await new Promise(r => setTimeout(r, 500));
  
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText?.trim() === '25');
    btn?.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  
  const afterButtons = await page.evaluate(() => 
    Array.from(document.querySelectorAll('button')).map(b => b.innerText?.trim()).filter(Boolean)
  );
  
  const needsLogin = afterButtons.some(b => b.includes('Continue with Google'));
  
  if (needsLogin) {
    console.log('\n❌ Still needs login. Please try again.');
    await browser.close();
    process.exit(1);
  } else {
    console.log('\n✓ Session is valid! Saving...');
    
    const state = await context.storageState();
    mkdirSync(resolve(ROOT), { recursive: true });
    writeFileSync(SESSION_PATH, JSON.stringify(state, null, 2));
    console.log(`Session saved: ${SESSION_PATH}`);
    console.log(`Cookies: ${state.cookies?.length || 0}`);
  }
  
  await browser.close();
  console.log('\n✅ Session fix complete!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
