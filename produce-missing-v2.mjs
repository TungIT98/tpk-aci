import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CDP_URL = 'ws://127.0.0.1:18800/devtools/browser/3238f575-e049-45a9-996d-16e4415c6696';

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

async function ensurePageReady() {
  try {
    await hailuoPage.waitForSelector('[contenteditable]', { timeout: 5000 });
    return true;
  } catch(e) {
    // Reload page
    console.log('  Page stale, reloading...');
    await hailuoPage.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await hailuoPage.waitForTimeout(3000);
    return true;
  }
}

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

async function generateShot(shotNum, prompt, outFile) {
  if (existsSync(outFile) && statSync(outFile).size > 100000) {
    const size = statSync(outFile).size;
    console.log(`  Shot ${shotNum}: exists (${size} bytes), skipping`);
    return 'skip';
  }
  if (existsSync(outFile)) unlinkSync(outFile);

  // Ensure page is ready
  await ensurePageReady();

  // Capture baseline URLs
  let beforeSet;
  try {
    const beforeUrls = await hailuoPage.evaluate(() => {
      return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(s => s.includes('moss'));
    });
    beforeSet = new Set(beforeUrls);
  } catch(e) {
    console.log(`  Shot ${shotNum}: page error getting baseline, reloading`);
    await ensurePageReady();
    const beforeUrls = await hailuoPage.evaluate(() => {
      return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(s => s.includes('moss'));
    });
    beforeSet = new Set(beforeUrls);
  }

  // Fill prompt
  try {
    const promptArea = hailuoPage.locator('[contenteditable]').first();
    await promptArea.click({ clickCount: 3, timeout: 10000 });
    await promptArea.fill(prompt);
    console.log(`  Shot ${shotNum}: prompt filled`);
  } catch(e) {
    console.log(`  Shot ${shotNum}: prompt fill error: ${e.message.substring(0, 50)}, reloading`);
    await ensurePageReady();
    const promptArea = hailuoPage.locator('[contenteditable]').first();
    await promptArea.click({ clickCount: 3 });
    await promptArea.fill(prompt);
    console.log(`  Shot ${shotNum}: prompt filled after reload`);
  }

  // Click generate
  try {
    const genBtn = hailuoPage.locator('button').filter({ hasText: /25/i }).first();
    await genBtn.click({ force: true, timeout: 5000 });
    console.log(`  Shot ${shotNum}: generate clicked`);
  } catch(e) {
    console.log(`  Shot ${shotNum}: generate click error: ${e.message.substring(0, 50)}, reloading`);
    await ensurePageReady();
    const genBtn = hailuoPage.locator('button').filter({ hasText: /25/i }).first();
    await genBtn.click({ force: true });
    console.log(`  Shot ${shotNum}: generate clicked after reload`);
  }

  // Wait for new CDN URL
  let newUrl = null;
  let attempts = 0;
  while (attempts < 120 && !newUrl) {
    await hailuoPage.waitForTimeout(3000);
    attempts++;

    try {
      const allVideos = await hailuoPage.evaluate(() => {
        return Array.from(document.querySelectorAll('video')).map(v => ({
          src: v.src,
          readyState: v.readyState,
          duration: v.duration
        }));
      });

      const newOnes = allVideos.filter(v =>
        v.src.includes('moss') &&
        v.src.includes('.mp4') &&
        !beforeSet.has(v.src)
      );

      if (newOnes.length > 0) {
        newOnes.sort((a, b) => b.src.localeCompare(a.src));
        newUrl = newOnes[0].src;
        console.log(`  Shot ${shotNum}: found ${newUrl.substring(0, 80)}, readyState=${newOnes[0].readyState}`);
      }
    } catch(e) {
      console.log(`  Shot ${shotNum}: poll error: ${e.message.substring(0, 30)}, reloading`);
      await ensurePageReady();
      const beforeUrls = await hailuoPage.evaluate(() => {
        return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(s => s.includes('moss'));
      });
      beforeSet = new Set(beforeUrls);
    }

    if (attempts % 10 === 0) console.log(`  Shot ${shotNum}: waiting ${attempts * 3}s...`);
  }

  if (newUrl) {
    try {
      const result = await downloadWithCookies(hailuoPage, newUrl);
      const buffer = Buffer.from(result.data, 'base64');
      writeFileSync(outFile, buffer);
      console.log(`  Shot ${shotNum}: saved ${buffer.length} bytes`);
      return 'ok';
    } catch(e) {
      console.log(`  Shot ${shotNum}: download failed: ${e.message}`);
      return 'fail';
    }
  } else {
    console.log(`  Shot ${shotNum}: no URL found`);
    return 'fail';
  }
}

