// scripts/check-video-hashes.js - compare video hashes (quick: first 64KB)
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const videos = ['AESTH-01', 'COM-01', 'LIFE-01', 'MOT-01', 'MOVIE-01', 'TECH-01'];
const dir = resolve(ROOT, 'output', 'videos');
const CHECK_BYTES = 65536; // first 64KB

const hashes = {};
for (const id of videos) {
  const path = resolve(dir, `${id}.mp4`);
  try {
    const buf = readFileSync(path);
    const sample = buf.slice(0, CHECK_BYTES);
    const hash = createHash('md5').update(sample).digest('hex');
    hashes[id] = { hash, sizeMb: (buf.length/1024/1024).toFixed(1) };
    console.log(`${id}: ${hash} (${hashes[id].sizeMb}MB)`);
  } catch (e) {
    console.log(`${id}: ERROR - ${e.message}`);
  }
}

const hashList = Object.values(hashes).map(h => h.hash);
const unique = [...new Set(hashList)];
console.log(`\nUnique videos: ${unique.length} / ${videos.length}`);
if (unique.length < videos.length) {
  console.log('⚠️  Duplicate content detected! Videos are identical.');
} else {
  console.log('✓ All videos have unique content.');
}
