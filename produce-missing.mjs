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

async function generateShot(hailuoPage, shotNum, prompt, outFile) {
  if (existsSync(outFile) && statSync(outFile).size > 100000) {
    const size = statSync(outFile).size;
    console.log(`  Shot ${shotNum}: exists (${size} bytes), skipping`);
    return;
  }
  if (existsSync(outFile)) unlinkSync(outFile);

  // Capture baseline URLs
  const beforeUrls = await hailuoPage.evaluate(() => {
    return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(s => s.includes('moss'));
  });
  const beforeSet = new Set(beforeUrls);

  // Fill prompt
  const promptArea = hailuoPage.locator('[contenteditable]').first();
  await promptArea.click({ clickCount: 3 });
  await promptArea.fill(prompt);
  console.log(`  Shot ${shotNum}: prompt filled`);

  // Click generate
  const genBtn = hailuoPage.locator('button').filter({ hasText: /25/i }).first();
  await genBtn.click({ force: true });
  console.log(`  Shot ${shotNum}: generate clicked`);

  // Wait for new CDN URL
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

    if (attempts % 10 === 0) console.log(`  Shot ${shotNum}: waiting ${attempts * 3}s...`);
  }

  if (newUrl) {
    try {
      const result = await downloadWithCookies(hailuoPage, newUrl);
      const buffer = Buffer.from(result.data, 'base64');
      writeFileSync(outFile, buffer);
      console.log(`  Shot ${shotNum}: saved ${buffer.length} bytes`);
    } catch(e) {
      console.log(`  Shot ${shotNum}: download failed: ${e.message}`);
    }
  } else {
    console.log(`  Shot ${shotNum}: no URL found`);
  }
}

async function produceVideo(id, outputDir, shots) {
  console.log(`\n=== Producing ${id} ===`);
  mkdirSync(outputDir, { recursive: true });

  for (const shot of shots) {
    const outFile = resolve(outputDir, `raw_shot_${shot.num}.mp4`);
    try {
      await generateShot(hailuoPage, shot.num, shot.prompt, outFile);
    } catch(e) {
      console.log(`  Error shot ${shot.num}: ${e.message}`);
    }
  }

  const files = readdirSync(outputDir).filter(f => f.startsWith('raw_shot_') && f.endsWith('.mp4'));
  console.log(`  Output files: ${files.length}`);
  for (const f of files) {
    const size = statSync(resolve(outputDir, f)).size;
    console.log(`    ${f}: ${size} bytes`);
  }
}

// XIANYX-41 prompts (5 shots)
const xianyx41 = [
  { num: 1, prompt: "Wide shot — dawn over the Crimson Phoenix temple courtyard, one year after the winter solstice. One hundred disciples in grey, crimson, and white robes stand in rows across the temple courtyard — from one hundred different sects. The temple has become a university of peace. She stands at the teaching altar in full crimson phoenix regalia — phoenix hairpin gleaming, crimson and gold robes complete. Camera: wide establishing shot, dawn temple, disciples gathered, her in full regalia before teaching altar. [Wide — dawn temple, one hundred disciples gathered, teaching altar]" },
  { num: 2, prompt: "Medium shot — she stands at the teaching altar, one hundred disciples before her. She raises her hand to teach. A figure in white cloud robes appears at the courtyard entrance — the Supreme Cultivator. The air changes around him. The one figure in the cultivation world who answers to no throne, no sect, no patriarch. Camera: medium shot, her teaching, then pan to the Supreme Cultivator arriving. [Medium — teaching, Supreme Cultivator arrives]" },
  { num: 3, prompt: "Close-up — the Supreme Cultivator watches from the shadows, troubled. He watches her teach philosophy but the disciples still hold swords. He steps forward and interrupts the lesson. Camera: close-up on his troubled face, then medium shot of him stepping forward. [Close-up — troubled Supreme Cultivator, then stepping forward]" },
  { num: 4, prompt: "Medium shot — she looks at the Supreme Cultivator without fear. He asks: The Crimson Decree — protection without wisdom — is just war with better intentions. What is the FIRST lesson? She answers without hesitation: The first lesson — is that you will never need the blade — if you are brave enough to be vulnerable first. Camera: medium shot, dialogue exchange between them. [Medium — dialogue exchange, vulnerability philosophy]" },
  { num: 5, prompt: "Wide shot — the Supreme Cultivator kneels — not to her power — to her wisdom. He declares: the Crimson Phoenix Sect is REAL — recognized by the cultivation world's highest authority. She places her hand on his shoulder. The first lesson begins. Camera: wide shot, him kneeling to wisdom, her hand on his shoulder, dawn light through temple columns. [Wide — kneeling to wisdom, first lesson begins]" }
];

