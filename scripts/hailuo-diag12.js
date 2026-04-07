// hailuo-diag12.js - Intercept console messages + network after submit
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Intercept console messages
const consoleLogs = [];
app._page.on('console', msg => {
  if (msg.type() !== 'debug') {
    consoleLogs.push(`[${msg.type()}] ${msg.text().slice(0, 200)}`);
  }
});

// Intercept ALL responses
const responses = [];
app._page.on('response', async resp => {
  const url = resp.url();
  const status = resp.status();
  const ct = resp.headers()['content-type'] || '';
  
  if (status >= 200 && (url.includes('hailuo') || url.includes('cdn') || url.includes('api'))) {
    try {
      const text = await resp.text().catch(() => '');
      if (text && text.length < 3000 && (text.includes('video') || text.includes('url') || text.includes('mp4') || text.includes('success') || text.includes('task') || text.includes('job'))) {
        responses.push({ url: url.slice(-80), status, ct: ct.slice(0, 30), body: text.slice(0, 200) });
      }
    } catch {}
  }
});

// Fill and submit
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.click();
await app._page.keyboard.press('Control+A');
await app._page.keyboard.press('Backspace');
await new Promise(r => setTimeout(r, 300));
await app._page.keyboard.type('Beautiful woman cliff sunset ocean golden hour wind dramatic', { delay: 30 });
await new Promise(r => setTimeout(r, 500));

// Check button before click
const btnBefore = await app._page.evaluate(() => {
  const btn = document.querySelector('button.new-color-btn-bg');
  return { text: btn?.innerText?.trim(), disabled: btn?.disabled, rect: btn ? btn.getBoundingClientRect() : null };
});
console.log('Button before click:', btnBefore);

console.log('\nSubmitting...');
await app._page.evaluate(() => {
  const btn = document.querySelector('button.new-color-btn-bg');
  btn?.scrollIntoView({ block: 'center' });
  btn?.click();
});

console.log('Waiting 60s...');
await new Promise(r => setTimeout(r, 60000));

console.log('\nConsole messages:');
for (const msg of consoleLogs.slice(0, 20)) console.log(' ', msg);

console.log('\nRelevant responses:');
for (const r of responses.slice(-30)) {
  console.log(`  [${r.status}] ${r.url}`);
  if (r.body) console.log('    Body:', r.body.slice(0, 150));
}

await app.close();
