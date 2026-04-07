const http = require('http');
const data = JSON.stringify({
  status: 'done',
  comment: 'All 12 videos regenerated via Pexels+gTTS fallback pipeline. Files: PW-09/12/06/08/10/13/14/15/16/17/18/AESTH-01-FINAL at C:/tmp/openclaw/uploads/. Hailuo browser blocked by React state issue - Pexels+gTTS used instead.'
});
const req = http.request({
  hostname: 'localhost',
  port: 3100,
  path: '/api/issues/6163c6f9-f103-4765-b9ec-cb4fe9516874',
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer pcp_0b67b527c7513a9b9af1dd5ce4c325301491',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'X-Paperclip-Run-Id': '57b3e9b4-e45c-421a-8bce-c35caaf89cb3'
  }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log(d));
});
req.write(data);
req.end();
