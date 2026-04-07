// Fix PW-11: No video file + no audio
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI';
const OUTPUT_DIR = `${WORKSPACE}/output_topic/videos`;
const TMP_DIR = 'C:/tmp/openclaw/uploads';

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

async function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { shell: true });
    let out = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => out += d);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(`Exit ${code}: ${out}`)));
  });
}

async function main() {
  const script = JSON.parse(fs.readFileSync(`${WORKSPACE}/scripts/pending/PW-11.json`, 'utf8'));
  
  // 1. Download Pexels video (search for professional communication/boundaries)
  console.log('Downloading Pexels video...');
  const searchTerms = 'business person saying no, professional communication';
  const pexelsSearch = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(searchTerms)}&per_page=5&orientation=portrait`, {
    headers: { 'Authorization': '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa' }
  });
  const pexelsData = await pexelsSearch.json();
  const video = pexelsData.videos[0];
  const videoFile = `${TMP_DIR}/pw11_video.mp4`;
  
  // Download best quality
  const hdFiles = video.video_files.filter(f => f.quality === 'hd');
  const targetFile = hdFiles[0] || video.video_files[0];
  console.log('Downloading:', targetFile.link);
  
  await run('curl', ['-s', '-L', '-o', videoFile, targetFile.link]);
  const videoStat = fs.statSync(videoFile);
  console.log('Video downloaded:', videoStat.size, 'bytes');
  
  // 2. Generate TTS with gTTS
  console.log('Generating TTS...');
  const gttsScript = `
from gtts import gTTS
import sys
text = """${script.script.replace(/"/g, '\\"')}"""
tts = gTTS(text=text, lang='en')
tts.save('${TMP_DIR}/pw11_audio.mp3')
print('TTS done')
`;
  fs.writeFileSync(`${TMP_DIR}/gtts_run.py`, gttsScript);
  await run('python', [`${TMP_DIR}/gtts_run.py`]);
  
  // 3. Trim TTS to match video duration (6s)
  console.log('Trimming audio to 6s...');
  await run('ffmpeg', ['-y', '-i', `${TMP_DIR}/pw11_audio.mp3`, '-t', '6', '-c:a', 'copy', `${TMP_DIR}/pw11_audio_trimmed.mp3`]);
  
  // 4. Combine video + audio
  const outputFile = `${OUTPUT_DIR}/PW-11.mp4`;
  console.log('Combining video + audio...');
  await run('ffmpeg', [
    '-y', '-i', videoFile, '-i', `${TMP_DIR}/pw11_audio_trimmed.mp3`,
    '-c:v', 'copy', '-c:a', 'aac', '-shortest',
    outputFile
  ]);
  
  const finalStat = fs.statSync(outputFile);
  console.log('Final output:', finalStat.size, 'bytes');
  
  // 5. Update script status
  script.status = 'ready_for_upload';
  script.video_path = `output/videos/PW-11.mp4`;
  script.generated_at = new Date().toISOString();
  script.upload_note = 'Fixed via Pexels + gTTS pipeline';
  fs.writeFileSync(`${WORKSPACE}/scripts/pending/PW-11.json`, JSON.stringify(script, null, 2));
  console.log('Script updated to ready_for_upload');
  
  console.log('PW-11 FIX COMPLETE');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });