/**
 * Xianxia TikTok Uploader
 * Uploads produced xianxia videos to TikTok.
 * Usage: node scripts/upload-xianxia-tiktok.js [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TikTokBrowser } from '../lib/upload/tiktok-browser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Xianxia produced videos (QC passed) — all 50 XIANYX scripts
const XIANYX_IDS = [
  'XIANYX-01', 'XIANYX-02', 'XIANYX-03', 'XIANYX-04', 'XIANYX-05',
  'XIANYX-06', 'XIANYX-07', 'XIANYX-08', 'XIANYX-09', 'XIANYX-10',
  'XIANYX-11', 'XIANYX-12', 'XIANYX-13', 'XIANYX-14', 'XIANYX-15',
  'XIANYX-16', 'XIANYX-17', 'XIANYX-18', 'XIANYX-19', 'XIANYX-20',
  'XIANYX-21', 'XIANYX-22', 'XIANYX-23', 'XIANYX-24', 'XIANYX-25',
  'XIANYX-26', 'XIANYX-27', 'XIANYX-28', 'XIANYX-29', 'XIANYX-30',
  'XIANYX-31', 'XIANYX-32', 'XIANYX-33', 'XIANYX-34', 'XIANYX-35',
  'XIANYX-36', 'XIANYX-37', 'XIANYX-38', 'XIANYX-39', 'XIANYX-40',
  'XIANYX-41', 'XIANYX-42', 'XIANYX-43', 'XIANYX-44', 'XIANYX-45',
  'XIANYX-46', 'XIANYX-47', 'XIANYX-48', 'XIANYX-49', 'XIANYX-50'
];

const XIANXIA_DIR = resolve(ROOT, 'scripts/pending/xianxia');

const toUpload = [];
for (const id of XIANYX_IDS) {
  const scriptPath = resolve(XIANXIA_DIR, `${id}.json`);
  if (!existsSync(scriptPath)) {
    console.log(`[SKIP] ${id}: script not found`);
    continue;
  }
  const raw = readFileSync(scriptPath);
  const clean = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF ? raw.slice(3) : raw;
  const data = JSON.parse(clean);

  if (data.status === 'published') {
    console.log(`[SKIP] ${id}: already published`);
    continue;
  }

  const videoPath = resolve(ROOT, `output/xianxia/${id}/final.mp4`);
  if (!existsSync(videoPath)) {
    console.log(`[SKIP] ${id}: video not found at ${videoPath}`);
    continue;
  }

  const size = statSync(videoPath).size;
  if (size < 1024 * 1024) {
    console.log(`[SKIP] ${id}: video < 1MB (${size})`);
    continue;
  }

  const caption = data.tiktok_caption || data.title || id;
  toUpload.push({ id, caption, videoPath, scriptPath });
}

console.log(`\nTotal to upload: ${toUpload.length} videos\n`);

const dryRun = process.argv.includes('--dry-run');
if (dryRun) console.log('[DRY RUN] No actual uploads will happen\n');

const uploader = new TikTokBrowser({ headless: false });
const results = [];

try {
  await uploader.init();
  console.log('[OK] Browser initialized\n');

  for (let i = 0; i < toUpload.length; i++) {
    const video = toUpload[i];
    console.log(`\n[${i + 1}/${toUpload.length}] ${video.id}: ${video.caption.substring(0, 80)}...`);

    if (dryRun) {
      results.push({ id: video.id, success: true, url: 'dry-run' });
      continue;
    }

    try {
      const result = await uploader.upload({
        videoPath: video.videoPath,
        caption: video.caption,
      });

      console.log(`[${video.id}] Result:`, result.success ? 'SUCCESS' : 'FAILED: ' + result.error);
      results.push({ id: video.id, ...result });

      if (result.success) {
        const raw = readFileSync(video.scriptPath);
        const clean = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF ? raw.slice(3) : raw;
        const data = JSON.parse(clean);
        data.status = 'published';
        data.publishedAt = new Date().toISOString();
        data.tiktok_url = result.url || 'https://www.tiktok.com/@thanhtungtran364';
        const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
        writeFileSync(video.scriptPath, Buffer.concat([bom, Buffer.from(JSON.stringify(data, null, 2))]));
        console.log(`[${video.id}] Status updated to published`);
      }

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
