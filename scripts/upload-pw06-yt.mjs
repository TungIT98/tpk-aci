import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const VIDEO_PATH = 'C:/tmp/openclaw/uploads/PW-06.mp4';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

try {
  // Go to YouTube Studio upload
  console.log('Navigating to YouTube Studio...');
  await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/videos/upload?d=ud', { timeout: 20000 });
  await page.waitForTimeout(3000);

  // Find the hidden file input and set files
  console.log('Setting file input...');
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(VIDEO_PATH);
  
  // Wait for upload to process
  console.log('Waiting for upload to start...');
  await page.waitForTimeout(8000);
  
  const url = page.url();
  const title = await page.locator('input[id="title"]').first().isVisible().catch(() => false);
  
  console.log(JSON.stringify({
    success: true,
    url: url,
    titleInputVisible: title
  }));
} catch (e) {
  console.log(JSON.stringify({
    success: false,
    error: e.message
  }));
}

await browser.close();
