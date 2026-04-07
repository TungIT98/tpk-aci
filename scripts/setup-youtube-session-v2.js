/**
 * scripts/setup-youtube-session-v2.js
 * Setup YouTube session by having user log in once
 * After this, future uploads use this session automatically
 */

import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SESSION_FILE = join(ROOT, '.youtube-session.json');

async function setupSession() {
  console.log('========================================');
  console.log('YOUTUBE SESSION SETUP');
  console.log('========================================\n');

  let browser;
  try {
    console.log('1. Launching browser...');
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    // Remove webdriver detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    console.log('\n2. Navigating to YouTube Studio...\n');
    await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/videos/upload?d=ud', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('3. Please LOG IN to YouTube in the browser window.');
    console.log('   - If already on login page, enter your credentials');
    console.log('   - Email: thanhtungtran364@gmail.com');
    console.log('   - Password: (use your account password)\n');

    // Wait for user to login or session to be established
    // Check every 5 seconds for up to 5 minutes
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await page.waitForTimeout(5000);
      const url = page.url();

      if (!url.includes('/login') && !url.includes('signin')) {
        console.log('\n✅ LOGIN DETECTED! Saving session...\n');
        break;
      }

      attempts++;
      if (attempts % 12 === 0) {
        console.log(`   Still waiting... (${attempts * 5}s elapsed)`);
      }
    }

    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);

    if (finalUrl.includes('/login') || finalUrl.includes('signin')) {
      console.error('\n❌ Login not completed. Please try again.\n');
      await browser.close();
      process.exit(1);
    }

    // Save the session state
    console.log('4. Saving session to .youtube-session.json...');
    const state = await context.storageState();
    writeFileSync(SESSION_FILE, JSON.stringify(state));
    console.log('   Saved!');

    // Verify session has accounts.google.com cookies
    const hasAccountCookies = state.cookies.some(c => c.domain.includes('accounts.google.com'));
    console.log('   Has accounts.google.com cookies:', hasAccountCookies ? '✅ Yes' : '❌ No');

    // Show cookie summary
    console.log('\n5. Session cookies:');
    for (const c of state.cookies) {
      console.log(`   - ${c.name} (${c.domain})`);
    }

    console.log('\n========================================');
    console.log('✅ SESSION SETUP COMPLETE!');
    console.log('========================================');
    console.log('\nFuture uploads will use this session automatically.');
    console.log('Note: Session may expire after ~30 days.\n');

    await browser.close();

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

setupSession();
