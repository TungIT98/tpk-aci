/**
 * produce-all-missing-shots.mjs
 * Generate Hailuo shots for ALL missing XIANYX videos.
 * Uses ensurePageReady() error recovery for robustness.
 *
 * Usage: node produce-all-missing-shots.mjs
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync, unlinkSync, statSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKDIR = __dirname; // Script is in TKP_ACI root
const SESSION_PATH = resolve(WORKDIR, '.hailuo-session.json');

// All missing videos that need shot generation
const MISSING_IDS = [
  'XIANYX-02','XIANYX-06','XIANYX-07','XIANYX-09','XIANYX-10',
  'XIANYX-12','XIANYX-13','XIANYX-14','XIANYX-15','XIANYX-16',
  'XIANYX-17','XIANYX-18','XIANYX-19','XIANYX-20','XIANYX-22',
  'XIANYX-23','XIANYX-24','XIANYX-25','XIANYX-26','XIANYX-27',
  'XIANYX-28','XIANYX-29','XIANYX-30','XIANYX-32','XIANYX-33',
  'XIANYX-35','XIANYX-36','XIANYX-37','XIANYX-38','XIANYX-39',
  'XIANYX-40','XIANYX-43'
];

const browser = await chromium.launch({
  headless: false,
  args: ['--disable-blink-features=AutomationControlled']
});
const ctx = await browser.newContext({
  storageState: SESSION_PATH
});
let hailuoPage = await ctx.newPage();
await hailuoPage.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 30000 });
await hailuoPage.waitForTimeout(2000);
console.log('Hailuo page ready (session restored)');

async function dismissConsentDialog() {
  // Cookie / sign-in consent banner blocks clicks — dismiss it
  try {
    // Try clicking "Accept" or "Agree" or "Continue" buttons commonly in consent dialogs
    const consentBtn = hailuoPage.locator('button').filter({ hasText: /accept|agree|continue|got it|allow/i }).first();
    if (await consentBtn.isVisible({ timeout: 2000 })) {
      await consentBtn.click({ force: true });
      await hailuoPage.waitForTimeout(500);
      return;
    }
  } catch(e) {}
  // Try pressing Escape to close modal overlays
  try {
    await hailuoPage.keyboard.press('Escape');
    await hailuoPage.waitForTimeout(300);
  } catch(e) {}
  // Try clicking the overlay backdrop to close it
  try {
    const overlay = hailuoPage.locator('section.fixed').first();
    if (await overlay.isVisible({ timeout: 1000 })) {
      // Click outside the dialog (bottom-right corner is usually outside)
      await hailuoPage.mouse.click(100, 900);
      await hailuoPage.waitForTimeout(300);
    }
  } catch(e) {}
}

async function ensurePageReady() {
  try {
    await hailuoPage.waitForSelector('[contenteditable]', { timeout: 5000 });
    await dismissConsentDialog();
    return true;
  } catch(e) {
    console.log('  Page stale, reloading...');
    await hailuoPage.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await hailuoPage.waitForTimeout(3000);
    await dismissConsentDialog();
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

  await ensurePageReady();

  let beforeSet;
  try {
    const beforeUrls = await hailuoPage.evaluate(() => {
      return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(s => s.includes('moss'));
    });
    beforeSet = new Set(beforeUrls);
  } catch(e) {
    console.log(`  Shot ${shotNum}: baseline error, reloading`);
    await ensurePageReady();
    const beforeUrls = await hailuoPage.evaluate(() => {
      return Array.from(document.querySelectorAll('video')).map(v => v.src).filter(s => s.includes('moss'));
    });
    beforeSet = new Set(beforeUrls);
  }

  try {
    const promptArea = hailuoPage.locator('[contenteditable]').first();
    await promptArea.click({ clickCount: 3, timeout: 10000, force: true });
    await promptArea.fill(prompt);
    console.log(`  Shot ${shotNum}: prompt filled`);
  } catch(e) {
    console.log(`  Shot ${shotNum}: fill error: ${e.message.substring(0, 50)}, reloading`);
    await ensurePageReady();
    const promptArea = hailuoPage.locator('[contenteditable]').first();
    await promptArea.click({ clickCount: 3, force: true });
    await promptArea.fill(prompt);
    console.log(`  Shot ${shotNum}: prompt filled after reload`);
  }

  try {
    const genBtn = hailuoPage.locator('button').filter({ hasText: /25/i }).first();
    await genBtn.click({ force: true, timeout: 5000 });
    await dismissConsentDialog(); // in case dialog reappeared after click
    console.log(`  Shot ${shotNum}: generate clicked`);
  } catch(e) {
    console.log(`  Shot ${shotNum}: click error: ${e.message.substring(0, 50)}, reloading`);
    await ensurePageReady();
    const genBtn = hailuoPage.locator('button').filter({ hasText: /25/i }).first();
    await genBtn.click({ force: true });
    await dismissConsentDialog();
    console.log(`  Shot ${shotNum}: generate clicked after reload`);
  }

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

async function produceVideo(id) {
  console.log(`\n=== Producing ${id} ===`);
  const scriptPath = resolve(WORKDIR, 'scripts', 'pending', 'xianxia', `${id}.json`);
  if (!existsSync(scriptPath)) {
    console.log(`  Script not found: ${scriptPath}`);
    return;
  }
  const script = JSON.parse(readFileSync(scriptPath, 'utf8'));
  const shots = script.shots || [];
  if (shots.length === 0) {
    console.log(`  No shots in script`);
    return;
  }

  const outputDir = resolve(WORKDIR, 'output', 'xianxia', id);
  mkdirSync(outputDir, { recursive: true });

  for (const shot of shots) {
    const outFile = resolve(outputDir, `raw_shot_${shot.shot_number || shot.num || shot.shotNum}.mp4`);
    const status = await generateShot(shot.shot_number || shot.num || shot.shotNum, shot.prompt, outFile);
    if (status === 'fail') {
      console.log(`  Shot ${shot.shot_number}: FAILED, continuing`);
    }
  }

  const files = readdirSync(outputDir).filter(f => f.startsWith('raw_shot_') && f.endsWith('.mp4'));
  console.log(`  Output files: ${files.length}`);
}

for (const id of MISSING_IDS) {
  try {
    await produceVideo(id);
  } catch(e) {
    console.error(`Error producing ${id}: ${e.message}`);
  }
}

await browser.close();
console.log('\nAll done!');
