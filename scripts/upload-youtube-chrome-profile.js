/**
 * scripts/upload-youtube-chrome-profile.js
 * Upload using user's actual Chrome profile (already logged in)
 */

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Find Chrome profile path on Windows
function getChromeProfilePath() {
  const home = homedir();
  const possiblePaths = [
    join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default'),
    join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Profile 1'),
    join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Profile 2'),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      console.log('[Chrome] Found profile at:', p);
      return p;
    }
  }
  return null;
}

async function uploadToYouTube(videoPath, title, description, tags) {
  console.log(`[YouTube] Starting upload: ${videoPath}`);
  console.log(`[YouTube] Title: ${title}`);

  const profilePath = getChromeProfilePath();
  if (!profilePath) {
    console.error('[YouTube] Could not find Chrome profile!');
    return { success: false, error: 'No Chrome profile found' };
  }

  let browser;
  try {
    // Launch Chrome with user's actual profile
    browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        `--user-data-dir=${profilePath}`,
        '--profile-directory=Default'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();

    // Remove webdriver detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    console.log('[YouTube] Navigating to YouTube Studio...');

    await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/videos/upload?d=ud', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log('[YouTube] Current URL:', currentUrl);

    // Check if logged in
    if (currentUrl.includes('/login') || currentUrl.includes('accounts.google.com/signin')) {
      console.error('[YouTube] Not logged in to YouTube in Chrome!');
      console.error('[YouTube] Please log in to YouTube in Chrome first, then run this script.');
      await browser.close();
      return { success: false, error: 'Not logged in - please log into YouTube in Chrome first' };
    }

    // Find file input
    console.log('[YouTube] Looking for file input...');
    let fileInput = null;
    const selectors = [
      'input[type="file"]',
      'input[type=file]',
    ];

    for (const sel of selectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        fileInput = page.locator(sel).first();
        console.log('[YouTube] Found file input');
        break;
      }
    }

    if (!fileInput) {
      console.error('[YouTube] File input not found!');
      await page.screenshot({ path: join(ROOT, 'youtube-upload-error.png') });
      await browser.close();
      return { success: false, error: 'File input not found' };
    }

    // Upload
    console.log('[YouTube] Uploading video...');
    await fileInput.setInputFiles(videoPath);

    await page.waitForTimeout(15000);

    const newUrl = page.url();
    console.log('[YouTube] URL after upload:', newUrl);

    await browser.close();
    return {
      success: true,
      url: newUrl,
      platform: 'youtube'
    };

  } catch (err) {
    console.error('[YouTube] Error:', err.message);
    if (browser) await browser.close();
    return { success: false, error: err.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node scripts/upload-youtube-chrome-profile.js <videoPath> <title> [description]');
    process.exit(1);
  }

  const videoPath = args[0];
  const title = args[1];
  const description = args[2] || '';

  const result = await uploadToYouTube(videoPath, title, description, []);

  if (result.success) {
    console.log('\n✅ Upload successful!');
    console.log('URL:', result.url);
  } else {
    console.log('\n❌ Upload failed:', result.error);
    process.exit(1);
  }
}

export { uploadToYouTube };

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
