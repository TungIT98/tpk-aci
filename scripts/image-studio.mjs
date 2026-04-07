/**
 * scripts/image-studio.mjs
 * Image-Based Video Studio — zero-cost production pipeline for TKP Content Agency.
 *
 * Runs: Script → Storyboard → Stable Diffusion images → Video clips → Assembly → Export
 * All image generation is local (RTX 5060). No AI video generation API required.
 * Cost per video: ~$0 in GPU compute.
 *
 * Prerequisites:
 *   1. Stable Diffusion WebUI (recommended) or ComfyUI running locally
 *      - WebUI: python webui.py --api --listen --xformers
 *      - ComfyUI: python main.py --listen
 *   2. FFmpeg installed (ffmpeg -version)
 *
 * Usage:
 *   # Preview — generate storyboard from a script
 *   node scripts/image-studio.mjs --storyboard --script "Your script text here"
 *
 *   # Test SD connectivity
 *   node scripts/image-studio.mjs --sd-check
 *
 *   # Produce a video (full pipeline)
 *   node scripts/image-studio.mjs \
 *     --topic "Why Your Morning Routine Is Killing You" \
 *     --channel growth \
 *     --script "In this video, you'll learn why..." \
 *     --audio assets/audio/track.mp3 \
 *     --music assets/music/growth/track.mp3
 *
 *   # Resume a failed run from scene images
 *   node scripts/image-studio.mjs --resume --session-id abc123
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadEnv() {
  try {
    const env = {};
    for (const line of readFileSync(resolve(ROOT, '.env'), 'utf-8').split('\n')) {
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

// ---------------------------------------------------------------------------
// Stage logger
// ---------------------------------------------------------------------------

const log = (stage, msg, icon = '▶') => {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${icon} [${stage.toUpperCase()}] ${msg}`);
};
const logOK   = (s, m) => log(s, m, '✔');
const logWarn = (s, m) => log(s, m, '⚠');
const logFail = (s, m) => log(s, m, '✖');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = argv[i + 1]?.startsWith('--') ? true : argv[++i] ?? true;
      args[key] = val;
    }
  }
  return args;
}

const args = parseArgs(process.argv);

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function sdCheck() {
  console.log('\n=== Stable Diffusion Connectivity Check ===\n');
  const { StableDiffusionGenerator } = await import('../lib/stable-diffusion.js');
  const sd = new StableDiffusionGenerator();
  const health = await sd.healthCheck();

  if (health.ok) {
    console.log(`  Backend:    ${sd.backend}`);
    console.log(`  URL:        ${sd.baseUrl}`);
    console.log(`  Status:     OK${health.version ? ` (v${health.version})` : ''}`);
    if (health.model) console.log(`  Model:      ${health.model}`);
    console.log('\n  Ready to generate images.\n');
  } else {
    console.error(`  Status:     UNREACHABLE`);
    if (health.error) console.error(`  Error:      ${health.error}`);
    console.error('\n  Setup steps:');
    console.error('  1. Install Stable Diffusion WebUI:');
    console.error('       git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git');
    console.error('       cd stable-diffusion-webui');
    console.error('       webui-user.bat  (Windows)  or  ./webui.sh (Mac/Linux)');
    console.error('       → Launch with flags: --api --listen --xformers');
    console.error('');
    console.error('  2. Set in .env:');
    console.error('       SD_WEBUI_URL=http://127.0.0.1:7860');
    console.error('       SD_BACKEND=webui');
    console.error('');
    console.error('  Or for ComfyUI:');
    console.error('       COMFYUI_URL=http://127.0.0.1:8188');
    console.error('       SD_BACKEND=comfyui');
    console.error('\n');
  }
  return health;
}

async function storyboardPreview() {
  const script = args.script ?? args.s;
  if (!script) {
    console.error('Usage: --storyboard --script "Your script text"');
    process.exit(1);
  }

  console.log('\n=== Storyboard Preview ===\n');
  const { breakIntoScenes } = await import('../lib/image-studio.js');

  // Fake word timings from script word count
  const words = script.split(/\s+/);
  const WPM = 150;
  const wordTimings = [];
  let t = 0;
  for (const w of words) {
    wordTimings.push({ word: w, start: t, end: t + (60 / WPM) });
    t += 60 / WPM;
  }

  const scenes = breakIntoScenes(script, wordTimings);
  console.log(`  Script:    ${script.substring(0, 100)}${script.length > 100 ? '...' : ''}`);
  console.log(`  Scenes:    ${scenes.length}\n`);
  console.log('  Scene breakdown:');
  for (const s of scenes) {
    console.log(`  [${s.id}]  ${(s.end - s.start).toFixed(1)}s  →  ${s.text.substring(0, 60)}${s.text.length > 60 ? '...' : ''}`);
  }
  console.log('\n  Image prompt:');
  for (const s of scenes) {
    console.log(`  [${s.id}]  "${s.imagePrompt.substring(0, 80)}..."`);
  }
  console.log('');
}

async function generateImages() {
  const script = args.script ?? args.s;
  if (!script) {
    console.error('Usage: --generate-images --script "..." --channel growth');
    process.exit(1);
  }

  const channel = args.channel ?? 'productivity';
  console.log(`\n=== Image Generation (${channel}) ===\n`);

  const { StableDiffusionGenerator, buildSDPrompt } = await import('../lib/stable-diffusion.js');
  const { breakIntoScenes } = await import('../lib/image-studio.js');

  const sd = new StableDiffusionGenerator();
  const health = await sd.healthCheck();
  if (!health.ok) {
    logFail('SD', 'Stable Diffusion backend not reachable. Run --sd-check first.');
    process.exit(1);
  }

  const words = script.split(/\s+/);
  const wordTimings = [];
  let t = 0;
  for (const w of words) {
    wordTimings.push({ word: w, start: t, end: t + 0.4 });
    t += 0.4;
  }

  const scenes = breakIntoScenes(script, wordTimings);
  logOK('SCRIPT', `${scenes.length} scenes identified`);

  const scenePrompts = scenes.map(s => ({
    prompt:       s.imagePrompt,
    aspectRatio:  args.aspectRatio ?? '9:16',
  }));

  log('SD', `Generating ${scenePrompts.length} images (2 at a time)...`);
  const paths = await sd.batchGenerateScenes(scenePrompts, { channel, concurrency: 2 });

  const successCount = paths.filter(p => p !== null).length;
  logOK('SD', `${successCount}/${scenePrompts.length} images generated`);

  for (let i = 0; i < scenes.length; i++) {
    const icon = paths[i] ? '✔' : '✖';
    console.log(`  ${icon} [${scenes[i].id}]  ${paths[i] ?? '(failed)'}`);
  }
  console.log('');
}

async function fullPipeline() {
  const script = args.script ?? args.s;
  const topic  = args.topic  ?? args.title ?? 'Untitled';
  const channel = args.channel ?? 'productivity';
  const audioPath = args.audio;
  const musicPath = args.music;

  if (!script || !audioPath) {
    console.error('Usage: --produce --script "..." --audio path.mp3 [--music path.mp3] [--channel growth]');
    console.error('  Minimum: --script + --audio required');
    process.exit(1);
  }

  if (!existsSync(audioPath)) {
    logFail('AUDIO', `Audio file not found: ${audioPath}`);
    process.exit(1);
  }

  console.log(`\n=== Image-Based Video Pipeline ===`);
  console.log(`  Topic:     ${topic}`);
  console.log(`  Channel:   ${channel}`);
  console.log(`  Audio:     ${audioPath}`);
  console.log(`  Music:     ${musicPath ?? '(none)'}\n`);

  const { ImageStudio } = await import('../lib/image-studio.js');

  const studio = new ImageStudio({ channel });

  try {
    const result = await studio.produceVideo({
      script,
      audioPath,
      musicPath:    musicPath ?? null,
      topic,
      aspectRatio:  args.aspectRatio ?? '9:16',
    });

    logOK('PIPELINE', `Done in ${result.elapsedSec}s`);
    console.log(`  Master:    ${result.masterFile}`);
    if (existsSync(result.tiktokFile)) logOK('OUTPUT', `TikTok:   ${result.tiktokFile}`);
    if (existsSync(result.youtubeFile)) logOK('OUTPUT', `YouTube:  ${result.youtubeFile}`);
    console.log(`  Scenes:    ${result.scenes.length}`);
    console.log(`  QC:        ${result.qcPassed ? 'PASSED' : 'MANUAL CHECK NEEDED'}`);
    console.log('');

    // Log cost
    console.log('  Cost estimate: ~$0.00 (local GPU)');
    console.log('');
  } catch (err) {
    logFail('PIPELINE', err.message);
    process.exit(1);
  }
}

async function preflightCheck() {
  console.log('\n=== Image Studio Pre-flight Check ===\n');
  const checks = [];

  // FFmpeg
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    await execAsync('ffmpeg -version');
    checks.push({ name: 'FFmpeg', ok: true });
  } catch { checks.push({ name: 'FFmpeg', ok: false, fix: 'Download from https://ffmpeg.org' }); }

  // Stable Diffusion
  const sdHealth = await sdCheck();
  checks.push({ name: 'Stable Diffusion', ok: sdHealth.ok });

  // Output dirs
  const dirs = ['output', 'assets/sd-images', 'assets/broll', 'assets/music'];
  for (const d of dirs) {
    const p = resolve(ROOT, d);
    const exists = existsSync(p);
    checks.push({ name: `Dir: ${d}`, ok: exists });
    if (!exists) mkdirSync(p, { recursive: true });
  }

  // .env keys
  const neededKeys = ['SD_WEBUI_URL', 'COMFYUI_URL'];
  for (const k of neededKeys) {
    checks.push({ name: `.env: ${k}`, ok: !!env[k], fix: `Add ${k}=... to .env` });
  }

  console.log('\n  Summary:');
  const passCount = checks.filter(c => c.ok).length;
  for (const c of checks) {
    console.log(`  ${c.ok ? '✔' : '✖'} ${c.name}`);
  }
  console.log(`\n  ${passCount}/${checks.length} checks passed\n`);
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

const command = args._?.[0] ?? (
  args.sd_check ? 'sd-check' :
  args.storyboard ? 'storyboard' :
  args.generate_images || args['generate-images'] ? 'generate-images' :
  args.produce ? 'produce' :
  args.preflight ? 'preflight' :
  args.resume ? 'resume' :
  'help'
);

switch (command) {
  case 'sd-check':
  case 'sd_check':
    await sdCheck();
    break;

  case 'storyboard':
    await storyboardPreview();
    break;

  case 'generate-images':
  case 'generate_images':
    await generateImages();
    break;

  case 'produce':
    await fullPipeline();
    break;

  case 'preflight':
    await preflightCheck();
    break;

  case 'resume':
    console.log('Resume from session: not yet implemented — file a bug for session persistence');
    break;

  default:
    console.log(`
Image-Based Video Studio — TKP zero-cost production pipeline

USAGE:
  node scripts/image-studio.mjs <command> [options]

COMMANDS:
  --sd-check         Test Stable Diffusion connectivity
  --storyboard       Preview scene breakdown from a script
  --generate-images  Generate scene images (no audio yet)
  --produce          Full pipeline: script → final video
  --preflight        System pre-flight check

OPTIONS:
  --script "..."       Script text (required for storyboard/generate/produce)
  --topic "..."        Video topic/title (for produce)
  --channel            'productivity' | 'growth' (default: productivity)
  --audio <path>       TTS audio MP3 path (required for produce)
  --music <path>       Background music MP3 path (optional)
  --aspect-ratio       '9:16' | '16:9' | '1:1' (default: 9:16)

EXAMPLES:
  node scripts/image-studio.mjs --sd-check

  node scripts/image-studio.mjs --storyboard --script "Your morning routine is killing your productivity. Here's what to do instead..."

  node scripts/image-studio.mjs --produce \
    --topic "Why Your Morning Routine Is Killing You" \
    --channel growth \
    --script "In this video..." \
    --audio output/audio/track.mp3 \
    --music assets/music/growth/track.mp3

ENVIRONMENT (.env):
  SD_WEBUI_URL=http://127.0.0.1:7860   (Stable Diffusion WebUI address)
  COMFYUI_URL=http://127.0.0.1:8188    (ComfyUI address)
  SD_BACKEND=webui                      (webui | comfyui)
  SD_TIMEOUT_MS=300000                   (generation timeout in ms)

COST: ~$0 per video (local RTX 5060 GPU, no API fees)
`);
}
