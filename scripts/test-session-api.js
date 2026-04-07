// test-session-api.js - Test Hailuo API auth with session cookies
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { chromium } from 'playwright';

const ROOT = resolve('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI');
const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');

async function main() {
  console.log('=== Testing Hailuo Session Auth ===\n');
  
  const sessionData = JSON.parse(readFileSync(SESSION_PATH, 'utf8'));
  console.log(`Session has ${sessionData.cookies.length} cookies`);
  
  // Create browser with session
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: sessionData });
  const page = await context.newPage();
  
  // Intercept API calls to detect auth failures
  const apiCalls = [];
  page.on('response', async resp => {
    const url = resp.url();
    if (url.includes('hailuo') || url.includes('cdn')) {
      const ct = resp.headers()['content-type'] || '';
      const status = resp.status();
      let body = '';
      try { body = (await resp.clone().text()).slice(0, 200); } catch {}
      apiCalls.push({ url: url.slice(-60), status, ct: ct.slice(0, 30), body });
    }
  });
  
  // Go to create page
  await page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Check cookies
  const cookies = await context.cookies(['hailuoai.video', '.hailuoai.video']);
  console.log(`\nActive Hailuo cookies: ${cookies.length}`);
  for (const c of cookies) {
    const exp = c.expires > 0 ? new Date(c.expires * 1000).toISOString() : 'session';
    console.log(`  ${c.name?.slice(0,40)} | exp:${exp.slice(0,10)}`);
  }
  
  // Try to submit and check for login modal
  const textarea = page.locator('div[contenteditable]').first();
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('test auth', { delay: 20 });
  await new Promise(r => setTimeout(r, 500));
  
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText?.trim() === '25');
    btn?.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  
  const buttons = await page.evaluate(() => 
    Array.from(document.querySelectorAll('button')).map(b => b.innerText?.trim()).filter(Boolean)
  );
  
  console.log(`\nButtons after submit:`, buttons);
  
  const needsLogin = buttons.some(b => b.includes('Continue with Google') || b.includes('Sign Up') || b.includes('Log In'));
  
  if (needsLogin) {
    console.log('\n❌ SESSION INVALID: Needs re-login');
    console.log('   Run: node scripts/hailuo-session-fix.js');
  } else {
    console.log('\n✅ SESSION VALID: No login modal');
  }
  
  // Show relevant API calls
  console.log('\nAPI calls:');
  for (const a of apiCalls.slice(-10)) {
    console.log(`  [${a.status}] ${a.url} | ${a.ct}`);
    if (a.body) console.log(`    Body: ${a.body.slice(0, 150)}`);
  }
  
  await browser.close();
}

main().catch(console.error);
