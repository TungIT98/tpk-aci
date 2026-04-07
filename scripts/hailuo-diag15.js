// hailuo-diag15.js - Test blob URL interception via page.route
import { HailuoApp } from '../lib/hailuo-app.js';
import { writeFileSync } from 'fs';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Intercept ALL requests, including blob: ones
let blobData = null;
let blobCount = 0;

await app._page.route('**/*', async (route) => {
  const url = route.request().url();
  
  if (url.startsWith('blob:')) {
    blobCount++;
    console.log(`[${new Date().toISOString().slice(11,19)}] Blob intercepted: ${url.slice(-50)}`);
    
    try {
      // Try to fetch the blob response
      const resp = await route.fetch();
      const body = await resp.body();
      const ct = resp.headers()['content-type'] || 'video/mp4';
      blobData = { body, contentType: ct, url };
      console.log(`  Got blob body: ${(body.length / 1024 / 1024).toFixed(1)}MB ${ct}`);
      
      // Return the blob as-is to not break the page
      await route.fulfill({
        status: 200,
        contentType: ct,
        body,
      });
    } catch (e) {
      console.log(`  Blob intercept failed: ${e.message}`);
      await route.abort();
    }
  } else {
    await route.continue();
  }
});

// Submit
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.click();
await app._page.keyboard.press('Control+A');
await app._page.keyboard.press('Backspace');
await new Promise(r => setTimeout(r, 300));
await app._page.keyboard.type('Beautiful woman cliff sunset ocean cinematic dramatic', { delay: 30 });
await new Promise(r => setTimeout(r, 500));

await app._page.evaluate(() => {
  const btn = document.querySelector('button.new-color-btn-bg');
  btn?.scrollIntoView({ block: 'center' });
  btn?.click();
});

console.log('Submit clicked! Monitoring blob...');

// Wait up to 90s for blob
const startTime = Date.now();
while (!blobData && Date.now() - startTime < 90000) {
  await new Promise(r => setTimeout(r, 5000));
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[${elapsed}s] No blob yet. blobCount=${blobCount}`);
}

if (blobData) {
  console.log('\n*** BLOB CAPTURED! ***');
  console.log(`Size: ${(blobData.body.length / 1024 / 1024).toFixed(1)}MB`);
  console.log(`Type: ${blobData.contentType}`);
  
  // Save to file
  const path = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output/test-blob.mp4';
  writeFileSync(path, Buffer.from(blobData.body));
  console.log(`Saved to: ${path}`);
} else {
  console.log('\nNo blob captured in 90s');
}

await app.close();
