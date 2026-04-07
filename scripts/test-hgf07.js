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
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const PEXELS_KEY = env.PEXELS_API_KEY ?? '';
console.log('PEXELS_KEY from env:', PEXELS_KEY);
console.log('PEXELS_KEY length:', PEXELS_KEY.length);
console.log('PEXELS_KEY == hardcoded:', PEXELS_KEY === '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa');

function httpReq(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const headers = { ...(options.headers || {}) };
    if (options.json) headers['Accept'] = 'application/json';
    const o = { ...options, headers, method: options.method || 'GET' };
    delete o.json;
    console.log('httpReq options:', JSON.stringify({...o, headers: o.headers}).slice(0, 300));
    const req = mod.request(url, o, res => {
      if (headers['Accept'] === 'application/json') {
        let d = ''; res.on('data', c => d += c); res.on('end', () => { 
          try { resolve(JSON.parse(d)); } 
          catch(e) { reject(new Error('JSON parse error: ' + d.slice(0, 200))); } 
        });
      } else {
        const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const data = await httpReq('https://api.pexels.com/videos/search?query=fitness&per_page=3', {
    headers: { Authorization: PEXELS_KEY },
    json: true
  });
  console.log('Result:', JSON.stringify(data).slice(0, 300));
})().catch(e => console.error('Error:', e.message));
