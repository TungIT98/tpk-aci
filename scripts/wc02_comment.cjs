const http = require('http');

const TOKEN = '724b0662d7f8cb522ac2db5ab10723da95c42ff192657815';
const ISSUE_ID = 'cbcfaddc-e9e3-4679-a48d-b28c02361548';

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const headers = {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
    };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const opts = { hostname: 'localhost', port: 3100, path, method, headers };
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: d }));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  // Post comment
  const comment = {
    body: `## Upload Retry — TKP-162 — April 1, 2026 9:03 AM

### Status: BOTH PLATFORMS UNAVAILABLE — OAuth Re-auth Required

**YouTube:** ❌ Refresh token expired/invalid (Google returned \`invalid_grant\`). Re-auth needed at https://studio.youtube.com

**TikTok:** ❌ No OAuth tokens configured (\`TIKTOK_ACCESS_TOKEN\` / \`TIKTOK_REFRESH_TOKEN\` not set). Run \`node scripts/oauth-tiktok.js\` to set up.

**Agent:** ❌ Agent \`dc784ae2\` is terminated — checkout returned 409. Manual assignment needed.

### Video Ready:
- \`C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\uploads\\WC-02.mp4\`
- **Title:** The Entire Bar Falls Silent
- **Caption:** The ball gets passed. Then again. Then suddenly everyone's on their feet...

### Action Required:
1. Re-authorize YouTube at https://studio.youtube.com (YouTube Data API OAuth flow)
2. Run \`node scripts/oauth-tiktok.js\` to set up TikTok
3. Re-assign issue to active agent
`
  };

  const r1 = await apiCall('POST', '/api/issues/' + ISSUE_ID + '/comments', comment);
  console.log('Comment status:', r1.status, r1.data);

  // Update status to in_progress (stay in queue)
  const r2 = await apiCall('PATCH', '/api/issues/' + ISSUE_ID, {
    status: 'in_progress',
    comment: 'Both YouTube OAuth expired and TikTok OAuth not configured. Manual re-auth required. Video ready at uploads/WC-02.mp4.'
  });
  console.log('Patch status:', r2.status, r2.data);
}

main().catch(console.error);
