/**
 * scripts/upload-youtube-browser.js
 * YouTube upload using existing browser session
 * Uses Playwright with the .youtube-session.json cookies
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function uploadToYouTube(videoPath, title, description, tags) {
  console.log(`[YouTube] Starting upload: ${videoPath}`);
  console.log(`[YouTube] Title: ${title}`);

  const sessionPath = join(ROOT, '.youtube-session.json');
  if (!existsSync(sessionPath)) {
    console.error('[YouTube] No session file found. Run setup-youtube-session.js first.');
    return { success: false, error: 'No session file' };
  }

  let browser;
  try {
    // Launch browser with existing session
    browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-notifications'
      ]
    });

    // Load the session state
    const sessionState = JSON.parse(readFileSync(sessionPath, 'utf-8'));

    // Create context with the saved session (includes cookies from accounts.google.com)
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      storageState: sessionState
    });

    const page = await context.newPage();

    // Remove webdriver detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    console.log('[YouTube] Navigating to YouTube Studio...');

    // Navigate to YouTube Studio upload page
    await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/videos/upload?d=ud', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for potential redirect to login
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log('[YouTube] Current URL:', currentUrl);

    // Check if redirected to login
    if (currentUrl.includes('/login') || currentUrl.includes('accounts.google.com/signin')) {
      console.error('[YouTube] Session expired - redirected to login');
      console.error('[YouTube] Please run: node scripts/setup-youtube-session.js');
      await browser.close();
      return { success: false, error: 'Session expired - please re-authenticate' };
    }

    // Look for file input
    console.log('[YouTube] Looking for file input...');

    // Try different selectors for file input
    let fileInput = null;
    const selectors = [
      'input[type="file"]',
      'input[type=file]',
      '#content > input[type="file"]',
      '.ytcp-upload-thumb-container input[type="file"]'
    ];

    for (const sel of selectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        fileInput = page.locator(sel).first();
        console.log('[YouTube] Found file input with selector:', sel);
        break;
      }
    }

    if (!fileInput) {
      console.error('[YouTube] File input not found!');
      await page.screenshot({ path: join(ROOT, 'youtube-upload-error.png') });
      console.error('[YouTube] Screenshot saved: youtube-upload-error.png');
      await browser.close();
      return { success: false, error: 'File input not found - page may have changed' };
    }

    // Upload the video
    console.log('[YouTube] Uploading video:', videoPath);
    await fileInput.setInputFiles(videoPath);

    // Wait for upload to start
    console.log('[YouTube] Waiting for upload...');
    await page.waitForTimeout(10000);

    // Check if upload succeeded
    const newUrl = page.url();
    console.log('[YouTube] URL after upload:', newUrl);

    // Try to find video ID from URL
    let videoId = null;
    const match = newUrl.match(/\/videos\/(\w+)/);
    if (match) {
      videoId = match[1];
    }

    const result = {
      success: true,
      url: newUrl.includes('watch?v=') ? newUrl : `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      platform: 'youtube'
    };

    console.log('[YouTube] Upload result:', JSON.stringify(result));

    // Save updated session
    const newState = await context.storageState();
    // Only update if we got new cookies (session was refreshed)
    if (newState.cookies.length > sessionState.cookies.length) {
      console.log('[YouTube] Updating session with new cookies...');
    }

    await browser.close();
    return result;

  } catch (err) {
    console.error('[YouTube] Error:', err.message);
    if (browser) await browser.close();
    return { success: false, error: err.message };
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node scripts/upload-youtube-browser.js <videoPath> <title> [description] [tags...]');
    process.exit(1);
  }

  const videoPath = args[0];
  const title = args[1];
  const description = args[2] || '';
  const tags = args.slice(3);

  const result = await uploadToYouTube(videoPath, title, description, tags);

  if (result.success) {
    console.log('\n✅ Upload successful!');
    console.log('URL:', result.url);
  } else {
    console.log('\n❌ Upload failed:', result.error);
    process.exit(1);
  }
}

export { uploadToYouTube };
export default uploadToYouTube;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
