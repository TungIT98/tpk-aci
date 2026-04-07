// scripts/hailuo-diag.js - Quick diagnostic: check Hailuo page state
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();
console.log('Logged in:', await app.isLoggedIn());

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));
console.log('URL:', app._page.url());

// Check what elements exist
const btns = await app._page.locator('button').evaluateAll(els => 
  els.map(e => ({ t: e.textContent?.trim().slice(0,50), c: e.className.slice(0,50) }))
);
console.log('Buttons:', JSON.stringify(btns.slice(0, 10), null, 2));

const textareas = await app._page.locator('textarea').count();
const contenteditable = await app._page.locator('div[contenteditable]').count();
const videos = await app._page.locator('video').count();
const mp4Links = await app._page.locator('a[href*=".mp4"]').count();
const mp4Hrefs = mp4Links > 0 ? await app._page.locator('a[href*=".mp4"]').evaluateAll(els => els.map(e => e.href)) : [];
console.log({ textareas, contenteditable, videos, mp4Links, mp4Hrefs });

// Check body text
const body = await app._page.locator('body').innerText().catch(() => '');
console.log('Body text (300 chars):', body.slice(0, 300));

await app.close();
