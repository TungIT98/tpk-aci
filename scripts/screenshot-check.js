// screenshot-check.js - Take screenshot to see actual page state
import { HailuoApp } from '../lib/hailuo-app.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI');
const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');

async function main() {
  const app = new HailuoApp({ headless: false, sessionPath: SESSION_PATH });
  await app.init();
  
  await app._page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded' });
  await app._page.waitForTimeout(3000);
  
  // Check URL and page state
  const url = app._page.url();
  console.log('URL:', url);
  
  const bodyText = await app._page.locator('body').innerText().catch(() => '');
  console.log('Body text (300 chars):', bodyText.slice(0, 300));
  
  // Take screenshot
  await app._page.screenshot({ path: resolve(ROOT, 'output', 'hailuo-page.png'), fullPage: false });
  console.log('Screenshot saved');
  
  // Check login state via cookies
  const cookies = await app._page.context().cookies();
  const authCookies = cookies.filter(c => c.domain.includes('hailuoai') || c.domain.includes('hailuo'));
  console.log('\nAuth cookies:', authCookies.map(c => `${c.name?.slice(0,30)} (exp:${c.expires > 0 ? new Date(c.expires*1000).toISOString().slice(0,10) : 'session'})`));
  
  await app.close();
}

main().catch(console.error);
