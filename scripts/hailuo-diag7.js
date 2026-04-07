// hailuo-diag7.js - Intercept the actual API response containing video URL
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Intercept ALL responses and look for anything with video data
// Specifically look for JSON responses from the hailuo API
app._page.on('response', async resp => {
  const url = resp.url();
  const status = resp.status();
  const ct = resp.headers()['content-type'] || '';
  
  // Only look at JSON responses from hailuo API
  if (ct.includes('json') || url.includes('api.hailuo') || url.includes('/api/')) {
    try {
      const text = await resp.text().catch(() => '');
      if (text.length > 0 && text.length < 5000 && (text.includes('mp4') || text.includes('video') || text.includes('url') || text.includes('asset') || text.includes('result'))) {
        console.log(`\n[${status}] ${url.slice(-100)}`);
        console.log('  CT:', ct);
        console.log('  Body:', text.slice(0, 500));
      }
    } catch {}
  }
});

console.log('Filling prompt...');
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.evaluate(el => {
  el.textContent = 'Beautiful woman on cliff watching sunset ocean golden hour wind in hair';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

const submitBtn = app._page.locator('button.new-color-btn-bg').first();
await submitBtn.click({ force: true });
console.log('Submit clicked! Waiting 30s for generation...');

await new Promise(r => setTimeout(r, 30000));

// Also check the current page video elements
const videos = await app._page.locator('video').evaluateAll(els => 
  els.map(e => ({ src: e.src?.slice(-50), currentSrc: e.currentSrc?.slice(-50) }))
);
console.log('\nCurrent videos on page:', JSON.stringify(videos));

// Check if there's a new video element
const videoCount = await app._page.locator('video').count();
console.log('Video count:', videoCount);

await app.close();
