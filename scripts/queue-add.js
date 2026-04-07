#!/usr/bin/env node
/**
 * scripts/queue-add.js — Add a video to the upload queue
 *
 * Usage:
 *   node scripts/queue-add.js <videoPath> <platforms> [title] [description]
 *
 * Examples:
 *   node scripts/queue-add.js output/vid-001.mp4 tiktok,youtube "My Video Title" "Description"
 *   node scripts/queue-add.js output/vid-001.mp4 tiktok,youtube,instagram,linkedin
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const QUEUE_FILE = resolve(ROOT, 'uploads', 'queue.json');

function loadQueue() {
  try {
    return JSON.parse(readFileSync(QUEUE_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  if (!existsSync(resolve(ROOT, 'uploads'))) {
    mkdirSync(resolve(ROOT, 'uploads'), { recursive: true });
  }
  writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
}

const [,, videoPath, platformsStr, title, description] = process.argv;

if (!videoPath || !platformsStr) {
  console.log(`Usage: node scripts/queue-add.js <videoPath> <platforms> [title] [description]

  platforms: comma-separated: tiktok,youtube,instagram,linkedin

Examples:
  node scripts/queue-add.js output/vid-001.mp4 tiktok "How I 10x'd Productivity"
  node scripts/queue-add.js output/vid-001.mp4 tiktok,youtube,instagram,linkedin`);
  process.exit(1);
}

const platforms = platformsStr.split(',').map(p => p.trim().toLowerCase());
const validPlatforms = ['tiktok', 'youtube', 'instagram', 'linkedin'];
const invalid = platforms.filter(p => !validPlatforms.includes(p));
if (invalid.length) {
  console.error('Invalid platforms:', invalid, '— valid:', validPlatforms.join(', '));
  process.exit(1);
}

const id = `vid-${Date.now()}`;
const job = {
  id,
  videoPath: resolve(ROOT, videoPath),
  platforms,
  metadata: {
    title: title || `Video ${id}`,
    description: description || '',
    tags: [],
  },
  status: 'pending',
  createdAt: new Date().toISOString(),
};

const queue = loadQueue();
queue.push(job);
saveQueue(queue);
console.log(`Added ${id} to queue for ${platforms.join(', ')}`);
console.log(`Queue now has ${queue.length} pending upload(s).`);
console.log(`Run 'node scripts/publish.js' to execute.`);
