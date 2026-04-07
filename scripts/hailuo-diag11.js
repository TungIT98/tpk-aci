// hailuo-diag11.js - Check My Videos page for NEW video after generation
import { HailuoApp } from '../lib/hailuo-app.js';

const app = new HailuoApp({ headless: true });
await app.init();

// Get My Videos BEFORE
await app._page.goto('https://hailuoai.video/my-videos', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

const getVideoList = async () => {
  return app._page.evaluate(() => {
    // Try multiple selectors
    const videoThumbs = Array.from(document.querySelectorAll('[class*="video-item"], [class*="asset-item"], [class*="my-video"]'));
    const videoCards = Array.from(document.querySelectorAll('[data-video-id], [data-id]'));  
    const links = Array.from(document.querySelectorAll('a[href*="video"], a[href*="play"]')).map(a => a.href?.slice(-40) || '').filter(Boolean);
    const imgs = Array.from(document.querySelectorAll('img[src*="thumbnail"], img[src*="cover"]')).map(img => img.src?.slice(-40) || '').filter(Boolean);
    
    // Get ALL href attributes that look like video URLs
    const allHrefs = Array.from(document.querySelectorAll('[href]')).map(a => a.href).filter(h => h.includes('video') || h.includes('mp4') || h.includes('play'));
    const allVideoHrefs = allHrefs.map(h => h.slice(-40)).filter(Boolean);
    
    return { links, imgs, videoCards: videoCards.length, allVideoHrefs: allVideoHrefs.slice(0, 10) };
  });
};

const before = await getVideoList();
console.log('My Videos BEFORE:');
console.log('  links:', before.links.slice(0, 5));
console.log('  imgs:', before.imgs.slice(0, 5));
console.log('  videoCards:', before.videoCards);
console.log('  allHrefs:', before.allVideoHrefs.slice(0, 5));

// Go to create page and submit
await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

const textarea = app._page.locator('div[contenteditable]').first();
await textarea.click();
await app._page.keyboard.press('Control+A');
await app._page.keyboard.press('Backspace');
await new Promise(r => setTimeout(r, 500));
await app._page.keyboard.type('Beautiful woman cliff sunset ocean golden hour wind cinematic', { delay: 30 });
await new Promise(r => setTimeout(r, 500));

console.log('\nSubmitting...');
await app._page.evaluate(() => {
  const btn = document.querySelector('button.new-color-btn-bg');
  if (btn) { btn.scrollIntoView(); btn.click(); }
});
console.log('Submit clicked! Waiting 30s for generation...');
await new Promise(r => setTimeout(r, 30000));

// Now check My Videos AFTER
await app._page.goto('https://hailuoai.video/my-videos', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 5000));

const after = await getVideoList();
console.log('\nMy Videos AFTER:');
console.log('  links:', after.links.slice(0, 5));
console.log('  imgs:', after.imgs.slice(0, 5));
console.log('  videoCards:', after.videoCards);
console.log('  allHrefs:', after.allVideoHrefs.slice(0, 5));

// Find NEW items
const newLinks = after.links.filter(l => !before.links.includes(l));
const newImgs = after.imgs.filter(i => !before.imgs.includes(i));
const newHrefs = after.allVideoHrefs.filter(h => !before.allVideoHrefs.includes(h));
console.log('\nNEW links:', newLinks);
console.log('NEW imgs:', newImgs);
console.log('NEW hrefs:', newHrefs);

// Also check the page content
const bodyText = await app._page.locator('body').innerText().catch(() => '');
console.log('\nMy Videos page body (300 chars):', bodyText.slice(0, 300));

await app.close();
