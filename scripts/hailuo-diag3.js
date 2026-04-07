// scripts/hailuo-diag3.js - Check page state with realistic prompt
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Fill with a REALISTIC prompt (not just "Test")
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.evaluate(el => {
  el.textContent = 'Beautiful woman with natural wavy hair, wearing flowy white dress, standing on cliff edge watching sunset over ocean. Wind blows through hair, closes eyes, takes deep breath. Opens eyes, face lit golden by sunset. Spins slowly with arms out, dress flowing.';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
console.log('Prompt filled (realistic)');

// Get video URLs before
const videosBefore = await app._page.locator('video').evaluateAll(els => 
  els.map(e => e.src?.slice(-40))
);
console.log('Videos before:', videosBefore.slice(0, 3));

// Click submit
const submitBtn = app._page.locator('button.new-color-btn-bg').first();
const btnText = await submitBtn.innerText().catch(() => '');
const btnDisabled = await submitBtn.isDisabled().catch(() => null);
console.log('Submit button text:', btnText, '| disabled:', btnDisabled);
await submitBtn.click({ force: true });
console.log('Submit clicked!');

// Wait and check page state at intervals
for (let i = 1; i <= 10; i++) {
  await new Promise(r => setTimeout(r, 3000));
  console.log(`\n--- ${i*3} seconds after submit ---`);
  console.log('URL:', app._page.url());
  
  const videos = await app._page.locator('video').evaluateAll(els => 
    els.map(e => e.src?.slice(-40))
  );
  const mp4Links = await app._page.locator('a[href*=".mp4"]').evaluateAll(els => els.map(e => e.href?.slice(-30))).catch(() => []);
  const progress = await app._page.locator('[class*="progress"], [class*="loading"], [class*="spinner"], [role="progressbar"]').count();
  const bodyText = await app._page.locator('body').innerText().catch(() => '').then(t => t.slice(0, 300));
  
  console.log('New videos:', videos.slice(0, 3));
  console.log('MP4 links:', mp4Links.slice(0, 3));
  console.log('Progress elements:', progress);
  console.log('Body snippet:', bodyText.slice(0, 150));
  
  // Check if any video URL changed from before
  const changedVideos = videos.filter(v => !videosBefore.includes(v));
  if (changedVideos.length > 0) {
    console.log('*** NEW VIDEO DETECTED:', changedVideos);
    break;
  }
}

await app.close();
