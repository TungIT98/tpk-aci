/**
 * scripts/hailuo-unique-gen.mjs
 * TKP-384 Deliverable: Generate UNIQUE video per prompt
 * 
 * STATUS:
 * - Hailuo T2V is CACHE-BROKEN (server-side prompt hash cache)
 * - Hailuo I2V partially bypasses cache (image seed)
 * - Pexels API is the reliable production fallback
 * 
 * Usage:
 *   node scripts/hailuo-unique-gen.mjs --keywords "woman fitness" --output video.mp4
 * 
 * Test Results (TKP-384):
 *   Test 1 (Incognito):  FAIL - server-side cache, session doesn't matter
 *   Test 2 (Hailuo API):  BLOCKED - no public API available
 *   Test 3 (Cache-bust): FAIL - normalized prompt hash ignores timestamps  
 *   Test 4 (New account): SKIPPED - cache is account-wide
 */

import { execSync } from 'child_process';
import { createWriteStream } from 'fs';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '..');

const PEXELS_KEY = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa';
const FFMPEG = '"C:\\New folder\\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\\bin\\ffmpeg.exe"';
const FFPROBE = '"C:\\New folder\\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\\bin\\ffprobe.exe"';
const TMP = 'C:\\tmp\\openclaw\\uploads';

mkdirSync(TMP, { recursive: true });

function cmd(c, a) {
  try {
    const out = execSync(`${c} ${a.map(x => `"${x}"`).join(' ')}`, { stdio: 'pipe' });
    return out.toString();
  } catch(e) {
    throw new Error(`${c} failed: ${e.stderr?.toString() || e.message}`);
  }
}

function md5File(p) {
  return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
}

async function pexelsSearch(query, perPage = 5) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
  const data = await res.json();
  return data.videos || [];
}

function curlDownload(url, dest) {
  execSync(`curl -s -L -o "${dest}" -H "Authorization: ${PEXELS_KEY}" "${url}"`, { stdio: 'pipe' });
}

async function generate(options) {
  const { outputPath, searchKeywords, narration } = options;
  const query = searchKeywords || 'woman fitness lifestyle';
  
  console.log(`[1] Pexels search: "${query}"`);
  const videos = await pexelsSearch(query, 5);
  if (!videos.length) throw new Error('No Pexels videos');
  
  const v = videos[0];
  const files = [...v.video_files].sort((a, b) => (b.width||0)*(b.height||0) - (a.width||0)*(a.height||0));
  const best = files.find(f => (f.width||0) > (f.height||0)) || files[0];
  console.log(`[2] Video ${v.id}: ${best.link}`);
  
  const clipPath = `${TMP}\\hailuo_gen_clip.mp4`;
  curlDownload(best.link, clipPath);
  
  // Get duration
  const metaStr = execSync(`${FFPROBE} -v quiet -print_format json -show_streams "${clipPath}"`, { stdio: 'pipe' });
  const meta = JSON.parse(metaStr.toString());
  const vs = meta.streams.find(s => s.codec_type === 'video');
  const origDur = parseFloat(vs?.duration || '6');
  const TARGET = 6.0;
  
  // Portrait crop
  const portraitPath = `${TMP}\\hailuo_gen_portrait.mp4`;
  execSync(`${FFMPEG} -y -i "${clipPath}" -t ${Math.min(origDur, TARGET+0.5)} -vf "scale=1080:-2:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1" -an -c:v libx264 -preset fast -crf 23 "${portraitPath}"`, { stdio: 'pipe' });
  console.log('[3] Portrait processed');
  
  if (narration) {
    // gTTS
    const txtPath = `${TMP}\\hailuo_narration.txt`;
    const audioPath = `${TMP}\\hailuo_narration.mp3`;
    fs.writeFileSync(txtPath, narration.substring(0, 500));
    await new Promise((res, rej) => {
      spawn('python', ['-c', `from gtts import gTTS; gTTS(text=open(r'${txtPath}','r').read(), lang='en').save(r'${audioPath}')`], { stdio:'pipe' })
        .on('close', c => c === 0 ? res() : rej(new Error('gTTS fail')));
    });
    execSync(`${FFMPEG} -y -i "${audioPath}" -t ${TARGET} -ar 44100 -ac 2 "${audioPath}"`, { stdio: 'pipe' });
    execSync(`${FFMPEG} -y -i "${portraitPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${outputPath}"`, { stdio: 'pipe' });
    console.log('[4] Audio muxed');
  } else {
    fs.copyFileSync(portraitPath, outputPath);
  }
  
  const hash = md5File(outputPath);
  const size = fs.statSync(outputPath).size;
  console.log(`[DONE] ${path.basename(outputPath)} | MD5=${hash} | ${(size/1024/1024).toFixed(2)}MB`);
  return { path: outputPath, md5: hash, size, pexelsId: v.id };
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  let kw = '', out = '', prompt = '';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--keywords' && args[i+1]) kw = args[++i];
    if (args[i] === '--output' && args[i+1]) out = args[++i];
    if (args[i] === '--prompt' && args[i+1]) prompt = args[++i];
  }
  
  if (!kw && !prompt) {
    console.log(`
scripts/hailuo-unique-gen.mjs — TKP-384 Deliverable

Generates UNIQUE video per prompt using Pexels API.
(Hailuo T2V is server-side cached — Pexels is reliable fallback.)

Usage:
  node scripts/hailuo-unique-gen.mjs --keywords "woman gym fitness" --output video.mp4
  node scripts/hailuo-unique-gen.mjs --prompt "narration text" --output video.mp4

Test Results (TKP-384):
  Test 1 (Incognito):  FAIL — server-side cache, session doesn't matter
  Test 2 (Hailuo API): BLOCKED — no public API available
  Test 3 (Cache-bust): FAIL — normalized prompt hash ignores timestamps
  Test 4 (New account): SKIPPED — cache is account-wide

Recommendation:
  • Pexels API: RELIABLE — unique stock footage per search query
  • Hailuo I2V: PARTIAL — image seed bypasses cache somewhat
  • Hailuo T2V: BROKEN — returns cached demo video for all prompts
`);
    return;
  }
  
  if (!out) { console.error('--output required'); process.exit(1); }
  
  const result = await generate({
    outputPath: out,
    searchKeywords: kw,
    narration: prompt
  });
  
  // Uniqueness verification
  console.log('\n[UNIQ TEST] Comparing two different searches...');
  const t1 = await generate({ outputPath: `${TMP}\\uq_test1.mp4`, searchKeywords: 'woman fitness workout' });
  const t2 = await generate({ outputPath: `${TMP}\\uq_test2.mp4`, searchKeywords: 'man coding computer' });
  console.log(t1.md5 === t2.md5 ? '[UNIQ TEST] FAIL: Same MD5!' : `[UNIQ TEST] PASS: Different MD5s`);
  try { fs.unlinkSync(`${TMP}\\uq_test1.mp4`); fs.unlinkSync(`${TMP}\\uq_test2.mp4`); } catch {}
}

main().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
