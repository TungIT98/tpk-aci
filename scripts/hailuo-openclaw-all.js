/**
 * hailuo-openclaw-all.js
 * Generate ALL 6 topic videos (AESTH-01, TECH-01, COM-01, LIFE-01, MOT-01, MOVIE-01)
 * using OpenClaw Browser via CDP WebSocket.
 * 
 * Connects to the OpenClaw gateway's CDP WebSocket to control the browser.
 * For each script:
 *   1. Navigate to hailuo create page
 *   2. Fill prompt
 *   3. Submit and wait for completion
 *   4. Extract video URL from page DOM
 *   5. Download video
 *
 * Usage: node scripts/hailuo-openclaw-all.js
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import WebSocket from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

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
const OUTPUT_DIR = resolve(ROOT, 'output_topic', 'videos');
mkdirSync(OUTPUT_DIR, { recursive: true });

const SCRIPTS = [
  { id: 'AESTH-01', file: 'AESTH-01.json', topic: 'Aesthetic' },
  { id: 'TECH-01',  file: 'TECH-01.json',  topic: 'Tech' },
  { id: 'COM-01',   file: 'COM-01.json',   topic: 'Comedy' },
  { id: 'LIFE-01',  file: 'LIFE-01.json',  topic: 'Lifestyle' },
  { id: 'MOT-01',   file: 'MOT-01.json',   topic: 'Motivation' },
  { id: 'MOVIE-01', file: 'MOVIE-01.json', topic: 'Movie' },
];

function loadScript(file) {
  const path = resolve(ROOT, 'scripts', 'pending', file);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function runCmd(cmd, opts = {}) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8', timeout: opts.timeout || 30000, ...opts });
  } catch (e) { return e.stdout || e.message || ''; }
}

/**
 * Connect to OpenClaw gateway's CDP WebSocket and execute a function.
 * Returns the CDP connection info.
 */
async function getGatewayCdpUrl() {
  // Read gateway config to find the CDP port/URL
  const configPath = resolve(ROOT, '..', '..', '..', '.openclaw', 'gateway.yml');
  // The gateway runs a CDP WebSocket at a specific port
  // Default: ws://127.0.0.1:9222 (Chrome DevTools Protocol)
  // Or we can use the browser tool's CDP WebSocket
  return null; // Not straightforward without gateway config
}

async function main() {
  console.log('=== Hailuo OpenClaw Video Generator ===\n');
  
  // Load all scripts
  const pending = [];
  for (const s of SCRIPTS) {
    const script = loadScript(s.file);
    if (!script) { console.error(`Not found: ${s.file}`); continue; }
    const prompt = script.prompt_for_hailuo || script.description || '';
    if (!prompt) { console.error(`No prompt: ${s.file}`); continue; }
    pending.push({ id: s.id, topic: s.topic, prompt, title: script.title });
    console.log(`- ${s.id}: ${prompt.slice(0, 80)}...`);
  }
  console.log(`\n${pending.length} scripts to generate.\n`);

  // The automation requires the OpenClaw gateway's CDP WebSocket.
  // This script needs to be run via OpenClaw agent context (using sessions_spawn).
  // For standalone use, we need the gateway WebSocket URL.
  
  // Save pending list
  const pendingPath = resolve(OUTPUT_DIR, '..', 'pending_scripts.json');
  writeFileSync(pendingPath, JSON.stringify(pending, null, 2));
  console.log(`Pending list saved to: ${pendingPath}`);
  console.log('\nTo run this, use sessions_spawn with the OpenClaw agent.\n');

  // Try to get gateway WS URL from environment
  const gatewayWs = process.env.OPENCLAW_GATEWAY_WS || process.env.OPENCLAW_CDP_URL;
  if (gatewayWs) {
    console.log(`Gateway WS: ${gatewayWs}`);
  } else {
    console.log('No gateway WS URL found in environment.');
  }

  // Try connecting to default CDP port
  const CDP_PORTS = [9222, 9310, 9333];
  for (const port of CDP_PORTS) {
    try {
      const ws = new WebSocket(`http://127.0.0.1:${port}/json`);
      await new Promise((res, rej) => {
        ws.on('open', () => { ws.close(); res(); });
        ws.on('error', () => rej());
      });
      console.log(`CDP port found: ${port}`);
    } catch {}
  }

  console.log('\nNote: This script needs to connect to the OpenClaw browser.');
  console.log('Run via: sessions_spawn with runtime="subagent" or use sessions_send to the main session.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
