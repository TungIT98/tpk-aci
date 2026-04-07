#!/usr/bin/env node
/**
 * scripts/publish.js — Upload scheduler runner
 *
 * Reads pending uploads from uploads/queue.json and executes them.
 * Run via cron or manually:  node scripts/publish.js [--dry-run]
 *
 * Queue format (uploads/queue.json):
 * [
 *   {
 *     "id": "vid-001",
 *     "videoPath": "output/vid-001.mp4",
 *     "platforms": ["tiktok", "youtube"],
 *     "metadata": {
 *       "title": "How I 10x'd My Productivity",
 *       "description": "...",
 *       "tags": ["productivity", "focus"]
 *     },
 *     "status": "pending",
 *     "createdAt": "2026-03-25T12:00:00Z"
 *   }
 * ]
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const QUEUE_FILE = resolve(ROOT, 'uploads', 'queue.json');
const LOG_FILE = resolve(ROOT, 'uploads', 'upload.log.md');

function loadQueue() {
  try {
    return JSON.parse(readFileSync(QUEUE_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
}

function log(msg) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] ${msg}`;
  console.log(entry);
  const existing = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, 'utf-8') : '';
  writeFileSync(LOG_FILE, existing + entry + '\n', 'utf-8');
}

async function uploadOne(job, platform) {
  const { UploadDispatcher } = await import('../lib/upload/index.js');
  const dispatcher = new UploadDispatcher();
  const start = Date.now();
  try {
    const result = await dispatcher.upload({
      platform,
      videoPath: job.videoPath,
      metadata: job.metadata,
    });
    const ms = Date.now() - start;
    log(`SUCCESS ${platform} ${job.id} ${job.videoPath} ${ms}ms → ${JSON.stringify(result)}`);
    return { platform, status: 'success', result, ms };
  } catch (err) {
    const ms = Date.now() - start;
    log(`FAILED ${platform} ${job.id} ${err.message} (${ms}ms)`);
    return { platform, status: 'failed', error: err.message, ms };
  }
}

async function processQueue(dryRun = false) {
  const queue = loadQueue();
  const pending = queue.filter(j => j.status === 'pending');
  if (pending.length === 0) {
    console.log('No pending uploads.');
    return;
  }
  console.log(`Processing ${pending.length} pending upload(s)...`);

  for (const job of pending) {
    console.log(`\nJob: ${job.id} → ${job.videoPath}`);
    if (!existsSync(job.videoPath)) {
      log(`SKIP ${job.id} file not found: ${job.videoPath}`);
      job.status = 'failed';
      job.error = 'File not found';
      continue;
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would upload to: ${job.platforms.join(', ')}`);
      continue;
    }

    job.status = 'in_progress';
    job.startedAt = new Date().toISOString();
    saveQueue(queue);

    const results = [];
    for (const platform of job.platforms) {
      results.push(await uploadOne(job, platform));
    }

    const allSuccess = results.every(r => r.status === 'success');
    job.status = allSuccess ? 'published' : 'partial';
    job.results = results;
    job.completedAt = new Date().toISOString();
    saveQueue(queue);

    const summary = results.map(r => `${r.platform}:${r.status}`).join(' ');
    console.log(`Result: ${job.id} ${summary}`);
  }
}

const dryRun = process.argv.includes('--dry-run');
processQueue(dryRun).catch(err => {
  console.error('Queue processor error:', err);
  process.exit(1);
});
