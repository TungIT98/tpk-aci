/**
 * upload-gz11-youtube.mjs - Upload GZ-11 to YouTube
 */
import { YouTubeUploader } from './lib/upload/youtube.js';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const VIDEO_PATH = resolve(__dirname, 'output_topic/videos/GZ-11.mp4');
const TITLE = 'I Ghosted 50 Networking Events. Here\'s What Happened Instead.';
const DESCRIPTION = `I ghosted 50 networking events. Here's what happened.

I showed up, handed out business cards, said "Let's connect," and nothing came of it. 50 events, zero meaningful relationships.

So I stopped going to events and replaced them with three things that actually work:

1. Personalized DMs to three people per week — one genuine question about their work, one specific observation
2. One piece of content per week about what I actually know — let it attract the right people automatically
3. One monthly virtual coffee with someone from step one

Quality beats quantity every time.

#Networking #CareerGrowth #ProfessionalDevelopment #LinkedIn`;

const TAGS = ['networking', 'introvert tips', 'career growth', 'linkedin networking', 'professional development'];
const CATEGORY = '27'; // Education

async function main() {
  console.log('=== Uploading GZ-11 to YouTube ===');
  console.log('Video path:', VIDEO_PATH);
  
  const uploader = new YouTubeUploader({});
  const filePath = VIDEO_PATH;
  console.log('Uploading filePath:', filePath);
  console.log('File exists:', existsSync(filePath));
  
  // Upload
  try {
    const result = await uploader.upload({
      videoPath: filePath,
      title: TITLE,
      description: DESCRIPTION,
      tags: TAGS,
      categoryId: CATEGORY,
      privacyStatus: 'unlisted',
    });
    console.log('\n=== UPLOAD SUCCESS ===');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Upload failed:', e.message);
  }
}

main();
