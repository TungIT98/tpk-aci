import https from 'https';
import http from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const env = {};
  for (const line of readFileSync(resolve(ROOT, '.env'), 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.split('#')[0].trim();
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const PEXELS_KEY = env.PEXELS_API_KEY ?? '';
console.log('Key length:', PEXELS_KEY.length, 'Key[:20]:', PEXELS_KEY.slice(0,20));

function httpReq(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const headers = { ...(options.headers || {}) };
    if (options.json) headers['Accept'] = 'application/json';
    const o = { ...options, headers, method: options.method || 'GET' };
    delete o.json;
    const req = mod.request(url, o, res => {
      if (headers['Accept'] === 'application/json') {
        let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('JSON: ' + d.slice(0, 200))); } });
      } else {
        const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('Test 1: httpReq with json:true');
  try {
    const data = await httpReq('https://api.pexels.com/videos/search?query=technology&per_page=3', {
      headers: { Authorization: PEXELS_KEY },
      json: true
    });
    console.log('Result:', data.videos?.length, 'videos, page:', data.page);
  } catch(e) { console.error('Error:', e.message); }
  
  console.log('Test 2: direct https.get');
  await new Promise((resolve) => {
    https.get('https://api.pexels.com/videos/search?query=technology&per_page=3', { headers: { Authorization: PEXELS_KEY } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { 
        try { const j = JSON.parse(d); console.log('Direct result:', j.videos?.length, 'videos'); }
        catch(e) { console.error('Parse error:', d.slice(0,100)); }
        resolve();
      });
    }).on('error', e => { console.error(e.message); resolve(); });
  });
})();
