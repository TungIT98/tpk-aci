/**
 * GOAL-8 XiAnyX TikTok Uploader
 * Uploads 60 GOAL-8 videos (E21-30 × 6 series) to TikTok.
 * Usage: node scripts/upload-goal8-tiktok.js [--dry-run] [--batch N]
 *   --batch 1 = XIANYX-111 to 130 (Ha Tien Du E21-30)
 *   --batch 2 = XIANYX-131 to 150 (Trieu Tien + Dau Pha E21-30)
 *   --batch 3 = XIANYX-151 to 170 (Tru Tien + Thanh Van Mon + Muc Than Ky E21-30)
 *   no flag = all 60 videos
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TikTokBrowser } from '../lib/upload/tiktok-browser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const BATCHES = {
  1: { label: 'Batch 1: Ha Tien Du E21-30', ids: [] },
  2: { label: 'Batch 2: Trieu Tien + Dau Pha E21-30', ids: [] },
  3: { label: 'Batch 3: Tru Tien + Thanh Van Mon + Muc Than Ky E21-30', ids: [] },
};

// Generate all GOAL-8 IDs
// Ha Tien Du E21-30: 111-120, Trieu Tien E21-30: 121-130
// Dau Pha Thuong Khau E21-30: 131-140, Tru Tien E21-30: 141-150
// Thanh Van Mon E21-30: 151-160, Muc Than Ky E21-30: 161-170
const allIds = [];
for (let i = 111; i <= 120; i++) allIds.push(`XIANYX-${i}`);
for (let i = 121; i <= 130; i++) allIds.push(`XIANYX-${i}`);
for (let i = 131; i <= 140; i++) allIds.push(`XIANYX-${i}`);
for (let i = 141; i <= 150; i++) allIds.push(`XIANYX-${i}`);
for (let i = 151; i <= 160; i++) allIds.push(`XIANYX-${i}`);
for (let i = 161; i <= 170; i++) allIds.push(`XIANYX-${i}`);

BATCHES[1].ids = allIds.slice(0, 20);
BATCHES[2].ids = allIds.slice(20, 40);
BATCHES[3].ids = allIds.slice(40, 60);

const XIANXIA_DIR = resolve(ROOT, 'scripts/pending/xianxia');

// Determine which IDs to upload
let idsToUpload = allIds;
const batchArg = process.argv.find(a => a.startsWith('--batch='));
if (batchArg) {
  const batchNum = parseInt(batchArg.split('=')[1]);
  if (BATCHES[batchNum]) {
    idsToUpload = BATCHES[batchNum].ids;
    console.log(`\n=== GOAL-8 ${BATCHES[batchNum].label} ===\n`);
  } else {
    console.error(`Invalid batch: ${batchNum}. Use 1, 2, or 3.`);
    process.exit(1);
  }
} else {
  console.log(`\n=== GOAL-8 TikTok Upload — All 60 Videos ===\n`);
}

const toUpload = [];
for (const id of idsToUpload) {
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
