import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

// Capture initial CDN URLs so we know what's pre-existing
const initialCdnUrls = await hailuoPage.evaluate(() => {
  return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(s => s.includes('moss'));
});
const initialSet = new Set(initialCdnUrls);
console.log('Initial CDN URLs in gallery:', initialSet.size);

// Helper: get fresh CDN URL from page (video elements with src containing moss)
async function getFreshVideoUrl(page) {
  const allVideos = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('video')).map(v => ({
      src: v.src,
      readyState: v.readyState,
      duration: v.duration
    })).filter(v => v.src.includes('moss') && v.src.includes('.mp4'));
  });

  // Find videos added after initialSet (new ones)
  const newVideos = allVideos.filter(v => !initialSet.has(v.src));
  if (newVideos.length > 0) {
    // Sort by src URL to get the most recent (URLs have timestamp)
    newVideos.sort((a, b) => b.src.localeCompare(a.src));
    return newVideos[0].src;
  }

  // Fallback: any video with readyState > 0
  const loadedVideos = allVideos.filter(v => v.readyState > 0);
  if (loadedVideos.length > 0) {
    return loadedVideos[0].src;
  }

  return null;
}

async function generateShot(shotNum, prompt) {
  console.log(`\n=== Shot ${shotNum} ===`);
  const outFile = resolve(OUT_DIR, `raw_shot_${shotNum}.mp4`);
  if (existsSync(outFile) && statSync(outFile).size > 100000) {
    const size = statSync(outFile).size;
    console.log(`Already exists (${size} bytes), skipping`);
    // Verify it's actually video
    const header = await hailuoPage.evaluate(async (f) => {
      const resp = await fetch('file://' + f);
      const blob = await resp.blob();
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer).slice(0, 12);
      return Array.from(bytes).map(b => b.toString(16)).join('');
    }, outFile.replace(/\\/g, '/'));
    console.log(`  File header hex: ${header}`);
    return;
  }
  if (existsSync(outFile)) unlinkSync(outFile);

  // Fresh page load
  await hailuoPage.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await hailuoPage.waitForTimeout(3000);

  // Capture current CDN URLs before generation
  const beforeUrls = await hailuoPage.evaluate(() => {
    return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(s => s.includes('moss'));
  });
  const beforeSet = new Set(beforeUrls);

  // Fill prompt
  const promptArea = hailuoPage.locator('[contenteditable]').first();
  await promptArea.click({ clickCount: 3 });
  await promptArea.fill(prompt);
  console.log('Prompt filled');

  // Click generate
  const genBtn = hailuoPage.locator('button').filter({ hasText: /25/i }).first();
  await genBtn.click({ force: true });
  console.log('Generate clicked');

  // Wait for generation to complete: look for a new CDN URL in video elements
  let newVideoUrl = null;
  let attempts = 0;
  while (attempts < 120 && !newVideoUrl) {
    await hailuoPage.waitForTimeout(3000);
    attempts++;

    const allVideos = await hailuoPage.evaluate(() => {
      return Array.from(document.querySelectorAll('video')).map(v => ({
        src: v.src,
        readyState: v.readyState,
        duration: v.duration
      }));
    });

    // Find videos not in 'before' set
    const newOnes = allVideos.filter(v => v.src.includes('moss') && v.src.includes('.mp4') && !beforeSet.has(v.src));
    if (newOnes.length > 0) {
      // Sort by src descending to get newest (timestamp in URL)
      newOnes.sort((a, b) => b.src.localeCompare(a.src));
      if (newOnes[0].src) {
        newVideoUrl = newOnes[0].src;
        console.log(`  Found new video URL: ${newVideoUrl.substring(0, 80)} readyState=${newOnes[0].readyState} duration=${newOnes[0].duration}`);
      }
    }

    if (attempts % 10 === 0) console.log(`  Waiting... ${attempts * 3}s`);
  }

  if (newVideoUrl) {
    // Download the video via curl with proper headers
    const https = await import('https');
    const http = await import('http');
    const { IncomingMessage } = await import('stream');

    const outPath = outFile;

    const download = (url) => new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, {
        headers: {
          'Referer': 'https://hailuoai.video/',
          'Origin': 'https://hailuoai.video/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          // Follow redirect
          download(res.headers.location).then(resolve).catch(reject);
        } else {
          const chunks = [];
          res.on('data', chunk => chunks.push(chunk));
          res.on('end', () => {
            const data = Buffer.concat(chunks);
            resolve(data);
          });
          res.on('error', reject);
        }
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    });

    try {
      console.log('  Downloading...');
      const buffer = await download(newVideoUrl);
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
