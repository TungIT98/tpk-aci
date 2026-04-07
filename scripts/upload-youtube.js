const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to YouTube Studio upload page
  await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/videos/upload?d=ud');
  await page.waitForTimeout(3000);
  
  // Find the hidden file input and set files
  const fileInput = await page.locator('input[type="file"]').first();
  await fileInput.setInputFiles('C:/tmp/openclaw/uploads/GZ-SPECIAL-final.mp4');
  
  // Wait for upload to start
  await page.waitForTimeout(5000);
  
  // Check for title input or processing
  const title = await page.locator('input[id="title"]').first().isVisible().catch(() => false);
  const uploadStatus = await page.locator('text=/đang tải|processing|upload/i').first().isVisible().catch(() => false);
  
  console.log(JSON.stringify({
    titleInputVisible: title,
    uploadStatusVisible: uploadStatus,
    url: page.url()
  }));
  
  await browser.close();
})();
