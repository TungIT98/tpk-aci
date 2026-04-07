/**
 * lib/upload/tiktok-browser.js
 * Browser automation for uploading videos to TikTok via playwright.
 *
 * Works without TikTok API OAuth — logs in via browser like a human would.
 *
 * Setup (one-time, or when session expires):
 *   node scripts/setup-tiktok-session.js
 *   (opens TikTok, you log in, session is saved to .tiktok-session.json)
 *
 * Usage:
 *   import { TikTokBrowser } from './lib/upload/tiktok-browser.js';
 *
 *   const uploader = new TikTokBrowser();
 *   await uploader.init();
 *   await uploader.upload({ videoPath, caption, tags });
 *   await uploader.close();
 *
 * Credentials:
 *   TikTok: thanhtungtran364@gmail.com
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = resolve(__dirname, '..', '..', '.env');
  try {
    const env = {};
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
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

export const TIKTOK_URL            = 'https://www.tiktok.com';
export const TIKTOK_SESSION_PATH   = env.TIKTOK_SESSION_PATH || resolve(__dirname, '..', '..', '.tiktok-session.json');
export const TIKTOK_USERNAME       = env.TIKTOK_USERNAME    || 'thanhtungtran364@gmail.com';
export const TIKTOK_PASSWORD       = env.TIKTOK_PASSWORD    || ''; // optional — session file preferred
export const TIKTOK_HEADLESS      = env.TIKTOK_HEADLESS    !== 'false';
export const TIKTOK_UPLOAD_TIMEOUT = 60_000; // 60s timeout for upload operations

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(...args) {
  console.log(`[TikTokBrowser] ${new Date().toISOString().slice(11,19)}`, ...args);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Detect if we need 2FA / phone verification during login.
 */
async function detectLoginChallenge(page) {
  const url = page.url();
  const bodyText = (await page.locator('body').innerText().catch(() => '')).toLowerCase();

  if (bodyText.includes('verification') || bodyText.includes('verify') ||
      bodyText.includes('phone') || bodyText.includes('sms') ||
      url.includes('verify') || url.includes('challenge')) {
    return 'verification';
  }
  if (bodyText.includes('password') || url.includes('login') || url.includes('signin')) {
    return 'password';
  }
  return null;
}

// ---------------------------------------------------------------------------
// TikTokBrowser — browser upload automation
// ---------------------------------------------------------------------------

