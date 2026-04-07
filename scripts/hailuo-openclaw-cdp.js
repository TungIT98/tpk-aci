/**
 * scripts/hailuo-openclaw-cdp.js
 * Hailuo video generation via OpenClaw Chrome CDP connection.
 *
 * Connects to the existing OpenClaw Chrome instance (port 18800) via
 * Chrome DevTools Protocol WebSocket — bypassing the need for session
 * setup/re-login. The OpenClaw Chrome already has Hailuo authenticated.
 *
 * Usage:
 *   node scripts/hailuo-openclaw-cdp.js --script=GZ-06
 *   node scripts/hailuo-openclaw-cdp.js --prompt="A person running..." --id=GZ-TEST
 *   node scripts/hailuo-openclaw-cdp.js --script=GZ-06 --skip-poll
 *
 * Prerequisites:
 *   - OpenClaw Chrome running at CDP port (auto-detected: 18800)
 *   - Hailuo account already logged in (via OpenClaw)
 */

import WebSocket from 'ws';
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT_DIR = resolve(ROOT, 'output', 'videos');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

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
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim().split('#')[0].trim();
      env[key] = val;
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();

// CLI args
const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [key, val] = arg.replace(/^--/, '').split('=');
    return [key, val ?? true];
  })
);

const SCRIPT_ID = args.script || null;
const PROMPT_INPUT = args.prompt || null;
const SKIP_POLL = args['skip-poll'] !== undefined;
const MAX_WAIT_MS = parseInt(args['wait'] || '600000', 10); // 10 min default
const CDP_PORT = parseInt(args['port'] || '18800', 10);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(...args) {
  console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function httpGet(url) {
  return new Promise((res, rej) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, r => {
      let data = '';
      r.on('data', d => data += d);
      r.on('end', () => res(data));
    }).on('error', rej);
  });
}

// ---------------------------------------------------------------------------
// Load script from pending folder
// ---------------------------------------------------------------------------

