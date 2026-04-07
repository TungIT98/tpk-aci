/**
 * lib/hailuo-app.js
 * Browser automation for Hailuo App (hailuoai.video) video generation.
 *
 * Uses Playwright to automate the web UI, bypassing the API which may have
 * insufficient balance. The App and API have SEPARATE credit systems.
 *
 * Setup (one-time):
 *   node scripts/setup-hailuo-app-session.js
 *
 * Usage:
 *   import { HailuoApp } from './lib/hailuo-app.js';
 *   const app = new HailuoApp();
 *   const videoPath = await app.generateVideo({ prompt: '...' });
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
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

export const HAILUO_APP_URL      = env.HAILUO_APP_URL      || 'https://hailuoai.video';
export const HAILUO_SESSION_PATH = env.HAILUO_SESSION_PATH || resolve(__dirname, '..', '.hailuo-session.json');
export const HAILUO_HEADLESS    = env.HAILUO_HEADLESS     !== 'false';
export const HAILUO_DOWNLOAD_DIR = env.HAILUO_DOWNLOAD_DIR || resolve(__dirname, '..', 'output', 'videos');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(...args) {
  console.log(`[HailuoApp] ${new Date().toISOString().slice(11,19)}`, ...args);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// HailuoApp — browser automation for hailuoai.video
// ---------------------------------------------------------------------------

export class HailuoApp {
  /**
   * @param {object} opts
   * @param {string} [opts.sessionPath]  — Path to saved session JSON (cookies + storage)
   * @param {string} [opts.downloadDir]  — Directory to save downloaded videos
   * @param {boolean} [opts.headless]    — Run browser headless, default true
   * @param {number} [opts.timeoutMs]    — Element/operation timeout in ms, default 30000
   */
  constructor({
    sessionPath    = HAILUO_SESSION_PATH,
    downloadDir    = HAILUO_DOWNLOAD_DIR,
    headless       = HAILUO_HEADLESS,
    timeoutMs      = 30_000,
  } = {}) {
    this.sessionPath  = sessionPath;
    this.downloadDir  = downloadDir;
    this.headless     = headless;
    this.timeoutMs    = timeoutMs;
    this._browser     = null;
    this._context     = null;
    this._page        = null;
    this._playwright  = null;
    this._downloadPath = null;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Initialize Playwright, launch browser, and restore or create session.
   * Call this before any generation calls.
   */
  async init() {
    const { chromium } = await import('playwright');
    this._playwright = { chromium };

    // Ensure download dir exists
    if (!existsSync(this.downloadDir)) {
      mkdirSync(this.downloadDir, { recursive: true });
    }

    // Try to restore existing session
    if (existsSync(this.sessionPath)) {
      log(`Restoring session from ${this.sessionPath}`);
      try {
        const sessionData = JSON.parse(readFileSync(this.sessionPath, 'utf-8'));
        this._context = await chromium.launchPersistentContext('', {
          headless:   this.headless,
          storageState: sessionData,
          args: ['--no-sandbox'],
        });
        this._page = (await this._context.pages())[0] || await this._context.newPage();
        log('Session restored successfully.');
        return;
      } catch (err) {
        log(`Failed to restore session (${err.message}), creating fresh session.`);
        this._context = null;
      }
    }

    // Fresh session — launch browser without saved state
    log('No valid session found. Launching fresh browser.');
    this._context = await chromium.launchPersistentContext('', {
      headless: this.headless,
      args: ['--no-sandbox'],
    });
    this._page = (await this._context.pages())[0] || await this._context.newPage();

    log(`New session started. Log in at ${HAILUO_APP_URL}, then run: node scripts/setup-hailuo-app-session.js`);
  }

  /**
   * Check if the current session is logged in by visiting the app.
   * Uses multiple detection strategies for reliability.
   * @returns {Promise<boolean>}
   */
  async isLoggedIn() {
    if (!this._page) return false;
    try {
      await this._page.goto(HAILUO_APP_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);

      const url = this._page.url();
      // If redirected to login page, we're not logged in
      if (url.includes('login') || url.includes('signin') || url.includes('auth') || url.includes('sign_in')) {
        log('isLoggedIn: redirected to login page');
        return false;
      }

      // Strategy 1: Look for logged-in nav/user elements
      const loginSelectors = [
        // Generic user/avatar patterns
        '[class*="avatar"]', '[class*="user-avatar"]', '[class*="userAvatar"]',
        '[class*="profile"]', '[class*="account"]', '[class*="userInfo"]',
        '[class*="logged"]', '[class*="nav-user"]', '[class*="header-user"]',
        '[class*="header-avatar"]', '[class*="menu-avatar"]',
        // data-testid patterns (common in React apps)
        '[data-testid*="avatar"]', '[data-testid*="user"]', '[data-testid*="profile"]',
        '[data-testid*="account"]',
        // img with user-related src
        'img[src*="avatar"]', 'img[src*="user"]', 'img[src*="profile"]',
        // Header/nav presence (if header exists, likely logged in)
        'header', 'nav[class*="header"]', '[class*="header-nav"]',
        // aria-label patterns
        '[aria-label*="avatar" i]', '[aria-label*="user" i]', '[aria-label*="profile" i]',
        '[aria-label*="account" i]', '[aria-label*="settings" i]',
        // Button with user name
        'button:has-text("My")', 'button:has-text("Account")', 'button:has-text("设置" i)',
      ];

      for (const sel of loginSelectors) {
        try {
          const count = await this._page.locator(sel).count();
          if (count > 0) {
            log(`isLoggedIn: found element with "${sel}" (${count}x)`);
            return true;
          }
        } catch { /* try next */ }
      }

      // Strategy 2: Check localStorage for auth tokens (hailuo specific)
      try {
        const storage = await this._page.evaluate(() => {
          const keys = Object.keys(localStorage).filter(k =>
            k.toLowerCase().includes('token') ||
            k.toLowerCase().includes('auth') ||
            k.toLowerCase().includes('session') ||
            k.toLowerCase().includes('user') ||
            k.toLowerCase().includes('login')
          );
          return keys.map(k => ({ key: k, hasValue: !!localStorage.getItem(k) }));
        });
        if (storage.some(s => s.hasValue)) {
          log('isLoggedIn: auth tokens found in localStorage');
          return true;
        }
      } catch { /* localStorage may not be accessible */ }

      // Strategy 3: Check body text for user-specific content
      try {
        const bodyText = await this._page.locator('body').innerText().catch(() => '');
        const loggedInIndicators = [
          'Credits', 'My Videos', 'My Projects', 'Generate Video',
          'Account Settings', 'Sign Out', 'Log Out', 'Logout',
          '积分', '我的', '账号', '设置', '视频创作',
          'Hailuo', '创作', '我的创作',
        ];
        for (const indicator of loggedInIndicators) {
          if (bodyText.includes(indicator)) {
            log(`isLoggedIn: found "${indicator}" in page body`);
            return true;
          }
        }
      } catch { /* ignore */ }

      log('isLoggedIn: no login indicators found');
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Test if the current session can actually generate videos (not just view pages).
   * This is the REAL auth test - isLoggedIn() may return true even when API calls fail.
   * @returns {Promise<boolean>}
   */
  async testAuth() {
    if (!this._page) return false;
    try {
      await this._page.goto(`${HAILUO_APP_URL}/create/text-to-video`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);

      // Try to fill prompt and submit
      const textarea = this._page.locator('div[contenteditable]').first();
      if (await textarea.count() === 0) return false;
      
      await textarea.click();
      await this._page.keyboard.press('Control+A');
      await this._page.keyboard.press('Backspace');
      await sleep(300);
      await this._page.keyboard.type('__auth_test__', { delay: 10 });
      await sleep(500);

      // Click submit button (one with cost indicator "25")
      const submitBtn = this._page.locator('button').filter({ hasText: '25' }).first();
      if (await submitBtn.count() > 0) {
        await submitBtn.evaluate(btn => btn.scrollIntoView({ block: 'center' }));
        await submitBtn.click({ force: true });
      }
      await sleep(2000);

      // Check for login modal
      const allButtons = await this._page.evaluate(() =>
        Array.from(document.querySelectorAll('button')).map(b => b.innerText?.trim()).filter(Boolean)
      );
      const needsLogin = allButtons.some(b =>
        b.includes('Continue with Google') || b.includes('Sign Up') || b.includes('Log In')
      );
      log(`testAuth: login modal=${needsLogin} buttons=${JSON.stringify(allButtons.slice(0,5))}`);
      return !needsLogin;
    } catch (e) {
      log(`testAuth error: ${e.message}`);
      return false;
    }
  }

  /**
   * Save the current browser session (cookies + localStorage) to disk.
   * Call this after manually logging in to avoid future manual logins.
   */
  async saveSession() {
    if (!this._context) throw new Error('Session not initialized. Call init() first.');
    const state = await this._context.storageState();
    writeFileSync(this.sessionPath, JSON.stringify(state, null, 2), 'utf-8');
    log(`Session saved to ${this.sessionPath}`);
  }

  /**
   * Close the browser. Call when done.
   */
  async close() {
    if (this._context) {
      try { await this._context.close(); } catch {}
      this._context = null;
      this._page = null;
    }
  }

  // -------------------------------------------------------------------------
  // Diagnostic helpers
  // -------------------------------------------------------------------------

  /**
   * Probe the current page and return a diagnostic snapshot.
   * Useful for debugging which elements are available on the page.
   * @param {string} [label] — Label for this snapshot
   * @returns {Promise<object>} — Diagnostic snapshot
   */
  async probePage(label = 'snapshot') {
    if (!this._page) throw new Error('Page not initialized. Call init() first.');

    const snapshot = {
      url: this._page.url(),
      timestamp: new Date().toISOString(),
      label,
      elements: {},
    };

    // Count key element types
    const tagCounts = ['textarea', 'input', 'button', 'video', 'a', 'form', 'nav', 'header', 'section', 'div'];
    for (const tag of tagCounts) {
      snapshot.elements[tag] = await this._page.locator(tag).count();
    }

    // Get all button texts
    snapshot.buttons = await this._page.locator('button').evaluateAll(els =>
      els.map(el => ({
        text: el.textContent?.trim().slice(0, 80),
        class: el.className.slice(0, 80),
        type: el.type,
        disabled: el.disabled,
      }))
    );

    // Get textarea placeholders
    snapshot.textareas = await this._page.locator('textarea').evaluateAll(els =>
      els.map(el => ({
        placeholder: el.getAttribute('placeholder'),
        class: el.className.slice(0, 80),
      }))
    );

    // Get input placeholders
    snapshot.inputs = await this._page.locator('input').evaluateAll(els =>
      els.map(el => ({
        placeholder: el.getAttribute('placeholder'),
        type: el.type,
        class: el.className.slice(0, 80),
      }))
    );

    // Get body text snippet
    snapshot.bodyText = (await this._page.locator('body').innerText().catch(() => '')).slice(0, 500);

    // Get all class names with "credit", "user", "avatar", "generate", "create"
    const bodyHTML = await this._page.content().catch(() => '');
    const classMatches = [...new Set([...bodyHTML.matchAll(/class="([^"]+)"/g)].map(m => m[1]))];
    const interestingClasses = classMatches.filter(c =>
      /credit|user|avatar|profile|generate|create|download|nav|header|video|result/i.test(c)
    );
    snapshot.interestingClasses = interestingClasses.slice(0, 30);

    log(`probePage[${label}]: ${JSON.stringify(snapshot.elements)}`);
    return snapshot;
  }

  // -------------------------------------------------------------------------
  // Core: navigate to video creation
  // -------------------------------------------------------------------------

  /**
   * Navigate to the video creation/generation page.
   * Tries multiple URL patterns to find the create page.
   * @returns {Promise<string>} — The URL path that worked
   */
  async _navigateToCreate() {
    // Try multiple URL patterns for the create page
    const urlPatterns = [
      '/create/text-to-video',
      '/create',
      '/video/create',
      '/video/new',
      '/new',
      '/generate',
      '/video/generate',
      '', // root may redirect to create page
    ];

    let lastError = null;
    for (const path of urlPatterns) {
      const url = HAILUO_APP_URL + path;
      log(`Trying create URL: ${url}`);
      try {
        // Always force fresh navigation to ensure form is reset
        await this._page.goto(url, { waitUntil: 'load', timeout: this.timeoutMs });
        await sleep(3000);
        // Force clear any cached state by re-navigating if already on same URL
        if (this._page.url() === url || this._page.url().endsWith(path)) {
          await this._page.goto('about:blank');
          await this._page.goto(url, { waitUntil: 'load', timeout: this.timeoutMs });
          await sleep(2000);
        }

        // Check if redirected to login
        if (this._page.url().includes('login')) {
          throw new Error('Not logged in. Run: node scripts/setup-hailuo-app-session.js');
        }

        // Check if we found the create UI
        const found = await this._waitForCreateUI();
        if (found) {
          log(`Successfully navigated to create page via: ${path || '(root)'}`);
          return path || '/';
        }
      } catch (e) {
        if (e.message.includes('Not logged in')) throw e;
        lastError = e;
        log(`  Could not find create UI at ${path}: ${e.message.slice(0, 80)}`);
      }
    }

    // Last resort: try clicking "Create Video" from homepage
    try {
      log('Trying to find Create Video button on homepage...');
      const createBtnSelectors = [
        'button:has-text("Create")', 'button:has-text("Generate")', 'button:has-text("视频" i)',
        'button:has-text("创作" i)', 'a:has-text("Create")', 'a:has-text("视频" i)',
        '[href*="create"]', '[href*="video"]', '[href*="generate"]',
        '[data-testid*="create"]',
      ];
      for (const sel of createBtnSelectors) {
        const btn = await this._page.$(sel);
        if (btn) {
          await btn.click();
          await sleep(3000);
          const found = await this._waitForCreateUI();
          if (found) {
            log(`Navigated to create page via button click: ${sel}`);
            return '/homepage-button';
          }
        }
      }
    } catch { /* ignore */ }

    throw lastError || new Error(
      'Could not navigate to create page. Run: node scripts/hailuo-app-diagnostic.js\n' +
      'Current URL: ' + this._page.url()
    );
  }

  /**
   * Wait for the video creation form to be visible.
   * Tries multiple selector patterns in priority order.
   * Logs which selector matched for debugging.
   * @returns {Promise<string|null>} — The selector that matched, or null
   */
  async _waitForCreateUI() {
    const selectors = [
      // Priority 1: Specific data-testid (most reliable)
      { sel: '[data-testid="create-video"]', label: 'data-testid=create-video' },
      { sel: '[data-testid="video-create"]', label: 'data-testid=video-create' },
      { sel: '[data-testid="generate-video"]', label: 'data-testid=generate-video' },
      // Priority 2: Prompt textarea (English)
      { sel: 'textarea[placeholder*="prompt" i]', label: 'textarea[placeholder~=prompt]' },
      { sel: 'textarea[placeholder*="描述" i]', label: 'textarea[placeholder~=描述]' },
      { sel: 'textarea[placeholder*="输入" i]', label: 'textarea[placeholder~=输入]' },
      { sel: 'textarea[placeholder*="video" i]', label: 'textarea[placeholder~=video]' },
      { sel: 'textarea[placeholder*="create" i]', label: 'textarea[placeholder~=create]' },
      { sel: 'textarea[placeholder*="创作" i]', label: 'textarea[placeholder~=创作]' },
      { sel: 'textarea[placeholder*="story" i]', label: 'textarea[placeholder~=story]' },
      // Priority 3: Any textarea on the page
      { sel: 'textarea', label: 'any textarea' },
      // Priority 4: Contenteditable
      { sel: 'div[contenteditable="true"]', label: 'contenteditable div' },
      { sel: '[contenteditable="true"]', label: 'any contenteditable' },
      // Priority 5: Prompt input fields
      { sel: 'input[placeholder*="prompt" i]', label: 'input[placeholder~=prompt]' },
      { sel: 'input[placeholder*="描述" i]', label: 'input[placeholder~=描述]' },
      { sel: 'input[placeholder*="text" i]', label: 'input[placeholder~=text]' },
      // Priority 6: Create/Generate buttons
      { sel: 'button:has-text("Create")', label: 'button Create' },
      { sel: 'button:has-text("Generate")', label: 'button Generate' },
      { sel: 'button:has-text("生成" i)', label: 'button 生成' },
      { sel: 'button:has-text("创建" i)', label: 'button 创建' },
      { sel: 'button:has-text("开始" i)', label: 'button 开始' },
      // Priority 7: Video tab
      { sel: '[role="tab"]:has-text("Video")', label: 'role=tab Video' },
      { sel: '[role="tab"]:has-text("视频" i)', label: 'role=tab 视频' },
      { sel: '[role="tab"]:has-text("Create")', label: 'role=tab Create' },
      // Priority 8: Role/form inputs
      { sel: '[role="textbox"]', label: 'role=textbox' },
      { sel: '[role="combobox"]', label: 'role=combobox' },
      // Priority 9: General form elements
      { sel: 'form[action*="create"]', label: 'form[action~=create]' },
      { sel: 'form[action*="video"]', label: 'form[action~=video]' },
    ];

    for (const { sel, label } of selectors) {
      try {
        const count = await this._page.locator(sel).count();
        if (count > 0) {
          log(`Create UI found: "${label}" (${sel}) [${count} element(s)]`);
          return sel;
        }
      } catch { /* try next */ }
    }

    // Fallback: wait for page to settle
    await sleep(3000);
    log('Create UI: no specific selector matched — using fallback wait');
    return null;
  }

  // -------------------------------------------------------------------------
  // Core: fill prompt and submit
  // -------------------------------------------------------------------------

  /**
   * Fill in the prompt and submit the generation request.
   * Returns the task/job identifier if detectable.
   *
   * @param {object} opts
   * @param {string} opts.prompt        — Video description text
   * @param {string} [opts.aspectRatio] — '16:9' | '9:16' | '1:1', default '16:9'
   * @param {string} [opts.duration]    — Video duration hint if UI supports it
   * @returns {Promise<object>}         — { submitted: true, jobId: string|null }
   */
  async _fillPromptAndSubmit({ prompt, aspectRatio = '16:9', duration }) {
    log(`Submitting prompt: "${prompt.slice(0, 80)}..."`);

    // Find and fill the prompt textarea
    const textarea = await this._findPromptInput();
    if (!textarea) {
      throw new Error(
        'Could not find prompt input field on the page.\n' +
        '  Fix: Run node scripts/hailuo-app-diagnostic.js to find correct selectors.\n' +
        '  Then update lib/hailuo-app.js with the findings.\n' +
        '  Current URL: ' + (this._page?.url() || 'unknown')
      );
    }
    // For contenteditable divs, use evaluate; for regular inputs, use fill
    // ALWAYS clear first to avoid appending to old prompt
    const tagName = await textarea.evaluate(el => el.tagName);
    if (tagName === 'DIV') {
      // contenteditable — clear first, then set content + dispatch events
      await textarea.evaluate((el) => {
        el.textContent = '';
        el.innerHTML = '';
      });
      await textarea.evaluate((el, text) => {
        el.textContent = text;
        el.innerHTML = '<p>' + text + '</p>';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, prompt);
      log('Prompt filled (contenteditable, cleared first).');
    } else {
      // textarea/input — triple-click to select all, then type new text
      await textarea.click();
      await textarea.click(); // extra click to ensure focus
      await textarea.fill(prompt);
      log('Prompt filled (cleared via fill()).');
    }

    // Set aspect ratio if UI supports it
    await this._setAspectRatio(aspectRatio);

    // Click submit / create / generate button
    const submitBtn = await this._findSubmitButton();
    if (!submitBtn) {
      throw new Error(
        'Could not find submit/create button on the page.\n' +
        '  Fix: Run node scripts/hailuo-app-diagnostic.js to find correct selectors.\n' +
        '  Then update lib/hailuo-app.js with the findings.\n' +
        '  Current URL: ' + (this._page?.url() || 'unknown')
      );
    }
    await submitBtn.click();
    log('Submit clicked.');

    // Wait briefly for the job to be submitted
    await sleep(3000);

    return { submitted: true, jobId: null };
  }

  /**
   * Find the main prompt input field using multiple selector strategies.
   * Returns the first matching element, or null.
   * @returns {Promise<ElementHandle|null>}
   */
  async _findPromptInput() {
    const selectors = [
      // Specific textarea with prompt-related placeholder
      { sel: 'textarea[placeholder*="prompt" i]', label: 'textarea[placeholder~=prompt]' },
      { sel: 'textarea[placeholder*="描述" i]', label: 'textarea[placeholder~=描述]' },
      { sel: 'textarea[placeholder*="输入" i]', label: 'textarea[placeholder~=输入]' },
      { sel: 'textarea[placeholder*="video" i]', label: 'textarea[placeholder~=video]' },
      { sel: 'textarea[placeholder*="create" i]', label: 'textarea[placeholder~=create]' },
      { sel: 'textarea[placeholder*="创作" i]', label: 'textarea[placeholder~=创作]' },
      { sel: 'textarea[placeholder*="story" i]', label: 'textarea[placeholder~=story]' },
      { sel: 'textarea[placeholder*="内容" i]', label: 'textarea[placeholder~=内容]' },
      // Any textarea on the page (fallback)
      { sel: 'textarea', label: 'any textarea' },
      // Prompt input fields
      { sel: 'input[placeholder*="prompt" i]', label: 'input[placeholder~=prompt]' },
      { sel: 'input[placeholder*="描述" i]', label: 'input[placeholder~=描述]' },
      { sel: 'input[placeholder*="text" i]', label: 'input[placeholder~=text]' },
      // Contenteditable divs
      { sel: 'div[contenteditable="true"]', label: 'contenteditable div' },
      { sel: '[contenteditable="true"]', label: 'any contenteditable' },
      // Role-based
      { sel: '[role="textbox"]', label: 'role=textbox' },
      { sel: '[role="combobox"]', label: 'role=combobox' },
    ];

    for (const { sel, label } of selectors) {
      try {
        const count = await this._page.locator(sel).count();
        if (count > 0) {
          log(`Prompt input found: "${label}" with "${sel}"`);
          return this._page.locator(sel).first();
        }
      } catch { /* try next */ }
    }

    // Log diagnostic info to help debug
    try {
      const textareaCount = await this._page.locator('textarea').count();
      const inputCount = await this._page.locator('input').count();
      const allTextareas = textareaCount > 0
        ? await this._page.locator('textarea').evaluateAll(els =>
            els.map(el => ({ placeholder: el.getAttribute('placeholder'), class: el.className.slice(0, 80) })))
        : [];
      log(`Prompt input not found. Page has: ${textareaCount} textareas, ${inputCount} inputs`);
      if (allTextareas.length > 0) {
        log('Textareas on page:');
        for (const t of allTextareas) {
          log(`  placeholder="${t.placeholder}" class="${t.class}"`);
        }
      }
    } catch { /* ignore */ }

    return null;
  }

  /**
   * Set aspect ratio in the UI if selectable.
   * @param {string} ratio — '16:9' | '9:16' | '1:1'
   */
  async _setAspectRatio(ratio) {
    try {
      // Look for aspect ratio buttons/dropdown
      const ratioMap = {
        '16:9':  ['16:9', '横屏', 'landscape', 'widescreen'],
        '9:16':  ['9:16', '竖屏', 'portrait', 'vertical', 'tiktok'],
        '1:1':   ['1:1', 'square'],
      };
      const labels = ratioMap[ratio] || [ratio];

      for (const label of labels) {
        const btn = await this._page.$(`button:has-text("${label}"), [role="button"]:has-text("${label}"), [data-aspect="${label}"]`);
        if (btn) {
          await btn.click();
          log(`Aspect ratio set to ${ratio}`);
          return;
        }
      }
    } catch { /* optional setting */ }
    log(`Aspect ratio ${ratio} could not be set automatically (optional).`);
  }

  /**
   * Find the submit / generate button.
   * Returns the first matching element, or null.
   * @returns {Promise<ElementHandle|null>}
   */
  async _findSubmitButton() {
    const selectors = [
      // Most specific: data-testid
      { sel: '[data-testid="generate"]', label: 'data-testid=generate' },
      { sel: '[data-testid="create"]', label: 'data-testid=create' },
      { sel: '[data-testid="submit"]', label: 'data-testid=submit' },
      // Hailuo App specific: submit button with cost indicator (text="25" or similar)
      { sel: 'button[type="submit"]:has-text("25")', label: 'button[type=submit] has-text(25)' },
      { sel: 'button[type="submit"]:has-text("生成" )', label: 'button[type=submit] has-text(生成)' },
      { sel: 'button[type="submit"][class*="btn"]', label: 'button[type=submit].btn' },
      { sel: 'button.new-color-btn-bg', label: 'button.new-color-btn-bg' },
      // English labels
      { sel: 'button:has-text("Create Video")', label: 'button "Create Video"' },
      { sel: 'button:has-text("Generate Video")', label: 'button "Generate Video"' },
      { sel: 'button:has-text("Create")', label: 'button "Create"' },
      { sel: 'button:has-text("Generate")', label: 'button "Generate"' },
      { sel: 'button:has-text("Start")', label: 'button "Start"' },
      { sel: 'button:has-text("Go")', label: 'button "Go"' },
      // Chinese labels
      { sel: 'button:has-text("生成" i)', label: 'button 生成' },
      { sel: 'button:has-text("创建" i)', label: 'button 创建' },
      { sel: 'button:has-text("开始" i)', label: 'button 开始' },
      { sel: 'button:has-text("创作视频" i)', label: 'button 创作视频' },
      // Type attributes
      { sel: 'button[type="submit"]', label: 'button[type=submit]' },
      { sel: 'button[type="button"][class*="primary"]', label: 'primary button' },
      { sel: 'button[class*="primary"]', label: 'class*primary button' },
      { sel: 'button[class*="accent"]', label: 'class*accent button' },
      // Class patterns
      { sel: '[class*="generate"][class*="btn"]', label: 'class*generate.btn' },
      { sel: '[class*="create"][class*="btn"]', label: 'class*create.btn' },
      { sel: '[class*="submit"][class*="btn"]', label: 'class*submit.btn' },
      { sel: 'button[class*="generate"]', label: 'button.class*generate' },
      { sel: 'button[class*="create"]', label: 'button.class*create' },
    ];

    for (const { sel, label } of selectors) {
      try {
        const count = await this._page.locator(sel).count();
        if (count > 0) {
          const txt = await this._page.locator(sel).first().innerText().catch(() => '');
          log(`Submit button found: "${label}" → "${txt.trim().slice(0, 40)}" at ${sel}`);
          return this._page.locator(sel).first();
        }
      } catch { /* try next */ }
    }

    // Diagnostic: list all buttons on the page
    try {
      const allBtns = await this._page.locator('button').evaluateAll(els =>
        els.map(el => ({ text: el.textContent?.trim().slice(0, 60), class: el.className.slice(0, 80), type: el.type }))
      );
      log(`Submit button not found. Page has ${allBtns.length} buttons:`);
      for (const b of allBtns.slice(0, 10)) {
        log(`  [type=${b.type}] class="${b.class}" text="${b.text}"`);
      }
    } catch { /* ignore */ }

    return null;
  }

  // -------------------------------------------------------------------------
  // Core: wait for completion
  // -------------------------------------------------------------------------

  /**
   * Wait for the video generation to complete.
   * Strategy: wait fixed 90s for generation to complete, then grab the first
   * available video URL (the newly generated one should be on the page by then).
   *
   * @param {object} [opts]
   * @param {number} [opts.maxWaitMs]       — Max wait time, default 5 min
   * @param {string[]} [opts.knownOldUrls]  — URLs already on page (ignore these)
   * @returns {Promise<string>}             — Download URL
   */
  async _waitForCompletion({
    maxWaitMs        = 5 * 60 * 1000,
    knownOldUrls     = [],
  } = {}) {
    const deadline = Date.now() + maxWaitMs;
    log(`Waiting for video generation... (max ${maxWaitMs/1000}s)`);

    // Wait 90s for generation to complete (Hailuo typically takes 3-5 min)
    log('Waiting 90s for generation to complete...');
    await sleep(90_000);

    // Grab the first available video URL
    const urls = await this._getCurrentVideoUrls();
    if (urls.length > 0) {
      // Try to filter out known old URLs
      const oldKeys = knownOldUrls.map(u => {
        const parts = u.split('/');
        const fname = parts[parts.length - 1].replace('.mp4', '');
        return fname.split('-').slice(0, 2).join('-');
      }).filter(k => k.length > 5);

      const newUrls = urls.filter(u => {
        if (!u) return false;
        const parts = u.split('/');
        const fname = parts[parts.length - 1].replace('.mp4', '');
        const fp = fname.split('-').slice(0, 2).join('-');
        return !oldKeys.includes(fp);
      });

      const chosen = newUrls.length > 0 ? newUrls[0] : urls[0];
      log(`Video ready: ${chosen.slice(0, 80)}`);
      return chosen;
    }

    // If no URL found, keep polling
    log('No video URL found after 90s, continuing to poll...');
    while (Date.now() < deadline) {
      const urls = await this._getCurrentVideoUrls();
      if (urls.length > 0) {
        const oldKeys = knownOldUrls.map(u => {
          const parts = u.split('/');
          const fname = parts[parts.length - 1].replace('.mp4', '');
          return fname.split('-').slice(0, 2).join('-');
        }).filter(k => k.length > 5);
        const newUrls = urls.filter(u => {
          if (!u) return false;
          const parts = u.split('/');
          const fname = parts[parts.length - 1].replace('.mp4', '');
          const fp = fname.split('-').slice(0, 2).join('-');
          return !oldKeys.includes(fp);
        });
        if (newUrls.length > 0) {
          log(`Video found in poll: ${newUrls[0].slice(0, 80)}`);
          return newUrls[0];
        }
      }
      await sleep(10_000);
    }

    throw new Error(`Timed out after ${maxWaitMs}ms — no video URL appeared`);
  }

  /**
   * Wait for generation then get video from history page using a "snapshot diff" approach.
   *
   * Strategy:
   * 1. Submit the prompt
   * 2. Navigate to history page and capture a snapshot of video URLs (before generation finishes)
   * 3. Wait for generation to finish (poll the page title or a status indicator)
   * 4. Navigate back to history page and find the NEW video (by comparing to snapshot)
   *
   * @param {object} [opts]
   * @param {number} [opts.maxWaitMs]         — Max wait time, default 5 min
   * @param {string[]} [opts.knownOldUrls]   — URLs already known (ignore these)
   * @returns {Promise<string>}               — Download URL
   */
  async _waitForCompletionViaHistory({
    maxWaitMs         = 5 * 60 * 1000,
    knownOldUrls      = [],
  } = {}) {
    const deadline = Date.now() + maxWaitMs;

    // Navigate to history page BEFORE generation finishes and capture snapshot
    log('Capturing history snapshot before generation...');
    const historyPaths = ['/video', '/videos', '/my-video', '/my-videos'];
    let beforeSnapshot = [];
    for (const path of historyPaths) {
      try {
        await this._page.goto(HAILUO_APP_URL + path, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(3000);
        const urls = await this._getCurrentVideoUrls();
        if (urls.length > 0) {
          beforeSnapshot = urls;
          log(`Snapshot captured from ${path}: ${urls.length} video(s)`);
          break;
        }
      } catch (e) {
        log(`Could not capture snapshot from ${path}: ${e.message.slice(0, 80)}`);
      }
    }

    // Go back to create page (generation should still be running)
    await this._page.goto(HAILUO_APP_URL + '/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 15000 });
    log('Waiting for generation to complete on create page...');

    // Poll for completion on create page (look for new URL OR submit button re-enabled)
    const oldKeys = knownOldUrls.map(u => {
      const parts = u.split('/');
      const fname = parts[parts.length - 1].replace('.mp4', '');
      return fname.split('-').slice(0, 2).join('-');
    }).filter(k => k.length > 5);

    let submitBtnEnabledAt = null;
    while (Date.now() < deadline) {
      const urls = await this._getCurrentVideoUrls();
      // Find URL that is new (not in beforeSnapshot and not in knownOldUrls)
      for (const u of urls) {
        if (!u) continue;
        const fname = u.split('/').pop().replace('.mp4', '');
        const fp = fname.split('-').slice(0, 2).join('-');
        if (!oldKeys.includes(fp) && !beforeSnapshot.some(s => s.includes(fp))) {
          log(`NEW video found on create page: ${u.slice(0, 80)}`);
          return u;
        }
      }
      // Also check if submit button is re-enabled (generation done)
      if (!submitBtnEnabledAt) {
        try {
          const btn = await this._page.$('button.new-color-btn-bg');
          if (btn && !await btn.getAttribute('disabled')) {
            submitBtnEnabledAt = Date.now();
            log('Submit button re-enabled — generation complete!');
          }
        } catch {}
      } else if (Date.now() - submitBtnEnabledAt > 5000) {
        // Button has been enabled for 5+ seconds, video should be ready
        log('Video should be ready, checking page...');
      }
      await sleep(10000);
    }

    // Timeout: go to history and find the first video that wasn't in our snapshot
    log('Create page timed out, checking history for new video...');
    for (const path of historyPaths) {
      try {
        await this._page.goto(HAILUO_APP_URL + path, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(3000);
        const urls = await this._getCurrentVideoUrls();
        for (const u of urls) {
          if (!u) continue;
          const fname = u.split('/').pop().replace('.mp4', '');
          const fp = fname.split('-').slice(0, 2).join('-');
          if (!oldKeys.includes(fp) && !beforeSnapshot.some(s => s.includes(fp))) {
            log(`NEW video found in history: ${u.slice(0, 80)}`);
            return u;
          }
        }
      } catch (e) {
        log(`History check failed: ${e.message.slice(0, 80)}`);
      }
    }

    throw new Error(`Could not find generated video URL after ${maxWaitMs}ms`);
  }

  /**
   * Clear old video elements from the page to prevent stale demo videos
   * from being detected as newly generated videos.
   */
  async clearOldVideos() {
    try {
      await this._page.evaluate(() => {
        const videos = document.querySelectorAll('video');
        const mp4Links = document.querySelectorAll('a[href*=".mp4"]');
        videos.forEach(v => v.remove());
        mp4Links.forEach(a => a.remove());
      });
      log('Cleared old video elements from page.');
    } catch (e) {
      log('Could not clear old videos: ' + e.message);
    }
  }

  /**
   * Get all MP4/video URLs currently visible on the page.
   * Used to filter out pre-existing demo/stale videos.
   * @returns {Promise<string[]>}
   */
  async _getCurrentVideoUrls() {
    const urls = [];
    const selectors = [
      'a[href*=".mp4"]', 'video[src*="mp4"]', 'video[src*="blob"]',
      '[download][href*="mp4"]',
    ];
    for (const sel of selectors) {
      try {
        const count = await this._page.locator(sel).count();
        for (let i = 0; i < count; i++) {
          const el = this._page.locator(sel).nth(i);
          const attr = sel.startsWith('a') || sel.startsWith('[download]') ? 'href' : 'src';
          const val = await el.getAttribute(attr).catch(() => null);
          if (val) urls.push(val);
        }
      } catch {}
    }
    return [...new Set(urls)];
  }

  /**
   * Check the page for completion indicators.
   * @param {string[]} [knownOldUrls] — URLs already present before submission (ignore these)
   * @returns {{ done: boolean, downloadPath: string|null }}
   */
  async _checkCompletion(knownOldUrls = []) {
    // Check for a download button / video preview
    const downloadSelectors = [
      // MP4 direct links
      { sel: 'a[href*=".mp4"]', attr: 'href', label: 'MP4 link' },
      { sel: 'a[href*=".webm"]', attr: 'href', label: 'WebM link' },
      { sel: 'a[href*="/download"]', attr: 'href', label: 'download link' },
      // Video elements
      { sel: 'video[src*="blob"]', attr: 'src', label: 'blob video' },
      { sel: 'video[src*="mp4"]', attr: 'src', label: 'MP4 video' },
      { sel: 'video', attr: 'src', label: 'any video element' },
      // Download buttons/links
      { sel: '[download]', attr: 'href', label: 'elements with download attr' },
      { sel: 'button:has-text("Download")', attr: null, label: 'Download button' },
      { sel: 'button:has-text("下载")', attr: null, label: '下载 button' },
      { sel: 'a:has-text("Download")', attr: 'href', label: 'Download link' },
      { sel: 'a:has-text("下载")', attr: 'href', label: '下载 link' },
      // Class-based patterns
      { sel: '[class*="download"]', attr: 'href', label: 'class*download' },
      { sel: '[class*="result"] video', attr: 'src', label: 'video in result element' },
      { sel: '[class*="output"] video', attr: 'src', label: 'video in output element' },
      { sel: '[class*="player"] video', attr: 'src', label: 'video player' },
      { sel: '[class*="preview"] video', attr: 'src', label: 'video preview' },
      { sel: '[class*="video-card"] video', attr: 'src', label: 'video card' },
      // data-testid
      { sel: '[data-testid*="download"]', attr: 'href', label: 'data-testid*download' },
      { sel: '[data-testid*="video-result"]', attr: null, label: 'data-testid*video-result' },
    ];

    for (const { sel, attr, label } of downloadSelectors) {
      try {
        const count = await this._page.locator(sel).count();
        if (count > 0) {
          const el = this._page.locator(sel).first();
          if (attr) {
            const val = await el.getAttribute(attr).catch(() => null);
            if (val && (val.includes('.mp4') || val.includes('blob') || val.includes('video'))) {
              // Ignore URLs that were already on the page before submission
              if (knownOldUrls.some(old => val.includes(old) || old.includes(val))) {
                log(`Completion check: ignoring stale URL → ${val.slice(0, 80)}`);
                continue;
              }
              log(`Completion detected: ${label} → ${val.slice(0, 80)}`);
              return { done: true, downloadPath: val };
            }
          } else {
            // Check for download button — trigger download
            log(`Completion detected: ${label}`);
            return { done: true, downloadPath: 'trigger_download' };
          }
        }
      } catch { /* not found */ }
    }

    // Check for error indicators
    const errorSelectors = [
      '[class*="error"]', '[class*="failed"]', '[class*="失败"]',
      '[class*="fail"]', '[class*="invalid"]',
      '[data-testid*="error"]', '[role="alert"]',
    ];
    for (const sel of errorSelectors) {
      try {
        const count = await this._page.locator(sel).count();
        if (count > 0) {
          const text = await this._page.locator(sel).first().innerText().catch(() => '');
          if (text.trim()) {
            log(`Error detected on page: "${text.trim().slice(0, 100)}"`);
            throw new Error(`Generation failed: ${text.trim().slice(0, 200)}`);
          }
        }
      } catch (e) {
        if (e.message.includes('Generation failed')) throw e;
      }
    }

    return { done: false, downloadPath: null };
  }

  /**
   * Get current generation status text from the UI.
   * @returns {Promise<string|null>}
   */
  async _getGenerationStatus() {
    const selectors = [
      '[class*="progress"]',
      '[class*="status"]',
      '[class*="进度"]',
      '[class*="processing"]',
      '[class*="generating"]',
      '[role="progressbar"]',
    ];
    for (const sel of selectors) {
      try {
        const el = await this._page.waitForSelector(sel, { timeout: 2000 });
        if (el) {
          const text = await el.innerText().catch(() => null);
          if (text) return text.trim().slice(0, 100);
        }
      } catch { /* not found */ }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Core: download video
  // -------------------------------------------------------------------------

  /**
   * Download the generated video to the local output directory.
   * Uses Playwright's download API when triggered via download button,
   * or fetches the URL directly.
   *
   * @param {string} videoUrl — Direct URL or 'auto' to detect from page
   * @param {string} filename — Optional filename, defaults to timestamp-based
   * @returns {Promise<string>} — Local file path
   */
  async _downloadVideo(videoUrl, filename) {
    const name = filename || `hailuo_${Date.now()}.mp4`;
    const dest = resolve(this.downloadDir, name);

    mkdirSync(this.downloadDir, { recursive: true });

    if (videoUrl && videoUrl.startsWith('http')) {
      log(`Downloading video from ${videoUrl}`);
      const res = await fetch(videoUrl);
      if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(dest, buf);
      log(`Video saved to ${dest} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
      return dest;
    }

    // Try to trigger download via Playwright
    try {
      const downloadPromise = this._page.waitForEvent('download', { timeout: 30000 });
      // Click download button if available
      const dlBtn = await this._page.$('button:has-text("Download"), a:has-text("Download")');
      if (dlBtn) await dlBtn.click();
      const dl = await downloadPromise;
      await dl.saveAs(dest);
      log(`Video downloaded to ${dest}`);
      return dest;
    } catch (e) {
      if (e.message.includes('download')) {
        throw new Error(
          `Could not download video.\n` +
          `  Video URL: ${videoUrl}\n` +
          `  Error: ${e.message}\n` +
          `  Fix: Check output/videos/ for partial downloads.`
        );
      }
      throw e;
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Generate a video via the Hailuo App web UI.
   * Orchestrates: navigate -> fill prompt -> submit -> wait -> download.
   *
   * @param {object} opts
   * @param {string}   opts.prompt           — Video description
   * @param {string}   [opts.aspectRatio]   — '16:9' | '9:16' | '1:1', default '16:9'
   * @param {string}   [opts.filename]       — Custom output filename
   * @param {number}   [opts.maxWaitMs]      — Max generation wait, default 15 min
   * @param {boolean}  [opts.saveSession]    — Auto-save session after login, default false
   * @returns {Promise<{ localPath: string, url: string|null, duration: number }>}
   */
  async generateVideo({
    prompt,
    aspectRatio  = '16:9',
    filename,
    maxWaitMs    = 15 * 60 * 1000,
    saveSession  = false,
  }) {
    if (!this._page) await this.init();

    // Check login
    const loggedIn = await this.isLoggedIn();
    if (!loggedIn) {
      log('Not logged in. Please log in manually, then save session:');
      log('  node scripts/setup-hailuo-app-session.js');
      throw new Error(
        'Hailuo App not logged in.\n' +
        '  Fix: node scripts/setup-hailuo-app-session.js\n' +
        '  Then re-run.\n' +
        '  Or run diagnostic: node scripts/hailuo-app-diagnostic.js'
      );
    }

    // Navigate and submit
    await this._navigateToCreate();

    // Capture pre-existing video URLs so we don't detect stale demos as new completions
    const knownOldUrls = await this._getCurrentVideoUrls();
    log(`Pre-existing video URLs: ${knownOldUrls.length > 0 ? knownOldUrls.map(u => u.slice(0,60)).join(', ') : 'none'}`);

    await this._fillPromptAndSubmit({ prompt, aspectRatio });

    // Wait for completion (DOM polling with new URL filtering)
    const videoUrl = await this._waitForCompletion({ maxWaitMs, knownOldUrls });

    // Download
    const localPath = await this._downloadVideo(videoUrl, filename);

    // Optionally save session
    if (saveSession) await this.saveSession();

    return { localPath, url: videoUrl, prompt };
  }

  /**
   * Check how many Hailuo App credits the account has.
   * Navigates to account/credits page and parses the credit display.
   * @returns {Promise<{ credits: number|null, display: string|null }>}
   */
  async getCredits() {
    if (!this._page) await this.init();
    const loggedIn = await this.isLoggedIn();
    if (!loggedIn) return { credits: null, display: 'Not logged in' };

    try {
      await this._page.goto(HAILUO_APP_URL + '/account', { timeout: 15000 });
      await this._page.waitForLoadState('domcontentloaded');
      await sleep(2000);

      // Look for credit display
      const creditSelectors = [
        '[class*="credit"]',
        '[class*="point"]',
        '[class*="余额"]',
        '[class*="积分"]',
      ];
      for (const sel of creditSelectors) {
        try {
          const el = await this._page.waitForSelector(sel, { timeout: 3000 });
          if (el) {
            const text = await el.innerText().catch(() => null);
            if (text) {
              // Try to extract a number
              const match = text.match(/[\d,]+/);
              const credits = match ? parseInt(match[0].replace(/,/g, ''), 10) : null;
              return { credits, display: text.trim() };
            }
          }
        } catch { /* not found */ }
      }
      return { credits: null, display: 'Credits display not found on page' };
    } catch (e) {
      return { credits: null, display: `Error: ${e.message}` };
    }
  }
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('HailuoApp module loaded.');
  console.log('Usage:');
  console.log('  1. node scripts/setup-hailuo-app-session.js   # one-time session setup');
  console.log('  2. node -e "');
  console.log('       import { HailuoApp } from \"./lib/hailuo-app.js\";');
  console.log('       const app = new HailuoApp();');
  console.log('       const r = await app.generateVideo({ prompt: \"...\" });');
  console.log('       console.log(r.localPath);');
  console.log('     "');
}
