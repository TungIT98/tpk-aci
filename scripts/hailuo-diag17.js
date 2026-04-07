// hailuo-diag17.js - Close modal popup first, then test submit
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Close any modals
const closed = await app._page.evaluate(() => {
  const closeBtns = Array.from(document.querySelectorAll('[class*="modal-close"], .ant-modal-close, [aria-label="close"], button[class*="close"]'));
  for (const btn of closeBtns) {
    btn.click();
  }
  return closeBtns.length;
});
console.log(`Closed ${closed} modal buttons`);

await new Promise(r => setTimeout(r, 1000));

// Check if modal is gone
const modalVisible = await app._page.evaluate(() => {
  return Array.from(document.querySelectorAll('.ant-modal')).some(el => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0;
  });
});
console.log('Modal still visible:', modalVisible);

// Fill prompt
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.click();
await app._page.keyboard.press('Control+A');
await app._page.keyboard.press('Backspace');
await new Promise(r => setTimeout(r, 300));
await app._page.keyboard.type('Beautiful woman cliff sunset ocean cinematic dramatic', { delay: 30 });
await new Promise(r => setTimeout(r, 500));

// Find submit button (the one that costs credits, NOT the Try it Now button)
const submitBtnInfo = await app._page.evaluate(() => {
  const allBtns = Array.from(document.querySelectorAll('button')).map(b => ({
    text: b.innerText?.trim().slice(0, 40),
    class: b.className?.slice(0, 60),
    disabled: b.disabled,
  }));
  const submitBtn = allBtns.find(b => b.text === '25' && !b.class.includes('Try'));
  const tryItBtns = allBtns.filter(b => b.class.includes('Try'));
  return { submitBtn, tryItBtns: tryItBtns.length, allBtns: allBtns.slice(0, 10) };
});
console.log('Submit button info:', JSON.stringify(submitBtnInfo, null, 2));

// Click submit button
await app._page.evaluate(() => {
  // Find the button that has exactly text "25" and is not "Try it Now"
  const btns = Array.from(document.querySelectorAll('button'));
  const submitBtn = btns.find(b => {
    const text = b.innerText?.trim();
    return text === '25' && !b.className?.includes('hl_text_07');
  });
  if (submitBtn) {
    submitBtn.scrollIntoView({ block: 'center' });
    submitBtn.click();
    console.log('Clicked submit button!');
  } else {
    console.log('Submit button not found!');
    // Try any button with "25"
    const btn25 = btns.find(b => b.innerText?.trim() === '25');
    if (btn25) {
      btn25.scrollIntoView({ block: 'center' });
      btn25.click();
      console.log('Clicked btn25 anyway');
    }
  }
});

await new Promise(r => setTimeout(r, 3000));

// Check if something changed
const afterState = await app._page.evaluate(() => {
  const videos = Array.from(document.querySelectorAll('video')).map(v => v.src?.slice(-40));
  const toasts = Array.from(document.querySelectorAll('[class*="toast"], [class*="notification"]')).map(el => el.innerText?.slice(0, 80));
  const btns = Array.from(document.querySelectorAll('button')).map(b => b.innerText?.trim()).filter(Boolean);
  return { videos, toasts, btns };
});
console.log('\nAfter submit:');
console.log('  Videos:', afterState.videos);
console.log('  Toasts:', afterState.toasts.slice(0, 3));
console.log('  Buttons:', afterState.btns.slice(0, 10));

await app.close();
