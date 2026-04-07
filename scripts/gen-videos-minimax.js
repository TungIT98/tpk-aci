/**
 * scripts/gen-videos-minimax.js
 * Generate 6 videos using MiniMax API.
 * 
 * API:
 * POST /v1/video_generation { model, prompt, duration, resolution }
 * GET  /v1/query/video_generation?task_id=xxx → { status, file_id }
 * GET  /v1/files/retrieve?file_id=xxx → { file: { download_url } }
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function stripBOM(str) {
  if (str.charCodeAt(0) === 0xFEFF) return str.slice(1);
  return str;
}

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  try {
    const lines = stripBOM(readFileSync(envPath, 'utf-8')).split('\n');
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
const API_KEY = env.ANTHROPIC_TOKEN_KEY;

function log(...args) {
  console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args);
}

const SCRIPTS = ['AESTH-01', 'COM-01', 'LIFE-01', 'MOT-01', 'MOVIE-01', 'TECH-01'];
const SCRIPT_DIR = resolve(ROOT, 'scripts', 'pending');
const OUTPUT_DIR = resolve(ROOT, 'output', 'videos');
const MODEL = 'MiniMax-Hailuo-2.3';
const DURATION = 6;
const RESOLUTION = '768P';

function api(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.minimax.io', path, method,
      headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' }
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('JSON parse error: ' + d.slice(0,100))); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function downloadFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'GET' };
    const req = https.request(options, (res) => {
      if (res.statusCode >= 400) { reject(new Error('HTTP ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        writeFileSync(outPath, buf);
        resolve(buf.length);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function createVideo(prompt) {
  return api('/v1/video_generation', 'POST', {
    model: MODEL, prompt: prompt.slice(0, 2000),
    duration: DURATION, resolution: RESOLUTION, prompt_optimizer: false,
  });
}

async function queryVideo(taskId) {
  return api('/v1/query/video_generation?task_id=' + taskId);
}

async function getDownloadUrl(fileId) {
  return api('/v1/files/retrieve?file_id=' + fileId);
}

async function waitForVideo(taskId) {
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    const result = await queryVideo(taskId);
    if (result.base_resp?.status_code !== 0) throw new Error('API error: ' + result.base_resp?.status_msg);
    if (result.status === 'Success') return result;
    if (result.status === 'Fail') throw new Error('Generation failed');
    const elapsed = Math.round((Date.now() - (deadline - 15 * 60 * 1000)) / 1000);
    log(`  [${elapsed}s] ${result.status}`);
    await new Promise(r => setTimeout(r, 10000));
  }
  throw new Error('Timeout (>15min)');
}

async function generateVideo(scriptId, prompt) {
  const filename = `${scriptId}.mp4`;
  const outputPath = resolve(OUTPUT_DIR, filename);
  
  // Create task
  log(`Creating video task: ${scriptId}`);
  const create = await createVideo(prompt);
  if (create.base_resp?.status_code !== 0) throw new Error(create.base_resp?.status_msg);
  const taskId = create.task_id;
  log(`  task_id: ${taskId}`);
  
  // Wait for completion
  const result = await waitForVideo(taskId);
  log(`  Done! file_id: ${result.file_id} (${result.video_width}x${result.video_height})`);
  
  // Get download URL
  const fileInfo = await getDownloadUrl(result.file_id);
  if (fileInfo.base_resp?.status_code !== 0) throw new Error('File info failed: ' + fileInfo.base_resp?.status_msg);
  const downloadUrl = fileInfo.file?.download_url;
  if (!downloadUrl) throw new Error('No download URL in response');
  
  // Download
  log(`  Downloading...`);
  const size = await downloadFile(downloadUrl, outputPath);
  log(`  Downloaded ${(size/1024/1024).toFixed(1)}MB → ${outputPath}`);
  
  return { taskId, fileId: result.file_id, size, path: outputPath };
}

async function main() {
  log('=== TKP-135: MiniMax API Video Generation ===');
  log(`Model: ${MODEL} | ${DURATION}s | ${RESOLUTION}`);
  
  if (!API_KEY) { log('ERROR: No API key'); process.exit(1); }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = [];
  
  for (const scriptId of SCRIPTS) {
    const scriptPath = resolve(SCRIPT_DIR, `${scriptId}.json`);
    const script = JSON.parse(stripBOM(readFileSync(scriptPath, 'utf-8')));
    
    if (script.status === 'produced' || script.status === 'published') {
      log(`Skipping ${scriptId} (status: ${script.status})`);
      continue;
    }
    
    log(`\n${'='.repeat(50)}`);
    log(`Processing: ${scriptId}`);
    
    const prompt = script.prompt_for_hailuo;
    
    try {
      const startTime = Date.now();
      const { taskId, fileId, size, path } = await generateVideo(scriptId, prompt);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      
      // Quick hash
      const { createHash } = await import('crypto');
      const sample = readFileSync(path).slice(0, 65536);
      const hash = createHash('md5').update(sample).digest('hex');
      
      script.status = 'produced';
      script.local_path = path;
      script.video_url = fileId;
      script.generated_at = new Date().toISOString();
      script.api_task_id = taskId;
      script.hash_64k = hash;
      writeFileSync(scriptPath, JSON.stringify(script, null, 2));
      
      results.push({ id: scriptId, status: 'success', path, sizeMb: (size/1024/1024).toFixed(1), hash, taskId, fileId, elapsed_s: elapsed });
      log(`  ✓ ${scriptId} done in ${elapsed}s (${(size/1024/1024).toFixed(1)}MB, hash=${hash.slice(0,8)})`);
      
    } catch (e) {
      log(`  ✗ ${scriptId} FAILED: ${e.message}`);
      script.status = 'error';
      script.error = e.message;
      script.error_at = new Date().toISOString();
      writeFileSync(scriptPath, JSON.stringify(script, null, 2));
      results.push({ id: scriptId, status: 'error', error: e.message });
    }
  }

  // Summary
  log('\n' + '='.repeat(50));
  log('SUMMARY');
  const success = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'error');
  log(`Total: ${results.length} | Success: ${success.length} | Failed: ${failed.length}`);
  for (const r of results) {
    if (r.status === 'success') log(`  ✓ ${r.id} ${r.sizeMb}MB hash=${r.hash?.slice(0,8)} ${r.elapsed_s}s`);
    else log(`  ✗ ${r.id} → ${r.error}`);
  }
  
  const uniqueHashes = [...new Set(success.map(r => r.hash))];
  log(`\nUnique video hashes: ${uniqueHashes.length} / ${success.length}`);
  if (uniqueHashes.length < success.length && success.length > 1) log('⚠️  Duplicate videos detected!');

  const reportPath = resolve(ROOT, 'output', 'TKP-135-minimax-report.json');
  writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  log(`Report: ${reportPath}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => { log('CRASH:', err.message); process.exit(1); });
