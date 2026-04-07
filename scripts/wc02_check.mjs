import { YouTubeUploader } from '../lib/upload/youtube.js';
import { TikTokUploader } from '../lib/upload/tiktok.js';

const yt = new YouTubeUploader();
const tt = new TikTokUploader();

console.log('=== YouTube Health ===');
const ytHealth = await yt.healthCheck();
console.log(JSON.stringify(ytHealth, null, 2));

console.log('\n=== TikTok Health ===');
const ttHealth = await tt.healthCheck();
console.log(JSON.stringify(ttHealth, null, 2));
