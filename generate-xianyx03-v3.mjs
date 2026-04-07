import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pump = promisify(pipeline);
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'output', 'xianxia', 'XIANYX-03');
mkdirSync(OUT_DIR, { recursive: true });

const CDP_URL = 'ws://127.0.0.1:18800/devtools/browser/3238f575-e049-45a9-996d-16e4415c6696';

const shots = [
  { num: 1, prompt: "Extreme wide shot — a young man lies face-down in the mud and ash of an ancient ruined courtyard. He is dressed in torn grey disciple robes, faded and bloodstained. Shattered stone pillars surround him. Dead autumn leaves and embers scatter in the wind. Rain begins to fall. He stirs, raises his head slowly. His eyes — defiant despite everything — meet the camera. Lightning flashes in the distance. Camera: extreme wide establishing shot, slow push in to medium shot as he raises his head." },
  { num: 2, prompt: "Medium shot — he rises to his knees. His hand presses against his chest where his dantian — his spiritual core — once burned. Now: cold and dark, shattered. He looks upward through the storm clouds. A crack splits the night sky. A burning star — comet-like — streaks downward trailing violet fire. Camera: medium shot, slow tilt upward from his face to the falling star streaking across the sky." },
  { num: 3, prompt: "Close-up — his trembling hand reaches into his torn robe and pulls out a broken jade pendant. The jade is cracked but still faintly glowing. His father's last gift. He closes his fist around it, blood seeping between his fingers. Rain falls on his face. Camera: close-up on the cracked jade pendant, his bloodied fingers closing around it, then a slow push in to his eyes — fierce, wet, unbroken." },
  { num: 4, prompt: "Wide shot — at the center of the ruined courtyard, the falling star has struck the earth, leaving a smoking crater. Within it, a violet-black flame burns impossibly, untouched by the rain, defying all natural law. It pulses like a heartbeat. Ancient runes appear briefly in the air around it. He approaches slowly from the darkness, the cracked jade pendant glowing increasingly bright. Camera: wide shot, crater and violet flame, then tracks forward with him approaching." },
  { num: 5, prompt: "Medium close-up — he stands at the edge of the crater. Rain rages around him but does not touch his body — the violet flame's heat radiates outward, evaporating every drop before it lands. His cracked jade pendant now burns with violet light, fused to his chest. He extends his hand toward the flame. The flame responds, spiraling up his arm, forming ancient violet-black markings on his skin. His expression transforms from despair to something ancient, terrible, and alive. A slow, dangerous smile. Camera: medium close-up, slow push in to his face, ending on that smile." }
];

const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 90000 });
console.log('Connected');

const ctx = browser.contexts()[0];
const pages = ctx.pages();
let hailuoPage = pages.find(p => p.url().includes('hailuoai.video'));
if (!hailuoPage) {
  hailuoPage = await ctx.newPage();
  await hailuoPage.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 30000 });
}
await hailuoPage.waitForTimeout(2000);
console.log('Hailuo page ready');

// Capture initial CDN URLs (pre-existing)
const initialUrls = await hailuoPage.evaluate(() => {
  return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(s => s.includes('moss'));
});
const initialSet = new Set(initialUrls);
console.log('Initial CDN URLs:', initialUrls.length);

// Helper: download from URL using page's cookie context via fetch
async function downloadWithCookies(page, url) {
  const result = await page.evaluate(async (url) => {
    const resp = await fetch(url, {
      headers: {
        'Referer': 'https://hailuoai.video/',
        'Origin': 'https://hailuoai.video/'
      }
    });
    if (!resp.ok) return { success: false, error: 'HTTP ' + resp.status, size: 0 };
    const blob = await resp.blob();
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { success: true, data: btoa(binary), size: buffer.byteLength };
  }, url);
  if (!result.success) throw new Error(result.error);
  return result;
}

async function generateShot(shotNum, prompt) {
  console.log(`\n=== Shot ${shotNum} ===`);
  const outFile = resolve(OUT_DIR, `raw_shot_${shotNum}.mp4`);

  if (existsSync(outFile) && statSync(outFile).size > 100000) {
    console.log(`Already exists (${statSync(outFile).size} bytes), skipping`);
    return;
  }
  if (existsSync(outFile)) unlinkSync(outFile);

  // Capture current URLs as baseline
  const beforeUrls = await hailuoPage.evaluate(() => {
    return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(s => s.includes('moss'));
  });
  const beforeSet = new Set(beforeUrls);
  console.log(`  Baseline CDN URLs: ${beforeUrls.length}`);

  // Fill prompt
  const promptArea = hailuoPage.locator('[contenteditable]').first();
  await promptArea.click({ clickCount: 3 });
  await promptArea.fill(prompt);
  console.log('  Prompt filled');

  // Click generate
  const genBtn = hailuoPage.locator('button').filter({ hasText: /25/i }).first();
  await genBtn.click({ force: true });
  console.log('  Generate clicked');

  // Wait for generation to produce a new CDN URL
  let newUrl = null;
  let attempts = 0;
  while (attempts < 120 && !newUrl) {
    await hailuoPage.waitForTimeout(3000);
    attempts++;

    const allVideos = await hailuoPage.evaluate(() => {
      return Array.from(document.querySelectorAll('video')).map(v => ({
        src: v.src,
        readyState: v.readyState,
        duration: v.duration
      }));
    });

    // Find URLs not in beforeSet (new ones)
    const newOnes = allVideos.filter(v =>
      v.src.includes('moss') &&
      v.src.includes('.mp4') &&
      !beforeSet.has(v.src)
    );

    if (newOnes.length > 0) {
      // Sort by src descending (latest first by timestamp in URL)
      newOnes.sort((a, b) => b.src.localeCompare(a.src));
      newUrl = newOnes[0].src;
      console.log(`  Found new video: ${newUrl.substring(0, 80)}, readyState=${newOnes[0].readyState}, duration=${newOnes[0].duration}`);
    }

    if (attempts % 10 === 0) console.log(`  Waiting... ${attempts * 3}s, videos: ${allVideos.length}`);
  }

  if (newUrl) {
    try {
      console.log(`  Downloading via fetch...`);
      const result = await downloadWithCookies(hailuoPage, newUrl);
      const buffer = Buffer.from(result.data, 'base64');
      writeFileSync(outFile, buffer);
      console.log(`  Saved: ${buffer.length} bytes`);
    } catch(e) {
      console.log(`  Download failed: ${e.message}`);
    }
  } else {
    console.log('  No new video URL found');
  }
}

for (const shot of shots) {
  try {
    await generateShot(shot.num, shot.prompt);
  } catch(e) {
    console.error(`Error shot ${shot.num}:`, e.message);
  }
}

console.log('\nOutput files:');
for (const f of readdirSync(OUT_DIR)) {
  const size = statSync(resolve(OUT_DIR, f)).size;
  console.log(`  ${f}: ${size} bytes`);
}

await browser.close();
