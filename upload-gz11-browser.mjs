/**
 * upload-gz11-browser.mjs - Upload GZ-11 to YouTube via Playwright browser
 */
import { chromium } from 'playwright';
import { resolve } from 'path';

const UPLOAD_DIR = 'C:/tmp/openclaw/uploads';
const VIDEO_FILE = 'GZ-11.mp4';
const VIDEO_PATH = resolve(UPLOAD_DIR, VIDEO_FILE);

const TITLE = 'I Ghosted 50 Networking Events. Here\'s What Happened Instead.';
const DESCRIPTION = `I ghosted 50 networking events. Here's what happened.

I showed up, handed out business cards, said "Let's connect," and nothing came of it. 50 events, zero meaningful relationships.

So I stopped going to events and replaced them with three things that actually work:

1. Personalized DMs to three people per week — one genuine question about their work, one specific observation
2. One piece of content per week about what I actually know — let it attract the right people automatically
3. One monthly virtual coffee with someone from step one

Quality beats quantity every time.

#Networking #CareerGrowth #ProfessionalDevelopment`;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== Uploading GZ-11 to YouTube via Browser ===');
  console.log('Video:', VIDEO_PATH);

  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  // Use existing browser context if possible
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Go to YouTube Studio upload page
    console.log('Navigating to YouTube Studio...');
    await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/videos/upload?d=ud', { 
      waitUntil: 'domcontentloaded',
      timeout: 20000 
    });
    await sleep(3000);
    
    // Check URL
    console.log('URL:', page.url());
    
    // Try to find file input and upload
    console.log('Looking for file input...');
    const fileInput = page.locator('input[type="file"]').first();
    const isVisible = await fileInput.isVisible().catch(() => false);
    console.log('File input visible:', isVisible);
    
    if (isVisible) {
      console.log('Setting file...');
      await fileInput.setInputFiles(VIDEO_PATH, { timeout: 10000 });
      console.log('File set!');
      await sleep(3000);
      
      // Check for title input
      const titleInput = page.locator('#title-input, input[name="title"], #title').first();
      const titleVisible = await titleInput.isVisible().catch(() => false);
      console.log('Title input visible:', titleVisible);
      
      if (titleVisible) {
        await titleInput.fill(TITLE);
        console.log('Title filled');
      }
      
      // Wait a bit more
      await sleep(2000);
      console.log('Current URL:', page.url());
      console.log('\n=== MANUAL INTERVENTION NEEDED ===');
      console.log('Browser is open. Please complete the upload manually.');
      console.log('Title:', TITLE);
      console.log('Description:', DESCRIPTION.substring(0, 100) + '...');
    } else {
      console.log('File input not found. Current page content:');
      const content = await page.content();
      console.log(content.substring(0, 2000));
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  // Don't close browser - let human complete if needed
  console.log('\nBrowser will stay open for 60 seconds...');
  await sleep(60000);
  await browser.close();
}

main().catch(console.error);
