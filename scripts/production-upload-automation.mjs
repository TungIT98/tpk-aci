/**
 * scripts/production-upload-automation.mjs
 * Automated upload workflow for Production Manager
 * Uploads videos to YouTube and TikTok automatically
 *
 * Usage:
 *   node scripts/production-upload-automation.mjs                    # Auto-upload all pending
 *   node scripts/production-upload-automation.mjs --video WC-01       # Upload specific video
 *   node scripts/production-upload-automation.mjs --dryrun            # Show what would be uploaded
 *   node scripts/production-upload-automation.mjs --platform youtube  # YouTube only
 *   node scripts/production-upload-automation.mjs --platform tiktok  # TikTok only
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCRIPTS_PENDING = join(ROOT, 'scripts', 'pending');
const OUTPUTS = join(ROOT, 'outputs');

// Load .env
function loadEnv() {
  const envPath = join(ROOT, '.env');
  try {
    const env = {};
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
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

// ============================================================================
// LOGGING
// ============================================================================

const LOG_FILE = join(ROOT, 'logs', 'production-uploads.log');

function log(...args) {
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] ${args.join(' ')}`;
  console.log(msg);
  try {
    const dir = dirname(LOG_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(LOG_FILE, msg + '\n', { flag: 'a' });
  } catch {}
}

function logError(...args) {
  log('[ERROR]', ...args);
}

// ============================================================================
// FIND VIDEOS READY FOR UPLOAD
// ============================================================================

/**
 * Find scripts with status = "ready_for_upload" or "pending" that have video files
 */
function findVideosReadyForUpload() {
  const results = [];

  if (!existsSync(SCRIPTS_PENDING)) {
    log('No scripts/pending directory found');
    return results;
  }

  const files = readdirSync(SCRIPTS_PENDING).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = join(SCRIPTS_PENDING, file);
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const videoId = data.id;

      // Skip if already published with YouTube URL
      if (data.status === 'published' && data.youtube_url) {
        continue;
      }

      // Find the actual video file
      let videoPath = null;
      const possiblePaths = [
        join(OUTPUTS, videoId, 'final.mp4'),
        join(OUTPUTS, videoId, `${videoId}-final.mp4`),
        join(OUTPUTS, `${videoId}-final.mp4`),
        join(OUTPUTS, videoId, 'output.mp4'),
      ];

      for (const p of possiblePaths) {
        if (existsSync(p)) {
          videoPath = p;
          break;
        }
      }

      if (!videoPath) {
        continue; // No video file found
      }

      results.push({
        id: videoId,
        scriptPath: filePath,
        videoPath,
        title: data.title || videoId,
        description: data.description || data.script || '',
        tags: data.tags || [],
        caption: data.caption || data.title || '',
        thumbnail: data.thumbnail_idea || null,
        category: data.category || 'Entertainment',
        status: data.status,
      });
    } catch (err) {
      logError(`Failed to read ${file}: ${err.message}`);
    }
  }

  return results;
}

// ============================================================================
// TIKTOK UPLOAD
// ============================================================================

async function uploadToTikTok(videoPath, caption, tags) {
  const captionWithTags = [...tags, '#viral', '#fyp', '#trending'].join(' ');

  return new Promise((resolve) => {
    log(`[TIKTOK] Starting upload: ${videoPath}`);

    const scriptPath = join(ROOT, 'lib', 'upload', 'tiktok-browser.js');

    // Check if session exists
    const sessionPath = join(ROOT, '.tiktok-session.json');
    if (!existsSync(sessionPath)) {
      log('[TIKTOK] No session file - run setup-tiktok-session.js first');
      resolve({ success: false, error: 'No TikTok session' });
      return;
    }

    // Use Node.js to run the upload
    const proc = spawn('node', [
      scriptPath,
      '--video=' + videoPath,
      '--caption=' + JSON.stringify(caption + ' ' + captionWithTags),
    ], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        log('[TIKTOK] Upload successful');
        resolve({ success: true, url: 'TikTok uploaded' });
      } else {
        logError(`[TIKTOK] Upload failed with code ${code}`);
        logError(stderr);
        resolve({ success: false, error: stderr || 'Upload failed' });
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      proc.kill();
      resolve({ success: false, error: 'Timeout after 5 minutes' });
    }, 300000);
  });
}

// ============================================================================
// YOUTUBE UPLOAD
// ============================================================================

