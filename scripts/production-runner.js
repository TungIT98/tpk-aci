#!/usr/bin/env node
/**
 * scripts/production-runner.js
 *
 * TKP-35: VID-24 Pilot Production — Execute video pipeline for SEO briefs.
 *
 * Reads SEO briefs from content/seo-briefs/, runs each through:
 *   TTS (ElevenLabs / MiniMax / SAPI) → Hailuo Video (API → App fallback)
 *
 * Produces:
 *   output/videos/{brief-id}.mp4   — raw generated video
 *   output/videos/{brief-id}.mp3   — TTS audio
 *   output/VID-24-manifest.json   — production tracking manifest
 *
 * Usage:
 *   node scripts/production-runner.js                        # run all briefs
 *   node scripts/production-runner.js --briefs PW-01 GZ-01  # specific briefs
 *   node scripts/production-runner.js --dry-run             # show what would run
 *   node scripts/production-runner.js --status              # show manifest status
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = resolve(ROOT, '.env');
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

// ---------------------------------------------------------------------------
// Module imports (lazy)
// ---------------------------------------------------------------------------

let _TTS, _HailuoVideo, _HailuoApp;

async function loadDeps() {
  if (_TTS) return;
  const [ttsMod, hailuoMod, hailuoAppMod] = await Promise.all([
    import('../lib/tts.js'),
    import('../lib/hailuo.js'),
    import('../lib/hailuo-app.js'),
  ]);
  _TTS         = new ttsMod.TTSProvider();
  _HailuoVideo = new hailuoMod.HailuoVideo();
  _HailuoApp   = new hailuoAppMod.HailuoApp();
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MANIFEST_PATH = resolve(ROOT, 'output', 'VID-24-manifest.json');
const VIDEOS_DIR     = resolve(ROOT, 'output', 'videos');
const AUDIO_DIR      = resolve(ROOT, 'output', 'videos');

// Default: run first 10 briefs (PW-01 through PW-10 for productivity, GZ-01 through GZ-05 for gen_z)
// Full handoff lists from SEO team WEEK1-SEO-HANDOFF
const DEFAULT_BRIEFS = [
  // Productivity Worker channel
  'PW-01', 'PW-02', 'PW-03', 'PW-04', 'PW-05',
  // Gen Z Success channel
  'GZ-01', 'GZ-02', 'GZ-03', 'GZ-04', 'GZ-05',
];

const CHANNEL_MAP = {
  productivity_worker: {
    briefPrefix: 'PW',
    ttsChannel:  'productivity',
    aspectRatio: '16:9',
    label:       'TKP Productivity',
  },
  gen_z_success: {
    briefPrefix: 'GZ',
    ttsChannel:  'growth',
    aspectRatio: '9:16',
    label:       'TKP Growth',
  },
};

// ---------------------------------------------------------------------------
// Brief parser
// ---------------------------------------------------------------------------

/**
 * Parse an SEO brief markdown file.
 * Returns structured data extracted from the brief.
 */
