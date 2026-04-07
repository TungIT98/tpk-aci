// Extract PW-06 video URL from Hailuo using CDP connection to OpenClaw browser
import { chromium } from 'playwright';

const CDP = 'ws://127.0.0.1:18800/devtools/page/43C6E84B042CC5D82D1F386903ABAD2D';

async function main() {
  console.log('Connecting via CDP to OpenClaw Hailuo tab...');
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  const pages = ctx.pages();
  console.log('Pages:', pages.map(p => p.url()));
  
  // Use the page at index 0 or create new
  let page = pages[0];
  if (!page) {
    page = await ctx.newPage();
  }
  
  console.log('Using page URL:', page.url());
  
  // Navigate to Hailuo create page
  console.log('Navigating to Hailuo...');
  await page.goto('https://hailuoai.video/create/text-to-video', { 
    waitUntil: 'domcontentloaded', 
    timeout: 15000 
  });
  console.log('Page URL after nav:', page.url());
  await page.waitForTimeout(5000);
  
  // Check current URL
  const finalUrl = page.url();
  console.log('Final URL:', finalUrl);
  
  // Check if redirected
  if (finalUrl.includes('tiktok') || finalUrl.includes('youtube')) {
    console.log('REDIRECTED! Current page is:', finalUrl);
    console.log('Cannot access Hailuo without redirect.');
    await browser.close();
    return;
  }
  
  // Try to find the video
  console.log('Looking for PW-06 video...');
  
  // Method 1: Look for video text
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  const hasPW06 = bodyText.includes('2pm rubbing');
  console.log('Has PW-06 text:', hasPW06);
  
  // Method 2: Get all video/src URLs
  const videoData = await page.evaluate(() => {
    const videos = Array.from(document.querySelectorAll('video')).map(v => ({
      src: v.src?.substring(0, 150),
      currentSrc: v.currentSrc?.substring(0, 150),
      readyState: v.readyState
    }));
    const mp4Links = Array.from(document.querySelectorAll('a[href*=".mp4"]')).map(a => ({
      href: a.href?.substring(0, 150),
      download: a.download
    }));
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent?.trim().substring(0, 60),
      class: b.className?.substring(0, 80)
    })).filter(b => b.text.includes('Download') || b.text.includes('download'));
    return { videos, mp4Links, downloadButtons: buttons };
  });
  
  console.log('Video data:', JSON.stringify(videoData, null, 2));
  
  await browser.close();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
