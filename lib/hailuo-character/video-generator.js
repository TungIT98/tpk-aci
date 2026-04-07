/**
 * lib/hailuo-character/video-generator.js
 * S2V (Subject-to-Video) generator using Hailuo App browser automation.
 *
 * Uses Playwright to automate hailuoai.video web UI instead of MiniMax API.
 * The App and API have SEPARATE credit systems — App subscription works here.
 *
 * S2V URL: https://hailuoai.video/create/subject-reference-to-video
 *
 * Usage:
 *   import { S2VGenerator } from './lib/hailuo-character/video-generator.js';
 *   const gen = new S2VGenerator();
 *   const result = await gen.generate({ subjectReferences: [...], prompt: '...' });
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

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

export const HAILUO_APP_URL      = env.HAILUO_APP_URL      || 'https://hailuoai.video';
export const HAILUO_SESSION_PATH = env.HAILUO_SESSION_PATH || resolve(__dirname, '..', '..', '.hailuo-session.json');
export const HAILUO_HEADLESS    = env.HAILUO_HEADLESS     !== 'false';
export const S2V_URL            = `${HAILUO_APP_URL}/create/subject-reference-to-video`;
export const POLL_INTERVAL_MS   = 10_000;
export const MAX_WAIT_MS        = 15 * 60 * 1000; // 15 min

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(...args) {
  console.log(`[S2VGenerator] ${new Date().toISOString().slice(11,19)}`, ...args);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// S2VGenerator — browser automation for Hailuo S2V
// ---------------------------------------------------------------------------

export class S2VGenerator {
  /**
   * @param {object} opts
   * @param {string} [opts.sessionPath]  — Path to saved session JSON
   * @param {string} [opts.downloadDir]  — Directory to save videos
   * @param {boolean} [opts.headless]     — Run browser headless
   * @param {number} [opts.timeoutMs]    — Element/operation timeout
   */
  constructor({
    sessionPath  = HAILUO_SESSION_PATH,
    downloadDir  = resolve(__dirname, '..', '..', 'outputs', 'hailuo-character'),
    headless     = HAILUO_HEADLESS,
    timeoutMs    = 30_000,
  } = {}) {
    this.sessionPath = sessionPath;
    this.downloadDir = downloadDir;
    this.headless    = headless;
    this.timeoutMs   = timeoutMs;
    this._browser    = null;
    this._context   = null;
    this._page      = null;
    this._playwright = null;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Initialize Playwright, launch browser, restore session.
   * Must call before any generation.
   */
  async init() {
    const { chromium } = await import('playwright');
    this._playwright = { chromium };

    if (!existsSync(this.downloadDir)) {
      mkdirSync(this.downloadDir, { recursive: true });
    }

    // Try to restore session from storageState file
    if (existsSync(this.sessionPath)) {
      log(`Restoring session from ${this.sessionPath}`);
      try {
        const sessionData = JSON.parse(readFileSync(this.sessionPath, 'utf-8'));
        // storageState format has cookies at root level
        if (sessionData.cookies && sessionData.origins) {
          this._context = await chromium.launchPersistentContext('', {
            headless:   this.headless,
            storageState: sessionData,
            args: ['--no-sandbox'],
          });
        } else {
          // cookies+origins format from Playwright's getCookies()
          this._context = await chromium.launchPersistentContext('', {
            headless:   this.headless,
            args: ['--no-sandbox'],
          });
          await this._context.addCookies(sessionData.cookies || []);
        }
        this._page = (await this._context.pages())[0] || await this._context.newPage();
        log('Session restored.');
        return;
      } catch (err) {
        log(`Failed to restore session: ${err.message}, trying browser profile...`);
        this._context = null;
      }
    }

    // Try using Edge browser profile (user may already be logged in there)
    const edgeProfilePath = process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\User Data';
    const chromeProfilePath = process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data';

    let browserProfile = null;
    if (existsSync(edgeProfilePath)) {
      browserProfile = edgeProfilePath;
    } else if (existsSync(chromeProfilePath)) {
      browserProfile = chromeProfilePath;
    }

    // Anti-detection browser args
    const antiDetectArgs = [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--lang=en-US',
    ];

    if (browserProfile) {
      log(`Using browser profile: ${browserProfile}`);
      try {
        this._context = await chromium.launchPersistentContext(browserProfile + '\\Default', {
          headless:   this.headless,
          args: antiDetectArgs,
          ignoreHTTPSErrors: true,
        });
        this._page = (await this._context.pages())[0] || await this._context.newPage();
        // Inject anti-detection
        await this._page.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });
        log('Browser profile loaded.');
        return;
      } catch (err) {
        log(`Failed to use browser profile: ${err.message}`);
      }
    }

    // Last resort: fresh browser
    log('No session or profile found. Launching fresh browser.');
    this._context = await chromium.launchPersistentContext('', {
      headless: this.headless,
      args: antiDetectArgs,
    });
    this._page = (await this._context.pages())[0] || await this._context.newPage();
    await this._page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    log('Fresh session started. Log in at hailuoai.video, then save session.');
  }

  /**
   * Check if session is logged in.
   */
  async isLoggedIn() {
    if (!this._page) return false;
    try {
      await this._page.goto(HAILUO_APP_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(2000);
      const url = this._page.url();
      if (url.includes('login') || url.includes('signin')) return false;

      // Look for user elements
      const hasUser = await this._page.locator('[class*="avatar"], [class*="user"], header nav').count() > 0;
      return hasUser;
    } catch { return false; }
  }

  /**
   * Save current session to file for reuse.
   */
  async saveSession() {
    if (!this._context) return;
    const state = await this._context.storageState();
    writeFileSync(this.sessionPath, JSON.stringify(state));
    log(`Session saved to ${this.sessionPath}`);
  }

  /**
   * Close browser.
   */
  async close() {
    if (this._context) {
      await this._context.close();
      this._context = null;
      this._page = null;
    }
  }

  // -------------------------------------------------------------------------
  // Navigation — S2V page
  // -------------------------------------------------------------------------

  /**
   * Navigate to the Subject Reference video creation page.
   */
  async _navigateToS2V() {
    log(`Navigating to S2V page: ${S2V_URL}`);
    await this._page.goto(S2V_URL, { waitUntil: 'load', timeout: 60000 });
    await sleep(3000);

    // Check login
    if (this._page.url().includes('login')) {
      throw new Error('Not logged in. Run: node scripts/setup-hailuo-app-session.js');
    }

    // Wait for S2V UI elements
    await this._waitForS2VUI();
    log('S2V page loaded.');
  }

  /**
   * Wait for S2V page elements to be ready.
   */
  async _waitForS2VUI() {
    const selectors = [
      // Reference image upload area
      { sel: '[class*="upload"], [class*="reference"], [class*="subject"]', label: 'upload/reference area' },
      // Textarea for prompt
      { sel: 'textarea', label: 'textarea' },
      // Submit button
      { sel: 'button:has-text("Create")', label: 'Create button' },
      { sel: 'button:has-text("Generate")', label: 'Generate button' },
    ];

    for (const { sel, label } of selectors) {
      try {
        const count = await this._page.locator(sel).count();
        if (count > 0) {
          log(`S2V UI found: ${label} (${count} element(s))`);
        }
      } catch { /* try next */ }
    }
    await sleep(2000);
  }

  // -------------------------------------------------------------------------
  // Reference image upload
  // -------------------------------------------------------------------------

  /**
   * Upload subject reference images to the S2V page.
   * Accepts an array of file paths or base64 data URLs.
   *
   * @param {string[]} imagePaths — Array of image file paths
   */
  async _uploadReferences(imagePaths) {
    log(`Uploading ${imagePaths.length} reference image(s)...`);

    // Find the file input for reference uploads
    // S2V page typically has a specific upload area for subject references
    const fileInput = await this._page.$('input[type="file"]');

    if (!fileInput) {
      // Try finding upload button/dropzone
      const uploadSelectors = [
        '[class*="upload"]',
        '[class*="reference"]',
        '[class*="subject"]',
        '[class*="dropzone"]',
        'button:has-text("Upload")',
      ];

      for (const sel of uploadSelectors) {
        const el = await this._page.$(sel);
        if (el) {
          // Check if it contains or is a file input
          const inputInEl = await el.$('input[type="file"]');
          if (inputInEl) {
            await inputInEl.setInputFiles(imagePaths);
            log(`Uploaded via nested input in ${sel}`);
            await sleep(2000);
            return;
          }
        }
      }
      throw new Error('Could not find file upload input on S2V page');
    }

    await fileInput.setInputFiles(imagePaths);
    log('Reference images uploaded.');
    await sleep(2000);
  }

  // -------------------------------------------------------------------------
  // Fill prompt and submit
  // -------------------------------------------------------------------------

  /**
   * Fill the prompt textarea on the S2V page.
   */
  async _fillPrompt(prompt) {
    const textarea = await this._page.$('textarea');
    if (!textarea) {
      throw new Error('Could not find prompt textarea on S2V page');
    }

    await textarea.fill(prompt);
    log(`Prompt filled: "${prompt.slice(0, 60)}..."`);
    await sleep(500);
  }

  /**
   * Click the submit/generate button.
   */
  async _clickSubmit() {
    const buttonSelectors = [
      'button:has-text("Create")',
      'button:has-text("Generate")',
      'button[type="submit"]',
      '[class*="submit"]',
      '[class*="generate"]',
    ];

    for (const sel of buttonSelectors) {
      const btn = await this._page.$(sel);
      if (btn && await btn.isEnabled()) {
        await btn.click();
        log(`Submit clicked: ${sel}`);
        await sleep(3000);
        return;
      }
    }
    throw new Error('Could not find enabled submit button');
  }

  // -------------------------------------------------------------------------
  // Wait for completion
  // -------------------------------------------------------------------------

  /**
   * Wait for video generation to complete and return the video URL.
   * Polls the page for result elements.
   */
  async _waitForCompletion() {
    const deadline = Date.now() + MAX_WAIT_MS;
    let lastStatus = '';

    while (Date.now() < deadline) {
      // Check current URL or page state for completion
      const pageText = await this._page.locator('body').innerText().catch(() => '');

      // Look for success indicators
      if (pageText.includes('completed') || pageText.includes('download') || pageText.includes('Download')) {
        log('Generation appears completed.');
        break;
      }

      // Look for error indicators
      if (pageText.includes('failed') || pageText.includes('error')) {
        throw new Error('Generation failed: ' + pageText.slice(0, 200));
      }

      // Look for video element
      const videoEl = await this._page.$('video');
      if (videoEl) {
        const src = await videoEl.getAttribute('src');
        if (src && !src.startsWith('data:')) {
          log(`Video found: ${src}`);
          return src;
        }
      }

      // Look for download link/button
      const downloadLinks = await this._page.$$('a[href*=".mp4"], a[href*="video"]');
      for (const link of downloadLinks) {
        const href = await link.getAttribute('href');
        if (href && href.includes('.mp4')) {
          log(`Download link found: ${href}`);
          return href;
        }
      }

      lastStatus = pageText.slice(0, 100);
      log(`Still generating... (${Math.round((deadline - Date.now()) / 1000)}s left)`);
      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(`S2V generation timed out after ${MAX_WAIT_MS}ms. Last status: ${lastStatus}`);
  }

  /**
   * Download video from URL to local file.
   */
  async _downloadVideo(url, destPath) {
    log(`Downloading video to ${destPath}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const { Writeable } = await import('stream');
    const { createWriteStream } = await import('fs');
    const fileStream = createWriteStream(destPath);
    res.body.pipe(fileStream);

    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    log(`Downloaded: ${destPath}`);
    return destPath;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Generate a character-consistent video using S2V (browser automation).
   *
   * @param {object}   opts
   * @param {string[]} opts.subjectReferences — Array of image file paths (local files)
   * @param {string}   opts.prompt           — Video description
   * @param {string}   [opts.aspect_ratio]   — '9:16' | '16:9' | '1:1' (default '9:16')
   * @param {number}   [opts.duration]        — Duration hint in seconds (default 6)
   * @returns {Promise<{ videoUrl: string, localPath: string, taskId: string }>}
   */
  async generate({ subjectReferences, prompt, aspect_ratio = '9:16', duration = 6 }) {
    // Ensure browser is initialized
    if (!this._page) {
      await this.init();
    }

    // Navigate to S2V page
    await this._navigateToS2V();

    // Upload reference images
    await this._uploadReferences(subjectReferences);

    // Fill prompt
    await this._fillPrompt(prompt);

    // Click submit
    await this._clickSubmit();

    // Wait for completion
    const videoUrl = await this._waitForCompletion();

    // Download to local file
    const taskId = new Date().getTime().toString(36);
    const ext = videoUrl.includes('.mp4') ? 'mp4' : 'mp4';
    const localPath = resolve(this.downloadDir, `s2v_${taskId}.${ext}`);

    let localPathStr = '';
    try {
      localPathStr = await this._downloadVideo(videoUrl, localPath);
    } catch (err) {
      log(`Download failed: ${err.message} — returning URL only`);
    }

    return {
      videoUrl,
      localPath: localPathStr,
      taskId,
      aspect_ratio,
      duration,
    };
  }

  /**
   * Generate with retry on transient failures.
   */
  async generateWithRetry({ subjectReferences, prompt, aspect_ratio, duration }, maxRetries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.generate({ subjectReferences, prompt, aspect_ratio, duration });
      } catch (err) {
        lastError = err;
        const isRetryable = !err.message.includes('Not logged in') &&
                            !err.message.includes('timed out');
        if (!isRetryable || attempt === maxRetries) throw err;
        log(`Attempt ${attempt + 1} failed: ${err.message}, retrying...`);
        await sleep(5000);
        // Reinitialize browser for retry
        await this.close();
        await this.init();
      }
    }
    throw lastError;
  }

  // -------------------------------------------------------------------------
  // High-level: generate from character library
  // -------------------------------------------------------------------------

  /**
   * Generate S2V video using a character from the library.
   *
   * @param {object}   opts
   * @param {string}   opts.characterId — Character ID in library
   * @param {string}   opts.prompt     — Video description
   * @param {object}   [opts.lib]      — CharacterLibrary instance
   * @returns {Promise<object>}
   */
  async generateFromCharacter({ characterId, prompt, lib: libInstance, aspect_ratio, duration }) {
    const { CharacterLibrary } = await import('./character-library.js');
    const lib = libInstance || new CharacterLibrary();

    const char = await lib.get(characterId);
    if (!char) throw new Error(`Character not found: ${characterId}`);

    // Load reference image paths
    const { CharacterLibrary: CL } = await import('./character-library.js');
    const refLib = new CL();
    const refPaths = await refLib.loadReferenceFilePaths(characterId);

    if (refPaths.length === 0) {
      throw new Error(`No reference images found for character '${characterId}'`);
    }

    log(`Using ${refPaths.length} reference images for character '${char.name}'`);

    return this.generateWithRetry({
      subjectReferences: refPaths,
      prompt,
      aspect_ratio: aspect_ratio || '9:16',
      duration: duration || 6,
    });
  }
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('S2VGenerator loaded. Uses HailuoApp browser automation.');
  console.log('S2V URL:', S2V_URL);
  console.log('Session path:', HAILUO_SESSION_PATH);
}
