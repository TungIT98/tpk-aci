/**
 * upload-xianyx.js
 * Uploads XIANYX-03 to XIANYX-25 videos to TikTok.
 * Handles browser re-init on session close.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TikTokBrowser } from '../lib/upload/tiktok-browser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TOKEN = 'pcp_board_90f175ea95622b221a6223a447c7a19ccbcc3d15d7036e87';

const SCRIPT_DIR = resolve(ROOT, 'scripts/pending/xianxia');
const XIANYX_IDS = [
  'XIANYX-03','XIANYX-04','XIANYX-05','XIANYX-06','XIANYX-07','XIANYX-08',
  'XIANYX-09','XIANYX-10','XIANYX-11','XIANYX-12','XIANYX-13','XIANYX-14',
  'XIANYX-15','XIANYX-16','XIANYX-17','XIANYX-18','XIANYX-19','XIANYX-20',
  'XIANYX-21','XIANYX-22','XIANYX-23','XIANYX-24','XIANYX-25'
];

function buildCaption(script) {
  if (script.metadata && script.metadata.tiktok_caption) {
    return script.metadata.tiktok_caption;
  }
  const tags = (script.tags || []).map(t => '#' + t.replace(/ /g, '')).join(' ');
  return (script.title || '') + ' ' + tags;
}

function getVideoPath(script, id) {
  if (script.local_path) return script.local_path;
  return `output/xianxia/${id}/final.mp4`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`XIANYX Batch Uploader — dryRun=${dryRun}\n`);

  const uploader = new TikTokBrowser({ headless: false });
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

  async function uploadVideo(id, videoPath, caption) {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await ensureBrowser();
        const result = await uploader.upload({ videoPath, caption });
        browserReady = true; // still good
        return result;
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('closed') || msg.includes('Target') || msg.includes('browser')) {
          console.log(`  [RETRY ${attempt}] Browser closed, re-initializing...`);
          browserReady = false;
          if (attempt === MAX_RETRIES) throw err;
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw err;
        }
      }
    }
  }

  try {
    if (dryRun) {
      console.log('[DRY RUN] Skipping browser init\n');
    }

    for (let i = 0; i < XIANYX_IDS.length; i++) {
      const id = XIANYX_IDS[i];
      const scriptPath = resolve(SCRIPT_DIR, `${id}.json`);

      if (!existsSync(scriptPath)) {
        console.log(`[SKIP] ${id}: script not found`);
        results.push({ id, success: false, error: 'Script not found' });
        continue;
      }

      const raw = readFileSync(scriptPath);
      const clean = raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF ? raw.slice(3) : raw;
      const script = JSON.parse(clean);

      // Skip already-published videos
      if (script.status === 'published') {
        console.log(`  [SKIP] Already published`);
        results.push({ id, success: true, url: script.tiktok_url || 'already-published' });
        continue;
      }

      const caption = buildCaption(script);
      const relVideoPath = getVideoPath(script, id);
      const videoPath = relVideoPath.startsWith('/') || relVideoPath.match(/^[A-Za-z]:/)
        ? relVideoPath
        : resolve(ROOT, relVideoPath);

      console.log(`[${i+1}/${XIANYX_IDS.length}] ${id}: ${script.title}`);
      console.log(`  Caption: ${caption.substring(0, 80)}...`);
      console.log(`  Video: ${videoPath}`);

      if (!existsSync(videoPath)) {
        console.log(`  [SKIP] Video not found`);
        results.push({ id, success: false, error: 'Video not found' });
        continue;
      }

      const stats = statSync(videoPath);
      console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(1)}MB`);

      if (dryRun) {
        results.push({ id, success: true, url: 'dry-run' });
        continue;
      }

      try {
        const result = await uploadVideo(id, videoPath, caption);
        console.log(`  [RESULT] ${result.success ? 'SUCCESS' : 'FAILED'}: ${result.error || result.url || 'no url'}`);
        results.push({ id, ...result });

        if (result.success) {
          script.status = 'published';
          script.publishedAt = new Date().toISOString();
          script.tiktok_url = result.url || 'https://www.tiktok.com/@thanhtungtran364';
          const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
          writeFileSync(scriptPath, Buffer.concat([bom, Buffer.from(JSON.stringify(script, null, 2))]));
          console.log(`  [OK] JSON updated`);
        }
      } catch (err) {
        console.error(`  [ERROR] ${err.message}`);
        results.push({ id, success: false, error: err.message });
      }

      await new Promise(r => setTimeout(r, 3000));
    }
  } finally {
    if (!dryRun) {
      try { await uploader.close(); } catch {}
    }
  }

  console.log('\n\n=== SUMMARY ===');
  const ok = results.filter(r => r.success).length;
  const fail = results.filter(r => !r.success).length;
  console.log(`Uploaded: ${ok}/${results.length}`);
  if (fail > 0) {
    console.log('Failed:');
    results.filter(r => !r.success).forEach(r => console.log(' -', r.id + ':', r.error));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
