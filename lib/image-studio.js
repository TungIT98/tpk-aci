/**
 * lib/image-studio.js
 * Image-Based Video Studio — TKP zero-cost production pipeline.
 *
 * Orchestrates: Script → Storyboard → SD Images → Video Clips → Assembly → Export
 * All image generation is local (RTX 5060 via SD WebUI/ComfyUI).
 * No AI video generation API required — cost per video: ~$0 in compute.
 *
 * Usage:
 *   import { ImageStudio } from './lib/image-studio.js';
 *
 *   const studio = new ImageStudio({ channel: 'growth' });
 *   await studio.produceVideo({
 *     script: 'In this video...',
 *     wordTimings: [{ word: 'In', start: 0.0, end: 0.3 }, ...],
 *     audioPath: 'output/audio/track.mp3',
 *     musicPath: 'assets/music/growth/track.mp3',
 *     topic: 'Why Your Morning Routine Is Killing You',
 *   });
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadEnv() {
  try {
    const env = {};
    for (const line of readFileSync(resolve(__dirname, '..', '.env'), 'utf-8').split('\n')) {
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
// Dependencies (lazy-loaded)
// ---------------------------------------------------------------------------

let _SD, _FFmpegPro, _TTS, _VideoAssemblyLine;
let _FFmpegAvailable;

async function _lazyLoad() {
  if (_SD) return;
  const [sdMod, ffmpegMod, ttsMod, assemblyMod] = await Promise.all([
    import('./stable-diffusion.js'),
    import('./ffmpeg-pro.js'),
    import('./tts.js'),
    import('./ffmpeg-pro.js'),
  ]);
  _SD                = new sdMod.StableDiffusionGenerator();
  _FFmpegPro         = ffmpegMod;
  _TTS               = new ttsMod.TTSProvider();
  _VideoAssemblyLine = ffmpegMod.VideoAssemblyLine;
  _FFmpegAvailable   = await ffmpegMod.ffmpegAvailable();
}

// ---------------------------------------------------------------------------
// Scene Breakout — script → timed scenes with image prompts
// ---------------------------------------------------------------------------

/**
 * Break a full script into timed scenes for image generation.
 *
 * @param {string} script — full script text (sentences separated by . ! ?)
 * @param {Array<{word: string, start: number, end: number}>} wordTimings — word-level timestamps
 * @param {object} opts
 * @param {number} [opts.secondsPerScene=6] — target duration per image scene
 * @returns {Array<{id: string, text: string, start: number, end: number, imagePrompt: string}>}
 */
export function breakIntoScenes(script, wordTimings, { secondsPerScene = 6 } = {}) {
  // Group words into sentences
  const cues = [];
  let currentCue = { words: [], start: null, end: null };

  for (const w of wordTimings) {
    if (!currentCue.start) currentCue.start = w.start;
    currentCue.words.push(w.word);
    currentCue.end = w.end;
    if (/[.!?]$/.test(w.word)) {
      cues.push({ text: currentCue.words.join(' '), start: currentCue.start, end: currentCue.end });
      currentCue = { words: [], start: null, end: null };
    }
  }
  if (currentCue.words.length > 0) {
    cues.push({ text: currentCue.words.join(' '), start: currentCue.start, end: currentCue.end });
  }

  // Group sentences into scenes of ~secondsPerScene duration
  const scenes = [];
  let sceneStart = 0;
  let sceneWords = [];
  let sceneStartTime = null;

  for (const cue of cues) {
    sceneWords.push(cue.text);
    const sceneDuration = cue.end - (sceneStartTime ?? cue.start);

    if (sceneDuration >= secondsPerScene || cue === cues[cues.length - 1]) {
      const text = sceneWords.join(' ');
      const start = sceneStartTime ?? cue.start;
      scenes.push({
        id:         `scene_${String(scenes.length).padStart(3, '0')}`,
        text,
        start,
        end:        cue.end,
        // Image prompt: summarize scene visually, strip speaker cues
        imagePrompt: _visualPrompt(text),
      });
      sceneStartTime = cue.end;
      sceneWords = [];
    }
  }

  return scenes;
}

/**
 * Convert a script sentence into a visual Stable Diffusion prompt.
 * Strips speech patterns and meta-text, keeps the visual scene.
 */
