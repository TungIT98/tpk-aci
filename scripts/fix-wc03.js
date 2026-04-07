/**
 * fix-wc03.js - Regenerate WC-03 with different clips from WC-01
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const lines = readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n');
const PEXELS_KEY = (lines.find(l => l.trim().startsWith('PEXELS_API_KEY')) || '').split('=')[1]?.trim()?.split('#')[0]?.trim();

const SCRATCH = resolve(ROOT, 'pexels_clips');

async function downloadClip(query, minDuration = 6, id = '') {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=10&orientation=portrait`;
  const r = await fetch(url, { headers: { Authorization: PEXELS_KEY } });
  const data = await r.json();
  // Filter: portrait (height > width), good duration
  const candidates = data.videos.filter(v => v.duration >= minDuration && v.height > v.width && v.duration <= 30);
  const v = candidates[0];
  if (!v) { console.log('No suitable video for:', query); return null; }
  // Get best quality link
  const sortedFiles = [...v.video_files].sort((a, b) => (b.width || 0) - (a.width || 0));
  const dlUrl = sortedFiles[0]?.link;
  if (!dlUrl) return null;
  const dest = resolve(SCRATCH, `WC03_fix_${id}_${v.id}.mp4`);
  console.log(`  Downloading ${v.duration}s ${v.width}x${v.height} (${sortedFiles[0].quality})...`);
  const r2 = await fetch(dlUrl, { headers: { Authorization: PEXELS_KEY } });
  const buf = await r2.arrayBuffer();
  writeFileSync(dest, Buffer.from(buf));
  const mb = (buf.byteLength / 1024 / 1024).toFixed(1);
  console.log(`  Downloaded: ${mb}MB`);
  return dest;
}

async function concatTwo(path1, path2, outPath) {
  const listPath = resolve(ROOT, 'tmp_wc03_fix.txt');
  writeFileSync(listPath, `file '${path1.replace(/\\/g, '/')}'\nfile '${path2.replace(/\\/g, '/')}'`);
  const vf = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1';
  execSync(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -vf "${vf}" -t 12 -c:v libx264 -preset fast -crf 23 -c:a aac "${outPath}"`, { stdio: 'pipe', timeout: 120000 });
  const sz = execSync(`powershell -Command "(Get-Item '${outPath}').Length/1MB"`, { stdio: 'pipe' }).toString().trim();
  console.log(`Concatenated: ${sz}MB`);
  try { require('fs').unlinkSync(listPath); } catch {}
  return sz;
}

async function main() {
  console.log('Generating new WC-03 clips...');
  // Use DIFFERENT queries from WC-01 (which used 'soccer football world cup stadium crowd celebration' and 'football stadium crowd cheering jumping excitement')
  const clip1 = await downloadClip('football world cup stadium aerial view crowd', 6, '1');
  const clip2 = await downloadClip('football stadium night lights celebration', 6, '2');
  
  if (!clip1 || !clip2) {
    console.error('Failed to download clips');
    process.exit(1);
  }
  
  const outPath = resolve(ROOT, 'outputs', 'WC-03', 'pexels_final.mp4');
  await concatTwo(clip1, clip2, outPath);
  
  // Update final.mp4 and final_with_voice.mp4
  const final = resolve(ROOT, 'outputs', 'WC-03', 'final.mp4');
  const finalVoice = resolve(ROOT, 'outputs', 'WC-03', 'final_with_voice.mp4');
  execSync(`copy /Y "${outPath}" "${final}" && copy /Y "${outPath}" "${finalVoice}"`, { stdio: 'pipe' });
  
  // Verify hash
  const hash = execSync(`powershell -Command "(Get-FileHash '${final}' -Algorithm MD5).Hash"`, { stdio: 'pipe' }).toString().trim();
  console.log(`WC-03 new hash: ${hash}`);
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