async function uploadToYouTube(videoPath, title, description, tags, category) {
  log(`[YOUTUBE] Starting upload: ${videoPath}`);
  log(`[YOUTUBE] Title: ${title}`);

  // Check n8n first (PRIMARY - fully automatic if n8n is running)
  const n8nUrl = env.N8N_BASE_URL || 'http://localhost:5678';
  const n8nWorkflowUrl = `${n8nUrl}/webhook/youtube-upload`;

  // Try n8n webhook first (automatic upload if n8n workflow is configured)
  try {
    const videoBuf = readFileSync(videoPath);
    const filename = videoPath.split(/[/\\]/).pop();

    const formData = new URLSearchParams();
    formData.append('videoPath', videoPath);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('tags', JSON.stringify(tags));
    formData.append('category', category);

    const n8nResp = await fetch(n8nWorkflowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoPath,
        title,
        description,
        tags,
        category,
        action: 'trigger_upload'
      }),
    }).catch(() => null);

    if (n8nResp && n8nResp.ok) {
      log('[YOUTUBE] n8n workflow triggered successfully');
      // n8n workflow will handle the upload asynchronously
      // Update status to indicate upload in progress via n8n
      return { success: true, url: 'YouTube (via n8n workflow)', platform: 'youtube' };
    }
  } catch (err) {
    log(`[YOUTUBE] n8n not available: ${err.message}`);
  }

  // Fallback: Use YouTube Data API v3 with OAuth
  log('[YOUTUBE] Falling back to YouTube Data API v3...');

  const hasOAuth = !!(env.YOUTUBE_REFRESH_TOKEN &&
                      env.YOUTUBE_CLIENT_ID &&
                      env.YOUTUBE_CLIENT_SECRET);

  if (!hasOAuth) {
    logError('[YOUTUBE] No upload method available!');
    logError('[YOUTUBE] Run: node scripts/youtube-oauth-setup.js');
    return { success: false, error: 'No upload method available' };
  }

  // Use API upload via youtube.js
  return new Promise((resolve) => {
    const scriptPath = join(ROOT, 'lib', 'upload', 'youtube.js');

    if (!existsSync(scriptPath)) {
      logError('[YOUTUBE] youtube.js not found');
      resolve({ success: false, error: 'Upload script not found' });
      return;
    }

    // Convert Windows paths to forward slashes for Node.js
    const scriptPathUnix = scriptPath.replace(/\\/g, '/');
    const videoPathUnix = videoPath.replace(/\\/g, '/');

    const proc = spawn('node', [
      '-e', `
        import { YouTubeUploader } from 'file:///${scriptPathUnix}';
        const uploader = new YouTubeUploader();
        if (!uploader.enabled) {
          console.log(JSON.stringify({ success: false, error: 'YouTube OAuth not configured' }));
          process.exit(1);
        }
        const result = await uploader.upload({
          videoPath: '${videoPathUnix.replace(/'/g, "\\'")}',
          title: '${title.replace(/'/g, "\\'")}',
          description: '${description.replace(/'/g, "\\'")}',
          tags: ${JSON.stringify(tags)},
          category: '${category}',
          privacy: 'public'
        });
        console.log(JSON.stringify(result));
      `
    ], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      try {
        const result = JSON.parse(stdout);
        if (result.success) {
          log(`[YOUTUBE] Upload successful: ${result.url}`);
        } else {
          logError(`[YOUTUBE] Upload failed: ${result.error}`);
        }
        resolve(result);
      } catch {
        logError('[YOUTUBE] Parse error:', stdout, stderr);
        resolve({ success: false, error: stderr || 'Unknown error' });
      }
    });

    setTimeout(() => {
      proc.kill();
      resolve({ success: false, error: 'Timeout after 5 minutes' });
    }, 300000);
  });
}

