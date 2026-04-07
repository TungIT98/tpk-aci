/**
 * scripts/generate-tkp135.js
 * Generate 6 videos for TKP-135: AESTH-01, COM-01, LIFE-01, MOT-01, MOVIE-01, TECH-01
 * 
 * Run: node scripts/generate-tkp135.js
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();

function log(...args) {
  console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args);
}

const SCRIPTS = ['AESTH-01', 'COM-01', 'LIFE-01', 'MOT-01', 'MOVIE-01', 'TECH-01'];
const SCRIPT_DIR = resolve(ROOT, 'scripts', 'pending');
const OUTPUT_DIR = resolve(ROOT, 'output', 'videos');
const SESSION_PATH = resolve(ROOT, '.hailuo-session.json');

async function main() {
  log('=== TKP-135: Generate 6 Topic Videos ===');
  
  // Check session
  if (!existsSync(SESSION_PATH)) {
    log('ERROR: No Hailuo session found. Run: node scripts/setup-hailuo-app-session.js');
    process.exit(1);
  }

  // Import HailuoApp
  let HailuoApp;
  try {
    ({ HailuoApp } = await import('../lib/hailuo-app.js'));
  } catch (e) {
    log('ERROR: Could not import HailuoApp:', e.message);
    process.exit(1);
  }

  const app = new HailuoApp({
    headless: true,
    sessionPath: SESSION_PATH,
    timeoutMs: 30_000,
  });

  // Init
  await app.init();
  const loggedIn = await app.isLoggedIn();
  if (!loggedIn) {
    log('ERROR: Not logged in to Hailuo. Run: node scripts/setup-hailuo-app-session.js');
    await app.close();
    process.exit(1);
  }
  log('✓ Hailuo session valid');

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = [];
  
  for (const scriptId of SCRIPTS) {
    log(`\n${'='.repeat(50)}`);
    log(`Processing: ${scriptId}`);
    
    const scriptPath = resolve(SCRIPT_DIR, `${scriptId}.json`);
    if (!existsSync(scriptPath)) {
      log(`ERROR: Script not found: ${scriptPath}`);
      results.push({ id: scriptId, status: 'error', error: 'Script not found' });
      continue;
    }

    const script = JSON.parse(readFileSync(scriptPath, 'utf-8'));
    log(`Title: ${script.title}`);
    log(`Duration: ${script.duration_seconds}s`);
    log(`Category: ${script.category}`);

    const prompt = script.prompt_for_hailuo;
    const filename = `${scriptId}.mp4`;
    const outputPath = resolve(OUTPUT_DIR, filename);

    log(`Prompt: "${prompt.slice(0, 80)}..."`);
    
    try {
      // Generate video
      log('Generating video via Hailuo (this may take 5-15 min)...');
      const startTime = Date.now();
      
      // Navigate and fill
      await app._navigateToCreate();
      await app._fillPromptAndSubmit({ 
        prompt, 
        aspectRatio: '9:16' // portrait for TikTok
      });
      
      // Wait for completion (up to 15 min)
      log('Waiting for generation to complete...');
      let videoUrl = null;
      let attempt = 0;
      const maxAttempts = 90; // 15 min at 10s intervals
      
      while (attempt < maxAttempts) {
        const { done, downloadPath } = await app._checkCompletion();
        if (done && downloadPath) {
          videoUrl = downloadPath;
          break;
        }
        
        const status = await app._getGenerationStatus();
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        log(`  [${elapsed}s] ${status || 'processing...'}`);
        
        await new Promise(r => setTimeout(r, 10_000)); // 10s poll
        attempt++;
      }
      
      if (!videoUrl) {
        throw new Error('Video generation timed out (>15 min)');
      }
      
      // Download
      log(`Downloading video from Hailuo CDN...`);
      await app._downloadVideo(videoUrl, filename);
      
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      log(`✓ ${scriptId} generated in ${elapsed}s → ${outputPath}`);
      
      results.push({
        id: scriptId,
        status: 'success',
        path: outputPath,
        prompt: prompt.slice(0, 80),
        elapsed_s: elapsed,
      });

      // Update script JSON
      script.status = 'produced';
      script.local_path = outputPath;
      script.generated_at = new Date().toISOString();
      script.video_url = videoUrl;
      writeFileSync(scriptPath, JSON.stringify(script, null, 2), 'utf-8');
      log(`Updated script: ${scriptPath}`);
      
    } catch (e) {
      log(`✗ ${scriptId} failed: ${e.message}`);
      results.push({ id: scriptId, status: 'error', error: e.message });
      
      // Update script with error
      script.status = 'error';
      script.error = e.message;
      script.error_at = new Date().toISOString();
      writeFileSync(scriptPath, JSON.stringify(script, null, 2), 'utf-8');
    }
  }

  // Summary
  log('\n' + '='.repeat(50));
  log('GENERATION SUMMARY');
  log('='.repeat(50));
  const success = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'error');
  log(`Total: ${results.length} | Success: ${success.length} | Failed: ${failed.length}`);
  
  for (const r of results) {
    if (r.status === 'success') {
      log(`  ✓ ${r.id} → ${r.path} (${r.elapsed_s}s)`);
    } else {
      log(`  ✗ ${r.id} → ${r.error}`);
    }
  }

  // Save report
  const reportPath = resolve(ROOT, 'output', 'TKP-135-generation-report.json');
  writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  log(`\nReport: ${reportPath}`);

  await app.close();
  
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  log('CRASH:', err.message);
  process.exit(1);
});
