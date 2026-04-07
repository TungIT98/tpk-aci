// CommonJS script for video production
const dotenv = require('dotenv');
dotenv.config({path:'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/.env'});
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { mkdtempSync } = require('os');

const key = process.env.PEXELS_API_KEY;
const SCRIPT_ID = 'COM-02';
const SCRIPT_PATH = `C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/scripts/pending/${SCRIPT_ID}.json`;
const OUTPUT_DIR = 'C:/tmp/openclaw/uploads';
const FFMPEG = 'C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe';

function httpsGet(url, authKey) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { headers: { 'Authorization': authKey } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse error: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

function downloadFile(url, dest, authKey) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { headers: { 'Authorization': authKey } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest, authKey).then(resolve).catch(reject);
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', (e) => { try { fs.unlinkSync(dest); } catch(e2){} reject(e); });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Download timeout')); });
  });
}

async function main() {
  console.log('=== Nova Video Production ===');

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Read script
  const rawContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const cleanContent = rawContent.charCodeAt(0) === 0xFEFF ? rawContent.slice(1) : rawContent;
  const scriptData = JSON.parse(cleanContent);
  console.log('Script:', scriptData.id, '-', scriptData.title);

  // Search Pexels
  const queries = [
    'young man bedroom night phone scrolling',
    'person bedroom dark phone light',
    'man late night bedroom phone'
  ];

  let searchResult = null;
  for (const q of queries) {
    try {
      const searchUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=5&orientation=portrait`;
      console.log('Searching:', q);
      const res = await httpsGet(searchUrl, key);
      if (res.videos && res.videos.length > 0) {
        searchResult = res;
        console.log('Found', res.videos.length, 'videos');
        break;
      }
    } catch(e) { console.log('Search error:', e.message); }
  }
  if (!searchResult || !searchResult.videos || searchResult.videos.length === 0) throw new Error('No Pexels videos found');

  const video = searchResult.videos[0];
  console.log('Selected:', video.id, video.duration + 's', video.width + 'x' + video.height);

  // Find best MP4
  const files = video.video_files
    .filter(f => f.file_type && f.file_type.includes('mp4'))
    .sort((a, b) => (b.width || 0) - (a.width || 0));
  const bestFile = files.find(f => (f.width || 0) >= 720) || files[0];
  console.log('Using:', bestFile.width + 'x' + bestFile.height, bestFile.quality);

  const tmpDir = mkdtempSync(path.join(require('os').tmpdir(), 'nova-com02-'));
  const videoPath = path.join(tmpDir, 'video.mp4');
  const audioPath = path.join(tmpDir, 'audio.mp3');

  console.log('Downloading...');
  await downloadFile(bestFile.link, videoPath, key);
  console.log('Downloaded:', fs.statSync(videoPath).size, 'bytes');

  // gTTS
  const gttsPy = path.join(tmpDir, 'gtts_gen.py');
  const scriptText = scriptData.script;
  const pyCode = `from gtts import gTTS\ntts = gTTS(text=${JSON.stringify(scriptText)}, lang='vi')\ntts.save(${JSON.stringify(audioPath)})\n`;
  fs.writeFileSync(gttsPy, pyCode, 'utf8');
  console.log('Generating TTS...');
  try {
    execSync(`python "${gttsPy}"`, { timeout: 30000, stdio: 'pipe' });
    console.log('TTS OK:', fs.statSync(audioPath).size, 'bytes');
  } catch(e) {
    console.log('Vietnamese TTS failed, using English...');
    const fallback = 'POV: You suddenly realize you have been wasting 5 years of your life on meaningless things. 1,825 days gone. Work, home, sleep, repeat. And now you sit there, staring at the screen, asking yourself: have you been living or just existing?';
    const fallbackPy = `from gtts import gTTS\ntts = gTTS(text=${JSON.stringify(fallback)}, lang='en')\ntts.save(${JSON.stringify(audioPath)})\n`;
    fs.writeFileSync(gttsPy, fallbackPy, 'utf8');
    execSync(`python "${gttsPy}"`, { timeout: 30000, stdio: 'pipe' });
    console.log('English TTS OK:', fs.statSync(audioPath).size, 'bytes');
  }

  // FFmpeg combine
  const outputMp4 = path.join(OUTPUT_DIR, `${SCRIPT_ID}.mp4`);
  const targetDuration = scriptData.duration_seconds || 6;

  console.log('Combining with FFmpeg...');
  const ffmpegCmd = `"${FFMPEG}" -y -ss 0 -i "${videoPath}" -i "${audioPath}" -t ${targetDuration} -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1" -c:v libx264 -preset fast -c:a aac -shortest "${outputMp4}"`;
  try {
    execSync(ffmpegCmd, { stdio: 'inherit', timeout: 120 });
  } catch(e) {
    console.log('FFmpeg primary failed, trying fast preset...');
    const altCmd = `"${FFMPEG}" -y -ss 0 -i "${videoPath}" -i "${audioPath}" -t ${targetDuration} -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1" -c:v libx264 -preset ultrafast -c:a aac -shortest "${outputMp4}"`;
    execSync(altCmd, { stdio: 'inherit', timeout: 120 });
  }

  if (!fs.existsSync(outputMp4)) throw new Error('Output file not created!');
  console.log('SUCCESS:', outputMp4, fs.statSync(outputMp4).size, 'bytes');

  // Update script
  const updated = JSON.parse(cleanContent);
  updated.status = 'produced';
  updated.video_path = outputMp4;
  updated.produced_at = new Date().toISOString();
  fs.writeFileSync(SCRIPT_PATH, '\ufeff' + JSON.stringify(updated, null, 2), 'utf8');
  console.log('Script updated to produced');

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('DONE');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