function _visualPrompt(text) {
  return text
    .replace(/\s*\(.*?\)\s*/g, ' ')        // remove parentheticals like (laughs)
    .replace(/\s*\[.*?\]\s*/g, ' ')         // remove stage directions
    .replace(/\b(so|okay|right|alright|hey|hi|um|uh|like|basically|actually)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500); // SD prompt length limit safety
}

// ---------------------------------------------------------------------------
// Storyboard Generator — generate scene briefs from script
// ---------------------------------------------------------------------------

/**
 * Generate a storyboard from a script with suggested visual descriptions.
 *
 * @param {string} script
 * @param {string} channel — 'productivity' | 'growth'
 * @returns {Promise<Array<{sceneId: string, scriptSegment: string, visualNote: string, type: string}>>}
 *   type: 'hook' | 'body' | 'cta' | 'broll'
 */
export async function generateStoryboard(script, channel) {
  // Simple heuristic: first 15% = hook, last 10% = CTA, rest = body
  const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const total = sentences.length;
  const hookEnd = Math.max(1, Math.ceil(total * 0.15));
  const ctaStart = Math.floor(total * 0.90);

  const visualTypes = {
    productivity: {
      hook: 'clean typography on solid background, minimal',
      body: 'professional workspace or lifestyle shot',
      cta: 'text overlay with confident call-to-action',
    },
    growth: {
      hook: 'high contrast dramatic scene, bold typography',
      body: 'energetic lifestyle, close-up reactions, phone screen',
      cta: 'bold text on dark background with accent colors',
    },
  };

  const types = visualTypes[channel] ?? visualTypes.productivity;

  return sentences.map((sentence, i) => {
    let type = 'body';
    if (i < hookEnd) type = 'hook';
    else if (i >= ctaStart) type = 'cta';

    return {
      sceneId:      `scene_${String(i).padStart(3, '0')}`,
      scriptSegment: sentence.trim(),
      visualNote:   types[type],
      type,
    };
  });
}

// ---------------------------------------------------------------------------
// ImageStudio — main orchestrator
// ---------------------------------------------------------------------------

export class ImageStudio {
  /**
   * @param {object} opts
   * @param {string} [opts.channel='productivity'] — 'productivity' | 'growth'
   * @param {string} [opts.outputDir] — default output root
   */
  constructor({ channel = 'productivity', outputDir = null } = {}) {
    this.channel   = channel;
    this.outputDir = outputDir ?? resolve(__dirname, '..', 'output', 'image-studio', channel);
    this.tempDir   = resolve(this.outputDir, '_temp');
    this.framesDir = resolve(this.tempDir, 'frames');
    this.clipsDir  = resolve(this.tempDir, 'clips');
    mkdirSync(this.outputDir, { recursive: true });
    mkdirSync(this.tempDir,   { recursive: true });
    mkdirSync(this.framesDir, { recursive: true });
    mkdirSync(this.clipsDir,  { recursive: true });
  }

  // -------------------------------------------------------------------------
  // Step 1: Generate storyboard
  // -------------------------------------------------------------------------

  /**
   * Create a storyboard from the script.
   * @param {string} script
   * @returns {Promise<Array>}
   */
  async createStoryboard(script) {
    await _lazyLoad();
    return generateStoryboard(script, this.channel);
  }

  // -------------------------------------------------------------------------
  // Step 2: Generate images for each scene (Stable Diffusion)
  // -------------------------------------------------------------------------

  /**
   * Generate scene images via Stable Diffusion.
   *
   * @param {Array} scenes — output from breakIntoScenes()
   * @param {object} opts
   * @param {string} [opts.aspectRatio='9:16'] — '9:16' | '16:9' | '1:1'
   * @param {number} [opts.secondsPerScene=6] — used if scenes have no end time
   * @returns {Promise<Array<{sceneId: string, imagePath: string|null, start: number, end: number}>>}
   */
  async generateSceneImages(scenes, { aspectRatio = '9:16' } = {}) {
    await _lazyLoad();

    console.log(`[ImageStudio] Generating ${scenes.length} scene images via Stable Diffusion...`);

    const scenePrompts = scenes.map(s => ({
      prompt:       s.imagePrompt || s.text,
      aspectRatio,
    }));

    const imagePaths = await _SD.batchGenerateScenes(scenePrompts, {
      channel:    this.channel,
      concurrency: 2, // RTX 5060: 2 at a time to avoid OOM
    });

    return scenes.map((scene, i) => ({
      ...scene,
      imagePath: imagePaths[i] ?? null,
    }));
  }

