/**
 * upload-gz11-tiktok.mjs - Upload GZ-11 to TikTok via browser automation
 */
import { TikTokBrowser } from './lib/upload/tiktok-browser.js';

const VIDEO_PATH = 'C:/tmp/openclaw/uploads/GZ-11.mp4';
const TITLE = "I Ghosted 50 Networking Events. Here's What Happened Instead.";
const TAGS = ['networking', 'career', 'professional development', 'gen z'];

async function main() {
  console.log('=== Uploading GZ-11 to TikTok ===');
  
  const uploader = new TikTokBrowser();
  
  try {
    await uploader.init();
    console.log('Browser initialized');
    
    const result = await uploader.upload({
      videoPath: VIDEO_PATH,
      title: TITLE,
      tags: TAGS,
    });
    
    console.log('\n=== RESULT ===');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await uploader.close();
  }
}

main();
