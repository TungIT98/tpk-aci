// GZ-07 TikTok Upload via CDP - connects to OpenClaw browser
// Upload directly to TikTok Studio which is already logged in

import { chromium } from 'playwright';

async function main() {
  const VIDEO_PATH = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output_topic/videos/GZ-07.mp4';
  
  console.log('Connecting to OpenClaw browser via CDP...');
  const browser = await chromium.connectOverCDP({ endpointURL: 'http://127.0.0.1:18800' });
  
  try {
    const ctx = browser.contexts()[0];
    if (!ctx) throw new Error('No browser context');
    
    const pages = ctx.pages();
    console.log(`Found ${pages.length} pages`);
    
    // Find TikTok Studio upload page
    let tiktokPage = pages.find(p => p.url().includes('tiktokstudio/upload'));
    
    if (!tiktokPage) {
      // Try to find any TikTok page and navigate
      const tiktokAny = pages.find(p => p.url().includes('tiktok'));
      if (tiktokAny) {
        console.log('Navigating TikTok page to upload...');
        await tiktokAny.goto('https://www.tiktok.com/tiktokstudio/upload');
        await tiktokAny.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await tiktokAny.waitForTimeout(3000);
        tiktokPage = tiktokAny;
      }
    }
    
    if (!tiktokPage) throw new Error('TikTok page not found');
    console.log('Found TikTok upload page:', tiktokPage.url().slice(0, 80));
    
    // Wait for page to stabilize
    await tiktokPage.waitForTimeout(2000);
    
    // Find the hidden file input
    const fileInput = tiktokPage.locator('input[type=file]').first();
    const inputCount = await fileInput.count();
    console.log('File inputs found:', inputCount);
    
    if (inputCount === 0) {
      // Try clicking the upload zone to trigger the input
      console.log('No file input visible - clicking upload zone first...');
      const uploadBtn = tiktokPage.locator('button:has-text("Chọn video")').first();
      if (await uploadBtn.count() > 0) {
        await uploadBtn.click().catch(() => {});
        await tiktokPage.waitForTimeout(2000);
      }
    }
    
    // Re-check for file input
    const finalInputCount = await tiktokPage.locator('input[type=file]').count();
    console.log('File inputs after trigger:', finalInputCount);
    
    if (finalInputCount === 0) {
      // Try ANY file input in the browser
      for (const p of pages) {
        const cnt = await p.locator('input[type=file]').count();
        if (cnt > 0) {
          console.log('Found file input on page:', p.url().slice(0, 60));
          const f = p.locator('input[type=file]').first();
          await f.setInputFiles(VIDEO_PATH);
          console.log('File set on page:', p.url().slice(0, 60));
          await p.waitForTimeout(5000);
          // Check if upload started
          const text = await p.locator('body').innerText().catch(() => '');
          console.log('Page text snippet:', text.slice(0, 200));
        }
      }
    } else {
      // Set file on the input
      console.log('Setting file on input...');
      await fileInput.setInputFiles(VIDEO_PATH);
      console.log('File set!');
      
      // Wait for processing
      await tiktokPage.waitForTimeout(5000);
      
      // Check state
      const bodyText = await tiktokPage.locator('body').innerText().catch(() => '');
      console.log('Body text snippet:', bodyText.slice(0, 300));
      
      // Look for caption input
      const captionInput = tiktokPage.locator('[data-e2e="video-desc-input"], div[contenteditable="true"]').first();
      if (await captionInput.count() > 0) {
        console.log('Found caption input!');
        const caption = 'I did a 30-day no-spend challenge. Not a single discretionary purchase for 30 days. Here\'s what actually happened. Week one was torture. Week two, something shifted. Week three, the math started: I saved $800. Week four, the real change: I wasn\'t buying things to fill a gap. The no-spend secret nobody tells you: it\'s not about willpower. It\'s about environment design. #NoSpendChallenge #SavingMoney #Budgeting #GenZFinance #PersonalFinance';
        await captionInput.click();
        await captionInput.fill(caption);
        console.log('Caption filled!');
        
        // Wait for post button
        await tiktokPage.waitForTimeout(1000);
        const postBtn = tiktokPage.locator('button:has-text("Đăng"), button:has-text("Post"), button:has-text("Publish")').first();
        if (await postBtn.count() > 0) {
          console.log('Clicking Post...');
          await postBtn.click();
          await tiktokPage.waitForTimeout(5000);
          console.log('Posted! URL:', tiktokPage.url());
        } else {
          console.log('Post button not found');
        }
      } else {
        console.log('Caption input not found');
      }
    }
    
  } finally {
    await browser.close();
    console.log('Done');
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
