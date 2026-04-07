// check-session.js - Check session validity and try fresh login
import { HailuoApp } from '../lib/hailuo-app.js';
import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI');
const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');

async function main() {
  console.log('=== Checking Hailuo Session ===\n');
  
  // Try existing session
  if (existsSync(SESSION_PATH)) {
    console.log('Trying existing session...');
    const app1 = new HailuoApp({ headless: true, sessionPath: SESSION_PATH });
    await app1.init();
    
    // Check cookies in the browser
    const cookies = await app1._page.context().cookies();
    console.log(`Browser has ${cookies.length} cookies`);
    
    const hailuoCookies = cookies.filter(c => c.domain.includes('hailuo'));
    console.log(`Hailuo cookies: ${hailuoCookies.length}`);
    
    for (const c of hailuoCookies) {
      const exp = c.expires > 0 ? new Date(c.expires * 1000).toISOString() : 'session';
      console.log(`  ${c.name?.slice(0,40)} | ${c.domain} | exp:${exp.slice(0,10)} | httpOnly:${c.httpOnly}`);
    }
    
    // Check if logged in via DOM
    const domLoggedIn = await app1.isLoggedIn();
    console.log(`\nisLoggedIn (DOM): ${domLoggedIn}`);
    
    // Check cookies being sent with API request
    await app1._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
    await app1._page.waitForTimeout(2000);
    
    // Try to fill and submit to check for login prompt
    const textarea = app1._page.locator('div[contenteditable]').first();
    await textarea.click();
    await app1._page.keyboard.press('Control+A');
    await app1._page.keyboard.press('Backspace');
    await app1._page.keyboard.type('test prompt for cookie check', { delay: 10 });
    await app1._page.waitForTimeout(500);
    
    await app1._page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText?.trim() === '25');
      btn?.click();
    });
    await app1._page.waitForTimeout(2000);
    
    const afterButtons = await app1._page.evaluate(() => 
      Array.from(document.querySelectorAll('button')).map(b => b.innerText?.trim()).filter(Boolean)
    );
    console.log(`\nButtons after submit:`, afterButtons);
    
    const needsLogin = afterButtons.some(b => b.includes('Continue with Google') || b.includes('Sign Up') || b.includes('Log In'));
    console.log(`Needs re-login: ${needsLogin}`);
    
    await app1.close();
    
    if (needsLogin) {
      console.log('\n⚠️  Session cookies are expired/invalid. Need fresh login.');
    }
  }
}

main().catch(console.error);