  // -------------------------------------------------------------------------
  // Step 3: Image → Video clip (Ken Burns / zoom effect via FFmpeg)
  // -------------------------------------------------------------------------

  /**
   * Convert a single scene image into a video clip with Ken Burns motion.
   * Uses FFmpeg with zoompan filter for cinematic camera movement.
   *
   * @param {string} imagePath
   * @param {number} durationSec
   * @param {object} opts
   * @param {string} [opts.motion='zoom-in'] — 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static'
   * @param {string} [opts.outputPath]
   * @returns {Promise<string>} path to video clip
   */
  async imageToClip(imagePath, durationSec, { motion = 'zoom-in', outputPath = null } = {}) {
    await _lazyLoad();

    if (!_FFmpegAvailable) throw new Error('FFmpeg not available — install from https://ffmpeg.org');

    if (!existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);

    const out = outputPath ?? resolve(this.clipsDir, `${basename(imagePath, extname(imagePath))}_clip.mp4`);

    // FFmpeg zoompan for Ken Burns effect
    // Duration in frames (fps * seconds)
    const fps = 30;
    const frames = Math.round(fps * durationSec);

    // Determine zoom/pan parameters
    let zoompanFilter;
    if (motion === 'zoom-in') {
      // Start at 1.0×, zoom to 1.3× over duration
      zoompanFilter = `zoompan=z='min(zoom+0.001,1.3)':d=${frames}:s=1080x1920:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=${fps}`;
    } else if (motion === 'zoom-out') {
      zoompanFilter = `zoompan=z='max(zoom-0.001,1.0)':d=${frames}:s=1080x1920:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=${fps}`;
    } else if (motion === 'pan-left') {
      zoompanFilter = `zoompan=z=1.2:d=${frames}:s=1080x1920:x='min(iw*1.2-iw,trunc(iw*(1-1/zoom)*t/${durationSec}))':y='ih/2-(ih/(zoom*2))':fps=${fps}`;
    } else if (motion === 'pan-right') {
      zoompanFilter = `zoompan=z=1.2:d=${frames}:s=1080x1920:x='max(0,iw-(iw*1.2-trunc(iw*(1-1/zoom)*t/${durationSec})))':y='ih/2-(ih/(zoom*2))':fps=${fps}`;
    } else {
      // Static — just scale and pad to target
      zoompanFilter = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`;
    }

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Scale image first to target resolution, then apply zoompan
    const cmd =
      `ffmpeg -y -loop 1 -i "${imagePath}" ` +
      `-vf "scale=4320:7680:force_original_aspect_ratio=increase,` +  // 4× upscale for smooth zoom
        `crop=4320:7680,` +
        `${zoompanFilter}" ` +
      `-t ${durationSec} ` +
      `-c:v libx264 -crf 18 -preset fast -pix_fmt yuv420p ` +
      `"${out}"`;

    try {
      await execAsync(cmd, { timeout: 120_000 });
      console.log(`[ImageStudio] Clip created: ${out} (${durationSec}s)`);
      return out;
    } catch (err) {
      throw new Error(`imageToClip failed:\n  ${err.stderr ?? err.message}`);
    }
  }

  /**
   * Convert all scene images to clips with varied Ken Burns motions.
   * @param {Array} scenes — scenes with imagePath
   * @param {Array<string>} [motions=['zoom-in','zoom-out','pan-left','pan-right','static']]
   * @returns {Promise<Array<{sceneId: string, clipPath: string|null}>>}
   */
  async generateAllClips(scenes, motions = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static']) {
    const results = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const motion = motions[i % motions.length];
      const duration = Math.max(3, (scene.end ?? 0) - (scene.start ?? 0));

      if (!scene.imagePath || !existsSync(scene.imagePath)) {
        console.warn(`[ImageStudio] Skipping scene ${scene.id}: no image`);
        results.push({ sceneId: scene.sceneId ?? scene.id, clipPath: null });
        continue;
      }

      try {
        const clipPath = await this.imageToClip(scene.imagePath, duration, { motion });
        results.push({ sceneId: scene.sceneId ?? scene.id, clipPath });
      } catch (err) {
        console.error(`[ImageStudio] Failed to generate clip for ${scene.id}: ${err.message}`);
        results.push({ sceneId: scene.sceneId ?? scene.id, clipPath: null });
      }
    }
    return results;
  }

