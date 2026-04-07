/**
 * Upload QC-passed videos: MOT-01, MOVIE-01, TECH-01
 * Videos are at output/videos/{id}.mp4
 * Uses TikTok browser automation.
 */

import { TikTokBrowser } from '../lib/upload/tiktok-browser.js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PENDING = resolve(ROOT, 'scripts/pending');

const videos = [
  {
    id: 'MOT-01',
    videoPath: resolve(ROOT, 'output/videos/MOT-01.mp4'),
    title: 'She worked in silence. Now she shines. ✨',
    tags: [],
  },
  {
    id: 'MOVIE-01',
    videoPath: resolve(ROOT, 'output/videos/MOVIE-01.mp4'),
    title: 'This movie made me cry in public 😢',
    tags: [],
  },
  {
    id: 'TECH-01',
    videoPath: resolve(ROOT, 'output/videos/TECH-01.mp4'),
    title: 'When AI finally understands emotions 🤖😢',
    tags: [],
  },
];

const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

function updateScriptStatus(id, tiktokUrl) {
  const scriptPath = `${PENDING}/${id}.json`;
  const raw = readFileSync(scriptPath);
  // Strip BOM
  const clean = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF ? raw.slice(3) : raw;
  const data = JSON.parse(clean);
  data.status = 'published';
  data.publishedAt = new Date().toISOString();
  data.tiktok_url = tiktokUrl || 'https://www.tiktok.com/@thanhtungtran364';
  // Re-add BOM for Windows compatibility
  writeFileSync(scriptPath, Buffer.concat([BOM, Buffer.from(JSON.stringify(data, null, 2))]));
}

const uploader = new TikTokBrowser({ headless: false });
const results = [];

try {
  await uploader.init();
  console.log('[OK] Browser initialized');

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    console.log(`\n[${i + 1}/${videos.length}] Uploading ${v.id}: ${v.title}...`);

    const tags = v.tags || [];
    const caption = (v.title || '') + (tags.length ? ' ' + tags.map(t => '#' + t.replace(/ /g, '')).join(' ') : '');

    try {
      const result = await uploader.upload({
        videoPath: v.videoPath,
        caption,
        tags: v.tags,
      });

      console.log(`[${v.id}] Result:`, result.success ? 'SUCCESS' : 'FAILED: ' + result.error);
      results.push({ id: v.id, ...result });

      if (result.success) {
        updateScriptStatus(v.id, result.url);
        console.log(`[${v.id}] Status updated to published`);
      }
    } catch (err) {
      console.error(`[${v.id}] ERROR:`, err.message);
      results.push({ id: v.id, success: false, error: err.message });
    }

    if (i < videos.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
} finally {
  await uploader.close();
}

console.log('\n\n=== SUMMARY ===');
const ok = results.filter(r => r.success).length;
const fail = results.filter(r => !r.success).length;
console.log(`Uploaded: ${ok}/${results.length}`);
results.forEach(r => {
  if (r.success) console.log(`  ✅ ${r.id}: ${r.url || 'no URL'}`);
  else console.log(`  ❌ ${r.id}: ${r.error}`);
});
