/**
 * scripts/test-upload.mjs
 * Test TikTok upload using the saved session
 */

import { TikTokBrowser } from '../lib/upload/tiktok-browser.js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function log(...args) {
  console.log(`[test-upload] ${new Date().toISOString().slice(11,19)}`, ...args);
}

async function main() {
  const sessionPath = resolve(ROOT, '.tiktok-session.json');
  
  log('Starting TikTok upload test...');
  log(`Session: ${sessionPath}`);
  
  const uploader = new TikTokBrowser({
    sessionPath,
    headless: false, // Show browser so we can see what's happening
  });
  
  try {
    await uploader.init();
    log('Uploader initialized');
    
    // Check if logged in
    const isLoggedIn = await uploader.isLoggedIn();
    log(`Logged in: ${isLoggedIn}`);
    
    if (!isLoggedIn) {
      log('Not logged in, attempting login...');
      // Try to log in with stored credentials
      // This may require manual verification
    }
    
    // Upload GZ-01
    const videoPath = resolve(ROOT, 'outputs', 'GZ-01', 'final.mp4');
    const caption = 'AI Video Generator Test #ai #video #automation #tiktok';
    
    log(`Uploading: ${videoPath}`);
    log(`Caption: ${caption}`);
    
    const result = await uploader.upload({
      videoPath,
      caption,
      tags: ['ai', 'video', 'automation'],
    });
    
    log(`Upload result: ${JSON.stringify(result)}`);
    
    if (result.success) {
      log(`✅ Upload successful: ${result.url}`);
      writeFileSync(resolve(ROOT, 'outputs', 'GZ-01', 'published.txt'), `Published at: ${result.url}\n${new Date().toISOString()}`);
    } else {
      log(`❌ Upload failed: ${result.error}`);
    }
    
  } finally {
    await uploader.close();
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
