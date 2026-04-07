import { chromium } from 'playwright';

const browser = await chromium.launch({ 
  headless: false,
  args: ['--disable-web-security', '--allow-file-access-from-files']
});
const context = await browser.newContext({
  storageState: undefined // Use existing cookies if available
});
const page = await context.newPage();

try {
  // Go to YouTube Studio upload
  await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/videos/upload?d=ud', { timeout: 15000 });
  await page.waitForTimeout(3000);
  
  // Find file input and upload
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles('C:/tmp/openclaw/uploads/GZ-SPECIAL-final.mp4', { timeout: 5000 });
  
  // Wait for upload to start
  await page.waitForTimeout(5000);
  
  const url = page.url();
  const hasUploadProgress = await page.locator('text=/đang tải|processing|upload/i').count();
  
  console.log(JSON.stringify({
    success: true,
    url: url,
    uploadStarted: hasUploadProgress > 0
  }));
} catch (e) {
  console.log(JSON.stringify({
    success: false,
    error: e.message
  }));
} finally {
  await browser.close();
}
