/**
 * scripts/upload-ready-videos.js
 * Upload ready videos to YouTube + TikTok using API/browser methods.
 *
 * YouTube: Uses lib/upload/youtube.js (OAuth API - no browser needed)
 * TikTok: Uses lib/upload/tiktok-browser.js (browser - needs session)
 *
 * Videos ready:
 *   PW-06:  output_topic/videos/PW-06.mp4
 *   GZ-SPECIAL: output_topic/videos/GZ-SPECIAL-final.mp4
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { YouTubeUploader } from '../lib/upload/youtube.js';
import { TikTokBrowser } from '../lib/upload/tiktok-browser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const VIDEOS = [
  {
    id: 'PW-06',
    videoPath: resolve(__dirname, '../output_topic/videos/PW-06.mp4'),
    title: 'The Real Reason You Can\'t Focus After Lunch (It\'s Not About Food)',
    description: 'Why your afternoon brain fog isn\'t about food — and the real science behind it.\n\n#productivity #focus #afternooncrash #deepwork',
    tags: ['productivity', 'focus', 'afternooncrash', 'deepwork'],
    privacy: 'unlisted'
  },
  {
    id: 'GZ-SPECIAL',
    videoPath: resolve(__dirname, '../output_topic/videos/GZ-SPECIAL-final.mp4'),
    title: 'Would You Take a $10K Raise If It Meant 60 Hours a Week?',
    description: 'The math behind that $10K raise might surprise you.\n\n#career #salary #worklifebalance #genz #negotiation',
    tags: ['career', 'salary', 'worklifebalance', 'genz', 'negotiation'],
    privacy: 'unlisted'
  }
];

async function uploadYouTube(video) {
  if (!existsSync(video.videoPath)) {
    console.error(`❌ PW-06 not found: ${video.videoPath}`);
    return null;
  }
  console.log(`\n📤 Uploading ${video.id} to YouTube...`);
  try {
    const uploader = new YouTubeUploader();
    await uploader.init();
    const result = await uploader.upload({
      videoPath: video.videoPath,
      title: video.title,
      description: video.description,
      tags: video.tags,
      privacy: video.privacy,
      categoryId: '28' // Science & Technology
    });
    console.log(`✅ YouTube upload success: ${result.videoId}`);
    console.log(`   URL: https://www.youtube.com/watch?v=${result.videoId}`);
    await uploader.close();
    return result;
  } catch (err) {
    console.error(`❌ YouTube upload failed: ${err.message}`);
    return null;
  }
}

async function uploadTikTok(video) {
  if (!existsSync(video.videoPath)) {
    console.error(`❌ ${video.id} not found: ${video.videoPath}`);
    return null;
  }
  console.log(`\n📤 Uploading ${video.id} to TikTok...`);
  try {
    const uploader = new TikTokBrowser();
    await uploader.init();
    const result = await uploader.upload({
      videoPath: video.videoPath,
      caption: video.title + '\n\n#' + video.tags.join(' #')
    });
    console.log(`✅ TikTok upload success: ${result.url}`);
    await uploader.close();
    return result;
  } catch (err) {
    console.error(`❌ TikTok upload failed: ${err.message}`);
    return null;
  }
}

async function main() {
  const results = {};
  for (const video of VIDEOS) {
    results[video.id] = {};
    const ytResult = await uploadYouTube(video);
    results[video.id].youtube = ytResult;
    const ttResult = await uploadTikTok(video);
    results[video.id].tiktok = ttResult;
  }
  console.log('\n📊 Results:', JSON.stringify(results, null, 2));
}

main().catch(console.error);
