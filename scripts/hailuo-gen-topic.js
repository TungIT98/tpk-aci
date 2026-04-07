/**
 * hailuo-gen-topic.js
 * Generate topic videos using Profile 2 browser (Hailuo + YouTube OAuth)
 * Uses hailuo's "Upload to YouTube" feature for automatic upload
 */
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  try {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim().split('#')[0].trim();
      env[key] = val;
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();

const VIDEOS = [
  { id: 'AESTH-01', file: 'AESTH-01.json',
    title: 'Aesthetic Morning Routine 🌅 #aesthetic #morningvibes',
    prompt: 'Aesthetic woman with pastel outfit, standing in golden hour light, soft smile, camera slowly pushing in' },
  { id: 'TECH-01',  file: 'TECH-01.json',
    title: 'AI Just Changed Everything Forever 🤯 #AI #TechNews',
    prompt: 'Futuristic AI robot with glowing blue eyes, working in a high-tech lab, cinematic lighting' },
  { id: 'COM-01',   file: 'COM-01.json',
    title: 'POV: When Your Text Finally Gets Seen 😂 #comedy #text',
    prompt: 'Funny reaction shot of person looking at phone, shocked expression, chaotic hand movements' },
  { id: 'LIFE-01',  file: 'LIFE-01.json',
    title: 'Day in My Life: Productivity Mode Activated ✨ #lifestyle #dayinmylife',
    prompt: 'Beautiful morning routine, sunlight through windows, woman drinking coffee, peaceful atmosphere' },
  { id: 'MOT-01',   file: 'MOT-01.json',
    title: 'Nobody Believed in Me. Now Look at Me 💪 #motivation #success',
    prompt: 'Person training hard in gym at sunrise, determination in eyes, muscles flexing, motivational' },
  { id: 'MOVIE-01', file: 'MOVIE-01.json',
    title: 'The Plot Twist That Broke The Internet 🎬 #movie #plot twist',
    prompt: 'Dramatic movie scene with unexpected twist, actor screaming in shock, dark cinematic lighting' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generateAndUpload(page, video) {
  console.log(`\n=== ${video.id}: Generating ===`);
  console.log(`Prompt: ${video.prompt.slice(0, 60)}...`);

  // Navigate to Hailuo create page
  await page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  // Check logged in
  const body = await page.textContent('body');
  if (body.includes('登录') || body.includes('Sign in')) {
    console.error('  NOT logged in!');
    return { id: video.id, status: 'not_logged_in' };
  }

  // Find and fill prompt textbox
  try {
    const textarea = page.locator('[data-id="prompt"], textarea, [contenteditable="true"]').first();
    await textarea.waitFor({ timeout: 5000 });
    await textarea.fill(video.prompt);
    console.log('  Prompt filled');
  } catch(e) {
    console.error(`  Could not fill prompt: ${e.message}`);
    return { id: video.id, status: 'fill_failed' };
  }

  // Submit (press Enter)
  await page.keyboard.press('Enter');
  console.log('  Submitted, waiting for generation...');

  // Wait for video to appear (up to 15 minutes)
  const startTime = Date.now();
  let completed = false;
  let videoUrl = null;
  let lastProgress = '';

  while (Date.now() - startTime < 15 * 60 * 1000) {
    await sleep(15000); // Check every 15s

    const currentBody = await page.textContent('body');

    // Look for completion indicators
    // Video appears with duration text
    const completedMatch = currentBody.match(/(\d{2}:\d{2})\s+([A-Z][^0-9]{5,80})/);
    if (completedMatch) {
      const [_, duration, text] = completedMatch;
      if (duration === '00:06' && video.prompt.slice(0, 20).includes(text.slice(0, 15).trim())) {
        console.log(`  Video completed: ${duration} - ${text.slice(0, 40)}...`);
        completed = true;
        break;
      }
    }

    // Also check for "Generating" status to disappear
    if (!currentBody.includes('Optimizing') && !currentBody.includes('Generating') && 
        !currentBody.includes('processing') && !currentBody.includes('Membership fast-track')) {
      // Status gone - might be done
      const march29Match = currentBody.match(/29 Mar 2026[\s\S]{0,300}/);
      if (march29Match && march29Match[0].includes('00:06')) {
        console.log('  Video in March 29 section!');
        completed = true;
        break;
      }
    }

    // Progress update
    const progressMatch = currentBody.match(/(\d+%)\s+(Generating|Optimizing)/);
    if (progressMatch) {
      const progress = progressMatch[1];
      if (progress !== lastProgress) {
        console.log(`  Progress: ${progress}`);
        lastProgress = progress;
      }
    }
  }

  if (!completed) {
    console.error(`  TIMEOUT: ${video.id} did not complete in 15 min`);
    return { id: video.id, status: 'timeout' };
  }

  // Now upload to YouTube
  console.log(`  Uploading to YouTube...`);

  // Find the "Upload to YouTube" button
  // It should be in the video card or in the video detail view
  try {
    // Click on the video to open the player/modal
    const videoCard = page.locator('text=/00:06.*' + video.prompt.slice(0, 15).replace(/\s/g, '.{0,3}') + '/i').first();
    if (await videoCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await videoCard.click();
      await sleep(3000);
    }
  } catch {}

  // Look for "Upload to YouTube" button
  try {
    const ytBtn = page.locator('button:has-text("Upload to YouTube"), button:has-text("Tải lên YouTube"), button:has-text("Share to YouTube")').first();
    if (await ytBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ytBtn.click();
      console.log('  Upload to YouTube clicked!');
      await sleep(10000);
    } else {
      console.log('  No Upload to YouTube button found');
    }
  } catch(e) {
    console.log('  Upload button error:', e.message.slice(0, 50));
  }

  // Check YouTube status
  const ytBody = await page.textContent('body');
  const ytUrl = page.url();

  if (ytUrl.includes('youtube.com') && !ytUrl.includes('hailuo')) {
    console.log(`  Now on YouTube: ${ytUrl}`);
    return { id: video.id, status: 'upload_started', url: ytUrl };
  }

  console.log(`  Done. URL: ${ytUrl}`);
  return { id: video.id, status: 'done', url: ytUrl };
}

async function main() {
  console.log('=== Hailuo Topic Video Generator + YouTube Upload ===\n');

  // Launch Profile 2 (Hailuo + YouTube)
  const browser = await chromium.launch({
    headless: false,
    args: ['--profile-directory=Profile 2']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const results = [];

  for (const v of VIDEOS) {
    try {
      const result = await generateAndUpload(page, v);
      results.push(result);
      console.log(`  Result: ${result.status}`);
    } catch(e) {
      console.error(`  Failed: ${e.message}`);
      results.push({ id: v.id, status: 'error', error: e.message });
    }
    await sleep(5000);
  }

  await browser.close();
  console.log('\n\n=== SUMMARY ===');
  for (const r of results) {
    console.log(`${r.id}: ${r.status}${r.url ? ' | ' + r.url : ''}`);
  }
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
