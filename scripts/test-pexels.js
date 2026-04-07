import https from 'https';

const PEXELS_KEY = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa';

function req(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Authorization: PEXELS_KEY } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d.slice(0, 1000)));
    }).on('error', reject);
  });
}

(async () => {
  const r = await req('https://api.pexels.com/videos/search?query=fitness&per_page=3');
  console.log(r);
})();
