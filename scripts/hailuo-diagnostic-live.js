/**
 * Diagnostic: submit a video and track URLs over time
 */
import { HailuoApp } from '../lib/hailuo-app.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const app = new HailuoApp({ headless: false });
await app.init();

console.log('Logged in:', await app.isLoggedIn());
await app._navigateToCreate();
await sleep(2000);

const initialUrls = await app._getCurrentVideoUrls();
console.log('Initial URLs:', JSON.stringify(initialUrls, null, 2));

console.log('\nSubmitting test prompt...');
await app._fillPromptAndSubmit({
  prompt: 'A cat running in a park, sunny day, 9:16 portrait',
  aspectRatio: '9:16'
});

const checkPoints = [2000, 5000, 10000, 30000, 60000, 120000];
let elapsed = 0;
let prevUrls = initialUrls;

for (const target of checkPoints) {
  await sleep(target - elapsed);
  elapsed = target;
  const urls = await app._getCurrentVideoUrls();
  const t = elapsed / 1000;
  const newUrls = urls.filter(u => !initialUrls.some(old => old.includes(u.split('/').pop().split('-')[0])));
  console.log(`\n[${t}s] Total URLs: ${urls.length}, New (by key): ${newUrls.length}`);
  if (newUrls.length > 0) console.log(`  NEW: ${JSON.stringify(newUrls)}`);
  const status = await app._getGenerationStatus();
  console.log(`  Status: "${status || 'none'}"`);
  prevUrls = urls;
}

await app.close();
console.log('\nDone');
