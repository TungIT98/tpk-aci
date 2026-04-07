/**
 * scripts/hailuo-web-skill.js
 *
 * Hailuo Web App Skill - Tích hợp $200/tháng Max Subscription
 * Sử dụng Playwright browser automation với saved session
 *
 * Usage:
 *   node scripts/hailuo-web-skill.js generate --prompt "A warrior walking through forest"
 *   node scripts/hailuo-web-skill.js status --job-id ABC123
 *   node scripts/hailuo-web-skill.js download --job-id ABC123 --output ./video.mp4
 *
 * Setup (chạy 1 lần):
 *   node scripts/setup-hailuo-app-session.js
 *
 * API Endpoints (Hailuo Web):
 *   - https://hailuoai.video/create (video generation)
 *   - Session auth via .hailuo-session.json
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');
const HAILUO_URL = 'https://hailuoai.video';
const OUTPUT_DIR = resolve(ROOT, 'output', 'hailuo-web');

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

/**
 * Launch browser with saved session
 */
async function getBrowser() {
  const sessionPath = env.HAILUO_SESSION_PATH || SESSION_PATH;

  if (!existsSync(sessionPath)) {
    throw new Error(`Session not found. Run: node scripts/setup-hailuo-app-session.js\nSession path: ${sessionPath}`);
  }

  const session = JSON.parse(readFileSync(sessionPath, 'utf-8'));

  const browser = await chromium.launch({
    headless: env.HAILUO_HEADLESS !== 'false',
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext();
  await context.addCookies(session.cookies || []);

  return { browser, context };
}

/**
 * Generate video using Hailuo Web App
 * Uses JavaScript injection to interact with React contenteditable UI
 */
async function generateVideo(prompt, options = {}) {
  const { duration = 6, model = 'video-01' } = options;

  console.log(`[HAILUO WEB] Generating: "${prompt}" (${duration}s, model: ${model})`);

  const { browser, context } = await getBrowser();

  try {
    const page = await context.newPage();

    // Inject anti-detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.navigator.chrome = { runtime: {} };
    });

    // Navigate to text-to-video page (NOT image-to-video)
    await page.goto(`${HAILUO_URL}/create/text-to-video`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check if logged in by looking for avatar
    const avatarCount = await page.locator('[class*="avatar"], img[src*="avatar"]').count();
    const loginButtonCount = await page.locator('button:has-text("Log in"), button:has-text("Sign in")').count();

    if (loginButtonCount > 0 && avatarCount === 0) {
      console.log('[HAILUO WEB] Not logged in! Please run: node scripts/setup-hailuo-app-session.js');
      await browser.close();
      return { error: 'Not logged in. Run setup-hailuo-app-session.js first.' };
    }

    console.log('[HAILUO WEB] Logged in, finding prompt input...');

    // Hailuo uses React contenteditable div - use JavaScript injection (same as hailuo-app.js)
    const promptEntered = await page.evaluate((text) => {
      const textareas = document.querySelectorAll('div[contenteditable="true"]');
      for (const el of textareas) {
        const parent = el.closest('[class*="prompt"], [class*="textarea"], [class*="input"]');
        if (parent || el.id?.includes('prompt')) {
          // Clear first, then set content (same as hailuo-app.js)
          el.textContent = '';
          el.innerHTML = '';
          el.textContent = text;
          el.innerHTML = '<p>' + text + '</p>';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      // Fallback: try any contenteditable
      if (textareas.length > 0) {
        const el = textareas[0];
        el.textContent = '';
        el.innerHTML = '';
        el.textContent = text;
        el.innerHTML = '<p>' + text + '</p>';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }, prompt);

    if (!promptEntered) {
      console.log('[HAILUO WEB] Could not find prompt input. Checking page structure...');
      const textareas = await page.$$('div[contenteditable="true"]');
      console.log(`[HAILUO WEB] Found ${textareas.length} contenteditable elements`);
    } else {
      console.log('[HAILUO WEB] Prompt entered via contenteditable');
    }

    // Wait a bit for React to process
    await page.waitForTimeout(1000);

    // FIRST: Dismiss any modal dialogs (like "Got It" cookie notices)
    const gotItBtn = page.locator('button').filter({ hasText: 'Got It' });
    if (await gotItBtn.count() > 0) {
      console.log('[HAILUO WEB] Dismissing modal: "Got It"');
      await gotItBtn.click();
      await page.waitForTimeout(500);
    }

    // Capture current video URLs before submitting (to filter out old ones)
    const oldVideoUrls = await page.evaluate(() => {
      const urls = new Set();
      const video = document.querySelector('video');
      if (video?.src) urls.add(video.src);
      document.querySelectorAll('a[href*=".mp4"]').forEach(a => urls.add(a.href));
      return [...urls];
    });
    console.log(`[HAILUO WEB] Old video URLs to filter: ${oldVideoUrls.length}`);

    // Try to submit using keyboard shortcut (Ctrl+Enter)
    console.log('[HAILUO WEB] Attempting keyboard submit (Ctrl+Enter)...');
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(2000);

    // Check if URL changed (indicating submission happened)
    const urlAfterKeyboard = page.url();
    console.log(`[HAILUO WEB] URL after keyboard: ${urlAfterKeyboard}`);

    // If no URL change, try multiple button strategies
    if (urlAfterKeyboard === `${HAILUO_URL}/create/text-to-video`) {
      console.log('[HAILUO WEB] No URL change - trying button click...');

      // Try all button strategies (same as hailuo-app.js)
      // Priority: type=submit > class-based > text-based
      const strategies = [
        { name: 'type=submit+25', locator: page.locator('button[type="submit"]:has-text("25")') },
        { name: 'type=submit', locator: page.locator('button[type="submit"]') },
        { name: 'new-color-btn-bg', locator: page.locator('button.new-color-btn-bg') },
        { name: 'Create Video', locator: page.locator('button:has-text("Create Video")') },
        { name: 'Generate Video', locator: page.locator('button:has-text("Generate Video")') },
        { name: 'Create', locator: page.locator('button:has-text("Create")') },
        { name: 'Generate', locator: page.locator('button:has-text("Generate")') },
        { name: 'any 25', locator: page.locator('button:has-text("25")') },
      ];

      let clicked = false;
      let clickedBtnText = null;
      for (const strategy of strategies) {
        const count = await strategy.locator.count();
        if (count > 0) {
          const btn = strategy.locator.first();
          const text = await btn.textContent();
          const isDisabled = await btn.isDisabled();
          const btnType = await btn.getAttribute('type');
          console.log(`[HAILUO WEB] Strategy "${strategy.name}": found, text="${text?.trim()}", disabled=${isDisabled}, type=${btnType}`);

          if (!isDisabled && !clicked) {
            try {
              await btn.scrollIntoViewIfNeeded();
              await btn.click({ force: true });
              clickedBtnText = text?.trim();
              console.log(`[HAILUO WEB] CLICKED via "${strategy.name}": "${clickedBtnText}"`);
              clicked = true;
              break;
            } catch (e) {
              console.log(`[HAILUO WEB] Click failed for ${strategy.name}: ${e.message}`);
            }
          }
        }
      }

      // After clicking, wait and check what changed
      if (clicked) {
        await page.waitForTimeout(5000);
        const urlAfterClick = page.url();
        console.log(`[HAILUO WEB] URL after click: ${urlAfterClick}`);

        // Check for any redirect to job page or loading states
        const pageState = await page.evaluate(() => {
          const loading = document.querySelector('[class*="loading"], [class*="generating"], [class*="progress"]');
          return {
            url: window.location.href,
            hasLoading: !!loading,
            loadingText: loading?.textContent?.trim().slice(0, 50),
            title: document.title,
          };
        });
        console.log(`[HAILUO WEB] Page state after click:`, JSON.stringify(pageState));
      }

      // If still not clicked, try clicking any visible enabled button with reasonable text
      if (!clicked) {
        console.log('[HAILUO WEB] Trying any visible button...');
        const anyBtn = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          for (const btn of buttons) {
            const r = btn.getBoundingClientRect();
            const text = btn.textContent?.trim();
            if (r.width > 0 && r.height > 0 && !btn.disabled && text && text.length > 0 && text.length < 50) {
              return { text, rect: { top: Math.round(r.top), left: Math.round(r.left) } };
            }
          }
          return null;
        });

        if (anyBtn) {
          console.log(`[HAILUO WEB] Clicking: "${anyBtn.text}" at (${anyBtn.rect.top}, ${anyBtn.rect.left})`);
          await page.locator('button').filter({ hasText: anyBtn.text, disabled: false }).first().click({ force: true });
        }
      }
    }

    // Wait for submission to process
    await page.waitForTimeout(3000);

    // Wait for generation (up to 3 minutes for video to be ready)
    console.log('[HAILUO WEB] Waiting for video generation...');
    let videoUrl = null;
    let attempts = 0;
    const maxAttempts = 18; // 18 * 10s = 180s = 3 minutes

    while (attempts < maxAttempts && !videoUrl) {
      await page.waitForTimeout(10000);
      attempts++;

      // Check for NEW video in multiple ways
      videoUrl = await page.evaluate((oldUrls) => {
        // 1. Video element with src (any non-blank src that's new)
        const video = document.querySelector('video');
        if (video?.src && video.src !== '' && !oldUrls.includes(video.src)) {
          // Check if it's a valid video URL (not just about:blank)
          if (!video.src.startsWith('about:') && !video.src.startsWith('data:')) {
            return { url: video.src, type: 'video_element' };
          }
        }

        // 2. Look for video source child element
        const videoSrc = video?.querySelector('source');
        if (videoSrc?.src && !oldUrls.includes(videoSrc.src)) {
          return { url: videoSrc.src, type: 'video_source' };
        }

        // 3. Look for download links
        const links = document.querySelectorAll('a[href*=".mp4"], a[href*="/download"]');
        for (const link of links) {
          if (link.href && !link.href.includes('blob') && !oldUrls.includes(link.href)) {
            if (!link.href.startsWith('about:') && !link.href.startsWith('data:')) {
              return { url: link.href, type: 'download_link' };
            }
          }
        }

        // 4. Check for any new URLs with video CDN domain
        const allElements = document.querySelectorAll('[src*="hailuoai"], [href*="hailuoai"]');
        for (const el of allElements) {
          const attr = el.src ? 'src' : (el.href ? 'href' : null);
          if (attr && el[attr] && !oldUrls.includes(el[attr])) {
            const val = el[attr];
            if (val.includes('.mp4') || val.includes('/video/')) {
              return { url: val, type: 'cdn_element' };
            }
          }
        }

        return null;
      }, oldVideoUrls);

      if (videoUrl) {
        console.log(`[HAILUO WEB] Video ready (${videoUrl.type}) after ${attempts * 10}s: ${videoUrl.url.slice(0, 80)}`);
      } else {
        // Check for error states
        const errorState = await page.evaluate(() => {
          const errorTexts = ['error', 'failed', 'thất bại', 'lỗi'];
          const bodyText = document.body.innerText.toLowerCase();
          for (const err of errorTexts) {
            if (bodyText.includes(err)) {
              return 'Error detected';
            }
          }
          // Check if still loading
          const loading = document.querySelector('[class*="loading"], [class*="generating"], [class*="progress"]');
          return loading ? 'Still loading...' : 'No video yet';
        });
        console.log(`[HAILUO WEB] ${errorState}... ${attempts}/${maxAttempts}`);
      }
    }

    // Get current URL
    const url = page.url();
    const jobMatch = url.match(/\/job\/([^\/\?]+)/);
    const jobId = jobMatch ? jobMatch[1] : null;

    // Check if we're still on create page or redirected
    const currentUrl = page.url();
    console.log(`[HAILUO WEB] Current URL: ${currentUrl}`);

    // Get the actual video URL (videoUrl might be an object now)
    const finalVideoUrl = videoUrl?.url || videoUrl || null;

    await browser.close();

    return {
      success: !!finalVideoUrl,
      jobId: jobId || 'unknown',
      url: finalVideoUrl || currentUrl,
      videoUrl: finalVideoUrl,
      message: finalVideoUrl ? 'Video generation completed!' : 'Video generation initiated.'
    };

  } catch (error) {
    await browser.close();
    return { error: error.message };
  }
}

/**
 * Check generation status
 */
async function checkStatus(jobId) {
  console.log(`[HAILUO WEB] Checking status for job: ${jobId}`);

  const { browser, context } = await getBrowser();

  try {
    const page = await context.newPage();
    await page.goto(`${HAILUO_URL}/job/${jobId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Check for video element
    const video = await page.$('video');
    const videoUrl = video ? await video.getAttribute('src') : null;

    // Check for status text
    const statusText = await page.textContent('body');
    const isComplete = statusText.includes('Complete') || statusText.includes('Ready') || videoUrl;
    const isFailed = statusText.includes('Failed') || statusText.includes('Error');

    await browser.close();

    return {
      jobId,
      status: isComplete ? 'complete' : isFailed ? 'failed' : 'processing',
      videoUrl
    };

  } catch (error) {
    await browser.close();
    return { error: error.message };
  }
}

/**
 * Download video by job ID
 */
async function downloadVideo(jobId, outputPath) {
  console.log(`[HAILUO WEB] Downloading video: ${jobId} -> ${outputPath}`);

  const { browser, context } = await getBrowser();

  try {
    const page = await context.newPage();
    await page.goto(`${HAILUO_URL}/job/${jobId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for video to be available
    await page.waitForSelector('video', { timeout: 30000 });

    const videoEl = await page.$('video');
    const videoUrl = await videoEl.getAttribute('src');

    if (!videoUrl) {
      throw new Error('Video URL not found');
    }

    // Download video
    const videoResponse = await page.goto(videoUrl);
    const buffer = await videoResponse.body();

    // Ensure output directory exists
    const outputDir = resolve(outputPath, '..');
    if (!existsSync(outputDir)) {
      require('fs').mkdirSync(outputDir, { recursive: true });
    }

    writeFileSync(outputPath, buffer);
    console.log(`[HAILUO WEB] Downloaded: ${outputPath}`);

    await browser.close();

    return { success: true, path: outputPath, size: buffer.length };

  } catch (error) {
    await browser.close();
    return { error: error.message };
  }
}

/**
 * CLI Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'generate') {
    let prompt = '';
    let duration = 6;
    let output = '';

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--prompt' || args[i] === '-p') prompt = args[++i];
      if (args[i] === '--duration' || args[i] === '-d') duration = parseInt(args[++i]);
      if (args[i] === '--output' || args[i] === '-o') output = args[++i];
    }

    if (!prompt) {
      console.log(`
HAILUO WEB SKILL - Video Generation

Usage:
  node scripts/hailuo-web-skill.js generate --prompt "Your video description" [--duration 6] [--output path]

Options:
  --prompt, -p    Video prompt (required)
  --duration, -d  Duration in seconds (default: 6)
  --output, -o    Output file path (optional)

Examples:
  node scripts/hailuo-web-skill.js generate --prompt "A warrior walking through forest" --duration 6
  node scripts/hailuo-web-skill.js status --job-id ABC123
  node scripts/hailuo-web-skill.js download --job-id ABC123 --output ./video.mp4
`);
      return;
    }

    const result = await generateVideo(prompt, { duration });
    console.log(JSON.stringify(result, null, 2));

  } else if (command === 'status') {
    let jobId = '';
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--job-id' || args[i] === '-j') jobId = args[++i];
    }

    if (!jobId) {
      console.log('Usage: node scripts/hailuo-web-skill.js status --job-id <ID>');
      return;
    }

    const result = await checkStatus(jobId);
    console.log(JSON.stringify(result, null, 2));

  } else if (command === 'download') {
    let jobId = '', output = '';
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--job-id' || args[i] === '-j') jobId = args[++i];
      if (args[i] === '--output' || args[i] === '-o') output = args[++i];
    }

    if (!jobId || !output) {
      console.log('Usage: node scripts/hailuo-web-skill.js download --job-id <ID> --output <path>');
      return;
    }

    const result = await downloadVideo(jobId, output);
    console.log(JSON.stringify(result, null, 2));

  } else {
    console.log(`
HAILUO WEB SKILL - TKP ACI Video Generation
============================================
$200/month Hailuo Max Subscription via Web App

Commands:
  generate   Generate a new video
  status     Check generation status
  download   Download generated video

First time setup:
  node scripts/setup-hailuo-app-session.js

Usage:
  node scripts/hailuo-web-skill.js <command> [options]

Examples:
  node scripts/hailuo-web-skill.js generate --prompt "A warrior walking through forest"
  node scripts/hailuo-web-skill.js status --job-id ABC123
  node scripts/hailuo-web-skill.js download --job-id ABC123 --output ./video.mp4
`);
  }
}

main().catch(e => {
  console.error('[ERROR]', e.message);
  process.exit(1);
});
