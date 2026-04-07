/**
 * HAILUO WEB SKILL - Tự động hóa Hailuo Web App bằng UI Automation
 *
 * Hoạt động NHƯ NGƯỜI THẬT - click, fill form, chờ đợi như human
 *
 * Tools có sẵn trên Hailuo:
 * - Video Generator: Tạo video từ text/image
 * - Image Generator: Tạo image từ text
 * - Voice Generator: Tạo voiceover (trên minimax.io)
 * - Music Generator: Tạo nhạc nền
 *
 * Usage:
 *   node scripts/hailuo-web.js check-session
 *   node scripts/hailuo-web.js generate-video --prompt "..." [--duration 6]
 *   node scripts/hailuo-web.js generate-image --prompt "..."
 *   node scripts/hailuo-web.js voice --text "..." (nếu có quyền truy cập)
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');
const HAILUO_URL = 'https://hailuoai.video';
const OUTPUT_DIR = resolve(ROOT, 'output', 'hailuo-web');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

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
 * Load session from file
 */
function loadSession() {
  if (!existsSync(SESSION_PATH)) {
    throw new Error(`Session not found. Run: node scripts/hailuo-web.js setup-session`);
  }
  return JSON.parse(readFileSync(SESSION_PATH, 'utf-8'));
}

/**
 * Setup session - login like human
 */
async function setupSession() {
  console.log('🚀 Setting up Hailuo session...');
  console.log('   1. Launching browser...');

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  console.log('   2. Going to Hailuo...');
  await page.goto(HAILUO_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  console.log('   3. Please login manually and wait...');
  console.log('   (The script will detect when login is complete)');

  // Wait for login (detect via cookies or UI)
  let loggedIn = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(4000);

    try {
      const cookies = await context.cookies();
      const hasHailuoCookie = cookies.some(c => c.domain.includes('hailuoai') && c.name === 'hailuo_token');

      if (hasHailuoCookie || cookies.length > 10) {
        loggedIn = true;
        console.log('   ✅ Login detected!');
        break;
      }
    } catch {}

    console.log(`   Waiting... ${(i + 1) * 4}s / 120s`);
  }

  if (!loggedIn) {
    console.log('❌ Login timeout. Please try again.');
    await browser.close();
    return;
  }

  // Save session
  const cookies = await context.cookies();
  const session = {
    cookies,
    timestamp: Date.now(),
    userAgent: await page.evaluate(() => navigator.userAgent)
  };

  writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2));
  console.log(`✅ Session saved! (${cookies.length} cookies)`);

  await browser.close();
}

/**
 * Get browser with session - works like human
 */