function loadScript(id) {
  const path = resolve(ROOT, 'scripts', 'pending', `${id}.json`);
  if (!existsSync(path)) {
    throw new Error(`Script not found: scripts/pending/${id}.json`);
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// ---------------------------------------------------------------------------
// CDP WebSocket client
// ---------------------------------------------------------------------------

class CDPClient {
  constructor(wsUrl) {
    this._wsUrl = wsUrl;
    this._ws = null;
    this._msgId = 0;
    this._pending = {};
    this._events = {};
  }

  async connect(timeout = 15000) {
    return new Promise((res, rej) => {
      this._ws = new WebSocket(this._wsUrl);
      let timer;
      const cleanup = () => { clearTimeout(timer); this._ws.removeAllListeners(); };
      timer = setTimeout(() => { cleanup(); rej(new Error('CDP connect timeout')); }, timeout);
      this._ws.on('open', () => { cleanup(); res(); });
      this._ws.on('error', e => { cleanup(); rej(e); });
      this._ws.on('message', data => this._handleMsg(JSON.parse(data.toString())));
    });
  }

  _handleMsg(msg) {
    if (msg.id !== undefined && this._pending[msg.id]) {
      const { res, rej } = this._pending[msg.id];
      delete this._pending[msg.id];
      if (msg.error) rej(new Error(JSON.stringify(msg.error)));
      else res(msg.result || {});
    } else if (msg.method) {
      // Event
      if (!this._events[msg.method]) this._events[msg.method] = [];
      this._events[msg.method].push(msg.params);
    }
  }

  on(method, cb) {
    if (!this._events[method]) this._events[method] = [];
    this._events[method].push(cb);
    // Also store as raw listener for events that already fired
  }

  // Void commands that don't return a response
  static VOID_COMMANDS = new Set([
    'Runtime.enable', 'Runtime.disable',
    'Page.enable', 'Page.disable',
    'DOM.enable', 'DOM.disable',
    'Log.enable', 'Log.disable',
    'Network.enable', 'Network.disable',
    'Input.enable', 'Input.disable',
  ]);

  async cmd(method, params = {}, timeout = 30000) {
    // For void commands, fire-and-forget
    if (CDPClient.VOID_COMMANDS.has(method)) {
      this._msgId++;
      this._ws.send(JSON.stringify({ id: this._msgId, method, params }));
      return {};
    }
    return new Promise((res, rej) => {
      this._msgId++;
      this._ws.send(JSON.stringify({ id: this._msgId, method, params }));
      const timer = setTimeout(() => {
        delete this._pending[this._msgId];
        rej(new Error(`CDP timeout: ${method}`));
      }, timeout);
      this._pending[this._msgId] = {
        res: v => { clearTimeout(timer); res(v); },
        rej: e => { clearTimeout(timer); rej(e); }
      };
    });
  }

  async eval(expr, returnByValue = true) {
    const r = await this.cmd('Runtime.evaluate', { expression: expr, returnByValue, silent: false });
    if (r.exceptionDetails) {
      throw new Error(`Eval error: ${r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)}`);
    }
    return r.result?.value;
  }

  async evalAsync(expr) {
    const r = await this.cmd('Runtime.evaluate', {
      expression: `(async () => { ${expr} })()`,
      awaitPromise: true,
      returnByValue: true
    });
    if (r.exceptionDetails) {
      throw new Error(`Eval error: ${r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)}`);
    }
    return r.result?.value;
  }

  close() {
    if (this._ws) this._ws.close();
  }
}

// ---------------------------------------------------------------------------
// Find OpenClaw Chrome CDP URL
// ---------------------------------------------------------------------------

async function findOpenClawCDPUrl(preferredPort = 18800) {
  const CDP_PORTS = [preferredPort, 9222, 9310, 9333];
  for (const port of CDP_PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (!res.ok) continue;
      const tabs = await res.json();
      // Find a Hailuo tab (or any usable page)
      const tab = tabs.find(t =>
        t.type === 'page' &&
        (t.url?.includes('hailuoai') || t.url?.includes('youtube'))
      ) || tabs.find(t => t.type === 'page');
      if (tab && tab.webSocketDebuggerUrl) {
        log(`Found Chrome CDP at port ${port}: ${tab.url}`);
        return { wsUrl: tab.webSocketDebuggerUrl, port, tab };
      }
    } catch { /* try next port */ }
  }
  throw new Error('Could not find OpenClaw Chrome CDP. Is OpenClaw running?');
}

// ---------------------------------------------------------------------------
// Hailuo CDP Generator
// ---------------------------------------------------------------------------

async function generateVideo(cdp, options = {}) {
  const { prompt, aspectRatio = '9:16', duration = 6 } = options;
  if (!prompt) throw new Error('No prompt provided');

  log('Step 1: Navigating to text-to-video page...');
  const nav = await cdp.cmd('Page.navigate', {
    url: 'https://hailuoai.video/create/text-to-video'
  }, 60000);
  log('  Navigation started, loaderId:', nav.loaderId?.slice(0, 16));

  // Wait for the SPA to render
  await sleep(6000);

  // Step 2: Check if logged in (look for Max credits)
  const creditsText = await cdp.eval(`
    (() => {
      const body = document.body.innerText || '';
      const match = body.match(/([\\d,]+)\\s*Max/);
      return match ? match[1] : null;
    })()
  `);
  log('  Max credits found:', creditsText || 'not detected');

  // Step 3: Close any modal/popup that blocks interaction
  const closedModals = await cdp.evalAsync(`
    (() => {
      const selectors = [
        '[class*="modal"] [class*="close"]',
        '.ant-modal-close',
        '[aria-label="close"]',
        '[class*="modal-close"]',
        'button[class*="close"]'
      ];
      let count = 0;
      for (const sel of selectors) {
        const btns = Array.from(document.querySelectorAll(sel));
        for (const btn of btns) {
          try { btn.click(); count++; } catch {}
        }
      }
      return count;
    })()
  `);
  if (closedModals > 0) log(`  Closed ${closedModals} modal(s)`);

  await sleep(1000);

  // Step 4: Find and fill the prompt textarea (div[contenteditable])
  log('Step 2: Filling prompt...');

  // Click on the contenteditable div to focus it
  await cdp.evalAsync(`
    (() => {
      const div = document.querySelector('div[contenteditable="true"]');
      if (div) {
        div.focus();
        // Select all and delete
        const s = window.getSelection();
        const r = document.createRange();
        r.selectNodeContents(div);
        s.removeAllRanges();
        s.addRange(r);
        document.execCommand('delete', false, null);
        return 'found';
      }
      return 'not found';
    })()
  `);
  await sleep(300);

  // Type the prompt using keyboard events
  await cdp.evalAsync(`
    (() => {
      const div = document.querySelector('div[contenteditable="true"]');
      if (!div) return false;
      // Type character by character
      const text = ${JSON.stringify(prompt)};
      div.focus();
      for (const char of text) {
        div.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: char, bubbles: true }));
        div.innerText += char;
        div.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
      }
      // Dispatch final input event
      div.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return div.innerText.length;
    })()
  `);

  const inputLen = await cdp.eval(`document.querySelector('div[contenteditable="true"]')?.innerText?.length || 0`);
  log(`  Typed ${inputLen} characters into prompt`);

  await sleep(500);

  // Step 5: Click the submit button (text = "25" credits, class = "new-color-btn-bg")
  log('Step 3: Clicking submit button...');
  await cdp.evalAsync(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => {
        const text = b.innerText?.trim();
        return text === '25' && b.className?.includes('new-color-btn-bg');
      });
      if (submitBtn) {
        submitBtn.scrollIntoView({ block: 'center' });
        submitBtn.click();
        return 'clicked';
      }
      return 'not found';
    })()
  `);
  log('  Submit clicked');

  // Step 6: Wait for generation to start — look for loading/progress indicator
  await sleep(3000);
  const startCheck = await cdp.eval(`
    JSON.stringify({
      hasSubmitBtn: Array.from(document.querySelectorAll('button')).some(b => b.innerText?.trim() === '25'),
      bodySnippet: document.body.innerText.slice(0, 300)
    })
  `);
  log('  After submit state:', startCheck?.slice(0, 200));

  return true;
}

// ---------------------------------------------------------------------------
// Wait for video completion
// ---------------------------------------------------------------------------

async function waitForVideo(cdp, maxWaitMs = MAX_WAIT_MS) {
  log(`Waiting up to ${Math.round(maxWaitMs / 60000)} min for video...`);

  const deadline = Date.now() + maxWaitMs;
  let lastState = '';
  let pollCount = 0;

  while (Date.now() < deadline) {
    pollCount++;
    await sleep(5000);

    const state = await cdp.eval(`
      JSON.stringify({
        videos: Array.from(document.querySelectorAll('video[src], a[href*=".mp4"]')).map(el => ({
          tag: el.tagName,
          src: el.src || el.href
        })).filter(v => v.src && v.src.length > 10),
        bodyText: document.body.innerText.slice(0, 200),
        hasNewVideo: document.querySelectorAll('video').length > 0,
        btns: Array.from(document.querySelectorAll('button')).map(b => b.innerText?.trim()).filter(Boolean)
      })
    `).catch(() => '{}');

    const s = JSON.parse(state || '{}');
    const elapsed = Math.round((Date.now() - (deadline - maxWaitMs)) / 1000);

    if (s.videos?.length > 0) {
      log(`  [${elapsed}s] Video found!`);
      return s.videos[0].src;
    }

    // Detect generation progress
    if (state !== lastState) {
      log(`  [${elapsed}s] ${s.bodyText?.slice(0, 150) || 'checking...'}`);
      lastState = state;
    } else if (pollCount % 12 === 0) {
      log(`  [${elapsed}s] Still waiting...`);
    }
  }

  throw new Error('Video generation timed out');
}

// ---------------------------------------------------------------------------
// Download video
// ---------------------------------------------------------------------------

async function downloadVideo(url, outputPath) {
  log(`Downloading: ${url.slice(-60)}`);
  return new Promise((res, rej) => {
    const mod = url.startsWith('https') ? https : http;
    const file = createWriteStream(outputPath);
    mod.get(url, r => {
      if (r.statusCode === 301 || r.statusCode === 302) {
        // Follow redirect
        file.close();
        return downloadVideo(r.headers.location, outputPath).then(res).catch(rej);
      }
      if (r.statusCode !== 200) {
        file.close();
        return rej(new Error(`HTTP ${r.statusCode}`));
      }
      r.pipe(file);
      file.on('finish', () => { file.close(); res(outputPath); });
      r.on('error', rej);
      file.on('error', rej);
    }).on('error', rej);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log('Hailuo OpenClaw CDP Generator');
  console.log('='.repeat(60));

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load script
  let scriptData = null;
  let prompt = PROMPT_INPUT;
  let scriptId = args.id || 'TEST';

  if (SCRIPT_ID) {
    scriptData = loadScript(SCRIPT_ID);
    scriptId = scriptData.id || SCRIPT_ID;
    prompt = prompt || scriptData.prompt_for_hailuo || scriptData.prompt || scriptData.description || '';
    if (!prompt) throw new Error(`No prompt found in ${SCRIPT_ID}.json`);
    log(`Script: ${scriptId} — ${scriptData.title || ''}`);
    log(`Prompt: ${prompt.slice(0, 80)}...`);
  } else if (prompt) {
    log(`Prompt: ${prompt.slice(0, 80)}...`);
  } else {
    console.error('Usage: --script=ID  OR  --prompt="text" [--id=name]');
    process.exit(1);
  }

  // Find CDP URL
  log(`Scanning for OpenClaw Chrome CDP...`);
  const { wsUrl } = await findOpenClawCDPUrl(CDP_PORT);
  log(`CDP WebSocket: ${wsUrl}`);

  // Connect
  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  log('Connected to Chrome via CDP!');

  // Enable domains (fire-and-forget, no response expected)
  await cdp.cmd('Runtime.enable');
  await cdp.cmd('Page.enable');
  await cdp.cmd('DOM.enable');
  log('Domains enabled');
  // Give Chrome time to set up the domains before sending navigate
  await sleep(2000);

  // Generate
  try {
    await generateVideo(cdp, { prompt });

    if (SKIP_POLL) {
      log('Skipping poll (--skip-poll)');
      await cdp.close();
      return;
    }

    // Wait for video
    const videoSrc = await waitForVideo(cdp);

    // Download
    const outputPath = resolve(OUTPUT_DIR, `${scriptId}.mp4`);
    await downloadVideo(videoSrc, outputPath);
    log(`\n✓ Video saved: ${outputPath}`);

    // Update script JSON
    if (scriptData) {
      scriptData.video_path = outputPath;
      scriptData.generated_at = new Date().toISOString();
      writeFileSync(resolve(ROOT, 'scripts', 'pending', `${SCRIPT_ID}.json`),
        JSON.stringify(scriptData, null, 2));
      log('Script JSON updated');
    }

  } finally {
    await cdp.close();
  }
}

main().catch(e => {
  console.error('\nERROR:', e.message);
  process.exit(1);
});
