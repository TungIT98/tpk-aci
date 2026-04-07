// hailuo-diag10.js - Test submit with keyboard typing + better video detection
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

console.log('Page URL:', app._page.url());

// Get video URLs before
const before = await app._page.evaluate(() => 
  Array.from(document.querySelectorAll('video')).map(v => v.src?.slice(-30) || '')
);
console.log('Before submit videos:', before);

// Check initial page state
const initCheck = await app._page.evaluate(() => {
  return {
    url: window.location.href,
    hasPromptInput: !!document.querySelector('div[contenteditable]'),
    hasSubmitBtn: !!document.querySelector('button.new-color-btn-bg'),
    submitText: document.querySelector('button.new-color-btn-bg')?.innerText?.trim() || '',
    avatarCount: document.querySelectorAll('img[src*="avatar"]').length,
  };
});
console.log('Initial state:', initCheck);

// Fill prompt using keyboard typing (more reliable than fill())
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.click();
await app._page.keyboard.press('Control+A');
await app._page.keyboard.press('Backspace');
await new Promise(r => setTimeout(r, 500));

const prompt = 'Beautiful woman cliff sunset ocean cinematic portrait wind hair flowing';
await app._page.keyboard.type(prompt, { delay: 50 });
await new Promise(r => setTimeout(r, 500));

// Check prompt was filled
const afterFill = await app._page.evaluate(() => {
  const div = document.querySelector('div[contenteditable]');
  return { textContent: div?.textContent?.slice(0, 50), textLength: div?.textContent?.length };
});
console.log('After fill:', afterFill);

// Submit using evaluate (direct click to bypass any overlay issues)
await app._page.evaluate(() => {
  const btn = document.querySelector('button.new-color-btn-bg');
  if (btn) {
    btn.scrollIntoView();
    btn.click();
  } else {
    console.error('SUBMIT BUTTON NOT FOUND!');
  }
});
console.log('Submit clicked via evaluate!');

// Now monitor video elements and network responses every 3 seconds for 90 seconds
let foundNewVideo = false;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 3000));
  
  const state = await app._page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video')).map(v => ({
      src: v.src?.slice(-40) || '',
      currentSrc: v.currentSrc?.slice(-40) || '',
      readyState: v.readyState,
      networkState: v.networkState,
    }));
    const submitText = document.querySelector('button.new-color-btn-bg')?.innerText?.trim() || '';
    const hasLoading = !!document.querySelector('[class*="loading"], [class*="spinner"]');
    const hasPrompt = document.querySelector('div[contenteditable]')?.textContent?.slice(0, 40) || '';
    return { videos, submitText, hasLoading, hasPrompt, videoCount: videos.length };
  });
  
  const newVideos = state.videos.filter(v => !before.includes(v.src));
  const elapsed = (i + 1) * 3;
  console.log(`[${elapsed}s] videos=${state.videoCount} new=${newVideos.length} loading=${state.hasLoading} submitText="${state.submitText}"`);
  
  if (newVideos.length > 0) {
    console.log('*** NEW VIDEO DETECTED:', newVideos.map(v => v.src));
    foundNewVideo = true;
    break;
  }
}

if (!foundNewVideo) {
  console.log('\nNo new video detected in 90s');
}

await app.close();
