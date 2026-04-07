import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CDP_URL = 'ws://127.0.0.1:18800/devtools/browser/3238f575-e049-45a9-996d-16e4415c6696';

const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 90000 });
const ctx = browser.contexts()[0];
const pages = ctx.pages();
const hailuoPage = pages.find(p => p.url().includes('hailuoai.video'));

if (!hailuoPage) {
  console.log('Hailuo page not found, pages:', pages.map(p => p.url().substring(0, 60)));
  await browser.close();
  process.exit(1);
}

console.log('Found Hailuo page:', hailuoPage.url());

// Get page structure
const html = await hailuoPage.content();
const textareaCount = await hailuoPage.locator('textarea').count();
const buttonCount = await hailuoPage.locator('button').count();
const inputCount = await hailuoPage.locator('input').count();
const videoCount = await hailuoPage.locator('video').count();

console.log('Textareas:', textareaCount);
console.log('Buttons:', buttonCount);
console.log('Inputs:', inputCount);
console.log('Videos:', videoCount);

// List buttons
const buttons = await hailuoPage.locator('button').allTextContents();
console.log('Buttons:', buttons.slice(0, 10));

// Take screenshot
const screenshot = await hailuoPage.screenshot();
writeFileSync(resolve(__dirname, 'hailuo-screenshot.png'), screenshot);
console.log('Screenshot saved to hailuo-screenshot.png');

await browser.close();
