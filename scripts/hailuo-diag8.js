// hailuo-diag8.js - Comprehensive video element monitoring
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Get ALL video element data BEFORE
const getAllVideoData = async () => {
  return app._page.evaluate(() => {
    return Array.from(document.querySelectorAll('video')).map((v, i) => ({
      index: i,
      src: v.src?.slice(-40) || '',
      currentSrc: v.currentSrc?.slice(-40) || '',
      readyState: v.readyState,
      networkState: v.networkState,
      paused: v.paused,
      duration: v.duration,
    }));
  });
};

const before = await getAllVideoData();
console.log('BEFORE submit:');
for (const v of before) console.log(' ', JSON.stringify(v));

// Fill and submit
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.evaluate(el => {
  el.textContent = 'Beautiful woman cliff sunset ocean wind hair golden hour cinematic';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const submitBtn = app._page.locator('button.new-color-btn-bg').first();
await submitBtn.click({ force: true });
console.log('\nSubmit clicked!');

let newVideoFound = false;
for (let i = 0; i < 60; i++) { // 60 * 2s = 120s max
  await new Promise(r => setTimeout(r, 2000));
  const after = await getAllVideoData();
  
  // Check for changes
  const changed = after.filter((v, idx) => {
    const b = before[idx];
    return !b || v.src !== b.src || v.currentSrc !== b.currentSrc;
  });
  
  const anyLoading = after.some(v => v.networkState === 2 || v.readyState < 3);
  const anyPlaying = after.some(v => !v.paused && v.readyState >= 3);
  
  if (i % 5 === 0 || changed.length > 0 || anyPlaying) {
    console.log(`\n[${(i+1)*2}s] ${after.length} videos | changed=${changed.length} | loading=${anyLoading} | playing=${anyPlaying}`);
    for (const v of after) {
      if (changed.some(c => c.index === v.index)) {
        console.log(`  *** CHANGED[${v.index}]: src=${v.src.slice(-30)} currentSrc=${v.currentSrc.slice(-30)}`);
      }
    }
  }
  
  if (changed.length > 0 && after.some(v => v.currentSrc && !v.currentSrc.includes('blob:') && v.readyState >= 3)) {
    const newVid = after.find(v => v.currentSrc && !v.currentSrc.includes('blob:') && v.readyState >= 3);
    if (newVid) {
      console.log('\n*** NEW VIDEO FOUND:', newVid.currentSrc.slice(-50));
      newVideoFound = true;
      break;
    }
  }
}

if (!newVideoFound) {
  console.log('\nNo new video detected in 120s');
  const final = await getAllVideoData();
  console.log('Final state:', JSON.stringify(final));
}

await app.close();
