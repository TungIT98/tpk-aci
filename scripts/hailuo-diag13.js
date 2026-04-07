// hailuo-diag13.js - Intercept SSE stream for video URL
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

// Intercept ALL responses, including streaming/SSE
const responses = [];
app._page.on('response', async resp => {
  const url = resp.url();
  const ct = resp.headers()['content-type'] || '';
  const status = resp.status();
  
  // Log any response from the hailuo relay endpoint
  if (url.includes('M-0EJopiYq')) {
    console.log(`\n*** SSE/RESPONSE[${status}] CT:${ct}`);
    console.log('  URL:', url.slice(-60));
    
    // Try to get the body as text
    try {
      // For SSE, the response body comes in chunks
      const clone = resp.clone();
      const text = await clone.text().catch(() => '');
      console.log('  Body (text):', text.slice(0, 500));
      
      // Also try as JSON
      const jsonClone = resp.clone();
      try {
        const json = await jsonClone.json().catch(() => null);
        if (json) console.log('  Body (json):', JSON.stringify(json).slice(0, 300));
      } catch {}
    } catch (e) {
      console.log('  Body error:', e.message);
    }
  }
  
  // Also check for any response containing video URLs
  if (status === 200 && (url.includes('.mp4') || url.includes('video') || url.includes('public_assets'))) {
    console.log(`\n*** VIDEO[${status}]:`, url.slice(-80));
  }
});

// Intercept requests
app._page.on('request', req => {
  const url = req.url();
  if (url.includes('M-0EJopiYq')) {
    console.log('\n>>> SSE REQUEST:', url.slice(-60));
    console.log('    PostData:', req.postData()?.slice(0, 100));
  }
});

console.log('Filling prompt...');
const textarea = app._page.locator('div[contenteditable]').first();
await textarea.click();
await app._page.keyboard.press('Control+A');
await app._page.keyboard.press('Backspace');
await new Promise(r => setTimeout(r, 300));
await app._page.keyboard.type('Beautiful woman cliff sunset ocean cinematic', { delay: 30 });
await new Promise(r => setTimeout(r, 500));

console.log('Clicking submit...');
await app._page.evaluate(() => {
  const btn = document.querySelector('button.new-color-btn-bg');
  btn?.scrollIntoView({ block: 'center' });
  btn?.click();
});

console.log('Waiting 60s for SSE stream...');
await new Promise(r => setTimeout(r, 60000));

console.log('\nDone waiting. Checking My Videos...');
await app._page.goto('https://hailuoai.video/my-videos', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 5000));

// Check for new videos
const myVideos = await app._page.evaluate(() => {
  // Look for any video-related elements
  const videos = Array.from(document.querySelectorAll('video')).map(v => v.src?.slice(-40) || '');
  const anchors = Array.from(document.querySelectorAll('a[href]')).map(a => ({ href: a.href.slice(-60), text: a.innerText?.slice(0, 30) })).filter(a => a.href.includes('video') || a.href.includes('mp4') || a.href.includes('play') || a.href.includes('hailuo'));
  return { videos, anchors: anchors.slice(0, 10) };
});

console.log('My Videos page videos:', myVideos.videos.slice(0, 5));
console.log('My Videos page anchors with video:', myVideos.anchors);

await app.close();
