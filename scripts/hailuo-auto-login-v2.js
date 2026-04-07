/**
 * hailuo-auto-login-v2.js - Verify and fix Hailuo session
 * 
 * Uses testAuth() to check if session is actually valid for API calls.
 * If testAuth() fails, prompts for manual re-login.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');

function log(...args) { console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args); }

async function main() {
  log('=== Hailuo Session Verification ===');
  
  const { HailuoApp } = await import('../lib/hailuo-app.js');
  const app = new HailuoApp({ headless: true, sessionPath: SESSION_PATH, timeoutMs: 30000 });
  await app.init();
  
  log('Testing authentication...');
  const authOk = await app.testAuth();
  
  if (authOk) {
    log('✅ Session is VALID for API calls!');
    log('Ready to generate videos.');
  } else {
    log('❌ Session is INVALID or EXPIRED.');
    log('');
    log('To fix, you need to re-authenticate:');
    log('1. Run: node scripts/hailuo-session-fix.js');
    log('2. Log in manually if browser opens to login page');
    log('3. Wait for "Session saved" confirmation');
    log('4. Then re-run your video generation script');
  }
  
  await app.close();
}

main().catch(err => {
  log('Error:', err.message);
  process.exit(1);
});
