// Quick script to extract PW-06 video URL from Hailuo
import { chromium } from 'playwright';

const CDP_URL = 'http://127.0.0.1:18800';
const TARGET_ID = '43C6E84B042CC5D82D1F386903ABAD2D';

async function main() {
  console.log('Connecting to existing browser via CDP...');
  const browser = await chromium.connectOverCDP(`ws://${CDP_URL}/devtools/page/${TARGET_ID}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0] || page;
  
  console.log('Current URL:', page.url());
  
  // Navigate to create page
  await page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('After nav URL:', page.url());
  
  // Wait for video list to load
  await page.waitForTimeout(3000);
  
  // Try to find the video text
  const bodyText = await page.locator('body').innerText();
  const idx = bodyText.indexOf('2pm rubbing');
  console.log('Found PW-06 text:', idx >= 0);
  
  // Try to find video elements
  const videos = await page.locator('video').count();
  const mp4Links = await page.locator('a[href*=".mp4"]').count();
  const downloadBtns = await page.locator('button:has-text("Download"), button:has-text("下载")').count();
  
  console.log(`Videos: ${videos}, MP4 links: ${mp4Links}, Download buttons: ${downloadBtns}`);
  
  // Try to find video URL via page.evaluate
  const result = await page.evaluate(() => {
    const urls = [];
    // Check all video elements
    document.querySelectorAll('video').forEach(v => {
      if (v.src) urls.push({type: 'video_src', url: v.src.substring(0, 100)});
    });
    // Check all anchor elements
    document.querySelectorAll('a[href*="mp4"], a[href*="video"]').forEach(a => {
      urls.push({type: 'anchor', url: a.href.substring(0, 100)});
    });
    // Check all buttons with download
    document.querySelectorAll('[download], [class*="download"]').forEach(el => {
      const href = el.href || el.getAttribute('data-url') || el.getAttribute('data-src');
      if (href) urls.push({type: 'download_attr', url: href.substring(0, 100)});
    });
    return urls;
  });
  
  console.log('URLs found:', JSON.stringify(result, null, 2));
  
  await browser.close();
}

main().catch(console.error);
