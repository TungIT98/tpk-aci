// hailuo-sse-diag.js - Read SSE stream body from hailuo relay
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Use page.route to intercept ALL responses and read their bodies
const sseData = [];
await app._page.route('**/*', async (route, request) => {
  const url = request.url();
  
  // Don't intercept non-hailuo URLs
  if (!url.includes('hailuo')) {
    await route.continue();
    return;
  }
  
  // Read the response body for SSE streams
  try {
    const response = await route.fetch();
    const ct = response.headers()['content-type'] || '';
    
    // For SSE/text streams, read the body
    if (ct.includes('text') || ct.includes('stream') || ct.includes('event-stream')) {
      const body = await response.text();
      if (body && body.length > 0) {
        sseData.push({ url: url.slice(-60), body: body.slice(0, 500) });
      }
      await route.fulfill({ response });
      return;
    }
    
    await route.continue();
  } catch (e) {
    await route.continue();
  }
});

// Fill and submit
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.click();
await app._page.keyboard.press('Control+A');
await app._page.keyboard.press('Backspace');
await new Promise(r => setTimeout(r, 300));
await app._page.keyboard.type('Beautiful woman cliff sunset ocean cinematic dramatic', { delay: 30 });
await new Promise(r => setTimeout(r, 500));

console.log('Submitting...');
await app._page.evaluate(() => {
  const btn = document.querySelector('button.new-color-btn-bg');
  btn?.scrollIntoView({ block: 'center' });
  btn?.click();
});

console.log('Waiting 60s for SSE stream...');
await new Promise(r => setTimeout(r, 60000));

console.log('\nSSE data captured:');
for (const d of sseData) {
  console.log(`\nURL: ${d.url}`);
  console.log(`Body: ${d.body.slice(0, 300)}`);
}

await app.close();
