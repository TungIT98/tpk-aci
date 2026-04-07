// scripts/hailuo-diag2.js - Check page state right after submit
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Get video URLs before
const videosBefore = await app._page.locator('video').evaluateAll(els => 
  els.map(e => ({ src: e.src?.slice(0,80), currentSrc: e.currentSrc?.slice(0,80) }))
);
console.log('Videos BEFORE:', JSON.stringify(videosBefore.slice(0,5)));

// Fill prompt
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.evaluate(el => { el.textContent = 'Test prompt'; el.dispatchEvent(new Event('input', {bubbles:true})); });
console.log('Prompt filled');

// Click submit
const submitBtn = app._page.locator('button.new-color-btn-bg').first();
const btnText = await submitBtn.innerText().catch(() => '');
console.log('Submit button text:', btnText);
await submitBtn.click();
console.log('Submit clicked!');

// Immediately check page state (0 seconds after)
console.log('\n--- Immediately after submit (0s) ---');
console.log('URL:', app._page.url());
const videos0s = await app._page.locator('video').evaluateAll(els => 
  els.map(e => ({ src: e.src?.slice(0,80), currentSrc: e.currentSrc?.slice(0,80) }))
);
const mp4Links0s = await app._page.locator('a[href*=".mp4"]').evaluateAll(els => els.map(e => e.href)).catch(() => []);
const progress0s = await app._page.locator('[class*="progress"], [class*="loading"], [class*="spinner"], [role="progressbar"]').count();
console.log({ videos0s: videos0s.slice(0,3), mp4Links0s, progress0s });

// Wait 5 seconds and check again
await new Promise(r => setTimeout(r, 5000));
console.log('\n--- 5 seconds after submit ---');
console.log('URL:', app._page.url());
const videos5s = await app._page.locator('video').evaluateAll(els => 
  els.map(e => ({ src: e.src?.slice(0,80), currentSrc: e.currentSrc?.slice(0,80) }))
);
const mp4Links5s = await app._page.locator('a[href*=".mp4"]').evaluateAll(els => els.map(e => e.href)).catch(() => []);
const progress5s = await app._page.locator('[class*="progress"], [class*="loading"], [class*="spinner"], [role="progressbar"]').count();
const body5s = await app._page.locator('body').innerText().catch(() => '').then(t => t.slice(0, 200));
console.log({ videos5s: videos5s.slice(0,3), mp4Links5s, progress5s });
console.log('Body:', body5s);

await app.close();
