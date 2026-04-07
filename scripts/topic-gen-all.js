/**
 * topic-gen-all.js
 * Generate AESTH-01, TECH-01, COM-01, LIFE-01, MOT-01, MOVIE-01 using OpenClaw browser.
 * Uses CDP (Chrome DevTools Protocol) via the OpenClaw browser session.
 * 
 * For each script:
 *   1. Fill prompt in Hailuo create page
 *   2. Submit
 *   3. Wait for completion
 *   4. Extract video URL from page
 *   5. Download video
 *
 * Usage: node scripts/topic-gen-all.js
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT_BASE = resolve(ROOT, 'outputs_topic');
const DOWNLOAD_DIR = resolve(ROOT, 'output_topic', 'videos');
const HAILUO_URL = 'https://hailuoai.video/create/text-to-video';
const POLL_INTERVAL = 10000; // 10s

mkdirSync(OUTPUT_BASE, { recursive: true });
mkdirSync(DOWNLOAD_DIR, { recursive: true });

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
      const rawVal = t.slice(eq + 1).trim();
      const val = rawVal.split('#')[0].trim();
      env[key] = val;
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();

// Scripts to generate
const SCRIPTS = [
  { id: 'AESTH-01', file: 'AESTH-01.json' },
  { id: 'TECH-01',  file: 'TECH-01.json'  },
  { id: 'COM-01',   file: 'COM-01.json'   },
  { id: 'LIFE-01',  file: 'LIFE-01.json'  },
  { id: 'MOT-01',   file: 'MOT-01.json'   },
  { id: 'MOVIE-01', file: 'MOVIE-01.json'  },
];

function loadScript(id, file) {
  const path = resolve(ROOT, 'scripts', 'pending', file);
  if (!existsSync(path)) {
    console.error(`Script not found: ${path}`);
    return null;
  }
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  // Extract prompt_for_hailuo or use the full prompt
  return {
    id,
    prompt: data.prompt_for_hailuo || data.description || data.prompt,
    title: data.title,
  };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function runCmd(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8', timeout: 30000 });
  } catch (e) { return e.stdout || e.message; }
}

function extractVideoUrl(text) {
  // Look for MP4 URLs in page text
  const matches = text.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/g);
  if (matches) return matches[0];
  return null;
}

async function downloadFile(url, destPath) {
  console.log(`  Downloading from CDN...`);
  try {
    execSync(`curl -L -o "${destPath}" "${url}"`, { stdio: 'pipe', timeout: 120000 });
    const size = parseFloat(execSync(`powershell -Command "(Get-Item '${destPath}').Length / 1MB"`, { stdio: 'pipe' }).toString().trim());
    console.log(`  Downloaded: ${size.toFixed(1)} MB -> ${destPath}`);
    return size > 0.01;
  } catch (e) {
    console.error(`  Download failed: ${e.message.slice(0, 100)}`);
    return false;
  }
}

/**
 * Inject and run a CDP script in the OpenClaw browser session.
 * Uses the browser's existing tab target.
 */
async function cdpEval(script, targetId) {
  // The browser tool's evaluate action uses Chrome DevTools CDP
  // We invoke it via the browser tool's act with fn parameter
  // Since we can't use the browser tool from here, we write a script file
  // that uses the OpenClaw gateway's CDP WebSocket
  throw new Error('CDP eval not available from Node.js - use browser tool directly');
}

async function main() {
  console.log('=== Topic Videos Generator (OpenClaw Browser) ===\n');
  console.log(`Output dir: ${OUTPUT_BASE}`);
  console.log(`Download dir: ${DOWNLOAD_DIR}\n`);

  const results = [];

  // For each script, we need to use the OpenClaw browser tool.
  // Since we can't use browser tool from Node.js exec, we output instructions
  // that the next heartbeat can follow.
  
  // Check if we have a browser session running
  // If yes, we can automate Hailuo via the hailuo-openclaw-browser.js library
  // For now, we'll just output the scripts that need to be run
  
  const pending = [];
  for (const s of SCRIPTS) {
    const script = loadScript(s.id, s.file);
    if (!script) {
      results.push({ id: s.id, status: 'script_not_found' });
      continue;
    }
    if (!script.prompt) {
      results.push({ id: s.id, status: 'no_prompt' });
      continue;
    }
    pending.push({ ...s, ...script });
    console.log(`- ${s.id}: ${script.prompt.slice(0, 80)}...`);
  }

  console.log(`\n${pending.length} scripts to generate.\n`);
  console.log('NOTE: Run these using the OpenClaw browser tool (profile=user) in the next heartbeat.');
  console.log('The hailuo-openclaw-browser.js library can be used for automation.\n');

  // Save pending list for next session
  const pendingPath = resolve(ROOT, 'outputs_topic', 'pending.json');
  writeFileSync(pendingPath, JSON.stringify(pending, null, 2));
  console.log(`Pending list saved to: ${pendingPath}`);

  return results;
}

main().catch(e => { console.error(e); process.exit(1); });