async function produceVideo(id, outputDir, shots) {
  console.log(`\n=== Producing ${id} ===`);
  mkdirSync(outputDir, { recursive: true });

  for (const shot of shots) {
    const outFile = resolve(outputDir, `raw_shot_${shot.num}.mp4`);
    const status = await generateShot(shot.num, shot.prompt, outFile);
    if (status === 'fail') {
      console.log(`  Shot ${shot.num}: FAILED, continuing to next shot`);
    }
  }

  const files = readdirSync(outputDir).filter(f => f.startsWith('raw_shot_') && f.endsWith('.mp4'));
  console.log(`  Output files: ${files.length}`);
  for (const f of files) {
    const size = statSync(resolve(outputDir, f)).size;
    console.log(`    ${f}: ${size} bytes`);
  }
}

// 4 missing videos
const xianyx41 = [
  { num: 1, prompt: "Wide shot — dawn over the Crimson Phoenix temple courtyard. One hundred disciples in grey, crimson, and white robes stand in rows — from one hundred different sects. The temple is now a university of peace. She stands at the teaching altar in full crimson phoenix regalia — phoenix hairpin gleaming, crimson and gold robes. Camera: wide establishing shot, dawn temple courtyard, disciples gathered, her in full regalia before altar. [Wide — dawn temple, disciples gathered]" },
  { num: 2, prompt: "Medium shot — she raises her hand to teach. A figure in white cloud robes appears at the courtyard entrance — the Supreme Cultivator. The air changes around him. The one figure in the cultivation world who answers to no throne, no sect. Camera: medium shot, her teaching, then pan to Supreme Cultivator arriving. [Medium — teaching, Supreme Cultivator arrives]" },
  { num: 3, prompt: "Close-up — the Supreme Cultivator watches from the shadows, troubled. He watches her teach philosophy but disciples still hold swords. He steps forward and interrupts. Camera: close-up on his troubled face, then medium shot stepping forward. [Close-up — troubled Supreme Cultivator stepping forward]" },
  { num: 4, prompt: "Medium shot — she answers without hesitation: The first lesson — is that you will never need the blade — if you are brave enough to be vulnerable first. Camera: medium shot, dialogue exchange. [Medium — dialogue exchange, vulnerability philosophy]" },
  { num: 5, prompt: "Wide shot — the Supreme Cultivator kneels — not to her power — to her wisdom. The Crimson Phoenix Sect is REAL — recognized by the cultivation world's highest authority. She places her hand on his shoulder. Camera: wide shot, him kneeling to wisdom, dawn light through temple columns. [Wide — kneeling to wisdom, first lesson begins]" }
];

const xianyx42 = [
  { num: 1, prompt: "Wide shot — a palace courtyard. Half the court prepares cold blue mourning flowers. The other half prepares warm orange chrysanthemums. A family arrives at the palace gates. Camera: wide establishing shot, palace courtyard with two groups preparing different flowers. [Wide — palace courtyard, two flower traditions]" },
  { num: 2, prompt: "Close-up — a one year old child glowing faintly with warm orange-gold phoenix fire. Her first breath was taken in white-gold flame. She has no fear. Camera: close-up on her glowing with warm fire, family beside her. [Close-up — one year old, warm phoenix fire glow]" },
  { num: 3, prompt: "Wide shot — the court is divided. Half reach for cold blue flowers. Half reach for orange chrysanthemums. The family walks between them. Camera: wide shot, court dividing between traditions as she walks through. [Wide — court dividing between traditions]" },
  { num: 4, prompt: "Medium close-up — she looks at the divided court. Her warm fire reflects in the eyes of those holding orange flowers. Three thousand years of funeral fires ending with one small hand. Camera: medium close-up on her face and warm fire reflected in court officials' eyes. [Medium close-up — warm fire reflected in eyes]" },
  { num: 5, prompt: "Wide shot — warm orange chrysanthemums win. She walks toward the palace doors, her small hand glowing with warm fire. Three thousand years of cold ending with one child's first warm fire. Camera: wide shot, orange flowers dominating, her walking toward palace in warm fire glow. [Wide — orange flowers win, walking toward palace]" }
];

