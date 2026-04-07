#!/usr/bin/env node
/**
 * Quick TikTok upload for WC-02
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
  console.log('Starting TikTok upload for WC-02...');
  
  const uploader = new TikTokBrowser();
  
  try {
    await uploader.init();
    console.log('Browser initialized');
    
    const result = await uploader.upload({
      videoPath: VIDEO_PATH,
      caption: CAPTION,
      tags: TAGS
    });
    
    console.log('Upload result:', JSON.stringify(result));
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await uploader.close();
  }
}

main();
