// hailuo-diag9.js - Check "My Videos" page after generation
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

// Get initial My Videos
await app._page.goto('https://hailuoai.video/my-videos', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

const getMyVideosUrls = async () => {
  return app._page.evaluate(() => {
    // Try video elements
    const videos = Array.from(document.querySelectorAll('video')).map(v => v.src?.slice(-40) || '');
    // Try links
    const links = Array.from(document.querySelectorAll('a[href*=".mp4"]')).map(a => a.href?.slice(-40) || '');
    // Try img thumbnails with video data
    const thumbs = Array.from(document.querySelectorAll('[data-video-id], [data-src*="mp4"]')).map(el => el.dataset.src || el.dataset.videoId || '').filter(Boolean);
    return { videos: videos.slice(0, 10), links: links.slice(0, 10), thumbs };
  });
};

const before = await getMyVideosUrls();
console.log('My Videos BEFORE:');
console.log('  videos:', before.videos);
console.log('  links:', before.links);

// Go to create page and submit
await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

const textarea = app._page.locator('div[contenteditable]').first();
await textarea.evaluate(el => {
  el.textContent = 'Beautiful woman cliff sunset ocean dramatic cinematic portrait';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const submitBtn = app._page.locator('button.new-color-btn-bg').first();
await submitBtn.click({ force: true });
console.log('\nSubmit clicked, waiting 60s for generation...');
await new Promise(r => setTimeout(r, 60000));

// Now check My Videos again
await app._page.goto('https://hailuoai.video/my-videos', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 5000));

const after = await getMyVideosUrls();
console.log('\nMy Videos AFTER:');
console.log('  videos:', after.videos.slice(0, 10));
console.log('  links:', after.links.slice(0, 10));

// Find what's new
const newVideos = after.videos.filter(v => !before.videos.includes(v));
const newLinks = after.links.filter(l => !before.links.includes(l));
console.log('\nNEW videos:', newVideos);
console.log('NEW links:', newLinks);

if (newLinks.length > 0) {
  console.log('\n*** NEW VIDEO FOUND:', newLinks[0]);
}

await app.close();
