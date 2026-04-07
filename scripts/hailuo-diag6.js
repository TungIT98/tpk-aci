// hailuo-diag6.js - Intercept API response body for video URL
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Intercept ALL responses and look for the one that contains video URL
let found = false;
app._page.on('response', async resp => {
  if (found) return;
  
  const url = resp.url();
  const status = resp.status();
  
  // Look for any response containing video URL
  if (status >= 200 && (url.includes('hailuo') || url.includes('cdn'))) {
    try {
      const ct = resp.headers()['content-type'] || '';
      const text = await resp.text().catch(() => '');
      
      // Look for video URLs in response body
      if (text.includes('.mp4') || text.includes('public_assets') || text.includes('video_url') || text.includes('download_url')) {
        console.log(`[${status}] ${url.slice(-80)}`);
        console.log('  Content-Type:', ct);
        console.log('  Body snippet:', text.slice(0, 300));
        console.log('---');
      }
    } catch {}
  }
});

// Intercept the submit POST request to get job ID
app._page.on('request', req => {
  if (found) return;
  const url = req.url();
  const method = req.method();
  if (method === 'POST' && (url.includes('task') || url.includes('video') || url.includes('generate') || url.includes('create'))) {
    console.log('POST request:', url.slice(-80));
    console.log('  Body:', req.postData()?.slice(0, 200));
  }
});

console.log('Filling prompt...');
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.evaluate(el => {
  el.textContent = 'Beautiful woman on cliff watching sunset ocean';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

const submitBtn = app._page.locator('button.new-color-btn-bg').first();
await submitBtn.click({ force: true });
console.log('Submit clicked!');

await new Promise(r => setTimeout(r, 30000));
console.log('Done waiting.');

await app.close();
