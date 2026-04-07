/**
 * check-youtube.js - Check YouTube for uploaded videos
 */
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/content', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Get video titles and links
  const videos = await page.$$eval('a#video-title', els => els.map(e => ({
    title: e.textContent?.trim(),
    href: e.href
  })));
  console.log('Recent videos:');
  videos.slice(0, 15).forEach(v => console.log(`  - ${v.title}: ${v.href}`));

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