const xianyx42 = [
  { num: 1, prompt: "Wide shot — a palace courtyard, one year after the winter solstice. Half the court prepares cold blue mourning flowers — old tradition honoring what the gravekeeper took. The other half prepares warm orange chrysanthemums — new tradition honoring what the gravekeeper healed. A family arrives at the palace gates. Camera: wide establishing shot, palace courtyard with two groups preparing different flowers, family arriving at gates. [Wide — palace courtyard, two flower traditions, family arriving]" },
  { num: 2, prompt: "Close-up — she stands at the palace gates with her family. She is one year old, glowing faintly with warm orange-gold phoenix fire — her first breath was taken in white-gold flame. She has no fear. Camera: close-up on her glowing with warm fire, family beside her. [Close-up — one year old, warm phoenix fire glow, no fear]" },
  { num: 3, prompt: "Wide shot — the court is divided. Half the officials see her and reach for cold blue flowers. The other half sees her warm fire and reaches for orange chrysanthemums. The family walks between them. Camera: wide shot, the court dividing between two traditions as she walks through. [Wide — court dividing between blue and orange flowers as she walks]" },
  { num: 4, prompt: "Medium close-up — she looks at the divided court. Her warm fire reflects in the eyes of those holding orange flowers. She understands: three thousand years of funeral fires ended with one small hand reaching toward warmth instead of death. Camera: medium close-up on her face and the warm fire reflected in court officials' eyes. [Medium close-up — warm fire reflected in eyes]" },
  { num: 5, prompt: "Wide shot — the warm orange chrysanthemums win. The court turns to orange. She walks toward the palace doors, her small hand glowing with warm fire. Three thousand years of cold. Three thousand years of funeral fires. Ending with one child's first warm fire. Camera: wide shot, orange flowers dominating, her walking toward palace doors in warm fire glow. [Wide — orange flowers win, walking toward palace in warm fire]" }
];

const xianyx44 = [
  { num: 1, prompt: "Extreme wide shot — a vast ancient Chinese imperial palace at sunrise. Morning mist drifts across marble courtyards. Red and gold banners hang from towering columns. Court officials in elaborate robes walk the corridors with purpose. A young imperial scholar in simple white and blue robes walks through the crowd unnoticed — invisible, unremarkable. Camera: extreme wide establishing shot, imperial palace at sunrise, the scholar walking through the crowd unnoticed. [Extreme wide — imperial palace at sunrise, scholar unnoticed in crowd]" },
  { num: 2, prompt: "Medium shot — he sits alone in a corner of the imperial library, surrounded by towering scrolls and ancient texts. His fingers trace characters in old books. He is quiet, observant, underestimated. Camera: medium shot, him in library corner surrounded by scrolls, quietly reading. [Medium — scholar alone in library corner with scrolls]" },
  { num: 3, prompt: "Close-up — he looks up from his book. His eyes — sharp, ancient, too knowing. For a moment, a faint violet light flickers behind his pupils — the Crimson Phoenix Fire, recognizing its true heir. He blinks it away. Camera: close-up on his face, violet flicker in eyes, then back to quiet scholar facade. [Close-up — violet fire flicker in eyes, scholar facade]" },
  { num: 4, prompt: "Wide shot — a commotion erupts in the palace corridor outside the library. Soldiers rush past with weapons drawn. The scholar looks up calmly, then returns to his book. Camera: wide shot, commotion in corridor, soldiers rushing past, scholar remains completely calm reading. [Wide — soldiers rushing past, scholar remains calm]" },
  { num: 5, prompt: "Medium close-up — he closes his book slowly and stands. He walks toward the window overlooking the imperial garden. A single crimson phoenix feather floats past the window on the morning breeze. He smiles faintly — cold, ancient, knowing. Camera: medium close-up, closing book, walking to window, crimson feather floating past, faint cold smile. [Medium close-up — cold smile at crimson feather, window scene]" }
];

const xianyx45 = [
  { num: 1, prompt: "Extreme wide shot — the same ancient palace at dusk. The scholar walks through the imperial corridors as firelight from torches casts dancing shadows on red walls. Court officials whisper as he passes. No one knows what he is truly capable of. Camera: extreme wide establishing shot, palace corridors at dusk, torches casting firelight shadows, whispers following him. [Extreme wide — palace corridors at dusk, firelight shadows, whispers following]" },
  { num: 2, prompt: "Wide shot — he walks through the imperial garden. A phoenix feather is embedded in the stone path — planted there deliberately. He stops, picks it up. It glows faintly with warm crimson fire. Camera: wide shot, imperial garden at dusk, him stopping at phoenix feather embedded in stone path. [Wide — phoenix feather embedded in stone path, glowing]" },
  { num: 3, prompt: "Close-up — he examines the phoenix feather. It is warm to the touch. A message encoded in fire: the Crimson Phoenix Sect has been reborn. He has been found. Camera: close-up on the glowing phoenix feather in his hand, warm crimson fire pulsing. [Close-up — phoenix feather glowing with warm fire, encoded message]" },
  { num: 4, prompt: "Wide shot — he closes his fist around the feather. When he opens it, the feather has transformed into a small phoenix ember floating above his palm. The Crimson Phoenix Fire recognizes him. Camera: wide shot, feather transforming into floating ember above his palm in the dusk garden. [Wide — feather transforming into floating ember above palm]" },
  { num: 5, prompt: "Medium close-up — he looks up from the ember. His quiet scholarly eyes are gone. In their place: ancient, cold, absolute certainty. He has been waiting for this. Three thousand years of patience. Now the real game begins. Camera: medium close-up, his expression transforming from scholar to ancient fire, cold knowing smile. [Medium close-up — scholar eyes transforming to ancient fire, cold knowing smile]" }
];

await produceVideo('XIANYX-41', resolve(__dirname, 'output/xianxia/XIANYX-41'), xianyx41);
await produceVideo('XIANYX-42', resolve(__dirname, 'output/xianxia/XIANYX-42'), xianyx42);
await produceVideo('XIANYX-44', resolve(__dirname, 'output/xianxia/XIANYX-44'), xianyx44);
await produceVideo('XIANYX-45', resolve(__dirname, 'output/xianxia/XIANYX-45'), xianyx45);

await browser.close();
console.log('\nDone!');
