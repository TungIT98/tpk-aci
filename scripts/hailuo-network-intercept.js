// Intercept Hailuo API calls to find correct headers
import { chromium } from 'playwright';

const TARGET_CDP = 'ws://127.0.0.1:18800/devtools/page/43C6E84B042CC5D82D1F386903ABAD2D';

async function main() {
  console.log('Connecting to Hailuo tab...');
  const browser = await chromium.connectOverCDP(TARGET_CDP);
  const ctx = browser.contexts()[0];
  let page = ctx.pages()[0];
  
  console.log('Current URL:', page.url());
  
  // Set up request interception BEFORE navigating
  const requests = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('hailuoai') || url.includes('minimax')) {
      requests.push({
        url: url.substring(0, 150),
        method: req.method(),
        headers: req.headers(),
        postData: req.postData()?.substring(0, 200)
      });
    }
  });
  
  page.on('response', async resp => {
    const url = resp.url();
    if (url.includes('hailuoai') || url.includes('minimax') || url.includes('/api/')) {
      try {
        const body = await resp.text();
        console.log('\n=== RESPONSE ===');
        console.log('URL:', url.substring(0, 150));
        console.log('Status:', resp.status());
        console.log('Body:', body.substring(0, 500));
        console.log('================\n');
      } catch(e) {}
    }
  });
  
  console.log('Navigating to Hailuo...');
  try {
    await page.goto('https://hailuoai.video/create/text-to-video', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
  } catch(e) {
    console.log('Navigation result:', e.message.substring(0, 100));
  }
  
  console.log('URL after nav:', page.url());
  await page.waitForTimeout(3000);
  
  console.log('\nAPI Requests captured:', requests.length);
  for(const req of requests.slice(0, 10)) {
    console.log(`\n[${req.method}] ${req.url}`);
    const auth = req.headers['authorization'] || req.headers['Authorization'];
    const yy = req.headers['yy'] || req.headers['Yy'];
    console.log(`Auth: ${auth?.substring(0, 50)}`);
    console.log(`yy: ${yy}`);
    console.log(`PostData: ${req.postData}`);
  }
  
  await browser.close();
}

main().catch(e => console.error('Error:', e.message));
