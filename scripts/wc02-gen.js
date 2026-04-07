#!/usr/bin/env node
/**
 * Quick WC-02 video generation script
 * Uses the Hailuo web session to create a video
 */

import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  try {
    const lines = require('fs').readFileSync(envPath, 'utf-8').split('\n');
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
const SESSION_PATH = env.HAILUO_SESSION_PATH || resolve(ROOT, '.hailuo-session.json');

const WC02_PROMPT = `Young woman with long dark hair, dark casual hoodie, standing in a packed lively sports bar watching a World Cup match on a big screen. Static shot, low angle, bar lights dim with screen glow. Tension builds - everyone on their feet - she grips the edge of the bar, mouth open, eyes wide. Tracking shot moving across row of tense fans. Goal is scored - she whips around, throws both arms up, screams with abandon. Push in on her face, pure shock turning to euphoria. Second clip: drinks are flying, high fives everywhere, she is hugging the stranger next to her mid-air. Tracking shot following chaotic celebration. Neon bar signs glow, screens flash the score, confetti poppers burst. Pull out to wide shot of entire bar celebrating. Modern sports bar, night game atmosphere, cinematic lighting, 9:16 portrait.`;

function log(...args) {
  console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  log('Starting WC-02 video generation...');
  
  // Import Playwright
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch(e) {
    log('Playwright not available:', e.message);
    process.exit(1);
  }
  
  // Check session
  if (!existsSync(SESSION_PATH)) {
    log('ERROR: No session file found at', SESSION_PATH);
    process.exit(1);
  }
  
  log('Loading session from', SESSION_PATH);
  const storageState = JSON.parse(require('fs').readFileSync(SESSION_PATH, 'utf-8'));
  
  // Launch browser with saved session
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    storageState: storageState,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  
  const page = (await context.pages())[0] || await context.newPage();
  log('Browser launched');
  
  // Navigate to create page
  await page.goto('https://hailuoai.video/create/image-to-video', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  
  log('Page URL:', page.url());
  
  // Find the prompt input
  const textarea = await page.locator('textarea, div[contenteditable="true"], [contenteditable="true"]').first();
  const tagName = await textarea.evaluate(el => el.tagName);
  log('Prompt input tag:', tagName);
  
  // Fill the prompt
  await textarea.click();
  await sleep(500);
  
  if (tagName === 'DIV') {
    await textarea.evaluate((el, text) => {
      el.textContent = text;
      el.innerHTML = '<p>' + text + '</p>';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, WC02_PROMPT);
    log('Prompt filled (contenteditable)');
  } else {
    await textarea.fill(WC02_PROMPT);
    log('Prompt filled (textarea/input)');
  }
  
  await sleep(1000);
  
  // Find and click submit button
  const createBtn = page.locator('button').filter({ hasText: /25|创建|生成|Create|Generate/i }).first();
  const btnText = await createBtn.innerText().catch(() => 'not found');
  log('Create button text:', btnText.trim());
  
  await createBtn.click();
  log('Create button clicked');
  
  // Wait for submission
  await sleep(5000);
  
  // Check URL or page state
  const url = page.url();
  log('URL after submit:', url);
  
  // Take a screenshot
  const screenshotPath = resolve(ROOT, 'output', 'wc02-screenshot.png');
  mkdirSync(resolve(ROOT, 'output'), { recursive: true });
  await page.screenshot({ path: screenshotPath });
  log('Screenshot saved to', screenshotPath);
  
  // Check network requests
  log('Checking for video generation...');
  
  await context.close();
  log('Done!');
}

main().catch(e => {
  log('ERROR:', e.message);
  process.exit(1);
});
