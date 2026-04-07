#!/usr/bin/env node
/**
 * scripts/tiktok-upload-all.js
 * Upload all 10 pilot videos to TikTok in one shot.
 * Requires: TIKTOK_ACCESS_TOKEN in .env (complete OAuth first via scripts/oauth-tiktok.js)
 *
 * Usage: node scripts/tiktok-upload-all.js
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const env = {};
  for (const line of readFileSync(resolve(ROOT, '.env'), 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();

if (!env.TIKTOK_ACCESS_TOKEN) {
  console.error('ERROR: TIKTOK_ACCESS_TOKEN not found in .env');
  console.error('Complete OAuth first:');
  console.error('  node scripts/oauth-tiktok.js --url');
  console.error('  # Visit URL → authorize → copy ?code= from redirect');
  console.error('  node scripts/oauth-tiktok.js <code>');
  process.exit(1);
}

const { uploadVideo } = await import('../lib/upload/tiktok.js');

const videos = [
  { file: 'outputs/PW-01/final.mp4',   title: 'Boost Your Productivity: 5 Science-Backed Techniques That Actually Work',    channel: 'Productivity Worker' },
  { file: 'outputs/PW-02/final.mp4',   title: 'I Tried the Pomodoro Method for 30 Days — Here\'s What Happened',               channel: 'Productivity Worker' },
  { file: 'outputs/PW-03/final.mp4',   title: 'The 2-Minute Rule: How to Beat Procrastination Forever',                      channel: 'Productivity Worker' },
  { file: 'outputs/PW-04/final.mp4',   title: 'Deep Work Made Simple: A Beginner\'s Guide to Focused Success',               channel: 'Productivity Worker' },
  { file: 'outputs/PW-05/final.mp4',   title: 'Stop Wasting Time: The Ultimate Time Management System',                     channel: 'Productivity Worker' },
  { file: 'outputs/GZ-01/final.mp4',   title: 'How Gen Z Masters Time Management (And Why It Works)',                       channel: 'Gen Z Success' },
  { file: 'outputs/GZ-02/final.mp4',   title: 'Productivity Hacks Gen Z Swears By — Scientific Breakdown',                  channel: 'Gen Z Success' },
  { file: 'outputs/GZ-03/final.mp4',   title: 'I Learned Time Management from Gen Z — Mind = Blown',                       channel: 'Gen Z Success' },
  { file: 'outputs/GZ-04/final.mp4',   title: 'The Gen Z Approach to Deep Work and Digital Focus',                        channel: 'Gen Z Success' },
  { file: 'outputs/GZ-05/final.mp4',   title: 'Gen Z Productivity Secrets: What Actually Gets Things Done',                channel: 'Gen Z Success' },
];

const HASHTAGS = '#productivity #timemanagement #study #genz #success #motivation #fyp';

for (const video of videos) {
  const filepath = resolve(ROOT, video.file);
  const fullTitle = `${video.title} ${HASHTAGS}`;
  console.log(`\n[${video.channel}] Uploading: ${video.file}`);
  console.log(`  Title: ${fullTitle.substring(0, 80)}...`);
  try {
    const result = await uploadVideo(filepath, fullTitle);
    console.log(`  ✅ Success! Video ID: ${result.video_id || result.id || JSON.stringify(result)}`);
  } catch (err) {
    console.error(`  ❌ Failed: ${err.message}`);
  }
}

console.log('\nAll uploads complete!');
