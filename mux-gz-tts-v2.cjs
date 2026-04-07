const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WORKSPACE = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI';
const SCRIPTS_DIR = path.join(WORKSPACE, 'scripts/pending');
const VIDEOS_DIR = path.join(WORKSPACE, 'output/videos');
const UPLOAD_DIR = 'C:/tmp/openclaw/uploads';
const TEMP_DIR = path.join(WORKSPACE, 'output/_temp_tts');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const VIDEOS = [
  { id: 'GZ-07', duration: 5.833 },
  { id: 'GZ-09', duration: 5.833 },
  { id: 'GZ-10', duration: 5.833 },
  { id: 'GZ-11', duration: 5.833 },
  { id: 'GZ-12', duration: 5.833 },
];

async function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { ...opts, shell: true });
    let out = '', err = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${cmd} failed (${code}): ${err.slice(-300)}`)));
  });
}

async function generateGTTs(text, outputPath) {
  // Write text to temp file to avoid shell quoting issues
  const textFile = path.join(TEMP_DIR, `text_${Date.now()}.txt`);
  fs.writeFileSync(textFile, text, 'utf8');
  
  // Write Python script to temp file
  const pyFile = path.join(TEMP_DIR, `tts_${Date.now()}.py`);
  const pyCode = `
from gtts import gTTS
import sys
with open(${JSON.stringify(textFile)}, 'r', encoding='utf8') as f:
    text = f.read().strip()
gTTS(text=text, lang='en').save(${JSON.stringify(outputPath)})
print('TTS done')
`;
  fs.writeFileSync(pyFile, pyCode, 'utf8');
  
  await run('python', [pyFile]);
  try { fs.unlinkSync(pyFile); } catch(e) {}
  try { fs.unlinkSync(textFile); } catch(e) {}
}

async function mux(videoPath, audioPath, outputPath, targetDuration) {
  const trimmedAudio = path.join(TEMP_DIR, `audio_trim_${Date.now()}.mp3`);
  await run('ffmpeg', ['-i', audioPath, '-t', String(targetDuration), '-c', 'copy', trimmedAudio]);
  await run('ffmpeg', ['-i', videoPath, '-i', trimmedAudio, '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-map', '0:v', '-map', '1:a', '-y', outputPath]);
}

async function main() {
  for (const v of VIDEOS) {
    const scriptPath = path.join(SCRIPTS_DIR, `${v.id}.json`);
    const videoPath = path.join(VIDEOS_DIR, `${v.id}.mp4`);
    const outputPath = path.join(UPLOAD_DIR, `${v.id}-FINAL.mp4`);

    if (!fs.existsSync(videoPath)) {
      console.log(`SKIP ${v.id}: no video`);
      continue;
    }

    // Check audio
    try {
      const probe = execSync(`ffprobe -v error -show_entries stream=codec_type -of json "${videoPath}"`, { encoding: 'utf8' });
      const info = JSON.parse(probe);
      const hasAudio = info.streams && info.streams.some(s => s.codec_type === 'audio');
      if (hasAudio) {
        console.log(`${v.id}: has audio, copying`);
        fs.copyFileSync(videoPath, outputPath);
        continue;
      }
    } catch(e) {}

    console.log(`${v.id}:`);
    const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
    const text = script.script || '';
    if (!text) { fs.copyFileSync(videoPath, outputPath); continue; }

    const ttsPath = path.join(TEMP_DIR, `${v.id}_tts.mp3`);
    try {
      await generateGTTs(text, ttsPath);
      console.log('  TTS generated');
    } catch(e) {
      console.log(`  gTTS failed: ${e.message}`);
      fs.copyFileSync(videoPath, outputPath);
      continue;
    }

    try {
      await mux(videoPath, ttsPath, outputPath, v.duration);
      console.log(`  DONE: ${path.basename(outputPath)}`);
    } catch(e) {
      console.log(`  Mux failed: ${e.message}`);
      fs.copyFileSync(videoPath, outputPath);
    }
  }

  // Copy already-good files
  const goodFiles = ['MOT-01.mp4', 'MOVIE-01.mp4', 'TECH-01.mp4', 'GZ-SPECIAL-final.mp4'];
  for (const f of goodFiles) {
    const src = path.join(VIDEOS_DIR, f);
    const dst = path.join(UPLOAD_DIR, f);
    if (fs.existsSync(src) && !fs.existsSync(dst)) {
      fs.copyFileSync(src, dst);
      console.log(`Copied ${f}`);
    }
  }
  // GZ-06 is in output_topic
  const gz6src = path.join(WORKSPACE, 'output_topic/videos/GZ-06.mp4');
  const gz6dst = path.join(UPLOAD_DIR, 'GZ-06.mp4');
  if (fs.existsSync(gz6src) && !fs.existsSync(gz6dst)) {
    fs.copyFileSync(gz6src, gz6dst);
    console.log('Copied GZ-06.mp4');
  }
  console.log('\nDone!');
}

main().catch(console.error);
