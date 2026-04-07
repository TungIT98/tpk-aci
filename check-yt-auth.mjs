import { YouTubeUploader } from './lib/upload/youtube.js';
const u = new YouTubeUploader();
const r = await u.healthCheck();
console.log(JSON.stringify(r));
