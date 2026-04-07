/**
 * gen-pw13-18.js
 * Generate PW-13 to PW-18 videos using Pexels stock footage + gTTS + FFmpeg.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const env = {};
  for (const line of readFileSync(resolve(ROOT, '.env'), 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const PEXELS_KEY = env.PEXELS_API_KEY ?? '';

const SCRIPTS_DIR = resolve(ROOT, 'scripts', 'pending');
const OUTPUT_DIR  = resolve(ROOT, 'output_topic', 'videos');
const TEMP_DIR    = resolve(ROOT, 'output', '_temp_pw1318');

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(TEMP_DIR, { recursive: true });

function log(...args) {
  console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ff(args) {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8', stdio: 'pipe' });
  if (r.status !== 0) throw new Error('FFmpeg: ' + (r.stderr||'').split('\n')[0]);
}

function httpReq(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const headers = { ...(options.headers||{}) };
    if (options.json) headers['Accept'] = 'application/json';
    const o = { ...options, headers, method: options.method||'GET' };
    delete o.json;
    const req = mod.request(url, o, res => {
      if (headers['Accept'] === 'application/json') {
        let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{resolve(JSON.parse(d));}catch{reject(new Error('JSON: '+d.slice(0,100)));}});
      } else {
        const c=[]; res.on('data',c2=>c.push(c2)); res.on('end',()=>resolve(Buffer.concat(c)));
      }
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function pexelsSearch(query, perPage=5) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait`;
  return (await httpReq(url, {headers:{Authorization:PEXELS_KEY},json:true})).videos||[];
}

async function downloadVideo(url, path) {
  const buf = await httpReq(url, {method:'GET'});
  writeFileSync(path, buf);
}

function gtts(text, outPath) {
  // gTTS: use python -c to avoid temp file
  const cmd = `python -c "from gtts import gTTS; gTTS(text=${JSON.stringify(text.slice(0,200))}, lang='en', tld='com').save(${JSON.stringify(outPath)})"`;
  const r = spawnSync('cmd', ['/c', cmd], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('gTTS failed: ' + (r.stderr||'').slice(0,100));
}

function searchTerms(prompt) {
  return prompt.replace(/\[.*?\]/g,' ').replace(/\s+/g,' ').trim().slice(0,120);
}

async function genVideo(scriptId) {
  const sp = resolve(SCRIPTS_DIR, `${scriptId}.json`);
  if (!existsSync(sp)) { log('SKIP not found:', scriptId); return; }
  const sc = JSON.parse(readFileSync(sp,'utf8'));
  const out = resolve(OUTPUT_DIR, `${scriptId}.mp4`);
  if (existsSync(out) && statSync(out).size > 50000) { log('SKIP exists:', scriptId); return; }
  
  log('GEN', scriptId, '-', sc.title);
  
  // Pexels search
  let q = searchTerms(sc.prompt_for_hailuo || sc.title);
  log('QUERY', q);
  let vs = [];
  try { vs = await pexelsSearch(q, 8); } catch(e) { log('ERR search:', e.message); }
  if (vs.length < 2) {
    try { vs = await pexelsSearch(sc.title.split(' ').filter(w=>w.length>3).join(' '), 10); } catch {}
  }
  log('PEXELS', vs.length, 'videos');
  if (vs.length < 2) { log('ERR not enough videos'); return; }
  
  // Download 2 clips
  const clips = [];
  for (let i = 0; i < 2; i++) {
    const v = vs[i];
    const files = v.video_files.sort((a,b)=>(b.width*b.height)-(a.width*b.height));
    const f = files[0];
    const cp = resolve(TEMP_DIR, `${scriptId}_c${i}.mp4`);
    try {
      log('DL clip'+i, f.link.slice(0,60));
      await downloadVideo(f.link, cp);
      clips.push({p: cp, d: v.duration});
      log('OK clip'+i, statSync(cp).size+'B', v.duration.toFixed(1)+'s');
    } catch(e) { log('ERR dl:', e.message.slice(0,80)); }
  }
  if (clips.length < 2) { log('ERR not enough clips'); return; }
  
  // Trim clips to ~2.5s portrait
  const trimmed = [];
  for (let i = 0; i < 2; i++) {
    const out2 = resolve(TEMP_DIR, `${scriptId}_t${i}.mp4`);
    const dur = Math.min(2.5, clips[i].d);
    try {
      ff(['-y','-ss','0','-i',clips[i].p,'-t',String(dur),
          '-vf',`crop=min(iw\,1080):min(ih\,1920):(iw-min(iw\,1080))/2:(ih-min(ih\,1920))/2,scale=1080:1920`,
          '-c:v','libx264','-preset','fast','-crf','23','-c:a','aac','-b:a','128k',out2]);
      trimmed.push(out2);
      log('OK trim'+i);
    } catch(e) { log('ERR trim:', e.message.slice(0,80)); }
  }
  if (trimmed.length < 2) { log('ERR not enough trimmed'); return; }
  
  // gTTS audio
  const ttsPath = resolve(TEMP_DIR, `${scriptId}_tts.mp3`);
  let hasAudio = false;
  try {
    const ttsText = (sc.script||sc.title).slice(0,150);
    gtts(ttsText, ttsPath);
    hasAudio = existsSync(ttsPath);
    log('OK gTTS', hasAudio ? statSync(ttsPath).size+'B' : 'missing');
  } catch(e) { log('WARN gTTS:', e.message.slice(0,80)); }
  
  // Concat
  const listFile = resolve(TEMP_DIR, `${scriptId}_l.txt`);
  writeFileSync(listFile, trimmed.map(p=>`file '${p}'`).join('\n'));
  const concatOut = resolve(TEMP_DIR, `${scriptId}_concat.mp4`);
  try {
    ff(['-y','-f','concat','-safe','0','-i',listFile,
        '-c:v','libx264','-preset','fast','-crf','23','-c:a','aac','-b:a','128k',concatOut]);
  } catch(e) { log('ERR concat:', e.message.slice(0,80)); return; }
  
  // Mux audio
  try {
    if (hasAudio) {
      ff(['-y','-i',concatOut,'-i',ttsPath,'-c:v','copy','-c:a','aac','-b:a','128k',
          '-shortest','-map','0:v:0','-map','1:a:0',out]);
    } else {
      copyFileSync(concatOut, out);
    }
    const sz = statSync(out).size;
    log('DONE', scriptId, sz+'B');
    
    // Update JSON
    sc.video_path = `output_topic/videos/${scriptId}.mp4`;
    sc.status = 'generated';
    sc.generated_at = new Date().toISOString();
    sc.qc_notes = `Pexels+gTTS (${new Date().toISOString()})`;
    writeFileSync(sp, JSON.stringify(sc, null, 2));
  } catch(e) { log('ERR mux:', e.message.slice(0,80)); }
}

async function main() {
  const ids = process.argv.length > 2 ? process.argv.slice(2) : ['PW-13','PW-14','PW-15','PW-16','PW-17','PW-18'];
  log('START', ids.join(', '));
  for (const id of ids) {
    try { await genVideo(id); } catch(e) { log('ERR', id, e.message); }
    await sleep(200);
  }
  log('ALL DONE');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
