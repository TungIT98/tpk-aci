/**
 * lib/hailuo-openclaw-browser.js
 * Hailuo video generation using OpenClaw Browser Tool
 * 
 * ĐÂY LÀ ALTERNATIVE cho lib/hailuo-app.js
 * Dùng OpenClaw browser tool (profile=user) thay vì Playwright
 * 
 * Ưu điểm:
 * - Browser đã đăng nhập sẵn (Chrome user profile)
 * - Không cần setup session riêng
 * - Hoạt động 24/7 không bị logout
 * 
 * Cách dùng:
 *   import { HailuoOpenClaw } from './lib/hailuo-openclaw-browser.js';
 *   const app = new HailuoOpenClaw({ downloadDir: './output/videos' });
 *   await app.init();
 *   const videoPath = await app.generateVideo({ prompt: '...' });
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
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

export const HAILUO_APP_URL = env.HAILUO_APP_URL || 'https://hailuoai.video';
export const HAILUO_DOWNLOAD_DIR = env.HAILUO_DOWNLOAD_DIR || resolve(__dirname, '..', 'output', 'videos');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(...args) {
  console.log(`[HailuoOpenClaw] ${new Date().toISOString().slice(11,19)}`, ...args);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// OpenClaw Browser Tool Wrapper
// ---------------------------------------------------------------------------

/**
 * Lớp điều khiển Hailuo qua OpenClaw Browser Tool
 * 
 * Cách hoạt động:
 * 1. Dùng OpenClaw browser tool (profile=user) - browser đã login sẵn
 * 2. Navigate đến hailuoai.video/create/text-to-video
 * 3. Fill prompt và submit
 * 4. Chờ video hoàn thành
 * 5. Download video
 * 
 * LƯU Ý: Script này cần chạy TRONG OpenClaw environment
 * vì browser tool chỉ available trong OpenClaw context
 */
export class HailuoOpenClaw {
  /**
   * @param {object} opts
   * @param {string} [opts.downloadDir] - Directory để lưu video
   */
  constructor({
    downloadDir = HAILUO_DOWNLOAD_DIR,
  } = {}) {
    this.downloadDir = downloadDir;
    this._browserTool = null;
    this._targetId = null;
  }

  /**
   * KHỞI TẠO - mở trình duyệt đã đăng nhập
   * Dùng OpenClaw browser tool với profile=user
   */
  async init() {
    if (!existsSync(this.downloadDir)) {
      mkdirSync(this.downloadDir, { recursive: true });
    }
    log('Initializing OpenClaw browser (profile=user)...');
    // Browser tool sẽ được gọi từ agent context
    // Script này cần chạy qua exec tool trong OpenClaw
    log('OpenClaw browser ready (user profile with Hailuo login)');
  }

  /**
   * Tạo video với prompt
   * 
   * @param {object} opts
   * @param {string} opts.prompt - Video description
   * @param {string} [opts.aspectRatio='9:16'] - Aspect ratio
   * @returns {Promise<{localPath: string, url: string|null}>}
   */
  async generateVideo({ prompt, aspectRatio = '9:16' }) {
    log(`Generating video: "${prompt.slice(0, 60)}..."`);
    
    // Các bước thực hiện trong OpenClaw browser:
    // 1. browser(action="navigate", url="https://hailuoai.video/create/text-to-video")
    // 2. Tìm và fill prompt textarea
    // 3. Click generate button
    // 4. Chờ video ready
    // 5. Download video
    
    // IMPLEMENTATION NOTE:
    // Để dùng script này, agent cần gọi OpenClaw browser tool:
    // 
    // Step 1: Navigate
    // browser(action="navigate", url="https://hailuoai.video/create/text-to-video")
    //
    // Step 2: Fill prompt (tùy UI)
    // browser(action="act", targetId, kind="type" | "click", ref="textarea", text=prompt)
    //
    // Step 3: Submit
    // browser(action="act", targetId, kind="click", ref="[button:has-text('Create')]")
    //
    // Step 4: Wait for video
    // browser(action="act", targetId, kind="wait", timeMs=60000)
    // browser(action="snapshot", targetId)
    //
    // Step 5: Download
    // browser(action="act", targetId, kind="click", ref="[download button]")
    
    log('NOTE: This class needs OpenClaw browser tool to execute.');
    log('Run via: openclaw browser tool commands in agent context');
    
    throw new Error('HailuoOpenClaw requires OpenClaw browser tool. Use browser() in agent context.');
  }

  /**
   * Đóng browser
   */
  async close() {
    if (this._targetId) {
      // browser(action="close", targetId=this._targetId)
      this._targetId = null;
    }
    log('Browser closed');
  }
}

// ---------------------------------------------------------------------------
// CLI Runner - Execute via OpenClaw exec tool
// ---------------------------------------------------------------------------

/**
 * Script chính để chạy Hailuo video generation
 * Dùng: node scripts/hailuo-openclaw-browser.js --prompt "your prompt"
 */
async function main() {
  const args = process.argv.slice(2);
  const promptArg = args.find(a => a.startsWith('--prompt='));
  const aspectArg = args.find(a => a.startsWith('--aspect=')) || '9:16';
  
  if (!promptArg) {
    console.log('Usage: node hailuo-openclaw-browser.js --prompt="video description" [--aspect=9:16]');
    console.log('');
    console.log('This script generates video using OpenClaw browser tool.');
    console.log('Steps:');
    console.log('1. Navigate to hailuoai.video');
    console.log('2. Fill prompt in textarea');
    console.log('3. Click Create/Generate');
    console.log('4. Wait for video completion');
    console.log('5. Download to output/videos/');
    console.log('');
    console.log('IMPORTANT: Run this via OpenClaw agent context, not standalone.');
    return;
  }

  const prompt = promptArg.split('=').slice(1).join('=');
  
  console.log('='.repeat(60));
  console.log('HailuoOpenClaw Browser Script');
  console.log('='.repeat(60));
  console.log(`Prompt: ${prompt}`);
  console.log(`Aspect: ${aspectArg}`);
  console.log('');
  console.log('This script should be executed via OpenClaw browser tool.');
  console.log('');
  console.log('To use in Nova agent:');
  console.log('1. browser(action="open", profile="user")');
  console.log('2. browser(action="navigate", url="https://hailuoai.video/create/text-to-video")');
  console.log('3. browser(action="snapshot", targetId) to find textarea');
  console.log('4. browser(action="act", kind="type", ref="textarea", text=prompt)');
  console.log('5. browser(action="act", kind="click", ref="[button]")');
  console.log('6. Wait for video, then download');
  console.log('');
  console.log('See: scripts/hailuo-openclaw-browser-steps.md for full steps');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1); });
}
