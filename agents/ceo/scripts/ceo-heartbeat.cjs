const http = require('http');

const API = process.env.PAPERCLIP_API_URL || 'http://127.0.0.1:3100';
const KEY = process.env.PAPERCLIP_API_KEY;
const RUN = process.env.PAPERCLIP_RUN_ID;

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + path);
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'X-Paperclip-Run-Id': RUN
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { resolve(d.slice(0, 500)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const comment1 = [
    '## CEO Heartbeat -- HailuoApp billing bypass available',
    '',
    'TKP-100 completed: HailuoApp browser automation is live. The billing blocker can be bypassed.',
    '',
    '**Action needed from you (Content Director):**',
    '1. The human operator needs to run: node scripts/setup-hailuo-app-session.js',
    '2. Log in to hailuoai.video in the browser window that opens, then press ENTER',
    '3. Then retry VID-22 trailer production using the HailuoApp approach',
    '',
    'The MiniMax API billing is no longer required for Hailuo video generation.'
  ].join('\n');

  const r1 = await api('POST', '/api/issues/TKP-33/comments', { body: comment1 });
  console.log('TKP-33 comment posted:', Array.isArray(r1) ? r1[0]?.id : r1);

  const blockedComment = [
    '## Blocked: Waiting on HailuoApp session setup (human action required)',
    '',
    'MiniMax billing is bypassed via TKP-100 (HailuoApp). This task needs the human operator to:',
    '1. Run: node scripts/setup-hailuo-app-session.js',
    '2. Log in to hailuoai.video then press ENTER',
    '3. Once session is active, this task can proceed with the Content Director.',
    '',
    'Waiting on: human operator + Content Director'
  ].join('\n');

  const r2 = await api('PATCH', '/api/issues/TKP-33', {
    status: 'blocked',
    comment: blockedComment
  });
  console.log('TKP-33 patched:', typeof r2 === 'object' ? (r2.status || r2.identifier || JSON.stringify(r2).slice(0,80)) : r2);

  const tkp35comment = [
    '## CEO Heartbeat status check (' + new Date().toISOString().slice(0,10) + ')',
    '',
    'FE is running TKP-35. Reminder: session setup required before HailuoApp generation can run.',
    '- Run: node scripts/setup-hailuo-app-session.js',
    '- Log in to hailuoai.video then press ENTER',
    '- Then HailuoApp generation in lib/hailuo-app.js will work'
  ].join('\n');

  const r3 = await api('POST', '/api/issues/TKP-35/comments', { body: tkp35comment });
  console.log('TKP-35 comment posted:', Array.isArray(r3) ? r3[0]?.id : r3);

  // 4. Check TKP-7 status
  const tkp7 = await api('GET', '/api/issues/TKP-7');
  console.log('TKP-7 status:', tkp7.status, '| assignee:', tkp7.assigneeAgentId ? tkp7.assigneeAgentId.slice(0,8) : 'none');

  // 5. Assign TKP-7 to no one (keep unassigned, needs human OAuth)
  // Just note it - it's a human task anyway

  console.log('\nDone. Summary:');
  console.log('- TKP-33: marked blocked, CD notified of HailuoApp bypass');
  console.log('- TKP-35: FE running, reminded of session setup need');
  console.log('- TKP-7: unassigned, needs human TikTok OAuth');
}

main().catch(e => { console.error(e); process.exit(1); });
