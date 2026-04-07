// scripts/hailuo-diag4.js - Check network requests and "My Videos" section
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Monitor network requests/responses
const responses = [];
app._page.on('response', async resp => {
  if (resp.url().includes('hailuo') && (resp.url().includes('video') || resp.url().includes('generate') || resp.url().includes('create') || resp.url().includes('task'))) {
    responses.push({ url: resp.url().slice(-60), status: resp.status() });
  }
});

// Fill prompt
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.evaluate(el => {
  el.textContent = 'Beautiful woman on cliff watching sunset';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
console.log('Prompt filled');

// Click submit
const submitBtn = app._page.locator('button.new-color-btn-bg').first();
await submitBtn.click({ force: true });
console.log('Submit clicked!');

// Wait and collect responses
await new Promise(r => setTimeout(r, 10000));

console.log('\nNetwork responses during generation:');
for (const r of responses.slice(-20)) {
  console.log(`  ${r.status} ${r.url}`);
}

// Now try "My Videos" page
console.log('\nNavigating to My Videos...');
await app._page.goto('https://hailuoai.video/my-videos', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));
console.log('URL:', app._page.url());
const videos = await app._page.locator('video').evaluateAll(els => 
  els.map(e => e.src?.slice(-40))
);
const bodyText = await app._page.locator('body').innerText().catch(() => '').then(t => t.slice(0, 300));
console.log('My Videos page videos:', videos.slice(0, 5));
console.log('Body snippet:', bodyText.slice(0, 200));

await app.close();