function parseBrief(filePath) {
  const raw = readFileSync(filePath, 'utf-8');

  // Format: "> Channel: Channel 1: Productivity Worker" or "> Channel: Channel 2: Gen Z Success"
  const channelMatch = raw.match(/Channel:\s*Channel\s*\d*:\s*(.+)/m);
  const channelRaw   = channelMatch?.[1]?.trim() ?? '';
  const channelKey   = channelRaw.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') ?? 'unknown';

  // Title: first numbered list item (Option 1 = recommended)
  const titleMatch = raw.match(/^\d+\.\s+`(.+?)`/m);
  const title        = titleMatch?.[1]?.trim() ?? '';

  // Extract description template (between ``` fences)
  const descMatch = raw.match(/```\n([\s\S]+?)```/);
  const descriptionTemplate = descMatch?.[1]?.trim() ?? '';

  // Extract primary keyword
  const keywordMatch = raw.match(/Primary Keyword[`\n]+`(.+?)`/);
  const primaryKeyword = keywordMatch?.[1]?.trim() ?? '';

  // Extract hashtags — look for lines starting with Broad/Niche/Seasonal/Broad-TikTok labels
  const hashtagLines = raw.match(/^(?:Broad|Niche|Seasonal|Broad-TikTok)[\s:]+(.+)$/gm) || [];
  const hashtags = [];
  for (const line of hashtagLines) {
    const m = line.match(/^(?:Broad|Niche|Seasonal|Broad-TikTok)[\s:]+(.+)$/);
    if (m) {
      hashtags.push(...(m[1].match(/#\S+/g) || []));
    }
  }

  // Extract chapters (| timestamp | title |)
  const chapters = [];
  for (const match of raw.matchAll(/^\|\s*(\d+:\d+)\s*\|\s*([^|]+)\|/gm)) {
    chapters.push({ time: match[1], title: match[2].trim() });
  }

  // Extract upload notes
  const uploadNoteMatch = raw.match(/\*\*Publish on(.+?)(?=\n\*\*|\n#|\n\*[^\*]|$)/s);
  const uploadNote = uploadNoteMatch?.[1]?.trim() ?? '';

  // Determine brief ID from filename: PW-01.md → PW-01
  // Use both / and \ as separators for cross-platform compatibility
  const fileName = filePath.split(/[/\\]/).pop().replace('.md', '');
  const prefix   = fileName.split('-')[0];
  const channelFromPrefix = prefix === 'PW' ? 'productivity_worker' : 'gen_z_success';

  return {
    id:           fileName,
    channel:      channelFromPrefix,
    title,
    descriptionTemplate,
    primaryKeyword,
    hashtags,
    chapters,
    uploadNote,
    raw,
  };
}

/**
 * Build a short video prompt from the brief's content.
 */
function buildVideoPrompt(brief) {
  const channel = brief.channel;
  const topic   = brief.title || brief.primaryKeyword;

  if (channel === 'gen_z_success') {
    return `Fast-paced cuts, phone screens, energetic vibe, bright and punchy. Gen Z success tip: ${topic}. High energy, modern aesthetic.`;
  }
  return `Professional workspace, clean and cinematic, soft natural lighting. Productivity tip: ${topic}. Camera push-in, warm professional tone.`;
}

/**
 * Extract the narration script from the brief's description template.
 * The description template contains the video narration (what gets read on-screen).
 */
function extractNarration(brief) {
  // Remove YouTube chapter markers like "00:00 —"
  let script = brief.descriptionTemplate
    .replace(/^\d+:\d+\s*—\s*/gm, '')
    .replace(/\nIn this video you'll learn:[\s\S]+?(?=\n\n|\n#|$)/, '')
    .replace(/\n\n#+.+$/s, '')
    .trim();
  return script;
}

// ---------------------------------------------------------------------------
// Manifest management
// ---------------------------------------------------------------------------

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return { version: 1, runId: null, produced: [], summary: {} };
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch {
    return { version: 1, runId: null, produced: [], summary: {} };
  }
}

function saveManifest(manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
}

function updateManifestEntry(manifest, briefId, updates) {
  const idx = manifest.produced.findIndex(e => e.briefId === briefId);
  if (idx >= 0) {
    manifest.produced[idx] = { ...manifest.produced[idx], ...updates };
  } else {
    manifest.produced.push({ briefId, ...updates });
  }
}

// ---------------------------------------------------------------------------
// Production run
// ---------------------------------------------------------------------------

async function runBrief(brief, pipeline, manifest, dryRun = false) {
  const { id: briefId, channel, title } = brief;
  const cfg = CHANNEL_MAP[channel];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${briefId}] Starting — ${cfg.label}`);
  console.log(`  Title: ${title || '(no title)'}`);
  console.log(`  Channel: ${channel}`);

  if (dryRun) {
    console.log(`  DRY RUN — would generate TTS + video`);
    const prefix = briefId.startsWith('PW') ? 'PW' : 'GZ';
    const ch = prefix === 'PW' ? 'productivity_worker' : 'gen_z_success';
    updateManifestEntry(manifest, briefId, { status: 'dry_run', channel: ch });
    return manifest;
  }

  const stageResults = {};
  const startTime = Date.now();

  try {
    // Stage 1: Extract narration script
    const scriptText = extractNarration(brief);
    if (!scriptText || scriptText.length < 10) {
      throw new Error(`Could not extract narration from brief ${briefId}. Check brief format.`);
    }
    console.log(`  Script (${scriptText.length} chars): "${scriptText.slice(0, 80)}..."`);
    stageResults.script = { ok: true, length: scriptText.length };

    // Stage 2: TTS
    console.log(`  [TTS] Generating audio via ${cfg.ttsChannel}...`);
    const ttsStart = Date.now();

    let ttsResult;
    try {
      // Try ElevenLabs first
      const result1 = await _TTS.speakForChannel(cfg.ttsChannel, {
        text:     scriptText,
        provider: 'elevenlabs',
      });
      const audioPath = resolve(AUDIO_DIR, `${briefId}.mp3`);
      if (result1?.audioBuffer) {
        writeFileSync(audioPath, result1.audioBuffer);
        ttsResult = { provider: 'elevenlabs', path: audioPath, ok: true };
      } else if (result1?.mp3Path) {
        ttsResult = { provider: 'elevenlabs', path: result1.mp3Path, ok: true };
      } else if (result1?.audio_url) {
        // MiniMax TTS returns { audio_url, duration_s }
        const res = await fetch(result1.audio_url);
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(audioPath, buf);
        ttsResult = { provider: 'minimax', path: audioPath, ok: true };
      }
    } catch (ttsErr) {
      console.warn(`  [TTS] ElevenLabs/MiniMax failed (${ttsErr.message}), falling back to SAPI...`);
    }

    // SAPI fallback if TTS failed or returned nothing
    if (!ttsResult) {
      const sapiPath = resolve(AUDIO_DIR, `${briefId}.mp3`);
      await _TTS.speakForChannel(cfg.ttsChannel, {
        text:     scriptText,
        provider: 'sapi',
        outputPath: sapiPath,
      });
      ttsResult = { provider: 'sapi', path: sapiPath, ok: true };
    }
    console.log(`  [TTS] Done (${((Date.now() - ttsStart) / 1000).toFixed(1)}s) → ${ttsResult.path}`);
    stageResults.tts = ttsResult;

    // Stage 3: Hailuo Video
    console.log(`  [Video] Generating via Hailuo (aspect: ${cfg.aspectRatio})...`);
    const videoStart = Date.now();
    const videoPrompt = buildVideoPrompt(brief);

    let videoResult;
    let videoSource;

    // Try API first
    try {
      const { HailuoVideo } = await import('../lib/hailuo.js');
      const hailuo = new HailuoVideo();
      videoResult = await hailuo.generateVideo({
        prompt:       videoPrompt,
        model:        'MiniMax-Hailuo-2.3',
        aspect_ratio: cfg.aspectRatio,
        duration:     6,
      });
      videoSource = 'api';
    } catch (apiErr) {
      const isBillingErr =
        apiErr.message.includes('1008') ||
        apiErr.message.includes('insufficient') ||
        apiErr.message.includes('balance') ||
        apiErr.message.includes('quota');

      if (isBillingErr) {
        console.warn(`  [Video] API insufficient balance. Falling back to HailuoApp browser...`);
        const { HailuoApp } = await import('../lib/hailuo-app.js');
        const hailuoApp = new HailuoApp();
        videoResult = await hailuoApp.generateVideo({
          prompt:      videoPrompt,
          aspectRatio: cfg.aspectRatio,
          maxWaitMs:   15 * 60 * 1000,
          filename:     `${briefId}.mp4`,
          saveSession:  true,
        });
        videoSource = 'app';
      } else {
        throw apiErr;
      }
    }

    // Save video to canonical path if not already there
    let videoPath = resolve(VIDEOS_DIR, `${briefId}.mp4`);
    if (videoResult?.localPath && videoResult.localPath !== videoPath) {
      const { copyFileSync } = await import('fs');
      try {
        copyFileSync(videoResult.localPath, videoPath);
        console.log(`  [Video] Copied to ${videoPath}`);
      } catch {
        videoPath = videoResult.localPath; // use original if copy fails
      }
    } else if (videoResult?.localPath) {
      videoPath = videoResult.localPath;
    } else if (videoResult?.url && videoResult.url.startsWith('http')) {
      // Download from URL
      const { writeFileSync: wfs } = await import('fs');
      const res = await fetch(videoResult.url);
      if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      wfs(videoPath, buf);
    }

    console.log(`  [Video] Done (${((Date.now() - videoStart) / 1000).toFixed(1)}s) → ${videoPath}`);
    stageResults.video = { source: videoSource, path: videoPath, ok: true };

    // Update manifest
    const elapsed = Date.now() - startTime;
    updateManifestEntry(manifest, briefId, {
      status:     'produced',
      channel,
      title,
      ttsPath:    ttsResult.path,
      videoPath,
      videoSource,
      duration_s: elapsed / 1000,
      producedAt: new Date().toISOString(),
      stages:     stageResults,
    });

    console.log(`  [${briefId}] COMPLETE in ${(elapsed / 1000).toFixed(1)}s`);

  } catch (err) {
    console.error(`  [${briefId}] FAILED: ${err.message}`);
    updateManifestEntry(manifest, briefId, {
      status:  'failed',
      channel,
      error:   err.message,
      stages:  stageResults,
    });
  }

  return manifest;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(arg => {
      const [key, val] = arg.replace(/^--/, '').split('=');
      return [key, val ?? true];
    })
  );

  const dryRun     = args['dry-run'] === true;
  const showStatus = args['status']  === true;
  const briefArg   = args['briefs'];

  // Normalize briefs: split comma-separated values
  let targetBriefIds = null;
  if (briefArg && briefArg !== true) {
    targetBriefIds = String(briefArg).split(',').map(s => s.trim()).filter(Boolean);
  }

  // Status mode
  if (showStatus) {
    const manifest = loadManifest();
    console.log(`\n=== VID-24 Production Manifest ===`);
    console.log(`Run ID: ${manifest.runId ?? 'none'}`);
    console.log(`Total entries: ${manifest.produced.length}`);
    const byStatus = {};
    for (const e of manifest.produced) {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    }
    console.log(`Status breakdown:`, byStatus);
    for (const e of manifest.produced) {
      const icon = e.status === 'produced' ? '✅' : e.status === 'failed' ? '❌' : '⏳';
      console.log(`  ${icon} ${e.briefId} [${e.channel}] — ${e.status}${e.title ? ` — "${e.title.slice(0, 50)}"` : ''}`);
    }
    return;
  }

  // Collect briefs to run
  let briefIds;
  if (targetBriefIds) {
    briefIds = targetBriefIds;
  } else {
    briefIds = DEFAULT_BRIEFS;
  }

  console.log(`\n=== TKP-35 VID-24 Pilot Production ===`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Briefs:  ${briefIds.join(', ')}`);
  console.log(`Output:  ${VIDEOS_DIR}`);

  // Ensure output dirs exist
  mkdirSync(VIDEOS_DIR, { recursive: true });
  mkdirSync(AUDIO_DIR,  { recursive: true });

  // Load or create manifest
  const manifest = loadManifest();
  // Ensure produced is always an array (protects against corrupt state files)
  if (!Array.isArray(manifest.produced)) {
    manifest.produced = [];
  }
  if (!manifest.runId) {
    manifest.runId = `vid24_${Date.now()}`;
    console.log(`New run ID: ${manifest.runId}`);
  }

  // Filter out already-produced briefs unless --force is set
  const alreadyProduced = new Set(
    manifest.produced.filter(e => e.status === 'produced').map(e => e.briefId)
  );
  const toRun = targetBriefIds
    ? briefIds
    : briefIds.filter(id => !alreadyProduced.has(id));

  console.log(`Already produced: ${alreadyProduced.size}/${briefIds.length}`);
  if (toRun.length === 0) {
    console.log(`\nAll briefs already produced. Use --briefs to re-run specific ones.`);
    saveManifest(manifest);
    return;
  }
  console.log(`Will produce: ${toRun.join(', ')}`);

  if (dryRun) {
    console.log(`\nDry run — skipping actual production.`);
    for (const id of toRun) {
      const prefix = id.startsWith('PW') ? 'PW' : 'GZ';
      const ch = prefix === 'PW' ? 'productivity_worker' : 'gen_z_success';
      updateManifestEntry(manifest, id, { status: 'dry_run', channel: ch });
    }
    saveManifest(manifest);
    return;
  }

  // Load pipeline dependencies
  await loadDeps();

  // Run each brief
  let successCount = 0;
  let failCount    = 0;

  for (const briefId of toRun) {
    // Find brief file
    const briefDirs = [
      resolve(ROOT, 'content', 'seo-briefs', `${briefId}.md`),
    ];
    const briefPath = briefDirs.find(p => existsSync(p));
    if (!briefPath) {
      console.error(`  [${briefId}] Brief file not found in content/seo-briefs/`);
      updateManifestEntry(manifest, briefId, { status: 'not_found' });
      failCount++;
      continue;
    }

    try {
      const brief = parseBrief(briefPath);
      await runBrief(brief, null, manifest, false);
      const entry = manifest.produced.find(e => e.briefId === briefId);
      if (entry?.status === 'produced') successCount++;
      else failCount++;
    } catch (err) {
      console.error(`  [${briefId}] Unexpected error: ${err.message}`);
      updateManifestEntry(manifest, briefId, { status: 'error', error: err.message });
      failCount++;
    }

    saveManifest(manifest);
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== Production Complete ===`);
  console.log(`  Run ID:   ${manifest.runId}`);
  console.log(`  Success:  ${successCount}`);
  console.log(`  Failed:   ${failCount}`);
  console.log(`  Total:    ${toRun.length}`);
  console.log(`  Manifest: ${MANIFEST_PATH}`);
  console.log(`${'='.repeat(60)}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
