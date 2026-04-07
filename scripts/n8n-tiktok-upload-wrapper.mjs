/**
 * scripts/n8n-tiktok-upload-wrapper.mjs
 * Node.js wrapper for n8n workflow to upload videos to TikTok via browser automation.
 *
 * Receives via CLI args:
 *   --video=<path>   Absolute path to video file
 *   --videoid=<id>   Video ID (e.g. XIANYX-01)
 *
 * Looks for caption in:
 *   scripts/pending/xianxia/<videoid>.json  → metadata.tiktok_caption
 *   scripts/pending/<videoid>.json           → caption or title field
 *
 * Usage:
 *   node scripts/n8n-tiktok-upload-wrapper.mjs --video="C:/.../captioned.mp4" --videoid=XIANYX-01
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const LOG_DIR = join(ROOT, 'logs');
const LOG_FILE = join(LOG_DIR, 'n8n-tiktok-uploads.json');

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function loadScript(videoid) {
  // Try xianxia subdirectory first
  const xianxiaPath = join(ROOT, 'scripts', 'pending', 'xianxia', `${videoid}.json`);
  if (existsSync(xianxiaPath)) {
    return JSON.parse(readFileSync(xianxiaPath, 'utf-8'));
  }
  // Try top-level pending
  const topPath = join(ROOT, 'scripts', 'pending', `${videoid}.json`);
  if (existsSync(topPath)) {
    return JSON.parse(readFileSync(topPath, 'utf-8'));
  }
  return null;
}

function getCaption(script, videoid) {
  if (!script) return `Xianxia video ${videoid} #xianxia #chinesefantasy #fyp`;
  // Prefer metadata.tiktok_caption, fall back to title + tags
  if (script.metadata?.tiktok_caption) return script.metadata.tiktok_caption;
  if (script.caption) return script.caption;
  if (script.title) {
    const tags = (script.tags || []).map(t => t.startsWith('#') ? t : `#${t}`).join(' ');
    return `${script.title} ${tags} #xianxia #fyp`;
  }
  return `Xianxia video ${videoid} #xianxia #chinesefantasy #fyp`;
}

async function run() {
  const args = process.argv.slice(2);
  let videoPath = null;
  let videoid = null;

  for (const arg of args) {
    if (arg.startsWith('--video=')) videoPath = arg.replace('--video=', '');
    if (arg.startsWith('--videoid=')) videoid = arg.replace('--videoid=', '');
  }

  if (!videoPath) {
    console.error('ERROR: --video=<path> is required');
    process.exit(1);
  }

  if (!videoid && videoPath) {
    // Extract videoid from path: content/videos/xianxia/XIANYX-01/captioned.mp4
    const match = videoPath.match(/([A-Z]+-[A-Z0-9]+)/i);
    videoid = match ? match[1].toUpperCase() : 'UNKNOWN';
  }

  log(`Starting TikTok upload via n8n workflow`);
  log(`  Video: ${videoPath}`);
  log(`  ID: ${videoid}`);

  // Load script metadata
  const script = loadScript(videoid);
  const caption = getCaption(script, videoid);
  log(`  Caption: ${caption.slice(0, 80)}...`);

  // Check session
  const sessionPath = join(ROOT, '.tiktok-session.json');
  if (!existsSync(sessionPath)) {
    log('ERROR: .tiktok-session.json not found. Run: node scripts/setup-tiktok-session.js');
    process.exit(1);
  }

  // Execute tiktok-browser.js
  const tiktokScript = join(ROOT, 'lib', 'upload', 'tiktok-browser.js');

  return new Promise((resolve) => {
    const proc = spawn('node', [
      tiktokScript,
      '--video=' + videoPath,
      '--caption=' + JSON.stringify(caption),
      '--headless=true'
    ], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      const success = code === 0;

      // Log result
      try {
        if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
        const logEntry = {
          timestamp: new Date().toISOString(),
          videoid,
          videoPath,
          caption: caption.slice(0, 100),
          success,
          exitCode: code,
          error: stderr.slice(0, 200) || null
        };
        let logs = [];
        if (existsSync(LOG_FILE)) {
          try { logs = JSON.parse(readFileSync(LOG_FILE, 'utf-8')); } catch {}
        }
        logs.push(logEntry);
        writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
      } catch {}

      // Update script status
      if (script) {
        try {
          const scriptPath = join(ROOT, 'scripts', 'pending', 'xianxia', `${videoid}.json`);
          if (existsSync(scriptPath)) {
            script.tiktok_uploaded_at = new Date().toISOString();
            script.tiktok_status = success ? 'uploaded' : 'failed';
            writeFileSync(scriptPath, JSON.stringify(script, null, 2));
          }
        } catch {}
      }

      if (success) {
        log(`Upload successful: ${videoid}`);
        resolve(0);
      } else {
        log(`Upload failed: ${stderr.slice(0, 200)}`);
        resolve(1);
      }
    });

    // 5 minute timeout
    setTimeout(() => {
      proc.kill();
      log('ERROR: Upload timed out after 5 minutes');
      resolve(1);
    }, 300_000);
  });
}

run().then(code => process.exit(code)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});