  // -------------------------------------------------------------------------
  // Step 4: Full production pipeline
  // -------------------------------------------------------------------------

  /**
   * Run the complete image-based video production pipeline.
   *
   * @param {object} opts
   * @param {string} opts.script — full script text
   * @param {Array<{word: string, start: number, end: number}>} [opts.wordTimings] — word timings for sync
   * @param {string} opts.audioPath — TTS audio track (MP3)
   * @param {string} [opts.musicPath] — background music (MP3)
   * @param {string} [opts.topic] — video topic/title
   * @param {string} [opts.aspectRatio='9:16']
   * @param {string} [opts.outputBasename]
   * @returns {Promise<{masterFile: string, tiktokFile: string, youtubeFile: string, storyboard: Array, scenes: Array, qcPassed: boolean}>}
   */
  async produceVideo(opts = {}) {
    await _lazyLoad();

    const {
      script,
      wordTimings = [],
      audioPath,
      musicPath   = null,
      topic       = 'Untitled',
      aspectRatio = '9:16',
      outputBasename = `tkp_img_${Date.now()}`,
    } = opts;

    const startTime = Date.now();
    console.log(`\n[ImageStudio] Starting pipeline: ${topic}`);
    console.log(`  Script: ${script.substring(0, 80)}...`);
    console.log(`  Audio:  ${audioPath}`);

    // 1. Break script into scenes
    const scenes = wordTimings.length > 0
      ? breakIntoScenes(script, wordTimings)
      : _dumbSceneBreak(script);

    console.log(`[ImageStudio] ${scenes.length} scenes identified`);

    // 2. Generate scene images via Stable Diffusion
    const scenesWithImages = await this.generateSceneImages(scenes, { aspectRatio });

    // 3. Convert images to clips
    const clips = await this.generateAllClips(scenesWithImages);

    // Build clip list for assembly
    const videoClips = clips
      .filter(c => c.clipPath)
      .map((c, i) => {
        const scene = scenesWithImages[i];
        const duration = Math.max(3, (scene.end ?? 0) - (scene.start ?? 0));
        return { path: c.clipPath, start: 0, end: duration };
      });

    if (!videoClips.length) throw new Error('No valid clips generated — aborting assembly');

    // 4. Assemble via VideoAssemblyLine
    const assembly = new _VideoAssemblyLine({
      channel:   this.channel,
      outputDir: this.outputDir,
      tempDir:   this.tempDir,
    });

    // Generate subtitles from word timings if available
    let subtitlePath = null;
    if (wordTimings.length > 0) {
      const sr = new _FFmpegPro.SubtitleRenderer();
      const cues = sr.groupWords(wordTimings);
      subtitlePath = resolve(this.tempDir, `${outputBasename}.ass`);
      const style = this.channel === 'growth'
        ? { fontSize: 32, primaryColour: '&H00FFFFFF', outlineColour: '&H00000000' }
        : { fontSize: 28, primaryColour: '&H00FFFFFF', outlineColour: '&H00000000' };
      sr.toASS(cues, subtitlePath, style);
    }

    // 5. Run assembly
    const result = await assembly.assemble({
      videoClips,
      audioPath,
      musicPath:    musicPath && existsSync(musicPath) ? musicPath : null,
      subtitlePath,
      outputBasename,
      transition: 'dissolve',
      transitionDuration: 0.5,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n[ImageStudio] Pipeline complete in ${elapsed}s`);
    console.log(`  Master:  ${result.masterFile}`);
    console.log(`  TikTok:  ${result.tiktokFile}`);

    return {
      ...result,
      storyboard: scenesWithImages,
      scenes:     clips,
      elapsedSec: parseFloat(elapsed),
      qcPassed:   existsSync(result.masterFile),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fallback scene breaker when no word timings are available.
 * Splits script by paragraph/sentence and assigns equal duration.
 */
function _dumbSceneBreak(script) {
  const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 15);
  const secondsPerScene = 6;
  let t = 0;
  return sentences.map((text, i) => {
    const end = t + secondsPerScene;
    const scene = {
      id:          `scene_${String(i).padStart(3, '0')}`,
      text:        text.trim(),
      start:       t,
      end,
      imagePrompt: _visualPrompt(text),
    };
    t = end;
    return scene;
  });
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('lib/image-studio.js loaded.');
  console.log('Use: import { ImageStudio } from "./lib/image-studio.js"');
}
