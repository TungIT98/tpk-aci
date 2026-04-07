// hailuo-diag14.js - Inspect video element attributes for downloadable URL
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Submit
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.click();
await app._page.keyboard.press('Control+A');
await app._page.keyboard.press('Backspace');
await new Promise(r => setTimeout(r, 300));
await app._page.keyboard.type('Beautiful woman cliff sunset ocean cinematic', { delay: 30 });
await new Promise(r => setTimeout(r, 500));

await app._page.evaluate(() => {
  const btn = document.querySelector('button.new-color-btn-bg');
  btn?.scrollIntoView({ block: 'center' });
  btn?.click();
});

console.log('Submit clicked! Monitoring for blob...');

// Monitor video elements every 5s for 90s
for (let i = 0; i < 18; i++) {
  await new Promise(r => setTimeout(r, 5000));
  
  const state = await app._page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video')).map((v, idx) => {
      // Get ALL possible URL sources
      const src = v.src;
      const currentSrc = v.currentSrc;
      const msSrc = v.msSrcUrl;
      
      // Check for video/data source in attributes
      const parent = v.parentElement;
      const parentSrc = parent?.src;
      const parentCurrentSrc = parent?.currentSrc;
      
      // Check for source child element
      const sourceEl = v.querySelector('source');
      const sourceSrc = sourceEl?.src;
      
      // Check data attributes
      const dataSrc = v.getAttribute('data-src') || v.getAttribute('data-url');
      
      // Video properties
      const readyState = v.readyState;
      const duration = v.duration;
      
      // Try to get the actual network URL via getVideoPlaybackQuality or other APIs
      let playbackUrl = null;
      try {
        if ('getVideoPlaybackQuality' in v) {
          const pq = v.getVideoPlaybackQuality();
          playbackUrl = 'getVideoPlaybackQuality available';
        }
      } catch {}
      
      // Also check video element's outerHTML for embedded URLs
      const outerHtml = v.outerHTML?.slice(0, 200);
      
      return {
        idx,
        src: src.slice(-40),
        currentSrc: currentSrc.slice(-40),
        msSrc: msSrc?.slice(-40) || null,
        sourceSrc: sourceSrc?.slice(-40) || null,
        dataSrc: dataSrc?.slice(-40) || null,
        readyState,
        duration: duration?.toFixed(2),
        playbackUrl,
        outerHtml: outerHtml?.slice(0, 100),
      };
    });
    return { videos, totalVideos: videos.length };
  });
  
  const elapsed = (i + 1) * 5;
  const hasBlob = state.videos.some(v => v.src.startsWith('blob:') || v.currentSrc.startsWith('blob:'));
  
  console.log(`\n[${elapsed}s] ${state.totalVideos} videos | hasBlob=${hasBlob}`);
  for (const v of state.videos) {
    if (hasBlob || v.readyState >= 3) {
      console.log(`  [${v.idx}] src=${v.src} currentSrc=${v.currentSrc} state=${v.readyState} dur=${v.duration}s`);
      console.log(`       src=${v.src}`);
      console.log(`       currentSrc=${v.currentSrc}`);
      if (v.dataSrc) console.log(`       dataSrc=${v.dataSrc}`);
      if (v.outerHtml) console.log(`       outerHTML=${v.outerHtml}`);
    }
  }
  
  if (hasBlob) {
    // Try to find ANY downloadable URL
    const downloadable = await app._page.evaluate(() => {
      // Look everywhere for .mp4 URLs
      const allText = document.body.innerHTML;
      const mp4Matches = allText.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/gi) || [];
      return mp4Matches.map(m => m.slice(0, 80)).slice(0, 5);
    });
    console.log('  Downloadable URLs found:', downloadable);
    break;
  }
}

await app.close();
