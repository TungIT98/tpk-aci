/**
 * upload-goal7-batch.js
 * Uploads GOAL-7 Batch 1 XiAnyX videos (26 videos) to TikTok.
 * Videos: output/xianxia/{id}/final.mp4
 * Scripts: scripts/pending/xianxia/{id}.json
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TikTokBrowser } from '../lib/upload/tiktok-browser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCRIPT_DIR = resolve(ROOT, 'scripts/pending/xianxia');
const VIDEO_ROOT = resolve(ROOT, 'output/xianxia');

// 26 target videos from GOAL-7 Batch 1
const TARGET_IDS = [
  'XIANYX-51','XIANYX-52','XIANYX-53','XIANYX-54','XIANYX-55',
  'XIANYX-56','XIANYX-57','XIANYX-58','XIANYX-59','XIANYX-60',
  'XIANYX-61','XIANYX-62','XIANYX-63','XIANYX-64','XIANYX-65',
  'XIANYX-66','XIANYX-67','XIANYX-69','XIANYX-70',
  'XIANYX-85','XIANYX-87','XIANYX-90','XIANYX-91',
  'XIANYX-96','XIANYX-102','XIANYX-110'
];

const SERIES_TAGS = {
  'Ha Tien Du': ['#HàTiênDu', '#cổtrang', '#xianxia', '#phimcổtrang', '#tiểuthuyết'],
  'Trieu Tien': ['#TriềuTiên', '#cổtrang', '#xianxia', '#phimcổtrang', '#tiểuthuyết'],
  'Dau Pha Thuong Khau': ['#ĐấuPháThươngKhâu', '#cổtrang', '#xianxia', '#phimcổtrang'],
  'Tru Tien': ['#TruTiên', '#cổtrang', '#xianxia', '#phimcổtrang', '#tiểuthuyết'],
  'Thanh Van Mon': ['#ThanhVânMôn', '#cổtrang', '#xianxia', '#phimcổtrang'],
  'Muc Than Ky': ['#MụcThầnKý', '#cổtrang', '#xianxia', '#phimcổtrang'],
};

const SERIES_ORDER = [
  'Ha Tien Du', 'Trieu Tien', 'Dau Pha Thuong Khau',
  'Tru Tien', 'Thanh Van Mon', 'Muc Than Ky'
];

function getSeriesFromTitle(title) {
  for (const s of SERIES_ORDER) {
    if (title && title.includes(s)) return s;
  }
  return null;
}

function buildCaption(script) {
  // Prefer stored caption
  if (script.metadata && script.metadata.tiktok_caption) {
    return script.metadata.tiktok_caption;
  }
  const title = script.title || '';
  const series = getSeriesFromTitle(title);

  // Vietnamese hashtags for all xianxia content
  let tags = ['#xianxia', '#cổtrang', '#phimcổtrang', '#cổtrang2026'];
  if (series && SERIES_TAGS[series]) {
    tags = SERIES_TAGS[series];
  }

  // If we have episode info, append episode tag
  const epMatch = title.match(/Episode\s*(\d+)/i);
  const epTag = epMatch ? '#Tập' + epMatch[1] : '';

  const tagStr = [...new Set([...tags, epTag])].filter(Boolean).join(' ');
  return `${title} ${tagStr}`.trim();
}

function getVideoPath(id) {
  return resolve(VIDEO_ROOT, id, 'final.mp4');
}

function updateScriptStatus(id, tiktokUrl) {
  const scriptPath = resolve(SCRIPT_DIR, `${id}.json`);
  const raw = readFileSync(scriptPath);
  const clean = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF ? raw.slice(3) : raw;
  const data = JSON.parse(clean);
  data.status = 'published';
  data.publishedAt = new Date().toISOString();
  data.tiktok_url = tiktokUrl || 'https://www.tiktok.com/@thanhtungtran364';
  const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
  writeFileSync(scriptPath, Buffer.concat([BOM, Buffer.from(JSON.stringify(data, null, 2))]));
  console.log(`  [STATUS] ${id} → published`);
}

async function uploadVideo(uploader, id, script) {
  const videoPath = getVideoPath(id);
  if (!existsSync(videoPath)) {
    console.log(`  [SKIP] ${id}: file not found at ${videoPath}`);
    return { id, success: false, reason: 'file_not_found' };
  }

  const caption = buildCaption(script);
  console.log(`  [CAPTION] ${caption.substring(0, 80)}...`);

  const result = await uploader.upload({ videoPath, caption });
  return { id, ...result };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`GOAL-7 Batch 1 Uploader — TikTok | dryRun=${dryRun}\n`);

  const uploader = new TikTokBrowser({ headless: false });

  if (dryRun) {
    // Just show what would be uploaded
    for (const id of TARGET_IDS) {
      const scriptPath = resolve(SCRIPT_DIR, `${id}.json`);
      if (!existsSync(scriptPath)) { console.log(`${id}: SCRIPT MISSING`); continue; }
      const raw = readFileSync(scriptPath);
      const clean = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF ? raw.slice(3) : raw;
      const script = JSON.parse(clean);
      const videoPath = getVideoPath(id);
      const exists = existsSync(videoPath);
      console.log(`${id}: ${exists ? 'READY' : 'NO_VIDEO'} | ${buildCaption(script).substring(0, 60)}`);
    }
    return;
  }

  let browserReady = false;
  const results = [];

  async function ensureBrowser() {
    if (!browserReady) {
      try { await uploader.close(); } catch {}
      await uploader.init();
      browserReady = true;
      console.log('[OK] Browser ready\n');
    }
  }

  for (const id of TARGET_IDS) {
    const scriptPath = resolve(SCRIPT_DIR, `${id}.json`);
    if (!existsSync(scriptPath)) {
      console.log(`[SKIP] ${id}: script not found`);
      results.push({ id, success: false, reason: 'script_missing' });
      continue;
    }

    const raw = readFileSync(scriptPath);
    const clean = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF ? raw.slice(3) : raw;
    const script = JSON.parse(clean);

    if (script.status === 'published') {
      console.log(`[SKIP] ${id}: already published`);
      results.push({ id, success: true, skipped: true });
      continue;
    }

    const videoPath = getVideoPath(id);
    if (!existsSync(videoPath)) {
      console.log(`[SKIP] ${id}: video file not found`);
      results.push({ id, success: false, reason: 'video_missing' });
      continue;
    }

    console.log(`\n[UPLOAD] ${id}`);
    try {
      await ensureBrowser();
      const result = await uploadVideo(uploader, id, script);
      results.push(result);

      if (result.success) {
        updateScriptStatus(id, result.url);
        console.log(`  [DONE] ${id} → ${result.url || 'OK'}`);
      } else {
        console.log(`  [FAIL] ${id}: ${result.error || result.reason}`);
      }
    } catch (err) {
      console.log(`  [ERROR] ${id}: ${err.message}`);
      browserReady = false; // Force re-init on next
      results.push({ id, success: false, reason: err.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  const passed = results.filter(r => r.success && !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.success && !r.skipped).length;
  console.log(`Passed: ${passed} | Skipped: ${skipped} | Failed: ${failed}`);

  await uploader.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
