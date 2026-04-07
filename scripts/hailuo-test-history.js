/**
 * hailuo-test-history.js - Simple history page test with retry
 */
import { HailuoApp } from '../lib/hailuo-app.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const app = new HailuoApp({ headless: false });
  await app.init();
  console.log('Logged in:', await app.isLoggedIn());

  async function safeGoto(url) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await app._page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(3000);
        return true;
      } catch (e) {
        console.log(`  Attempt ${attempt} failed: ${e.message.slice(0, 80)}`);
        if (attempt < 3) {
          console.log('  Retrying...');
          await sleep(5000);
        }
      }
    }
    return false;
  }

  // Step 1: Capture history snapshot BEFORE submission
  console.log('\n--- SNAPSHOT BEFORE ---');
  await safeGoto('https://hailuoai.video/video');
  const beforeUrls = await app._getCurrentVideoUrls();
  console.log('History before (' + beforeUrls.length + ' videos):');
  beforeUrls.forEach((u, i) => console.log(`  ${i+1}. ${u.slice(0, 80)}`));

  // Step 2: Submit a test prompt
  console.log('\n--- SUBMITTING ---');
  await app._navigateToCreate();
  await sleep(2000);
  await app._fillPromptAndSubmit({
    prompt: 'A red sports car driving through mountain road, sunny day, cinematic',
    aspectRatio: '9:16'
  });
  console.log('Submitted at', new Date().toISOString());

  // Step 3: Wait with periodic keepalive
  console.log('\n--- WAITING 180s ---');
  for (let i = 0; i < 18; i++) {
    await sleep(10000);
    console.log(`  ${(i+1)*10}s elapsed...`);
  }
  console.log('Done waiting at', new Date().toISOString());

  // Step 4: Check history page
  console.log('\n--- HISTORY AFTER ---');
  await safeGoto('https://hailuoai.video/video');
  const afterUrls = await app._getCurrentVideoUrls();
  console.log('History after (' + afterUrls.length + ' videos):');
  afterUrls.forEach((u, i) => console.log(`  ${i+1}. ${u.slice(0, 80)}`));

  const newUrls = afterUrls.filter(u => !beforeUrls.includes(u));
  console.log('\nNEW URLs (' + newUrls.length + '):');
  newUrls.forEach(u => console.log('  ' + u.slice(0, 80)));

  await app.close();
  console.log('\nDone');
}

main().catch(e => { console.error(e); process.exit(1); });
