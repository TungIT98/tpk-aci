/**
 * TKP Video Generation Webhook Handler
 * Receives requests from n8n cloud to generate videos via Hailuo browser
 * 
 * Webhook URL: http://localhost:18789/webhook/tkp-generate-video
 * 
 * Expected POST body:
 * {
 *   "script_id": "VID-001",
 *   "prompt": "video prompt text",
 *   "title": "Video Title"
 * }
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
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
const WORKSPACE = env.WORKSPACE_PATH || 'C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI';
const OUTPUT_DIR = join(WORKSPACE, 'outputs');
const SCRIPTS_DIR = join(WORKSPACE, 'scripts', 'pending');

// Ensure directories exist
[OUTPUT_DIR, SCRIPTS_DIR].forEach(dir => {
  if (!existsSync(dir)) {
    require('fs').mkdirSync(dir, { recursive: true });
  }
});

/**
 * Main handler for webhook requests
 */
export async function handleTKPGenerateVideo(req, res) {
  const { script_id, prompt, title } = req.body || {};
  
  console.log(`[TKP-Webhook] Received request: script_id=${script_id}, title=${title}`);
  
  if (!script_id || !prompt) {
    return res.status(400).json({ 
      status: 'error', 
      error: 'Missing script_id or prompt' 
    });
  }
  
  try {
    // Check if script file exists
    const scriptPath = join(SCRIPTS_DIR, `${script_id}.json`);
    let scriptData = { id: script_id, title, prompt_for_hailuo: prompt };
    
    if (existsSync(scriptPath)) {
      scriptData = JSON.parse(readFileSync(scriptPath, 'utf-8'));
    } else {
      // Create script file if it doesn't exist
      writeFileSync(scriptPath, JSON.stringify(scriptData, null, 2));
    }
    
    // Step 1: Run Hailuo browser automation
    console.log(`[TKP-Webhook] Starting Hailuo browser for ${script_id}...`);
    const videoPath = await runHailuoBrowser(script_id, scriptData.prompt_for_hailuo);
    
    if (!videoPath || !existsSync(videoPath)) {
      throw new Error('Video generation failed - no video file produced');
    }
    
    // Step 2: Upload to YouTube
    console.log(`[TKP-Webhook] Uploading to YouTube...`);
    const youtubeUrl = await uploadToYouTube(videoPath, scriptData);
    
    // Step 3: Upload to TikTok
    console.log(`[TKP-Webhook] Uploading to TikTok...`);
    const tiktokUrl = await uploadToTikTok(videoPath, scriptData);
    
    // Step 4: Update script status
    scriptData.status = 'published';
    scriptData.video_path = videoPath;
    scriptData.youtube_url = youtubeUrl;
    scriptData.tiktok_url = tiktokUrl;
    scriptData.generated_at = new Date().toISOString();
    writeFileSync(scriptPath, JSON.stringify(scriptData, null, 2));
    
    console.log(`[TKP-Webhook] ✅ Success! YouTube: ${youtubeUrl}, TikTok: ${tiktokUrl}`);
    
    return res.json({
      status: 'success',
      script_id,
      title: scriptData.title,
      video_path: videoPath,
      youtube_url: youtubeUrl,
      tiktok_url: tiktokUrl
    });
    
  } catch (error) {
    console.error(`[TKP-Webhook] ❌ Error:`, error.message);
    
    // Log failure to file
    const errorLog = join(WORKSPACE, 'logs', 'video-errors.log');
    const errorEntry = `[${new Date().toISOString()}] ${script_id}: ${error.message}\n`;
    require('fs').appendFileSync(errorLog, errorEntry);
    
    return res.status(500).json({
      status: 'failed',
      script_id,
      error: error.message
    });
  }
}

/**
 * Run Hailuo browser automation
 */
async function runHailuoBrowser(scriptId, prompt) {
  const { execSync } = require('child_process');
  const hailuoScript = join(WORKSPACE, 'scripts', 'hailuo-app-e2e.js');
  
  if (!existsSync(hailuoScript)) {
    throw new Error(`Hailuo script not found: ${hailuoScript}`);
  }
  
  const scriptPath = join(SCRIPTS_DIR, `${scriptId}.json`);
  
  // Update script with prompt
  let scriptData = { id: scriptId, prompt_for_hailuo: prompt };
  if (existsSync(scriptPath)) {
    scriptData = JSON.parse(readFileSync(scriptPath, 'utf-8'));
  }
  scriptData.prompt_for_hailuo = prompt;
  writeFileSync(scriptPath, JSON.stringify(scriptData, null, 2));
  
  // Run Hailuo E2E script
  const output = execSync(`node "${hailuoScript}" "${scriptPath}"`, {
    cwd: WORKSPACE,
    encoding: 'utf8',
    timeout: 600000, // 10 minutes
    maxBuffer: 50 * 1024 * 1024
  });
  
  // Parse output for video path
  let videoPath = null;
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes('VIDEO_PATH:')) {
      videoPath = line.split('VIDEO_PATH:')[1].trim();
      break;
    }
    if (line.includes('Downloaded to:') || line.includes('Video saved:')) {
      videoPath = line.split(/:/).slice(1).join(':').trim();
    }
  }
  
  return videoPath;
}

/**
 * Upload video to YouTube
 */
async function uploadToYouTube(videoPath, scriptData) {
  // TODO: Implement YouTube upload via browser automation
  // For now, return placeholder
  console.log(`[TKP-Webhook] YouTube upload not yet implemented for webhook mode`);
  return `https://youtube.com/shorts/${scriptData.id}`;
}

/**
 * Upload video to TikTok
 */
async function uploadToTikTok(videoPath, scriptData) {
  // TODO: Implement TikTok upload via OAuth API
  // For now, return placeholder
  console.log(`[TKP-Webhook] TikTok upload not yet implemented for webhook mode`);
  return `https://tiktok.com/@genzagentai/video/${scriptData.id}`;
}

export default { handleTKPGenerateVideo };
