import { chromium } from 'playwright';

const CDP_URL = 'ws://127.0.0.1:18800/devtools/browser/a0acead7-9d28-4e2e-932d-4c20bf14fc58';
const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 60000 });
console.log('Connected, contexts:', browser.contexts().length);

const ctx = browser.contexts()[0];
const page = await ctx.newPage();
console.log('New page created');

await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(5000);
console.log('URL:', page.url());

// Get page target ID for reconnection
const pageId = page.target()._targetId;
console.log('Page target ID:', pageId);

await browser.close();
console.log('Done');
