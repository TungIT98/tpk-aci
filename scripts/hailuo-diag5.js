// scripts/hailuo-diag5.js - Intercept the API call and job ID
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Intercept ALL API requests to find the generation API
let jobResponse = null;
app._page.on('response', async resp => {
  const url = resp.url();
  // Look for task/job/video creation API calls
  if (resp.status() >= 200 && (url.includes('task') || url.includes('video') || url.includes('generate') || url.includes('create') || url.includes('submit'))) {
    try {
      const text = await resp.text().catch(() => '');
      console.log(`[${resp.status()}] ${url.slice(-80)}`);
      if (text.length < 500) console.log('  Body:', text.slice(0, 300));
    } catch {}
  }
  // Any POST that might be the generation request
  if (resp.status() === 201 && url.includes('hailuo')) {
    console.log('*** 201 RESPONSE:', url.slice(-100));
    try {
      const json = await resp.json().catch(() => null);
      console.log('  JSON:', JSON.stringify(json)?.slice(0, 300));
      jobResponse = json;
    } catch {}
  }
});

// Fill prompt and submit
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.evaluate(el => {
  el.textContent = 'Beautiful woman on cliff watching sunset ocean golden hour';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
console.log('Prompt filled');

const submitBtn = app._page.locator('button.new-color-btn-bg').first();
await submitBtn.click({ force: true });
console.log('Submit clicked!');

// Wait for the job response
await new Promise(r => setTimeout(r, 15000));

// Also check current page for any new video elements
const videos = await app._page.locator('video').evaluateAll(els => 
  els.map(e => e.src?.slice(-40))
);
const mp4Links = await app._page.locator('a[href*=".mp4"]').evaluateAll(els => els.map(e => e.href?.slice(-40))).catch(() => []);
console.log('\nCurrent videos:', videos);
console.log('MP4 links:', mp4Links);

// Try to go to the homepage and see recent videos
await app._page.goto('https://hailuoai.video/', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2000));
const homeVideos = await app._page.locator('video').evaluateAll(els => 
  els.map(e => e.src?.slice(-40))
);
console.log('\nHomepage videos:', homeVideos.slice(0, 5));

await app.close();
