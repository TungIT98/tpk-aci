/**
 * hailuo-gen-all.js - Self-contained Hailuo video generation + YouTube upload script
 * Uses: Playwright (standalone browser) for Hailuo, Hailuo API for generation
 * Downloads from Hailuo CDN and uploads to YouTube via Playwright browser
 * 
 * For YouTube upload: uses the OpenClaw browser's hailuo session
 * (Files must be accessible to the browser sandbox)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
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
const UPLOAD_DIR = 'C:/tmp/openclaw/uploads';
const OUTPUT_DIR = resolve(ROOT, 'output_topic', 'videos');
const SCRATCH_DIR = resolve(ROOT, 'scratch');
mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(SCRATCH_DIR, { recursive: true });

// Scripts to generate
const SCRIPTS = [
  { id: 'AESTH-01', file: 'AESTH-01.json', title: 'Aesthetic Morning Routine 🌅 #aesthetic #morningvibes' },
  { id: 'TECH-01',  file: 'TECH-01.json',  title: 'AI Just Changed Everything Forever 🤯 #AI #TechNews' },
  { id: 'COM-01',   file: 'COM-01.json',   title: 'POV: When Your Text Finally Gets Seen 😂 #comedy #text' },
  { id: 'LIFE-01',  file: 'LIFE-01.json',  title: 'Day in My Life: Productivity Mode Activated ✨ #lifestyle #dayinmylife' },
  { id: 'MOT-01',   file: 'MOT-01.json',   title: 'Nobody Believed in Me. Now Look at Me 💪 #motivation #success' },
  { id: 'MOVIE-01', file: 'MOVIE-01.json', title: 'The Plot Twist That Broke The Internet 🎬 #movie #plot twist' },
];

function loadScript(file) {
  const path = resolve(ROOT, 'scripts', 'pending', file);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForCDP(wsUrl, timeout = 10000) {
  const { default: WebSocket } = await import('ws');
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('CDP timeout')), timeout);
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => { clearTimeout(timer); res(ws); });
    ws.on('error', e => { clearTimeout(timer); rej(e); });
  });
}

async function main() {
  console.log('=== Hailuo Gen + Upload (All 6 Videos) ===\n');
  
  // Step 1: Check Hailuo session (use hailuo session from .hailuo-session.json)
  console.log('Step 1: Checking Hailuo session...');
  const sessionPath = resolve(ROOT, '.hailuo-session.json');
  if (!existsSync(sessionPath)) {
    console.error('No Hailuo session found! Run hailuo-session-fix.js first.');
    process.exit(1);
  }
  
  // Step 2: Launch Playwright browser with Hailuo session
  console.log('Step 2: Launching Hailuo browser...');
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--profile-directory=Profile 2']  // Use the Hailuo profile
  });
  
  const context = await browser.newContext({
    storageState: sessionPath,
  });
  const page = await context.newPage();
  
  // Navigate to Hailuo and verify logged in
  await page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  
  // Check credits
  const body = await page.textContent('body');
  const creditsMatch = body.match(/([\d,]+)\s*Max/);
  const credits = creditsMatch ? creditsMatch[1] : 'unknown';
  console.log(`Hailuo credits: ${credits}`);
  
  if (body.includes('登录') || body.includes('Sign in')) {
    console.error('NOT logged in! Session expired.');
    await browser.close();
    process.exit(1);
  }
  console.log('Hailuo: logged in ✓\n');
  
  // Step 3: Generate all 6 videos
  for (const s of SCRIPTS) {
    const scriptData = loadScript(s.file);
    if (!scriptData) { console.error(`Script not found: ${s.file}`); continue; }
    
    const prompt = scriptData.prompt_for_hailuo || scriptData.description || '';
    if (!prompt) { console.error(`No prompt for: ${s.id}`); continue; }
    
    console.log(`\n=== Generating ${s.id}: ${prompt.slice(0, 60)}... ===`);
    
    // Navigate to create page
    await page.goto('https://hailuoai.video/create/text-to-video', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);
    
    // Fill prompt
    try {
      const textarea = await page.waitForSelector('[data-id="prompt"], textarea, [contenteditable="true"]', { timeout: 5000 });
      await textarea.fill(prompt);
    } catch(e) {
      console.error(`  Could not fill prompt: ${e.message}`);
      continue;
    }
    
    // Submit
    await page.keyboard.press('Enter');
    console.log('  Submitted, waiting for generation...');
    
    // Wait for completion (up to 15 minutes)
    let completed = false;
    const startTime = Date.now();
    
    while (Date.now() - startTime < 15 * 60 * 1000) {
      await sleep(30000); // Check every 30s
      
      const currentUrl = page.url();
      const currentBody = await page.textContent('body');
      
      // Check if video appeared in history (March 29 section)
      if (currentBody.includes('29 Mar 2026') || currentBody.includes('March 29')) {
        // Look for the video text in the history
        const videoTexts = [...currentBody.matchAll(/(\d{2}:\d{2})\s+([A-Z][^0-9]{10,80})/g)];
        const ourVideo = videoTexts.find(v => prompt.slice(0, 20).includes(v[2].slice(0, 20)));
        if (ourVideo || currentBody.includes(prompt.slice(0, 30))) {
          console.log(`  Video completed!`);
          completed = true;
          break;
        }
      }
      
      // Check for new entries
      if (!currentBody.includes('Optimizing') && !currentBody.includes('Generating')) {
        // Look for a new video entry
        const march29Sections = currentBody.match(/29 Mar 2026[\s\S]{0,500}/);
        if (march29Sections) {
          const section = march29Sections[0];
          const hasDuration = /\d{2}:\d{2}/.test(section);
          if (hasDuration && !section.includes('00:00')) {
            console.log(`  Video detected in history`);
            completed = true;
            break;
          }
        }
      }
      
      console.log(`  Still generating... (${Math.round((Date.now() - startTime)/60000)}m elapsed)`);
    }
    
    if (!completed) {
      console.error(`  TIMEOUT: ${s.id} did not complete`);
      continue;
    }
    
    // Extract video URL from page DOM
    console.log(`  Extracting video URL...`);
    
    // Try to get the video CDN URL
    const cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send('Network.enable');
    
    let videoUrl = null;
    cdpSession.on('Network.requestWillBeSent', params => {
      const url = params.request.url;
      if (url.includes('.mp4') && url.includes('hailuo')) {
        videoUrl = url;
        console.log(`  Found CDN URL: ${url.slice(0, 80)}`);
      }
    });
    
    // Refresh to trigger network requests
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(5000);
    await cdpSession.detach();
    
    if (!videoUrl) {
      console.log(`  Could not extract CDN URL from network tab`);
    }
    
    // Download video if URL found
    if (videoUrl) {
      const outPath = resolve(OUTPUT_DIR, `${s.id}.mp4`);
      try {
        execSync(`curl -L -o "${outPath}" -H "Cookie: $(cat ${sessionPath.replace(/\\/g,'/')})" "${videoUrl}"`, { stdio: 'pipe', timeout: 120000 });
        const size = parseFloat(execSync(`powershell -Command "(Get-Item '${outPath}').Length / 1MB"`, { stdio: 'pipe' }).toString().trim());
        console.log(`  Downloaded: ${size.toFixed(1)} MB`);
      } catch(e) {
        console.error(`  Download failed: ${e.message.slice(0, 100)}`);
      }
    }
  }
  
  await browser.close();
  console.log('\n=== Done ===');
}

main().catch(e => { console.error(e); process.exit(1); });
