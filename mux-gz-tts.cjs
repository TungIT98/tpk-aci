// Quick TTS + Mux for GZ-07 through GZ-12
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

async function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { shell: true });
    let out = '', err = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${cmd} failed: ${err.slice(-200)}`)));
  });
}

async function generateGTTs(text, outputPath) {
  const MAX = 490;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let current = '';
  const chunks = [];
  for (const s of sentences) {
    if ((current + s).length > MAX) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current) chunks.push(current.trim());

  if (chunks.length === 1) {
    const py = `from gtts import gTTS; gTTS(text=${JSON.stringify(chunks[0])}, lang='en').save(${JSON.stringify(outputPath)})`;
    await run('python', ['-c', py]);
    return;
  }

  const mp3s = [];
  for (let i = 0; i < chunks.length; i++) {
    const mp3 = path.join(TEMP_DIR, `chunk_${Date.now()}_${i}.mp3`);
    mp3s.push(mp3);
    const py = `from gtts import gTTS; gTTS(text=${JSON.stringify(chunks[i])}, lang='en').save(${JSON.stringify(mp3)})`;
    await run('python', ['-c', py]);
    console.log(`  Chunk ${i+1}/${chunks.length} done`);
  }

  const listFile = path.join(TEMP_DIR, `list_${Date.now()}.txt`);
  fs.writeFileSync(listFile, mp3s.map(f => `file '${f.replace(/\\/g,'/')}'`).join('\n'));
  await run('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outputPath]);
}

async function mux(videoPath, audioPath, outputPath, targetDuration) {
  const trimmedAudio = path.join(TEMP_DIR, `audio_trim_${Date.now()}.mp3`);
  await run('ffmpeg', ['-i', audioPath, '-t', String(targetDuration), '-c', 'copy', trimmedAudio]);
  await run('ffmpeg', ['-i', videoPath, '-i', trimmedAudio, '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-map', '0:v', '-map', '1:a', '-y', outputPath]);
  console.log(`  Muxed: ${path.basename(outputPath)}`);
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

    // Check if video already has audio
    try {
      const probe = execSync(`ffprobe -v error -show_entries stream=codec_type -of json "${videoPath}"`, { encoding: 'utf8' });
      const info = JSON.parse(probe);
      const hasAudio = info.streams && info.streams.some(s => s.codec_type === 'audio');
      if (hasAudio) {
        console.log(`${v.id}: has audio already, copying`);
        fs.copyFileSync(videoPath, outputPath);
        continue;
      }
    } catch(e) {}

    console.log(`${v.id}:`);
    const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
    const text = script.script || '';

    if (!text) {
      console.log('  No script, copying as-is');
      fs.copyFileSync(videoPath, outputPath);
      continue;
    }

    const ttsPath = path.join(TEMP_DIR, `${v.id}_tts.mp3`);
    try {
      await generateGTTs(text, ttsPath);
    } catch(e) {
      console.log(`  gTTS failed: ${e.message}, copying raw`);
      fs.copyFileSync(videoPath, outputPath);
      continue;
    }

    try {
      await mux(videoPath, ttsPath, outputPath, v.duration);
    } catch(e) {
      console.log(`  Mux failed: ${e.message}, copying raw`);
      fs.copyFileSync(videoPath, outputPath);
    }
  }

  // Copy already-good files
  const goodFiles = ['MOT-01.mp4', 'MOVIE-01.mp4', 'TECH-01.mp4', 'GZ-SPECIAL-final.mp4', 'GZ-06.mp4'];
  for (const f of goodFiles) {
    const src = path.join(VIDEOS_DIR, f);
    const altSrc = path.join(WORKSPACE, 'output_topic/videos', f);
    const dst = path.join(UPLOAD_DIR, f);
    const srcPath = fs.existsSync(src) ? src : fs.existsSync(altSrc) ? altSrc : null;
    if (srcPath && !fs.existsSync(dst)) {
      fs.copyFileSync(srcPath, dst);
      console.log(`Copied ${f}`);
    }
  }
  console.log('\nDone!');
}

main().catch(console.error);
