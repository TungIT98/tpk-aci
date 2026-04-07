#!/usr/bin/env node
/**
 * Retry TikTok upload - handles the "Continue to post?" copyright modal
 */
import { TikTokBrowser } from '../lib/upload/tiktok-browser.js';

const VIDEO_PATH = 'C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\uploads\\WC-02.mp4';
const CAPTION = `⚽ The Entire Bar Falls Silent

The ball gets passed. Then again. Then suddenly everyone's on their feet. Nobody breathes. The keeper stretches. The striker shoots. The net ripples. And then — absolute mayhem.

Beers spill. Strangers grab each other. Someone screams so loud the windows shake.

The bar has become a church and we are all preaching the same sermon: WE SCORED! ⚽

#worldcup #football #sportsbar #celebration #goals #soccer #fyp #viral`;

const TAGS = ['worldcup', 'football', 'sportsbar', 'celebration', 'goals', 'soccer', 'fyp', 'viral'];

async function main() {
  console.log('Starting TikTok upload retry for WC-02...');
  
  const uploader = new TikTokBrowser({ headless: true });
  
  try {
    await uploader.init();
    console.log('Browser initialized');
    
    // Navigate directly to upload page
    const { chromium } = await import('playwright');
    await uploader._page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    // Dismiss cookie banner
    await uploader._dismissCookieBanner();
    
    // Set file
    const fileInput = uploader._page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(VIDEO_PATH);
    console.log('File set');
    
    // Wait for processing
    await new Promise(r => setTimeout(r, 8000));
    
    // Fill caption
    const captionText = [CAPTION, ...TAGS.map(t => t.startsWith('#') ? t : `#${t}`)].join(' ');
    const captionTextarea = uploader._page.locator(
      '[data-e2e="video-desc-input"], div[contenteditable="true"], textarea[placeholder*="aption"]'
    ).first();
    
    if (await captionTextarea.count() > 0) {
      await captionTextarea.click();
      await captionTextarea.fill(captionText);
    }
    console.log('Caption filled');
    await new Promise(r => setTimeout(r, 3000));
    
    // Scroll to bottom
    await uploader._page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));
    
    // Click POST button via evaluate
    await uploader._page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => {
        const text = b.textContent.trim();
        return (text === 'Đăng' || text === 'Post') && b.offsetParent !== null && !b.disabled;
      });
      if (btn) btn.click();
    });
    console.log('POST clicked');
    await new Promise(r => setTimeout(r, 3000));
    
    // Check for English "Continue to post?" dialog
    const bodyText = (await uploader._page.locator('body').innerText().catch(() => ''));
    
    if (bodyText.toLowerCase().includes('continue to post') || bodyText.toLowerCase().includes('copyright check')) {
      console.log('Copyright modal detected - clicking Post anyway...');
      // Find and click "Continue to post" / "Post now" / "Đăng ngay" button
      await uploader._page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        // Look for "Continue to post", "Post now", "Đăng ngay", or just the first red/pink button
        for (const btn of buttons) {
          const text = btn.textContent.trim().toLowerCase();
          if (text === 'continue to post' || text === 'post now' || text === 'đăng ngay') {
            btn.click();
            console.log('Clicked:', text);
            return;
          }
        }
        // Fallback: click the last visible enabled button
        const visibleBtns = buttons.filter(b => b.offsetParent !== null && !b.disabled);
        if (visibleBtns.length > 0) {
          visibleBtns[visibleBtns.length - 1].click();
        }
      });
      await new Promise(r => setTimeout(r, 5000));
    }
    
    // Wait for upload result
    await new Promise(r => setTimeout(r, 10000));
    
    const finalText = (await uploader._page.locator('body').innerText().catch(() => ''));
    const finalUrl = uploader._page.url();
    console.log('Final URL:', finalUrl);
    console.log('Final text snippet:', finalText.slice(0, 300));
    
    // Check success
    const successKeywords = ['đăng thành công', 'posted successfully', 'your video has been posted', 'view post', 'xem video'];
    const isSuccess = successKeywords.some(k => finalText.toLowerCase().includes(k)) || !finalUrl.includes('/upload');
    
    if (isSuccess) {
      console.log('✅ TikTok upload SUCCESS');
    } else {
      console.log('❌ TikTok upload status unclear');
      await uploader._page.screenshot({ path: 'tiktok-retry-result.png' }).catch(() => {});
    }
    
    await uploader._page.screenshot({ path: 'tiktok-retry-result.png' }).catch(() => {});
    console.log('Screenshot saved: tiktok-retry-result.png');
    
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await uploader.close();
  }
}

main();