export class TikTokBrowser {
  /**
   * @param {object} opts
   * @param {string}   [opts.sessionPath]   — Path to saved Playwright session state
   * @param {string}   [opts.username]       — TikTok login email
   * @param {string}   [opts.password]       — TikTok password (used if no session)
   * @param {boolean}  [opts.headless]        — Run headless, default true
   * @param {number}   [opts.timeoutMs]       — Element/operation timeout, default 30000
   */
  constructor({
    sessionPath = TIKTOK_SESSION_PATH,
    username    = TIKTOK_USERNAME,
    password    = TIKTOK_PASSWORD,
    headless    = TIKTOK_HEADLESS,
    timeoutMs   = 30_000,
  } = {}) {
    this.sessionPath = sessionPath;
    this.username    = username;
    this.password    = password;
    this.headless    = headless;
    this.timeoutMs   = timeoutMs;
    this._browser    = null;
    this._context    = null;
    this._page       = null;
    this._chromium   = null;
    this._loggedIn   = false;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Initialize Playwright, launch browser, restore or create session.
   */
  async init() {
    const { chromium } = await import('playwright');
    this._chromium = chromium;

    if (existsSync(this.sessionPath)) {
      log(`Restoring session from ${this.sessionPath}`);
      try {
        const sessionData = JSON.parse(readFileSync(this.sessionPath, 'utf-8'));
        const browser = await chromium.launch({
          headless: this.headless,
          args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
        });
        this._context = await browser.newContext({
          storageState: sessionData,
          viewport: { width: 1280, height: 800 },
        });
        this._page = (await this._context.pages())[0] || await this._context.newPage();
        this._browser = browser;
        log('Session restored.');
        await this._checkLogin();
        return;
      } catch (err) {
        log(`Failed to restore session (${err.message}), launching fresh browser.`);
        this._context = null;
        this._browser = null;
      }
    }

    log('No valid session. Launching fresh browser.');
    const browser = await chromium.launch({
      headless: this.headless,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });
    this._browser = browser;
    this._context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    this._page = (await this._context.pages())[0] || await this._context.newPage();

    if (this.username && this.password) {
      log('Session file not found. Please call login() or set up via: node scripts/setup-tiktok-session.js');
    }
  }

  /**
   * Save current browser session to disk for reuse.
   */
  async saveSession() {
    if (!this._context) return;
    const sessionDir = dirname(this.sessionPath);
    if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });
    const state = await this._context.storageState();
    writeFileSync(this.sessionPath, JSON.stringify(state));
    log(`Session saved to ${this.sessionPath}`);
  }

  /**
   * Check if currently logged in; navigate to check if needed.
   * @returns {Promise<boolean>}
   */
  async isLoggedIn() {
    if (!this._page) return false;
    try {
      await this._page.goto(TIKTOK_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);

      const url = this._page.url();
      if (url.includes('/login') || url.includes('/auth') || url.includes('/signin')) {
        return false;
      }

      // TikTok-specific logged-in indicators
      const loggedInSelectors = [
        '[data-e2e="upload-icon"]',
        'a[href*="/upload"]',
        'button:has-text("Upload")',
        '[class*="upload"]',
        '[class*="creator-toolkit"]',
      ];
      for (const sel of loggedInSelectors) {
        if (await this._page.locator(sel).count() > 0) return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  async _checkLogin() {
    this._loggedIn = await this.isLoggedIn();
    if (this._loggedIn) {
      log('Confirmed logged in.');
    } else {
      log('NOT logged in — session may have expired. Call login() or re-run setup.');
    }
  }

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  /**
   * Log in to TikTok using email + password.
   * Saves session after successful login.
   * @returns {Promise<boolean>} true if login succeeded
   */
  async login() {
    if (!this._page) throw new Error('Call init() first.');
    if (!this.username) throw new Error('No TikTok username set. Provide opts.username or TIKTOK_USERNAME in .env.');

    log(`Navigating to TikTok login for ${this.username}...`);
    await this._page.goto(`${TIKTOK_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    // Close any cookie banner first
    await this._dismissCookieBanner();

    // Try email login tab
    const emailTab = this._page.locator('text=/email|username|log in with email/i').first();
    if (await emailTab.count() > 0) {
      await emailTab.click();
      await sleep(1000);
    }

    // Fill email
    const emailInput = this._page.locator('input[type="text"], input[name="username"], input[autocomplete="username"]').first();
    if (await emailInput.count() > 0) {
      await emailInput.fill(this.username);
      await sleep(500);
    } else {
      // Try generic input on page
      const inputs = this._page.locator('input');
      const count = await inputs.count();
      log(`Found ${count} inputs on login page — trying first text input`);
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const type = await input.getAttribute('type');
        if (!type || type === 'text') {
          await input.fill(this.username);
          break;
        }
      }
    }

    // Click Next
    const nextBtn = this._page.locator('button[type="submit"], button:has-text("Next"), button:has-text("Continue")').first();
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      await sleep(2000);
    }

    // Fill password
    if (this.password) {
      const pwInput = this._page.locator('input[type="password"], input[name="password"]').first();
      if (await pwInput.count() > 0) {
        await pwInput.fill(this.password);
        await sleep(500);

        const submitBtn = this._page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")').first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          await sleep(3000);
        }
      }
    }

    // Check for challenge / 2FA
    const challenge = await detectLoginChallenge(this._page);
    if (challenge === 'verification') {
      log('Login requires phone/email verification — manual step needed. Session NOT saved.');
      log('Please complete verification in the browser window, then re-run saveSession() or re-run this script.');
      this._loggedIn = false;
      return false;
    }

    await sleep(3000);

    // Check login success
    const url = this._page.url();
    if (url.includes('/login') || url.includes('/signin')) {
      log('Login may have failed — still on login page. Check credentials.');
      this._loggedIn = false;
      return false;
    }

    log('Login appears successful.');
    this._loggedIn = true;
    await this.saveSession();
    return true;
  }

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------

  /**
   * Upload a video to TikTok.
   *
   * @param {object} opts
   * @param {string} opts.videoPath       — Absolute path to video file (.mp4)
   * @param {string} opts.caption         — Video caption (supports #hashtags)
   * @param {string[]} [opts.tags]         — Optional additional hashtag strings
   * @param {string} [opts.title]          — Optional title (same as caption if omitted)
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  async upload({ videoPath, caption, tags = [], title }) {
    if (!this._page) throw new Error('Call init() first.');

    const { chromium } = await import('playwright');
    const resolvedPath = resolve(videoPath);
    if (!existsSync(resolvedPath)) {
      return { success: false, error: `Video file not found: ${resolvedPath}` };
    }

    log(`Starting upload: ${resolvedPath}`);
    log(`Caption: ${caption?.slice(0, 60)}...`);

    // Navigate to upload page directly - session cookies should work for /tiktokstudio/*
    // even if main www.tiktok.com redirects to login
    log('Navigating to upload page...');
    await this._page.goto(`${TIKTOK_URL}/tiktokstudio/upload`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(5000);

    // Dismiss cookie banner if present
    await this._dismissCookieBanner();

    // Check if we're actually on the upload page (not login)
    const currentUrl = this._page.url();
    if (currentUrl.includes('/login')) {
      log('Redirected to login - session expired. Attempting login...');
      const ok = await this.login();
      if (!ok) return { success: false, error: 'Login failed. Cannot upload.' };
      await this._page.goto(`${TIKTOK_URL}/tiktokstudio/upload`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(5000);
    }

    // Upload — TikTok uses a hidden file input for video selection
    // The upload page has a large dropzone OR a button that triggers file picker
    log('Locating video file input...');

    // Strategy 1: Find the actual file input (often hidden)
    let fileInput = this._page.locator('input[type="file"]').first();
    if (await fileInput.count() === 0) {
      // Strategy 2: Click upload button to reveal input
      const uploadBtn = this._page.locator(
        'button:has-text("Upload"), a:has-text("Upload video"), [class*="upload-btn"], [class*="upload-button"]'
      ).first();
      if (await uploadBtn.count() > 0) {
        log('Clicking upload button to reveal file input...');
        await uploadBtn.click();
        await sleep(1000);
        fileInput = this._page.locator('input[type="file"]').first();
      }
    }

    if (await fileInput.count() === 0) {
      // Strategy 3: probe page for alternative upload trigger
      log('Standard file input not found — probing for alternative upload elements...');
      const probe = await this._probeCurrentPage('upload');
      const uploadTrigger = probe.buttonTexts.find(t =>
        /upload|post|publish|share/i.test(t)
      );
      if (uploadTrigger) {
        log(`Found upload trigger: "${uploadTrigger}"`);
      }
      return { success: false, error: 'Could not locate file input on TikTok upload page. The UI may have changed.' };
    }

    // Set file on the input
    log(`Setting file: ${resolvedPath}`);
    await fileInput.setInputFiles(resolvedPath);

    // Wait for video to process - look for processing indicators to disappear
    log('Waiting for video to process...');
    try {
      // TikTok shows "Processing" or a spinner during upload - wait for it to finish
      await this._page.waitForFunction(() => {
        const text = document.body.innerText.toLowerCase();
        // Wait for processing indicators to disappear
        return !text.includes('processing') &&
               !text.includes('đang xử lý') &&
               !text.includes('uploading') &&
               !text.includes('tải lên');
      }, { timeout: TIKTOK_UPLOAD_TIMEOUT });
      log('Video processing complete.');
    } catch {
      log('Timeout waiting for video processing — continuing anyway...');
    }
    // Additional wait for any animation/JS to settle
    await sleep(5000);

    // Fill caption
    log('Filling caption...');
    const captionText = [caption, ...tags.map(t => t.startsWith('#') ? t : `#${t}`)].join(' ');
    const captionTextarea = this._page.locator(
      '[data-e2e="video-desc-input"], div[contenteditable="true"], textarea[placeholder*="aption"], textarea[placeholder*="escribe"]'
    ).first();

    if (await captionTextarea.count() > 0) {
      await captionTextarea.click();
      await captionTextarea.fill(captionText);
    } else {
      // Fallback: type into body
      log('Caption textarea not found by selector — attempting contentEditable approach');
      await this._page.keyboard.type(captionText, { delay: 50 });
    }
    await sleep(2000);

    // IMPORTANT: After filling caption, TikTok may reload/navigate the page (SPA behavior)
    // We MUST re-locate the button AFTER caption is filled.
    log('Looking for post button (re-locating after caption fill)...');

    // Scroll to bottom to find the actual red "Đăng" POST button
    await this._page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(2000);

    // The actual POST button is a RED/PINK button at the bottom left
    // Look for it by trying multiple strategies
    let postBtn = null;

    // Strategy 1: Look for red/pink button with "Đăng" text (using evaluate to check styles)
    try {
      const redButton = await this._page.locator('button:has-text("Đăng")').evaluateAll(async (buttons) => {
        for (const btn of buttons) {
          const style = window.getComputedStyle(btn);
          const bg = style.backgroundColor || '';
          const text = btn.textContent?.trim() || '';
          // Red/pink buttons typically have rgb(238, 29, 82) or similar
          if ((bg.includes('29') || bg.includes('238') || bg.includes('14') || text.includes('Đăng')) && !style.display.includes('none')) {
            return btn;
          }
        }
        return null;
      });
      if (redButton) {
        log('Found red/pink POST button');
        postBtn = this._page.locator('button:has-text("Đăng")').last();
      }
    } catch(e) {
      log('Red button search failed: ' + e.message.slice(0, 50));
    }

    // Strategy 2: If red button not found, look for "Đăng" in footer/specific container
    if (!postBtn) {
      // Look for buttons at the bottom of the page
      const bottomButtons = await this._page.locator('[class*="footer"] button, [class*="actions"] button, [class*="bottom"] button').evaluateAll(async (buttons) => {
        return buttons.map(b => ({ text: b.textContent?.trim(), disabled: b.disabled }));
      }).catch(() => []);
      log('Bottom buttons:', JSON.stringify(bottomButtons));
    }

    // Strategy 3: Just click the LAST "Đăng" or "Post" button (should be the bottom one)
    if (!postBtn) {
      const dangButtons = await this._page.locator('button:has-text("Đăng")').count();
      const postButtons = await this._page.locator('button:has-text("Post")').count();
      log(`Found ${dangButtons} "Đăng" buttons, ${postButtons} "Post" buttons`);
      if (dangButtons > 0) {
        postBtn = this._page.locator('button:has-text("Đăng")').last();
      } else if (postButtons > 0) {
        postBtn = this._page.locator('button:has-text("Post")').last();
      }
    }

    if (!postBtn) {
      // Fallback: try any button that looks like a post button (not disabled, visible)
      const allButtons = await this._page.locator('button:not([disabled])').evaluateAll(async (buttons) => {
        return buttons.filter(b => {
          const text = (b.textContent || '').trim().toLowerCase();
          const isVisible = b.offsetParent !== null;
          return isVisible && (text === 'post' || text === 'đăng' || text.includes('đăng'));
        }).map(b => b.textContent.trim());
      }).catch(() => []);
      log('All visible post-like buttons:', JSON.stringify(allButtons));
      if (allButtons.length > 0) {
        const selector = allButtons[0] === 'Post'
          ? 'button:has-text("Post")'
          : 'button:has-text("Đăng")';
        postBtn = this._page.locator(selector).first();
      }
    }

    // Small settle time then click
    await sleep(1000);
    log('Clicking POST button via evaluate...');

    // Use evaluate to click directly via DOM - bypasses Playwright interception
    const clicked = await this._page.evaluate(() => {
      // Find all buttons with "Đăng" or "Post" text
      const buttons = Array.from(document.querySelectorAll('button'));
      const dangBtn = buttons.find(b => {
        const text = b.textContent.trim();
        return (text === 'Đăng' || text === 'Post') &&
          b.offsetParent !== null &&
          !b.disabled;
      });
      if (dangBtn) {
        dangBtn.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      log('evaluate click failed - trying locator click');
      await postBtn.click({ force: true });
    } else {
      log('POST button clicked via evaluate');
    }

    // Wait for potential dialog or navigation
    await sleep(3000);

    // Check for exit confirmation dialog - use regex/textContains
    let dialogDismissed = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const bodyText = (await this._page.locator('body').innerText().catch(() => '')).toLowerCase();
      if (bodyText.includes('bạn có chắc') && bodyText.includes('thoát')) {
        log(`Exit dialog detected (attempt ${attempt + 1}) - dismissing...`);
        // Modal backdrop is blocking clicks - use evaluate to click directly
        try {
          // Try clicking the backdrop first to dismiss
          await this._page.locator('[data-e2e="discard_post_button"]').click({ force: true, timeout: 5000 });
          dialogDismissed = true;
          log('Dialog dismissed via force click.');
        } catch {
          // Alternative: click via evaluate
          try {
            await this._page.evaluate(() => {
              const btn = document.querySelector('[data-e2e="discard_post_button"]');
              if (btn) btn.click();
            });
            dialogDismissed = true;
            log('Dialog dismissed via evaluate click.');
          } catch(e) {
            log('Failed to dismiss dialog: ' + e.message.slice(0, 100));
          }
        }
        await sleep(2000);
      } else {
        break;
      }
    }

    // Handle "Tiếp tục đăng?" / "Continue to post?" modal — TikTok shows this when content
    // check is still in progress. Click "Đăng ngay" / "Post now" to force-publish.
    const bodyTextAfterPost = (await this._page.locator('body').innerText().catch(() => ''));
    const hasContinuePostModal = bodyTextAfterPost.includes('tiếp tục đăng') ||
                                 bodyTextAfterPost.includes('đăng ngay') ||
                                 bodyTextAfterPost.toLowerCase().includes('continue to post') ||
                                 bodyTextAfterPost.toLowerCase().includes('post now');
    if (hasContinuePostModal) {
      log('Continue posting modal detected — clicking Đăng ngay / Post now...');
      try {
        const clicked = await this._page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          // Find the red "Đăng ngay" or "Post now" button inside the modal
          for (const btn of buttons) {
            const text = btn.textContent?.trim() || '';
            if ((text === 'Đăng ngay' || text === 'Post now') && !btn.disabled) {
              btn.click();
              return true;
            }
          }
          return false;
        });
        if (clicked) {
          log('Post now clicked successfully.');
          await sleep(5000);
        } else {
          log('Could not find Post now button via evaluate — trying locator...');
          try {
            // Try English "Post now" first, then Vietnamese "Đăng ngay"
            const postBtn = this._page.locator('button:has-text("Post now")').filter({ hasNot: this._page.locator('[disabled]') }).first();
            if (await postBtn.count() > 0) {
              await postBtn.click({ force: true, timeout: 5000 });
            } else {
              await this._page.locator('button:has-text("Đăng ngay")').click({ force: true, timeout: 5000 });
            }
          } catch(e) {
            log('Locator click also failed: ' + e.message.slice(0, 100));
          }
        }
      } catch(e) {
        log('Failed to handle continue-post modal: ' + e.message.slice(0, 100));
      }
    }

    // Debug: take screenshot
    try {
      const screenshot = await this._page.screenshot({ path: 'tiktok-post-click.png' });
      log('Screenshot saved: tiktok-post-click.png');
    } catch(e) {
      log('Screenshot failed: ' + e.message);
    }

    // Log all visible buttons (try to find the actual Post button)
    const allButtons = await this._page.locator('button').evaluateAll(els =>
      els.filter(el => el.offsetParent !== null).map(el => ({
        text: el.textContent?.trim().slice(0, 60),
        disabled: el.disabled,
        ariaDisabled: el.getAttribute('aria-disabled')
      }))
    );
    log('All buttons:', JSON.stringify(allButtons.slice(0, 20)));

    // Log current URL and page text
    log('URL:', this._page.url());
    const bodySnippet = (await this._page.locator('body').innerText().catch(() => '')).slice(0, 500);
    log('Page text:', bodySnippet);

    // If dialog was dismissed, we need to find and click the actual Post button
    if (dialogDismissed) {
      log('Looking for actual Post button after dismissing dialog...');
      // Try button with specific data-e2e or class for post
      const actualPostBtn = this._page.locator('[data-e2e="upload-button"], button[type="submit"], button:has-text("Đăng"):not([disabled])').first();
      if (await actualPostBtn.count() > 0) {
        log('Found actual Post button - clicking...');
        await actualPostBtn.click();
        await sleep(5000);
      }
    }

    // Scroll down to make sure Post button is visible
    await this._page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(2000);

    // Wait for redirect or success confirmation
    log('Waiting for upload to complete...');
    try {
      await this._page.waitForFunction(() => {
        const text = document.body.innerText.toLowerCase();
        const url = window.location.href;
        return (!url.includes('/upload') && !url.includes('/tiktokstudio')) ||
               text.includes('posted') ||
               text.includes('success') ||
               text.includes('đăng thành công') ||
               text.includes('publish');
      }, { timeout: 60000 });
      log('Upload completed!');
    } catch {
      log('Did not get clear success confirmation — checking status...');
    }

    // Final status check
    const bodyText = (await this._page.locator('body').innerText().catch(() => '')).toLowerCase();
    const postUrl = this._page.url();

    // Check for errors FIRST — error indicators override success indicators
    const errorIndicators = [
      'error', 'failed', 'cannot', 'sorry', 'something went wrong',
      'đăng thất bại', 'lỗi', 'upload failed', 'tải lên thất bại',
      'video is too long', 'video is too short', 'file size too large',
    ];
    const hasError = errorIndicators.some(e => bodyText.includes(e));

    if (hasError) {
      // Distinguish between hard errors vs. soft warnings
      const hardErrors = ['đăng thất bại', 'lỗi', 'upload failed', 'sorry, something went wrong',
                          'video is too long', 'video is too short', 'file size too large'];
      if (hardErrors.some(e => bodyText.includes(e))) {
        return { success: false, error: `Upload failed: ${bodyText.slice(0, 200)}` };
      }
      // Soft warnings (e.g., "review in progress") may still have succeeded — continue checking
    }

    // SUCCESS DETECTION — TikTok does NOT always redirect after posting.
    // Instead it shows one of:
    //   1) Toast / snackbar: "Your video has been posted" or "đăng thành công"
    //   2) Content page thumbnail visible on upload page
    //   3) A new "View post" or "Xem video" link appears
    //   4) URL changes to /tiktokstudio/content (less common)
    //   5) The upload form is cleared and a new upload prompt appears

    // Check for explicit success toasts / snackbars
    const successToastIndicators = [
      'đăng thành công', 'posted successfully', 'your video has been posted',
      'video đã đăng', 'upload complete', 'đăng thành công!',
      'view post', 'xem video', 'see post', 'posted',
    ];
    const hasSuccessToast = successToastIndicators.some(s => bodyText.includes(s));

    // Check for "View post" / "Xem video" anchor/link (appears after successful post)
    let hasViewPostLink = false;
    try {
      hasViewPostLink = await this._page.locator(
        'a[href*="/video/"], a[href*="/tiktokstudio/posted"], [class*="view-post"], [class*="posted-success"]'
      ).count() > 0;
    } catch {}

    // Check if the upload form was cleared (video input is empty = new upload state)
    let formCleared = false;
    try {
      const fileInput = this._page.locator('input[type="file"]').first();
      formCleared = await fileInput.evaluate(el => el.files.length === 0);
    } catch {}

    // Check for content thumbnail (TikTok shows uploaded video preview on success)
    let hasVideoThumbnail = false;
    try {
      const videoEl = await this._page.locator('video[src], video[poster], [class*="video-preview"]').first();
      hasVideoThumbnail = await videoEl.count() > 0;
    } catch {}

    // URL-based check (less reliable — only used as a hint)
    const isOnUploadPage = postUrl.includes('/upload') ||
      (postUrl.includes('/tiktokstudio') && !postUrl.includes('/content') && !postUrl.includes('/posted'));
    const navigatedAway = !isOnUploadPage;

    // Success if: toast, view-post link, form cleared, OR navigated away (any one is sufficient)
    const uploadSucceeded = hasSuccessToast || hasViewPostLink || formCleared || navigatedAway;

    if (!uploadSucceeded) {
      log('No clear success indicators detected — taking debug screenshot.');
      await this._page.screenshot({ path: 'tiktok-upload-fail.png' }).catch(() => {});
      return { success: false, error: 'No success indicators detected after post click — possible failure' };
    }

    // Try to extract the posted video URL
    let videoUrl = postUrl;
    try {
      const viewLink = await this._page.locator(
        'a[href*="/video/"]:not([href*="/upload"]):not([href*="/tiktokstudio"])'
      ).first().getAttribute('href').catch(() => null);
      if (viewLink) videoUrl = viewLink;
    } catch {}

    log(`Upload appears successful! (indicators: toast=${hasSuccessToast}, viewLink=${hasViewPostLink}, formCleared=${formCleared}, navigated=${navigatedAway})`);
    return { success: true, url: videoUrl };
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /**
   * Probe the current page and log all interactive elements.
   * Useful for debugging UI changes.
   * @param {string} label — label for this probe
   * @returns {Promise<object>} probe results
   */
  async _probeCurrentPage(label) {
    const results = {};
    results.url = this._page.url();
    const buttonTexts = await this._page.locator('button').evaluateAll(els =>
      els.map(el => el.textContent?.trim().slice(0, 60)).filter(Boolean)
    );
    const fileInputs = await this._page.locator('input[type="file"]').count();
    results.buttonTexts = buttonTexts;
    results.fileInputs = fileInputs;
    log(`[probe:${label}] URL: ${results.url}`);
    log(`[probe:${label}] Buttons: ${buttonTexts.slice(0, 8).join(' | ') || 'none'}`);
    log(`[probe:${label}] File inputs: ${fileInputs}`);
    return results;
  }

  /**
   * Dismiss TikTok cookie consent banner if present.
   */
  async _dismissCookieBanner() {
    const dismissSelectors = [
      'button:has-text("Accept"), button:has-text("Accept all"), button:has-text("Agree"), button:has-text("Allow")',
      '[class*="cookie"] button',
      'button[data-testid="cookie-accept"]',
    ];
    for (const sel of dismissSelectors) {
      const btn = this._page.locator(sel).first();
      if (await btn.count() > 0) {
        try {
          await btn.click({ timeout: 3000 });
          log('Dismissed cookie banner.');
          await sleep(500);
          break;
        } catch { /* ok */ }
      }
    }
  }

  /**
   * Close the browser and clean up.
   */
  async close() {
    if (this._context) {
      await this._context.close().catch(() => {});
      this._context = null;
      this._page = null;
      this._browser = null;
      log('Browser closed.');
    }
  }
}

// ---------------------------------------------------------------------------
// CLI entry point — run this script directly for upload
// ---------------------------------------------------------------------------

/**
 * Usage:
 *   node lib/upload/tiktok-browser.js --video outputs/WC-01/final.mp4 --caption "My video #tiktok"
 *   node lib/upload/tiktok-browser.js --video outputs/WC-01/final.mp4 --caption "My video" --tags "fyp,trending,viral"
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const args = Object.fromEntries(
      process.argv.slice(2).map(arg => {
        const [key, val] = arg.replace(/^--/, '').split('=');
        return [key, val ?? true];
      })
    );

    const videoPath = args.video || args.path;
    if (!videoPath) {
      console.error('Usage: node lib/upload/tiktok-browser.js --video <path> --caption "<caption>" [--tags "tag1,tag2"]');
      process.exit(1);
    }

    const caption = args.caption || 'Check out this video! #viral #fyp';
    const tags = args.tags ? args.tags.split(',').map(t => t.trim()) : [];

    const uploader = new TikTokBrowser({ headless: args.headless !== 'false' });

    try {
      await uploader.init();

      const result = await uploader.upload({ videoPath, caption, tags });

      if (result.success) {
        console.log(`\n✅ Upload successful: ${result.url}`);
      } else {
        console.error(`\n❌ Upload failed: ${result.error}`);
        process.exit(1);
      }
    } finally {
      await uploader.close();
    }
  })();
}