const xianyx44 = [
  { num: 1, prompt: "Extreme wide shot — an ancient Chinese imperial palace at sunrise. Morning mist drifts across marble courtyards. Red and gold banners on towering columns. Court officials in elaborate robes walk corridors. A young imperial scholar in simple white and blue robes walks through the crowd unnoticed. Camera: extreme wide establishing shot, imperial palace at sunrise, scholar walking through crowd unnoticed. [Extreme wide — imperial palace at sunrise, scholar unnoticed]" },
  { num: 2, prompt: "Medium shot — he sits alone in a corner of the imperial library, surrounded by towering scrolls and ancient texts. His fingers trace characters in old books. He is quiet, observant, underestimated. Camera: medium shot, him in library corner surrounded by scrolls. [Medium — scholar alone in library with scrolls]" },
  { num: 3, prompt: "Close-up — he looks up from his book. His eyes — sharp, ancient, too knowing. A faint violet light flickers behind his pupils — the Crimson Phoenix Fire, recognizing its true heir. He blinks it away. Camera: close-up on his face, violet flicker in eyes, then scholar facade returns. [Close-up — violet fire flicker in eyes]" },
  { num: 4, prompt: "Wide shot — a commotion in the palace corridor. Soldiers rush past with weapons drawn. He looks up calmly, then returns to his book. Camera: wide shot, commotion in corridor, soldiers rushing, scholar remains completely calm. [Wide — soldiers rushing, scholar remains calm]" },
  { num: 5, prompt: "Medium close-up — he closes his book slowly and stands. A single crimson phoenix feather floats past the window on the morning breeze. He smiles faintly — cold, ancient, knowing. Camera: medium close-up, closing book, crimson feather floating past, faint cold smile. [Medium close-up — cold smile at crimson feather]" }
];

const xianyx45 = [
  { num: 1, prompt: "Extreme wide shot — the same ancient palace at dusk. Firelight from torches casts dancing shadows on red walls. Court officials whisper as he passes. No one knows what he is truly capable of. Camera: extreme wide establishing shot, palace corridors at dusk, firelight shadows, whispers following. [Extreme wide — palace corridors at dusk, whispers following]" },
  { num: 2, prompt: "Wide shot — he walks through the imperial garden. A phoenix feather is embedded in the stone path — planted there deliberately. He stops, picks it up. It glows faintly with warm crimson fire. Camera: wide shot, imperial garden at dusk, him stopping at glowing phoenix feather in stone path. [Wide — phoenix feather embedded in stone path, glowing]" },
  { num: 3, prompt: "Close-up — he examines the phoenix feather. It is warm to the touch. A message encoded in fire: the Crimson Phoenix Sect has been reborn. Camera: close-up on the glowing phoenix feather in his hand, warm crimson fire pulsing. [Close-up — phoenix feather glowing with warm fire]" },
  { num: 4, prompt: "Wide shot — he closes his fist around the feather. When he opens it, the feather has transformed into a small phoenix ember floating above his palm. Camera: wide shot, feather transforming into floating ember above his palm in dusk garden. [Wide — feather transforming into floating ember above palm]" },
  { num: 5, prompt: "Medium close-up — he looks up from the ember. His quiet scholarly eyes are gone. In their place: ancient, cold, absolute certainty. The real game begins. Camera: medium close-up, expression transforming from scholar to ancient fire, cold knowing smile. [Medium close-up — scholar transforming to ancient fire, cold smile]" }
];

await produceVideo('XIANYX-41', resolve(__dirname, 'output/xianxia/XIANYX-41'), xianyx41);
await produceVideo('XIANYX-42', resolve(__dirname, 'output/xianxia/XIANYX-42'), xianyx42);
await produceVideo('XIANYX-44', resolve(__dirname, 'output/xianxia/XIANYX-44'), xianyx44);
await produceVideo('XIANYX-45', resolve(__dirname, 'output/xianxia/XIANYX-45'), xianyx45);

await browser.close();
console.log('\nDone!');
