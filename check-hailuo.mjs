import { chromium } from 'playwright';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CDP_URL = 'ws://127.0.0.1:18800/devtools/browser/3238f575-e049-45a9-996d-16e4415c6696';

const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 90000 });
const ctx = browser.contexts()[0];
const pages = ctx.pages();
const hailuoPage = pages.find(p => p.url().includes('hailuoai.video'));

if (!hailuoPage) {
  console.log('No Hailuo page');
  await browser.close();
  process.exit(1);
}

console.log('Page URL:', hailuoPage.url());

// Check the creation module
const promptArea = hailuoPage.locator('[contenteditable]').first();
const areaText = await promptArea.textContent();
console.log('Prompt area text:', areaText?.substring(0, 50));

// List buttons with "25" in them
const allBtns = await hailuoPage.locator('button').all();
console.log('Total buttons:', allBtns.length);
for (const btn of allBtns) {
  const text = await btn.textContent().catch(() => '');
  const disabled = await btn.isDisabled().catch(() => null);
  if (text.includes('25') || text.includes('Generate') || text.includes('Create')) {
    console.log(`  Button: "${text}" disabled=${disabled}`);
  }
}

// Fill prompt and try to click generate
await promptArea.click({ clickCount: 3 });
await promptArea.fill('test prompt');
console.log('Filled test prompt');

const genBtn = hailuoPage.locator('button').filter({ hasText: /25/i }).first();
const genDisabled = await genBtn.isDisabled().catch(() => null);
console.log('Generate button disabled:', genDisabled);
await genBtn.click();
console.log('Clicked generate');
await hailuoPage.waitForTimeout(3000);

// Take screenshot
const screenshot = await hailuoPage.screenshot();
writeFileSync(resolve(__dirname, 'hailuo-after-generate.png'), screenshot);
console.log('Screenshot saved');

await browser.close();
