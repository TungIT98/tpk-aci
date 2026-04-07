/**
 * Batch TikTok Uploader
 * Usage: node scripts/upload-batch-tiktok.js [--dry-run]
 *
 * Reads scripts/pending/*.json with status="produced" and uploads
 * videos to TikTok one by one, updating JSON status to "published".
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TikTokBrowser } from '../lib/upload/tiktok-browser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Load all produced scripts
// ---------------------------------------------------------------------------
const pendingDir = resolve(ROOT, 'scripts/pending');
const { readdirSync } = await import('fs');
const files = readdirSync(pendingDir).filter(f => f.endsWith('.json'));

const produced = [];
for (const f of files) {
  const raw = readFileSync(`${pendingDir}/${f}`);
  const clean = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF ? raw.slice(3) : raw;
  const data = JSON.parse(clean);
  if (data.status === 'produced') {
    const id = f.replace('.json', '');
    const videoPath = `output/videos/${id}.mp4`;
    const exists = existsSync(resolve(ROOT, videoPath));
    const stats = exists ? statSync(resolve(ROOT, videoPath)) : null;
    const size = stats ? stats.size : 0;
    if (!exists || size < 1024 * 1024) {
      console.log(`[SKIP] ${id}: video missing or < 1MB`);
      continue;
    }
    const tags = data.tags || [];
    const caption = (data.title || '') + ' ' + tags.map(t => '#' + t.replace(/ /g, '')).join(' ');
    produced.push({ id, title: data.title, caption, tags, videoPath });
  }
}

// Exclude PW-15 (already uploaded)
const toUpload = produced.filter(v => v.id !== 'PW-15');
console.log(`\nTotal to upload: ${toUpload.length} videos\n`);

// ---------------------------------------------------------------------------
// Batch upload
// ---------------------------------------------------------------------------
const dryRun = process.argv.includes('--dry-run');
if (dryRun) console.log('[DRY RUN] No actual uploads will happen\n');

const uploader = new TikTokBrowser({ headless: false });
const results = [];

try {
  await uploader.init();
  console.log('[OK] Browser initialized');

  for (let i = 0; i < toUpload.length; i++) {
    const video = toUpload[i];
    console.log(`\n[${i + 1}/${toUpload.length}] Uploading ${video.id}: ${video.title.substring(0, 50)}...`);

    if (dryRun) {
      results.push({ id: video.id, success: true, url: 'dry-run' });
      continue;
    }

    try {
      const absolutePath = resolve(ROOT, video.videoPath);
      const result = await uploader.upload({
        videoPath: absolutePath,
        caption: video.caption,
        tags: video.tags,
      });

      console.log(`[${video.id}] Result:`, result.success ? 'SUCCESS' : 'FAILED: ' + result.error);
      results.push({ id: video.id, ...result });

      // Update JSON status
      if (result.success) {
        const scriptPath = `${pendingDir}/${video.id}.json`;
        const raw = readFileSync(scriptPath);
        const clean = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF ? raw.slice(3) : raw;
        const data = JSON.parse(clean);
        data.status = 'published';
        data.publishedAt = new Date().toISOString();
        data.tiktok_url = result.url || 'https://www.tiktok.com/@thanhtungtran364';
        // Re-add BOM for Windows compatibility
        const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
        writeFileSync(scriptPath, Buffer.concat([bom, Buffer.from(JSON.stringify(data, null, 2))]));
        console.log(`[${video.id}] Status updated to published`);
      }

      // Small delay between uploads
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`[${video.id}] ERROR:`, err.message);
      results.push({ id: video.id, success: false, error: err.message });
    }
  }
} finally {
  await uploader.close();
  console.log('\n\n=== SUMMARY ===');
  const ok = results.filter(r => r.success).length;
  const fail = results.filter(r => !r.success).length;
  console.log(`Uploaded: ${ok}/${results.length}`);
  if (fail > 0) {
    console.log('Failed:');
    results.filter(r => !r.success).forEach(r => console.log(' -', r.id + ':', r.error));
  }
}
