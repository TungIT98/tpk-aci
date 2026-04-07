// hailuo-diag16.js - Check button state and any toast/notification immediately after submit
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Intercept ALL console messages and errors
app._page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    console.log(`[CONSOLE ${msg.type()}] ${msg.text().slice(0, 200)}`);
  }
});

app._page.on('pageerror', err => {
  console.log(`[PAGE ERROR] ${err.message}`);
});

// Fill prompt
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.click();
await app._page.keyboard.press('Control+A');
await app._page.keyboard.press('Backspace');
await new Promise(r => setTimeout(r, 300));
await app._page.keyboard.type('Beautiful woman cliff sunset ocean cinematic', { delay: 30 });
await new Promise(r => setTimeout(r, 500));

// Check button BEFORE
const before = await app._page.evaluate(() => {
  const btn = document.querySelector('button.new-color-btn-bg');
  const allBtns = Array.from(document.querySelectorAll('button')).map(b => ({
    text: b.innerText?.trim()?.slice(0, 30),
    class: b.className?.slice(0, 40),
    disabled: b.disabled,
  }));
  return {
    btnText: btn?.innerText?.trim(),
    btnDisabled: btn?.disabled,
    btnClass: btn?.className?.slice(0, 40),
    allBtns: allBtns.slice(0, 8),
    // Check for toast/notification
    toasts: Array.from(document.querySelectorAll('[class*="toast"], [class*="notification"], [class*="popup"], [class*="modal"]')).map(el => ({
      class: el.className?.slice(0, 40),
      text: el.innerText?.slice(0, 100),
    })),
  };
});
console.log('Before submit:', JSON.stringify(before, null, 2));

// Submit
await app._page.evaluate(() => {
  const btn = document.querySelector('button.new-color-btn-bg');
  btn?.scrollIntoView({ block: 'center' });
  btn?.click();
});
console.log('Submit clicked!');

// Check IMMEDIATELY after (0s, 1s, 2s, 3s, 5s, 10s)
for (const delay of [0, 1, 2, 3, 5, 10, 15]) {
  await new Promise(r => setTimeout(r, delay === 0 ? 0 : 1000));
  
  const state = await app._page.evaluate(() => {
    const btn = document.querySelector('button.new-color-btn-bg');
    const toasts = Array.from(document.querySelectorAll('[class*="toast"], [class*="notification"], [class*="popup"], [class*="modal"], [class*="alert"]')).map(el => ({
      class: el.className?.slice(0, 50),
      text: el.innerText?.slice(0, 100),
      visible: el.offsetHeight > 0,
    }));
    
    // Check for any new elements
    const videos = Array.from(document.querySelectorAll('video')).map(v => v.src?.slice(-40));
    
    return {
      btnText: btn?.innerText?.trim(),
      btnDisabled: btn?.disabled,
      btnClass: btn?.className?.slice(0, 40),
      toasts,
      videos,
      url: window.location.href,
    };
  });
  
  console.log(`\n[${delay}s] After submit:`, JSON.stringify(state, null, 2));
}

await app.close();
