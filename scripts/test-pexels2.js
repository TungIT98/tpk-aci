import https from 'https';

const PEXELS_KEY = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa';

function httpReq(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { ...(options.headers || {}) };
    if (options.json) headers['Accept'] = 'application/json';
    const o = { ...options, headers, method: options.method || 'GET' };
    delete o.json;
    console.log('Request:', u.protocol, u.host, u.pathname, 'headers:', JSON.stringify(headers));
    https.request(url, o, res => {
      console.log('Status:', res.statusCode, 'headers:', JSON.stringify(res.headers).slice(0,200));
      if (headers['Accept'] === 'application/json') {
        let d = ''; res.on('data', c => d += c); res.on('end', () => { 
          console.log('Response length:', d.length, 'first200:', d.slice(0, 200));
          try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('JSON: ' + d.slice(0, 100))); }
        });
      } else {
        const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    }).on('error', reject).end();
  });
}

(async () => {
  const data = await httpReq('https://api.pexels.com/videos/search?query=fitness&per_page=3', {
    headers: { Authorization: PEXELS_KEY },
    json: true
  });
  console.log('Videos:', data.videos?.length, 'page:', data.page);
})().catch(e => console.error('Error:', e.message));