async function uploadToYouTubeBrowser(videoPath, title, description) {
  // Use playwright browser automation with saved session
  log('[YOUTUBE] Using browser automation with session...');

  const sessionPath = join(ROOT, '.youtube-session.json');
  const hasSession = existsSync(sessionPath);

  return new Promise((resolve) => {
    // Dynamic import playwright
    import('playwright').then(async ({ chromium }) => {
      try {
        const browser = await chromium.launch({
          headless: false,
          args: [
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--disable-notifications'
          ]
        });

        const contextOptions = {
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        };

        // Load session if exists
        if (hasSession) {
          log('[YOUTUBE] Loading saved session...');
          contextOptions.storageState = JSON.parse(readFileSync(sessionPath, 'utf-8'));
        }

        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();

        // Remove webdriver flag
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        // Navigate to YouTube Studio upload page
        log('[YOUTUBE] Navigating to YouTube Studio upload...');
        await page.goto('https://studio.youtube.com/channel/UCpNiXZ7Zz3MjMlUpLIvpWmg/videos/upload?d=ud', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        await page.waitForTimeout(8000);

        // Check if redirected to login
        if (page.url().includes('/login')) {
          log('[YOUTUBE] Not logged in! Run: node scripts/setup-youtube-session.js');
          await browser.close();
          resolve({ success: false, error: 'Not logged in - run setup-youtube-session.js' });
          return;
        }

        log('[YOUTUBE] Current URL:', page.url());

        // Find file input - try multiple selectors
        log('[YOUTUBE] Looking for file input...');
        const fileInput = page.locator('input[type="file"]').first();

        if (await fileInput.count() === 0) {
          // Try alternative selectors
          const altInput = page.locator('input[type=file]').first();
          if (await altInput.count() === 0) {
            log('[YOUTUBE] File input not found - page may have changed');
            await page.screenshot({ path: 'youtube-upload-error.png' });
            logError('[YOUTUBE] Screenshot saved: youtube-upload-error.png');
            await browser.close();
            resolve({ success: false, error: 'Upload page changed - screenshot saved' });
            return;
          }
        }

        log('[YOUTUBE] Uploading video:', videoPath);
        await fileInput.setInputFiles(videoPath);
        log('[YOUTUBE] Video selected, waiting for processing...');

        // Wait for upload to complete
        await page.waitForTimeout(15000);

        // Look for success indicators
        const url = page.url();
        log('[YOUTUBE] Current URL:', url);

        // Save session for next time
        if (!hasSession) {
          const state = await context.storageState();
          writeFileSync(sessionPath, JSON.stringify(state));
          log('[YOUTUBE] Session saved to .youtube-session.json');
        }

        await browser.close();
        resolve({ success: true, url: url });

      } catch (err) {
        logError('[YOUTUBE] Browser error:', err.message);
        resolve({ success: false, error: err.message });
      }
    }).catch(err => {
      logError('[YOUTUBE] Playwright import error:', err.message);
      resolve({ success: false, error: err.message });
    });
  });
}

// ============================================================================
// UPDATE SCRIPT STATUS
// ============================================================================

function updateScriptStatus(scriptPath, updates) {
  try {
    const data = JSON.parse(readFileSync(scriptPath, 'utf-8'));
    Object.assign(data, updates);
    writeFileSync(scriptPath, JSON.stringify(data, null, 2));
    log(`[STATUS] Updated ${scriptPath}`);
  } catch (err) {
    logError(`[STATUS] Failed to update ${scriptPath}: ${err.message}`);
  }
}

// ============================================================================
// MAIN UPLOAD FLOW
// ============================================================================

async function uploadVideo(video, options = {}) {
  const { platform = 'all', dryRun = false } = options;

  log(`\n${'='.repeat(60)}`);
  log(`Processing: ${video.id}`);
  log(`Video file: ${video.videoPath}`);
  log(`${'='.repeat(60)}`);

  if (dryRun) {
    log('[DRY RUN] Would upload:');
    log(`  YouTube: ${video.title}`);
    log(`  TikTok: ${video.caption}`);
    return { youtube: { success: true }, tiktok: { success: true } };
  }

  const results = { id: video.id };

  // Upload to YouTube
  if (platform === 'all' || platform === 'youtube') {
    log('[YOUTUBE] Starting...');
    const ytResult = await uploadToYouTube(
      video.videoPath,
      video.title,
      video.description,
      video.tags,
      video.category
    );
    results.youtube = ytResult;

    if (ytResult.success && ytResult.url) {
      updateScriptStatus(video.scriptPath, {
        youtube_url: ytResult.url,
        youtube_uploaded_at: new Date().toISOString()
      });
    }
  }

  // Upload to TikTok
  if (platform === 'all' || platform === 'tiktok') {
    log('[TIKTOK] Starting...');
    const ttResult = await uploadToTikTok(video.videoPath, video.caption, video.tags);
    results.tiktok = ttResult;

    if (ttResult.success && ttResult.url) {
      updateScriptStatus(video.scriptPath, {
        tiktok_url: ttResult.url,
        tiktok_uploaded_at: new Date().toISOString()
      });
    }
  }

  // Mark as published if at least YouTube succeeded
  if (results.youtube?.success) {
    updateScriptStatus(video.scriptPath, {
      status: 'published',
      published_at: new Date().toISOString()
    });
  }

  return results;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const options = {
    platform: 'all',
    dryRun: false,
    videoId: null
  };

  for (const arg of args) {
    if (arg === '--dryrun') options.dryRun = true;
    if (arg === '--platform=youtube') options.platform = 'youtube';
    if (arg === '--platform=tiktok') options.platform = 'tiktok';
    if (arg.startsWith('--video=')) options.videoId = arg.replace('--video=', '');
  }

  log('\n' + '='.repeat(60));
  log('PRODUCTION UPLOAD AUTOMATION');
  log('='.repeat(60));
  log(`Platform: ${options.platform}`);
  log(`Dry run: ${options.dryRun}`);
  log(`Time: ${new Date().toISOString()}`);
  log('='.repeat(60) + '\n');

  // Find videos ready for upload
  let videos = findVideosReadyForUpload();

  if (options.videoId) {
    videos = videos.filter(v => v.id === options.videoId);
  }

  if (videos.length === 0) {
    log('No videos found ready for upload');
    return;
  }

  log(`Found ${videos.length} video(s) ready for upload`);

  let successCount = 0;
  let failCount = 0;

  for (const video of videos) {
    try {
      const results = await uploadVideo(video, options);

      if (results.youtube?.success || results.tiktok?.success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      logError(`Failed to upload ${video.id}: ${err.message}`);
      failCount++;
    }

    // Small delay between uploads to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  log('\n' + '='.repeat(60));
  log('UPLOAD SUMMARY');
  log('='.repeat(60));
  log(`Total: ${videos.length}`);
  log(`Success: ${successCount}`);
  log(`Failed: ${failCount}`);
  log('='.repeat(60));
}

// Run
main().catch(err => {
  logError('Fatal error:', err);
  process.exit(1);
});
