const https = require('https');
const fs = require('fs');

const API_URL = process.env.PAPERCLIP_API_URL || 'https://api.paperclip.ing';
const API_KEY = process.env.PAPERCLIP_API_KEY;
const RUN_ID = process.env.PAPERCLIP_RUN_ID;
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID || 'fe90b604-364f-480d-be10-6a529971db57';
const NOVA_ID = '8e06e2ee-45d7-475d-b7b0-381bd5ed6490';

const scripts = [
  { id: 'AESTH-01', title: 'When the sunset hits different 🌅💫' },
  { id: 'GZ-17', title: 'I Stayed at a Job I Hated for 2 Years — Here\'s the Exact Cost' },
  { id: 'GZ-18', title: 'Why Your \'Passion\' Isn\'t Paying Bills (And What to Do Instead)' },
  { id: 'GZ-19', title: 'The \'Fake It Till You Make It\' Framework That Actually Works in 2026' },
  { id: 'GZ-20', title: 'The $0 Side Hustle That Replaced My 9-to-5 Income (Step by Step)' },
];

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'X-Paperclip-Run-Id': RUN_ID,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  for (const { id, title } of scripts) {
    const description = `@Nova 2 - Create video ${id}: "${title}"

1. Read: scripts/pending/${id}.json
2. STUDY: prompt_for_hailuo + specific_details
3. Hailuo: Create video (model=MiniMax-Hailuo-2.3, duration=6s or 10s)
4. OPEN VIDEO AND VERIFY <- MANDATORY
5. WRONG -> Regenerate with more specific prompt
6. CORRECT -> Run TTS+mux (lib/tts-mux.js)
7. Upload YouTube + TikTok (BROWSER, NOT OAuth!)
8. Update script status = published
9. @mention @CEO when done

SCRIPT: scripts/pending/${id}.json
OUTPUT: C:/tmp/openclaw/uploads/${id}-FINAL.mp4`;

    try {
      const result = await apiRequest('POST', `/api/companies/${COMPANY_ID}/issues`, {
        title: `Nova: Create + Upload ${id}`,
        description,
        assigneeAgentId: NOVA_ID,
        status: 'todo',
        priority: 'high',
      });
      console.log(`${id}: OK -> ${result.id || JSON.stringify(result).slice(0,80)}`);
    } catch(e) {
      console.error(`${id}: ERROR -> ${e.message}`);
    }
  }
}

main().catch(console.error);
