// Quick TTS + Mux for GZ-07 through GZ-12
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKSPACE = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI';
const SCRIPTS_DIR = path.join(WORKSPACE, 'scripts/pending');
const VIDEOS_DIR = path.join(WORKSPACE, 'output_topic/videos');
const UPLOAD_DIR = 'C:/tmp/openclaw/uploads';
const TEMP_DIR = path.join(WORKSPACE, 'output/_temp_tts');

// Ensure upload dir exists
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
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${cmd} ${args.join(' ')} failed: ${err}`)));
  });
}

async function generateGTTs(text, outputPath) {
  // gTTS has ~500 char limit - split text
  const MAX = 490;
  const chunks = [];
  
  // Split by sentences where possible
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let current = '';
  
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
    // Single chunk - direct gTTS
    await run('python', ['-c', `from gtts import gTTS; gTTS(text=${JSON.stringify(chunks[0])}, lang='en').save(${JSON.stringify(outputPath)})`]);
    return;
  }
  
  // Multiple chunks - generate separately and concat with ffmpeg
  const mp3s = [];
  for (let i = 0; i < chunks.length; i++) {
    const mp3 = path.join(TEMP_DIR, `chunk_${i}.mp3`);
    mp3s.push(mp3);
    await run('python', ['-c', `from gtts import gTTS; gTTS(text=${JSON.stringify(chunks[i])}, lang='en').save(${JSON.stringify(mp3)})`]);
    console.log(`  Chunk ${i+1}/${chunks.length} done`);
  }
  
  // Concat MP3s with silence between chunks
  const listFile = path.join(TEMP_DIR, 'chunks.txt');
  const listContent = mp3s.map(f => `file '${f}'`).join('\n');
  fs.writeFileSync(listFile, listContent);
  await run('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outputPath]);
  console.log('  Chunks concatenated');
}

async function mux(videoPath, audioPath, outputPath, targetDuration) {
  // Trim audio to match video duration
  const trimmedAudio = path.join(TEMP_DIR, `audio_trim_${Date.now()}.mp3`);
  await run('ffmpeg', ['-i', audioPath, '-t', String(targetDuration), '-c', 'copy', trimmedAudio]);
  
  // Mux video + audio
  await run('ffmpeg', ['-i', videoPath, '-i', trimmedAudio, '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-map', '0:v', '-map', '1:a', '-y', outputPath]);
  console.log(`  Muxed: ${outputPath}`);
}

async function main() {
  for (const v of VIDEOS) {
    const scriptPath = path.join(SCRIPTS_DIR, `${v.id}.json`);
    const videoPath = path.join(VIDEOS_DIR, `${v.id}.mp4`);
    const outputPath = path.join(UPLOAD_DIR, `${v.id}-FINAL.mp4`);
    
    if (!fs.existsSync(videoPath)) {
      console.log(`SKIP ${v.id}: video not found at ${videoPath}`);
      continue;
    }
    
    // Verify video has no audio
    try {
      const probe = execSync(`ffprobe -v error -show_entries stream=codec_type -of json "${videoPath}"`, { encoding: 'utf8' });
      const info = JSON.parse(probe);
      const hasAudio = info.streams?.some(s => s.codec_type === 'audio');
      if (hasAudio) {
        console.log(`${v.id}: already has audio, copying as FINAL`);
        fs.copyFileSync(videoPath, outputPath);
        continue;
      }
    } catch(e) {}
    
    console.log(`\n${v.id}:`);
    
    // Read script
    const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
    const text = script.script || script.description || '';
    
    if (!text) {
      console.log(`  No script text found, copying as-is`);
      fs.copyFileSync(videoPath, outputPath);
      continue;
    }
    
    // Generate TTS
    const ttsPath = path.join(TEMP_DIR, `${v.id}_tts.mp3`);
    try {
      await generateGTTs(text, ttsPath);
    } catch(e) {
      console.log(`  gTTS failed: ${e.message}, copying as-is`);
      fs.copyFileSync(videoPath, outputPath);
      continue;
    }
    
    // Mux
    try {
      await mux(videoPath, ttsPath, outputPath, v.duration);
    } catch(e) {
      console.log(`  Mux failed: ${e.message}, copying as-is`);
      fs.copyFileSync(videoPath, outputPath);
    }
  }
  
  // Also copy already-good files
  const goodFiles = ['MOT-01.mp4', 'MOVIE-01.mp4', 'TECH-01.mp4', 'GZ-SPECIAL-final.mp4'];
  for (const f of goodFiles) {
    const src = path.join(VIDEOS_DIR, f);
    const dst = path.join(UPLOAD_DIR, f);
    if (fs.existsSync(src) && !fs.existsSync(dst)) {
      fs.copyFileSync(src, dst);
      console.log(`Copied ${f}`);
    }
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
