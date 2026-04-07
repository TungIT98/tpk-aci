/**
 * scripts/n8n-tiktok-upload-server.mjs
 * Tiny HTTP server that n8n calls to trigger TikTok uploads.
 *
 * POST /upload
 * Body: { "videoPath": "...", "videoid": "XIANYX-01" }
 * Response: { "success": true/false, "error": "..." }
 *
 * Listens on port 5676 to avoid conflict with n8n (5678).
 *
 * Usage:
 *   node scripts/n8n-tiktok-upload-server.mjs
 *   # Then start n8n workflow
 */

import { createServer } from 'http';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PORT = process.env.UPLOAD_PORT || 5676;
const LOG_DIR = join(ROOT, 'logs');
const LOG_FILE = join(LOG_DIR, 'n8n-tiktok-uploads.json');

function log(...args) {
  console.log(`[${new Date().toISOString()}] [upload-server]`, ...args);
}

function loadScript(videoid) {
  const xianxiaPath = join(ROOT, 'scripts', 'pending', 'xianxia', `${videoid}.json`);
  if (existsSync(xianxiaPath)) {
    return JSON.parse(readFileSync(xianxiaPath, 'utf-8'));
  }
  const topPath = join(ROOT, 'scripts', 'pending', `${videoid}.json`);
  if (existsSync(topPath)) {
    return JSON.parse(readFileSync(topPath, 'utf-8'));
  }
  return null;
}

function getCaption(script, videoid) {
  if (!script) return `Xianxia video ${videoid} #xianxia #chinesefantasy #fyp`;
  if (script.metadata?.tiktok_caption) return script.metadata.tiktok_caption;
  if (script.caption) return script.caption;
  if (script.title) {
    const tags = (script.tags || []).map(t => t.startsWith('#') ? t : `#${t}`).join(' ');
    return `${script.title} ${tags} #xianxia #fyp`;
  }
  return `Xianxia video ${videoid} #xianxia #chinesefantasy #fyp`;
}

async function handleUpload(body) {
  const { videoPath, videoid } = body;

  if (!videoPath) {
    return { success: false, error: 'videoPath is required' };
  }

  const id = videoid || (() => {
    const m = videoPath.match(/([A-Z]+-[A-Z0-9]+)/i);
    return m ? m[1].toUpperCase() : 'UNKNOWN';
  })();

  log(`Upload request: ${id} -> ${videoPath}`);

  const script = loadScript(id);
  const caption = getCaption(script, id);
  const sessionPath = join(ROOT, '.tiktok-session.json');

  if (!existsSync(sessionPath)) {
    return { success: false, error: '.tiktok-session.json not found. Run: node scripts/setup-tiktok-session.js' };
  }

  // Run upload asynchronously, don't wait
  runUpload(videoPath, caption, id, script);

  return { success: true, videoid: id, caption: caption.slice(0, 80) };
}

function runUpload(videoPath, caption, videoid, script) {
  const tiktokScript = join(ROOT, 'lib', 'upload', 'tiktok-browser.js');

  const proc = spawn('node', [
    tiktokScript,
    '--video=' + videoPath,
    '--caption=' + JSON.stringify(caption),
    '--headless=true'
  ], {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let stderr = '';

  proc.stderr.on('data', (data) => { stderr += data.toString(); });

  proc.on('close', (code) => {
    const success = code === 0;
    log(`Upload ${success ? 'SUCCESS' : 'FAILED'} (${code}): ${videoid}`);

    // Log to file
    try {
      if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
      const logEntry = {
        timestamp: new Date().toISOString(),
        videoid, videoPath,
        success, exitCode: code,
        error: success ? null : stderr.slice(0, 200)
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
  });
}

const server = createServer(async (req, res) => {
  // CORS headers for n8n
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/upload') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        handleUpload(data).then(result => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  log(`TikTok upload server listening on port ${PORT}`);
  log(`POST http://localhost:${PORT}/upload`);
  log(`GET  http://localhost:${PORT}/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    log(`Port ${PORT} is already in use. Server not started.`);
  } else {
    log('Server error:', err.message);
  }
});