async function getBrowser() {
  const sessionPath = env.HAILUO_SESSION_PATH || SESSION_PATH;

  if (!existsSync(sessionPath)) {
    throw new Error(`Session not found. Run: node scripts/hailuo-web.js setup-session`);
  }

  const session = loadSession();

  const browser = await chromium.launch({
    headless: env.HAILUO_HEADLESS !== 'false',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  await context.addCookies(session.cookies || []);

  // Stealth scripts
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  return { browser, context };
}

/**
 * Check if user is logged in
 */
async function isLoggedIn(page) {
  try {
    // Check for logged-in indicators
    const url = page.url();
    if (url.includes('login') || url.includes('signin')) return false;

    // Check for avatar or user menu (indicates logged in)
    const hasAvatar = await page.locator('[class*="avatar"], [class*="user"], img[src*="avatar"]').count() > 0;
    const hasLoginBtn = await page.locator('button:has-text("Log in"), button:has-text("Sign in")').count() > 0;

    return hasAvatar && !hasLoginBtn;
  } catch {
    return false;
  }
}

/**
 * DISCOVER TOOLS - List all available tools on Hailuo
 */
async function discoverTools() {
  console.log('🔍 Discovering Hailuo tools...\n');

  const { browser, context } = await getBrowser();

  try {
    const page = await context.newPage();
    await page.goto(HAILUO_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Get all navigation items
    const navItems = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('a[href]').forEach(a => {
        if (a.offsetWidth > 0 && a.href && !a.href.startsWith('javascript')) {
          items.push({
            text: a.textContent?.trim().slice(0, 40),
            href: a.href
          });
        }
      });
      return items;
    });

    console.log('NAVIGATION:');
    navItems.forEach(item => {
      if (item.text) {
        console.log(`  ${item.text}: ${item.href}`);
      }
    });

    // Go to Tools page
    console.log('\n--- TOOLS PAGE ---');
    await page.goto(`${HAILUO_URL}/tool`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const toolCards = await page.evaluate(() => {
      const cards = [];
      document.querySelectorAll('[class*="tool"], [class*="feature"], a[href*="/tool/"]').forEach(el => {
        const link = el.tagName === 'A' ? el : el.querySelector('a');
        if (link && link.offsetWidth > 0) {
          cards.push({
            text: el.textContent?.trim().slice(0, 80),
            href: link.href
          });
        }
      });
      return cards;
    });

    console.log('TOOL CARDS:');
    toolCards.forEach(card => {
      if (card.href && !card.href.includes('hailuoai.video')) {
        console.log(`  ${card.text}: ${card.href}`);
      }
    });

    // Get full page content
    const pageContent = await page.evaluate(() => {
      return document.body.innerText.slice(0, 2000).replace(/\n+/g, '\n');
    });
    console.log('\nPAGE CONTENT:');
    console.log(pageContent);

    await browser.close();

  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
  }
}

/**
 * GENERATE VIDEO - Using Hailuo Video Generator
 */
async function generateVideo(prompt, options = {}) {
  const { duration = 6 } = options;

  console.log(`\n🎬 HAILUO VIDEO GENERATOR`);
  console.log(`   Prompt: "${prompt.slice(0, 60)}..."`);
  console.log(`   Duration: ${duration}s`);

  const { browser, context } = await getBrowser();

  try {
    const page = await context.newPage();

    // Step 1: Navigate to Video Generator
    console.log('\n📱 Step 1: Going to Video Generator...');
    await page.goto(`${HAILUO_URL}/create/text-to-video`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    // Step 2: Check login
    console.log('🔐 Step 2: Checking login...');
    if (!await isLoggedIn(page)) {
      console.log('❌ Not logged in! Run: node scripts/hailuo-web.js setup-session');
      await browser.close();
      return { error: 'Not logged in' };
    }
    console.log('   ✅ Logged in');

    // Step 3: Dismiss modal if present
    console.log('🚪 Step 3: Checking for modals...');
    const gotItBtn = page.locator('button:has-text("Got It")');
    if (await gotItBtn.count() > 0) {
      await gotItBtn.click();
      await page.waitForTimeout(500);
      console.log('   ✅ Dismissed modal');
    }

    // Step 4: Enter prompt
    console.log('✍️  Step 4: Entering prompt...');
    const textarea = page.locator('#video-create-textarea');
    await textarea.click();
    await page.waitForTimeout(300);
    await textarea.fill('');
    await textarea.fill(prompt);
    await page.waitForTimeout(500);

    const enteredText = await textarea.inputValue();
    console.log(`   ✅ Entered ${enteredText.length} characters`);

    // Step 5: Select duration (click duration button if needed)
    console.log('⏱️  Step 5: Setting duration...');

    // Hailuo has duration options like 5s, 6s, 10s
    // Look for duration buttons
    const durationBtns = await page.locator('button:has-text("5"), button:has-text("6"), button:has-text("10")');
    const durationCount = await durationBtns.count();
    if (durationCount > 0) {
      console.log(`   Found ${durationCount} duration buttons`);
    }

    // Step 6: Click Create
    console.log('🎯 Step 6: Clicking Create...');

    // Try multiple button strategies
    let createClicked = false;
    const strategies = [
      'button.new-color-btn-bg',
      'button[type="submit"]',
      'button:has-text("Create Video")',
      'button:has-text("Create")'
    ];

    for (const selector of strategies) {
      const btn = page.locator(selector).first();
      if (await btn.count() > 0) {
        const isDisabled = await btn.isDisabled();
        if (!isDisabled) {
          await btn.scrollIntoViewIfNeeded();
          await btn.click({ force: true });
          createClicked = true;
          console.log(`   ✅ Clicked: ${selector}`);
          break;
        }
      }
    }

    if (!createClicked) {
      console.log('   ⚠️ Could not click Create, trying keyboard...');
      await page.keyboard.press('Control+Enter');
      await page.waitForTimeout(2000);
    }

    // Step 7: Wait for video
    console.log('⏳ Step 7: Waiting for video generation...');

    // Capture URLs before submission
    const oldUrls = await page.evaluate(() => {
      const urls = new Set();
      document.querySelectorAll('video').forEach(v => {
        if (v.src && !v.src.startsWith('about:')) urls.add(v.src);
      });
      document.querySelectorAll('a[href*=".mp4"]').forEach(a => urls.add(a.href));
      return [...urls];
    });

    // Wait for new video to appear (up to 3 minutes)
    let videoUrl = null;
    let pollCount = 0;
    const maxPolls = 18; // 18 * 10s = 180s

    while (pollCount < maxPolls && !videoUrl) {
      await page.waitForTimeout(10000);
      pollCount++;

      // Check for new video
      videoUrl = await page.evaluate((old) => {
        // Check video elements
        const vids = document.querySelectorAll('video');
        for (const v of vids) {
          if (v.src && !v.src.startsWith('about:') && !old.includes(v.src)) {
            return v.src;
          }
        }
        // Check download links
        const links = document.querySelectorAll('a[href*=".mp4"]');
        for (const link of links) {
          if (!link.href.includes('blob') && !old.includes(link.href)) {
            return link.href;
          }
        }
        return null;
      }, oldUrls);

      if (videoUrl) {
        console.log(`   ✅ Video found after ${pollCount * 10}s!`);
      } else {
        process.stdout.write('.');
      }
    }
    console.log();

    if (!videoUrl) {
      console.log('❌ Video generation timeout (3 minutes)');
      await browser.close();
      return { error: 'Timeout' };
    }

    // Step 8: Download
    console.log('💾 Step 8: Downloading video...');
    const response = await page.goto(videoUrl);
    const buffer = await response.body();

    const outputPath = resolve(OUTPUT_DIR, `video_${Date.now()}.mp4`);
    writeFileSync(outputPath, buffer);

    console.log(`\n✅ VIDEO GENERATED!`);
    console.log(`   📁 File: ${outputPath}`);
    console.log(`   📊 Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

    await browser.close();

    return {
      success: true,
      path: outputPath,
      url: videoUrl,
      size: buffer.length
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
    return { error: error.message };
  }
}

/**
 * GENERATE IMAGE - Using Hailuo Image Generator
 */
async function generateImage(prompt, options = {}) {
  console.log(`\n🖼️ HAILUO IMAGE GENERATOR`);
  console.log(`   Prompt: "${prompt.slice(0, 60)}..."`);

  const { browser, context } = await getBrowser();

  try {
    const page = await context.newPage();

    await page.goto(`${HAILUO_URL}/create/image-generation`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    if (!await isLoggedIn(page)) {
      console.log('❌ Not logged in!');
      await browser.close();
      return { error: 'Not logged in' };
    }

    // Enter prompt
    const textarea = page.locator('#video-create-textarea');
    await textarea.click();
    await textarea.fill(prompt);
    console.log('   ✅ Prompt entered');

    // Click Create
    const createBtn = page.locator('button.new-color-btn-bg, button:has-text("Generate")').first();
    await createBtn.click();
    console.log('   ✅ Create clicked');

    // Wait for image
    let imageUrl = null;
    for (let i = 0; i < 12 && !imageUrl; i++) {
      await page.waitForTimeout(10000);

      imageUrl = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img');
        for (const img of imgs) {
          if (img.src && !img.src.startsWith('data:') && img.naturalWidth > 100) {
            if (img.src.includes('hailuoai') || img.src.includes('minimax')) {
              return img.src;
            }
          }
        }
        return null;
      });

      if (!imageUrl) process.stdout.write('.');
    }
    console.log();

    if (!imageUrl) {
      console.log('❌ Image generation timeout');
      await browser.close();
      return { error: 'Timeout' };
    }

    // Download
    const response = await page.goto(imageUrl);
    const buffer = await response.body();

    const outputPath = resolve(OUTPUT_DIR, `image_${Date.now()}.png`);
    writeFileSync(outputPath, buffer);

    console.log(`\n✅ IMAGE GENERATED!`);
    console.log(`   📁 File: ${outputPath}`);
    console.log(`   📊 Size: ${(buffer.length / 1024).toFixed(2)} KB`);

    await browser.close();

    return {
      success: true,
      path: outputPath,
      url: imageUrl,
      size: buffer.length
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
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

  if (!command) {
    console.log(`
🎬 HAILUO WEB SKILL
====================
UI Automation cho Hailuo Web App - hoạt động như người thật

Commands:
  check-session     Kiểm tra session đăng nhập
  setup-session     Login và lưu session (chạy 1 lần)
  discover          Khám phá tools trên Hailuo
  generate-video    Tạo video từ prompt
  generate-image    Tạo image từ prompt

Examples:
  node scripts/hailuo-web.js check-session
  node scripts/hailuo-web.js setup-session
  node scripts/hailuo-web.js discover
  node scripts/hailuo-web.js generate-video --prompt "A warrior in forest" --duration 6
  node scripts/hailuo-web.js generate-image --prompt "Beautiful landscape"
`);
    return;
  }

  switch (command) {
    case 'check-session':
      await checkSession();
      break;

    case 'setup-session':
      await setupSession();
      break;

    case 'discover':
      await discoverTools();
      break;

    case 'generate-video': {
      let prompt = '';
      let duration = 6;

      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--prompt' || args[i] === '-p') prompt = args[++i];
        else if (args[i] === '--duration' || args[i] === '-d') duration = parseInt(args[++i]);
      }

      if (!prompt) {
        console.log('Usage: node scripts/hailuo-web.js generate-video --prompt "..." [--duration 6]');
        return;
      }

      const result = await generateVideo(prompt, { duration });
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'generate-image': {
      let prompt = '';

      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--prompt' || args[i] === '-p') prompt = args[++i];
      }

      if (!prompt) {
        console.log('Usage: node scripts/hailuo-web.js generate-image --prompt "..."');
        return;
      }

      const result = await generateImage(prompt);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    default:
      console.log(`Unknown command: ${command}`);
  }
}

async function checkSession() {
  console.log('🔍 Checking Hailuo session...\n');

  if (!existsSync(SESSION_PATH)) {
    console.log('❌ No session file');
    console.log('   Run: node scripts/hailuo-web.js setup-session');
    return;
  }

  try {
    const session = loadSession();
    const { browser, context } = await getBrowser();
    const page = await context.newPage();

    await page.goto(HAILUO_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const loggedIn = await isLoggedIn(page);

    console.log(loggedIn ? '✅ Logged in' : '❌ Not logged in');
    console.log(`   Cookies: ${session.cookies?.length || 0}`);

    await browser.close();

  } catch (error) {
    console.log('❌ Session error:', error.message);
  }
}

main().catch(e => {
  console.error('❌ Fatal error:', e.message);
  process.exit(1);
});
