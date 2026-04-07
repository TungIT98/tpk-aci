import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'output', 'xianxia', 'XIANYX-03');

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

const prompt = "Extreme wide shot — a young man lies face-down in the mud and ash of an ancient ruined courtyard. Torn grey disciple robes, bloodstained. Shattered stone pillars. Rain falls. He raises his head, defiant eyes meet camera. Lightning flashes. Camera: extreme wide establishing shot, slow push in.";

const cdpSession = await ctx.newCDPSession(hailuoPage);
await cdpSession.send('Network.enable');

cdpSession.on('Network.requestWillBeSent', params => {
  const url = params.request.url;
  if (url.includes('cdn.hailuoai') && !url.includes('SVDCMr') && !url.includes('sdk')) {
    console.log('  [REQ] ' + url.substring(0, 120));
  }
});

cdpSession.on('Network.responseReceived', params => {
  const url = params.response.url;
  const status = params.response.status;
  if (url.includes('cdn.hailuoai') && status !== 0) {
    console.log('  [RES] ' + url.substring(0, 120) + ' status=' + status);
  }
});

cdpSession.on('Network.loadingFinished', params => {
  const url = params.response.url;
  if (url.includes('cdn.hailuoai') && !url.includes('SVDCMr')) {
    console.log('  [DONE] ' + url.substring(0, 120));
  }
});

const promptArea = hailuoPage.locator('[contenteditable]').first();
await promptArea.click({ clickCount: 3 });
await promptArea.fill(prompt);
console.log('Prompt filled');

const genBtn = hailuoPage.locator('button').filter({ hasText: /25/i }).first();
await genBtn.click({ force: true });
console.log('Generate clicked - monitoring network for 60s...');

await hailuoPage.waitForTimeout(60000);

// Check current video srcs
const videoInfo = await hailuoPage.evaluate(() => {
  const results = [];
  for (const vid of document.querySelectorAll('video')) {
    if (vid.src && (vid.src.startsWith('http') || vid.src.startsWith('blob:'))) {
      results.push({
        src: vid.src.substring(0, 150),
        readyState: vid.readyState,
        currentSrc: vid.currentSrc ? vid.currentSrc.substring(0, 150) : '',
        duration: vid.duration
      });
    }
  }
  return results;
});
console.log('\nVideo srcs found:', JSON.stringify(videoInfo, null, 2));

try { await cdpSession.detach(); } catch(e) {}
await browser.close();
