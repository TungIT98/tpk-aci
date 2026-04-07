/**
 * mux-gz-audio.js
 * Mux gTTS audio into existing GZ-07, GZ-09, GZ-12 videos that have no audio.
 */
import { readFileSync, writeFileSync, existsSync, statSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TEMP = resolve(ROOT, 'output', '_temp_gz');

require('fs').mkdirSync(TEMP, { recursive: true });

function log(...a) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...a); }
function ff(args) {
  const r = spawnSync('ffmpeg', args, { encoding:'utf8', stdio:'pipe' });
  if (r.status !== 0) throw new Error('FFmpeg: '+(r.stderr||'').split('\n')[0]);
}
function gtts(text, out) {
  const cmd = `python -c "from gtts import gTTS; gTTS(text=${JSON.stringify(text.slice(0,200))}, lang='en', tld='com').save(${JSON.stringify(out)})"`;
  const r = spawnSync('cmd',['/c',cmd],{encoding:'utf8'});
  if (r.status !== 0) throw new Error('gTTS: '+(r.stderr||'').slice(0,100));
}

const scripts = {
  'GZ-07': { video: resolve(ROOT,'output_topic/videos/GZ-07.mp4'), text: 'I did a 30-day no-spend challenge. Not a single discretionary purchase for 30 days. Here is what actually happened.' },
  'GZ-09': { video: resolve(ROOT,'output_topic/videos/GZ-09.mp4'), text: 'My LinkedIn post went viral. 500 reactions in 24 hours. Here is the surprising truth about what actually works on LinkedIn.' },
  'GZ-12': { video: resolve(ROOT,'output_topic/videos/GZ-12.mp4'), text: 'At 23, I met with a career mentor. What she told me changed everything about how I think about success.' },
};

for (const [id, s] of Object.entries(scripts)) {
  log('Processing', id);
  if (!existsSync(s.video)) { log('SKIP no video:', id); continue; }
  
  const ttsPath = resolve(TEMP, `${id}_tts.mp3`);
  try {
    gtts(s.text, ttsPath);
    log('OK gTTS', statSync(ttsPath).size+'B');
  } catch(e) { log('ERR gTTS:', e.message.slice(0,80)); continue; }
  
  const outPath = resolve(ROOT, 'output_topic', 'videos', `${id}.mp4`);
  require('fs').mkdirSync(resolve(ROOT,'output_topic/videos'), { recursive: true });
  try {
    ff(['-y','-i',s.video,'-i',ttsPath,'-c:v','copy','-c:a','aac','-b:a','128k','-shortest','-map','0:v:0','-map','1:a:0',outPath]);
    log('DONE mux', id, statSync(outPath).size+'B');
    
    // Update JSON
    const sp = resolve(ROOT,'scripts/pending',`${id}.json`);
    if (existsSync(sp)) {
      const sc = JSON.parse(readFileSync(sp,'utf8'));
      sc.video_path = `output_topic/videos/${id}.mp4`;
      sc.status = 'generated';
      sc.audio_path = `output_topic/videos/${id}.mp4`; // same file
      sc.qc_notes = `gTTS muxed ${new Date().toISOString()}`;
      writeFileSync(sp, JSON.stringify(sc, null, 2));
      log('Updated JSON', id);
    }
  } catch(e) { log('ERR mux:', e.message.slice(0,100)); }
}
log('All done');
