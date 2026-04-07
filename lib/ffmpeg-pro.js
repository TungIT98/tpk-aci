/**
 * lib/ffmpeg-pro.js
 * FFmpeg production utilities for TKP Studio System.
 *
 * Provides:
 * - VideoAssemblyLine: Full video assembly pipeline (clips → output)
 * - SubtitleRenderer: Converts word timings to .ASS subtitle files
 * - WatermarkApplicator: Applies TKP logo watermark to video
 *
 * Requirements: FFmpeg with libx264, libass, and aac encoder.
 *   Verify: ffmpeg -version | grep libx264
 *
 * Usage:
 *   import { VideoAssemblyLine } from './lib/ffmpeg-pro.js';
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Utilities
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

/**
 * Run an FFmpeg command. Throws on non-zero exit.
 * @param {string} args — ffmpeg CLI args (without 'ffmpeg -y')
 * @param {object} opts
 * @param {boolean} [opts.quiet=false]
 */
async function ffmpeg(args, { quiet = true } = {}) {
  const cmd = `ffmpeg -y ${quiet ? '-loglevel error ' : ''}${args}`;
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 300_000 }); // 5min timeout
    return { stdout, stderr };
  } catch (err) {
    throw new Error(`FFmpeg failed:\n  CMD: ${cmd}\n  STDERR: ${err.stderr ?? err.message}`);
  }
}

/** Check if ffmpeg is available */
export async function ffmpegAvailable() {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// SubtitleRenderer — word timings → .ASS / .SRT
// ---------------------------------------------------------------------------

/**
 * Renders word-level timing data into .ASS subtitle files for FFmpeg burn-in.
 * Also supports .SRT export for soft subtitles.
 */
export class SubtitleRenderer {
  /**
   * @param {object} opts
   * @param {string} [opts.encoding='utf-8']
   */
  constructor(opts = {}) {
    this.encoding = opts.encoding ?? 'utf-8';
  }

  /**
   * Group word timings into subtitle cues (sentences/phrases).
   *
   * @param {Array<{word: string, start: number, end: number}>} wordTimings
   * @param {object} opts
   * @param {number} [opts.maxWordsPerCue=8]
   * @param {number} [opts.maxDurationSec=4] — max duration per cue before forcing split
   * @returns {Array<{text: string, start: number, end: number}>}
   */
  groupWords(wordTimings, { maxWordsPerCue = 8, maxDurationSec = 4 } = {}) {
    const cues = [];
    let currentCue = { words: [], start: null, end: null };

    for (const w of wordTimings) {
      if (!currentCue.start) currentCue.start = w.start;

      currentCue.words.push(w.word);
      currentCue.end = w.end;

      const overWordLimit = currentCue.words.length >= maxWordsPerCue;
      const overDuration  = (w.end - currentCue.start) >= maxDurationSec;
      const sentenceEnd   = /[.!?]$/.test(w.word);

      if (overWordLimit || overDuration || sentenceEnd) {
        cues.push({
          text:  currentCue.words.join(' '),
          start: currentCue.start,
          end:   currentCue.end,
        });
        currentCue = { words: [], start: null, end: null };
      }
    }

    // Flush remaining
    if (currentCue.words.length > 0) {
      cues.push({
        text:  currentCue.words.join(' '),
        start: currentCue.start,
        end:   currentCue.end,
      });
    }

    return cues;
  }

  /**
   * Generate an .SRT subtitle file.
   *
   * @param {Array} cues — output from groupWords()
   * @param {string} outputPath
   */
  toSRT(cues, outputPath) {
    const lines = cues.map((cue, i) => {
      return [
        i + 1,
        `${this._toSRTTime(cue.start)} --> ${this._toSRTTime(cue.end)}`,
        cue.text,
        '', // blank line between entries
      ].join('\n');
    }).join('\n');

    mkdirSync(resolve(outputPath, '..'), { recursive: true });
    writeFileSync(outputPath, lines, this.encoding);
    return outputPath;
  }

  /**
   * Generate an .ASS subtitle file with TKP channel styling.
   *
   * @param {Array} cues
   * @param {string} outputPath
   * @param {object} opts
   * @param {string} [opts.font='Arial']
   * @param {number} [opts.fontSize=28] — Productivity: 28, Growth: 32
   * @param {string} [opts.primaryColour='&H00FFFFFF'] — white
   * @param {string} [opts.outlineColour='&H00000000'] — black outline
   * @param {string} [opts.alignment='2'] — 2=bottom center, 5=center, 7=top center
   * @param {number} [opts.marginL=40]
   * @param {number} [opts.marginR=40]
   * @param {number} [opts.marginV=10]
   */
  toASS(cues, outputPath, {
    font          = 'Arial',
    fontSize      = 28,
    primaryColour = '&H00FFFFFF',
    outlineColour = '&H00000000',
    alignment     = '2',
    marginL       = 40,
    marginR       = 40,
    marginV       = 10,
  } = {}) {
    const lines = [
      '[Script Info]',
      'Title: TKP Subtitles',
      'ScriptType: v4.00+',
      'Collisions: Normal',
      'PlayDepth: 0',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Alignment, MarginL, MarginR, MarginV,',
      `Style: Default,${font},${fontSize},${primaryColour},${outlineColour},&H00000000,0,${alignment},${marginL},${marginR},${marginV},`,
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, Text',
      ...cues.map(cue => {
        const start = this._toASSTime(cue.start);
        const end   = this._toASSTime(cue.end);
        const text  = cue.text.replace(/\n/g, '\\N');
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
      }),
    ];

    mkdirSync(resolve(outputPath, '..'), { recursive: true });
    writeFileSync(outputPath, lines.join('\r\n'), this.encoding);
    return outputPath;
  }

  /**
   * Convert seconds → SRT time format (HH:MM:SS,mmm)
   */
  _toSRTTime(sec) {
    const h  = Math.floor(sec / 3600);
    const m  = Math.floor((sec % 3600) / 60);
    const s  = Math.floor(sec % 60);
    const ms = Math.round((sec % 1) * 1000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
  }

  /**
   * Convert seconds → ASS time format (HH:MM:SS.cc)
   */
  _toASSTime(sec) {
    const h  = Math.floor(sec / 3600);
    const m  = Math.floor((sec % 3600) / 60);
    const s  = Math.floor(sec % 60);
    const cs = Math.round((sec % 1) * 100);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  }
}

// ---------------------------------------------------------------------------
// VideoAssemblyLine — Full clip → output pipeline
// ---------------------------------------------------------------------------

/**
 * Orchestrates the complete video assembly process:
 * trim clips → concatenate → add audio → add subtitles → add watermark → export
 */
export class VideoAssemblyLine {
  /**
   * @param {object} opts
   * @param {string} opts.channel — 'productivity' | 'growth'
   * @param {string} [opts.outputDir='output/{channel}']
   * @param {string} [opts.tempDir='output/_temp']
   */
  constructor({ channel, outputDir, tempDir } = {}) {
    this.channel   = channel;
    this.outputDir = outputDir ?? resolve(__dirname, '..', 'output', channel);
    this.tempDir   = tempDir   ?? resolve(this.outputDir, '_temp');
    this.renderer  = new SubtitleRenderer();
    mkdirSync(this.outputDir, { recursive: true });
    mkdirSync(this.tempDir,   { recursive: true });
  }

  // -------------------------------------------------------------------------
  // Step 1: Trim clips
  // -------------------------------------------------------------------------

  /**
   * Trim clip(s) to in/out points.
   *
   * @param {string} inputPath
   * @param {number} startSec
   * @param {number} endSec
   * @param {string} [outputPath] — derived if omitted
   * @returns {Promise<string>} outputPath
   */
  async trim(inputPath, startSec, endSec, outputPath) {
    const out = outputPath ?? resolve(this.tempDir, `${basename(inputPath, extname(inputPath))}_trimmed.mp4`);
    const duration = (endSec - startSec).toFixed(3);
    await ffmpeg(
      `-ss ${startSec} -i "${inputPath}" -t ${duration} ` +
      `-c:v libx264 -crf 18 -r 30 ` +
      `-c:a aac -b:a 192k -ar 48000 ` +
      `"${out}"`
    );
    return out;
  }

  // -------------------------------------------------------------------------
  // Step 2: Concatenate multiple clips with transitions
  // -------------------------------------------------------------------------

  /**
   * Concatenate multiple clips with dissolve/fade transitions.
   *
   * @param {string[]} clipPaths
   * @param {string} outputPath
   * @param {object} opts
   * @param {string} [opts.transition='dissolve'] — 'dissolve' | 'fade' | 'none'
   * @param {number} [opts.transitionDuration=0.5]
   * @returns {Promise<string>}
   */
  async concatWithTransitions(clipPaths, outputPath, {
    transition = 'dissolve',
    transitionDuration = 0.5,
  } = {}) {
    if (clipPaths.length === 1) return clipPaths[0];

    // Write FFmpeg concat list
    const listPath = resolve(this.tempDir, `concat_list_${Date.now()}.txt`);
    const listContent = clipPaths.map(p => `file '${p}'`).join('\n');
    writeFileSync(listPath, listContent);

    if (transition === 'dissolve') {
      await ffmpeg(
        `-f concat -safe 0 -i "${listPath}" ` +
        `-c:v libx264 -crf 18 -preset fast ` +
        `-c:a aac -b:a 192k ` +
        `"${outputPath}"`
      );
    } else if (transition === 'fade') {
      // Fade-through-black between clips
      await ffmpeg(
        `-f concat -safe 0 -i "${listPath}" ` +
        `-vf "fade=t=out:st=0:d=${transitionDuration}" ` +
        `-c:v libx264 -crf 18 ` +
        `-c:a aac -b:a 192k ` +
        `"${outputPath}"`
      );
    } else {
      // Hard cuts
      await ffmpeg(
        `-f concat -safe 0 -i "${listPath}" ` +
        `-c copy ` +
        `"${outputPath}"`
      );
    }

    return outputPath;
  }

  // -------------------------------------------------------------------------
  // Step 3: Mix audio (TTS + background music)
  // -------------------------------------------------------------------------

  /**
   * Mix TTS voice track with background music at brand-compliant volumes.
   *
   * @param {string} videoPath — video to extract video track from
   * @param {string} voicePath — TTS audio file (MP3)
   * @param {string} musicPath — background music file
   * @param {object} opts
   * @param {number} [opts.musicVolume=0.15] — 0.15 for Productivity, 0.12 for Growth
   * @param {number} [opts.fadeOutSeconds=3]
   * @param {string} [opts.outputPath]
   * @returns {Promise<string>}
   */
  async mixAudio(videoPath, voicePath, musicPath, {
    musicVolume     = 0.15,
    fadeOutSeconds  = 3,
    outputPath,
  } = {}) {
    const out = outputPath ?? resolve(this.tempDir, `mixed_${basename(videoPath)}`);

    await ffmpeg(
      `-i "${videoPath}" -i "${voicePath}" -i "${musicPath}" ` +
      `-filter_complex ` +
        `"[2:a]volume=${musicVolume},afade=t=out:st=0:d=${fadeOutSeconds}[music];` +
         `[1:a][music]amix=inputs=2:duration=first:dropout_transition=2[a]" ` +
      `-map 0:v -map "[a]" ` +
      `-c:v copy -c:a aac -b:a 192k -ar 48000 ` +
      `"${out}"`
    );

    return out;
  }

  // -------------------------------------------------------------------------
  // Step 4: Burn subtitles (ASS)
  // -------------------------------------------------------------------------

  /**
   * Burn hard-coded subtitles into video from an .ASS file.
   *
   * @param {string} inputPath
   * @param {string} subtitlePath — .ASS or .SRT file
   * @param {string} outputPath
   * @param {object} opts — subtitle styling options passed to SubtitleRenderer
   * @returns {Promise<string>}
   */
  async burnSubtitles(inputPath, subtitlePath, outputPath, opts = {}) {
    // If subtitle path is word timings, generate ASS first
    let assPath = subtitlePath;
    if (!existsSync(subtitlePath) && Array.isArray(subtitlePath)) {
      // subtitlePath was actually word timings array — generate .ASS
      const cues = this.renderer.groupWords(subtitlePath, { maxWordsPerCue: 8 });
      assPath = resolve(this.tempDir, `subs_${Date.now()}.ass`);
      const style = this.channel === 'growth'
        ? { fontSize: 32, marginL: 40, marginR: 40 }
        : { fontSize: 28, marginL: 40, marginR: 40 };
      this.renderer.toASS(cues, assPath, { ...style, ...opts });
    }

    await ffmpeg(
      `-i "${inputPath}" -vf "ass=${assPath}" ` +
      `-c:v libx264 -crf 18 -preset fast ` +
      `-c:a copy ` +
      `"${outputPath}"`
    );

    return outputPath;
  }

  // -------------------------------------------------------------------------
  // Step 5: Add watermark
  // -------------------------------------------------------------------------

  /**
   * Apply TKP logo watermark.
   *
   * @param {string} inputPath
   * @param {string} logoPath — PNG/SVG with transparency
   * @param {string} outputPath
   * @param {object} opts
   * @param {string} [opts.position='bottom-left']
   * @param {number} [opts.padding=20]
   * @param {number} [opts.opacity=0.10]
   * @returns {Promise<string>}
   */
  async addWatermark(inputPath, logoPath, outputPath, {
    position = 'bottom-left',
    padding  = 20,
    opacity  = 0.10,
  } = {}) {
    // Compute position
    const positions = {
      'bottom-left':  `overlay=${padding}:H-h-${padding}`,
      'bottom-right': `overlay=W-w-${padding}:H-h-${padding}`,
      'top-left':     `overlay=${padding}:${padding}`,
      'top-right':    `overlay=W-w-${padding}:${padding}`,
      'center':       'overlay=(W-w)/2:(H-h)/2',
    };

    const overlay = positions[position] ?? positions['bottom-left'];

    await ffmpeg(
      `-i "${inputPath}" -i "${logoPath}" ` +
      `-filter_complex "[1:v]format=rgba,colorchannelmixer=aa=${opacity}[logo];` +
       `[0:v][logo]${overlay}[out]" ` +
      `-map "[out]" -map 0:a ` +
      `-c:a copy ` +
      `"${outputPath}"`
    );

    return outputPath;
  }

  // -------------------------------------------------------------------------
  // Step 6: Platform export
  // -------------------------------------------------------------------------

  /**
   * Export master video for a specific platform.
   *
   * @param {string} inputPath
   * @param {string} platform — 'youtube' | 'tiktok' | 'instagram' | 'linkedin'
   * @param {string} outputPath
   * @param {object} opts — metadata fields to embed
   * @returns {Promise<string>}
   */
  async exportForPlatform(inputPath, platform, outputPath, opts = {}) {
    const settings = {
      youtube:   { crf: 18, audioBitrate: '192k', faststart: true },
      tiktok:    { crf: 20, audioBitrate: '128k', faststart: false },
      instagram: { crf: 20, audioBitrate: '128k', faststart: false },
      linkedin:  { crf: 18, audioBitrate: '192k', faststart: true },
    };

    const s = settings[platform] ?? settings.youtube;
    const faststart = s.faststart ? '-movflags +faststart' : '';

    const metadata = [];
    if (opts.title)       metadata.push(`-metadata title="${opts.title}"`);
    if (opts.description) metadata.push(`-metadata description="${(opts.description ?? '').slice(0, 5000)}"`);

    await ffmpeg(
      `-i "${inputPath}" ` +
      `${metadata.join(' ')} ` +
      `-c:v libx264 -crf ${s.crf} -preset fast ` +
      `-c:a aac -b:a ${s.audioBitrate} -ar 48000 ` +
      `${faststart} ` +
      `"${outputPath}"`
    );

    return outputPath;
  }

  // -------------------------------------------------------------------------
  // Full assembly pipeline
  // -------------------------------------------------------------------------

  /**
   * Run the complete assembly pipeline end-to-end.
   *
   * @param {object} opts
   * @param {Array<{path: string, start: number, end: number}>} opts.videoClips
   * @param {string} opts.audioPath — TTS voice track (MP3)
   * @param {string} [opts.musicPath] — background music (MP3)
   * @param {string|Array} [opts.subtitlePath] — .ASS path OR word timings array
   * @param {string} opts.outputBasename — e.g. 'tkpg-042'
   * @param {object} [opts.transition]
   * @param {number} [opts.transitionDuration=0.5]
   * @param {string} [opts.watermarkLogo='assets/logos/tkp-watermark-prod.png']
   * @returns {Promise<{masterFile: string, youtubeFile: string, tiktokFile: string, instagramFile: string}>}
   */
  async assemble(opts = {}) {
    const {
      videoClips,
      audioPath,
      musicPath = null,
      subtitlePath = null,
      outputBasename,
      transition       = 'dissolve',
      transitionDuration = 0.5,
      watermarkLogo    = this.channel === 'growth'
        ? 'assets/logos/tkp-watermark-growth.png'
        : 'assets/logos/tkp-watermark-prod.png',
    } = opts;

    // 1. Trim each clip
    const trimmed = [];
    for (const clip of videoClips) {
      const t = await this.trim(clip.path, clip.start, clip.end);
      trimmed.push(t);
    }

    // 2. Concatenate clips
    const concatPath = resolve(this.tempDir, `${outputBasename}_concat.mp4`);
    await this.concatWithTransitions(trimmed, concatPath, { transition, transitionDuration });

    // 3. Mix audio
    const audioOut = (musicPath && existsSync(musicPath))
      ? await this.mixAudio(concatPath, audioPath, musicPath, {
          musicVolume: this.channel === 'growth' ? 0.12 : 0.15,
        })
      : concatPath; // no music — use concat directly

    // 4. Burn subtitles
    const subtitledPath = resolve(this.outputDir, `${outputBasename}_subs.mp4`);
    if (subtitlePath) {
      await this.burnSubtitles(audioOut, subtitlePath, subtitledPath);
    } else {
      await ffmpeg(`-i "${audioOut}" -c copy "${subtitledPath}"`);
    }

    // 5. Add watermark
    const wmPath = resolve(this.outputDir, `${outputBasename}_wm.mp4`);
    if (watermarkLogo && existsSync(watermarkLogo)) {
      await this.addWatermark(subtitledPath, watermarkLogo, wmPath, {
        position: 'bottom-left',
        padding: 20,
        opacity: 0.10,
      });
    } else {
      await ffmpeg(`-i "${subtitledPath}" -c copy "${wmPath}"`);
    }

    // 6. Platform exports
    const masterPath  = resolve(this.outputDir, `${outputBasename}_master.mp4`);
    const ytPath      = resolve(this.outputDir, `${outputBasename}_youtube.mp4`);
    const tiktokPath  = resolve(this.outputDir, `${outputBasename}_tiktok.mp4`);
    const igPath      = resolve(this.outputDir, `${outputBasename}_instagram.mp4`);

    await ffmpeg(`-i "${wmPath}" -c copy "${masterPath}"`);
    await this.exportForPlatform(wmPath, 'youtube', ytPath);
    await this.exportForPlatform(wmPath, 'tiktok', tiktokPath);
    await this.exportForPlatform(wmPath, 'instagram', igPath);

    return {
      masterFile:   masterPath,
      youtubeFile:  ytPath,
      tiktokFile:   tiktokPath,
      instagramFile: igPath,
    };
  }
}

// ---------------------------------------------------------------------------
// VideoCutter — cut_scene, merge_videos, detect_scenes
// ---------------------------------------------------------------------------

export class VideoCutter {
  constructor({ tempDir = 'output/_temp' } = {}) {
    this.tempDir = tempDir;
    mkdirSync(this.tempDir, { recursive: true });
  }

  /**
   * Detect scene changes in a video using FFmpeg's scene detection.
   * Returns array of { start, end, index } scene segments.
   *
   * @param {string} inputPath
   * @param {object} opts
   * @param {number} [opts.threshold=0.3] — scene detection sensitivity (0.0–1.0, lower = more sensitive)
   * @param {number} [opts.minSceneDuration=1.0] — minimum scene length in seconds
   * @returns {Promise<Array<{ start: number, end: number, index: number }>>}
   */
  /**
   * Detect scene changes in a video using FFmpeg's scene detection.
   * Returns array of { start, end, index } scene segments.
   *
   * @param {string} inputPath
   * @param {object} opts
   * @param {number} [opts.threshold=0.3] — scene detection sensitivity (0.0–1.0, lower = more sensitive)
   * @param {number} [opts.minSceneDuration=1.0] — minimum scene length in seconds
   * @returns {Promise<Array<{ start: number, end: number, index: number }>>}
   */
  async detectScenes(inputPath, { threshold = 0.3, minSceneDuration = 1.0 } = {}) {
    const thresholdValue = (threshold * 100).toFixed(0);

    // Get video duration
    const durCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;
    const { stdout: durOut } = await execAsync(durCmd, { timeout: 30_000 });
    const totalDuration = parseFloat(durOut.trim()) || 0;

    // Write stderr to temp log file (avoids cross-platform output issues)
    const logPath = resolve(this.tempDir, `scene_log_${Date.now()}.txt`);
    const probeCmd = `ffmpeg -i "${inputPath}" -vf "select='gt(scene,${thresholdValue}/100)',showinfo" -f null - 2> "${logPath}"`;

    try {
      await execAsync(probeCmd, { timeout: 300_000 });

      // Parse pts_time values from the log file
      const logContent = readFileSync(logPath, 'utf-8');
      const ptsRe = /pts_time:(\d+\.?\d*)/g;
      const timestamps = [];
      let match;
      while ((match = ptsRe.exec(logContent)) !== null) {
        timestamps.push(parseFloat(match[1]));
      }

      // Build scene segments from detected timestamps
      const scenes = [];
      let lastTs = 0;
      let idx = 0;
      for (const ts of timestamps) {
        if (ts - lastTs >= minSceneDuration) {
          scenes.push({ start: parseFloat(lastTs.toFixed(3)), end: parseFloat(ts.toFixed(3)), index: idx++ });
          lastTs = ts;
        }
      }

      // Add final scene
      const finalStart = scenes.length > 0 ? scenes[scenes.length - 1].end : 0;
      if (totalDuration - finalStart >= 0.5) {
        scenes.push({ start: parseFloat(finalStart.toFixed(3)), end: parseFloat(totalDuration.toFixed(3)), index: idx });
      }

      return scenes;
    } catch (err) {
      throw new Error(`Scene detection failed:\n  ${err.message}`);
    } finally {
      try { unlinkSync(logPath); } catch (_) {}
    }
  }

  /**
   * Cut a scene from a video file (alias for trim).
   *
   * @param {string} inputPath
   * @param {number} startSec
   * @param {number} endSec
   * @param {string} [outputPath]
   * @returns {Promise<string>}
   */
  async cutScene(inputPath, startSec, endSec, outputPath) {
    const out = outputPath ?? resolve(this.tempDir, `scene_${Date.now()}.mp4`);
    const duration = (endSec - startSec).toFixed(3);
    await ffmpeg(
      `-ss ${startSec} -i "${inputPath}" -t ${duration} ` +
      `-c:v libx264 -crf 18 -r 30 ` +
      `-c:a aac -b:a 192k -ar 48000 ` +
      `"${out}"`
    );
    return out;
  }

  /**
   * Merge multiple video files into one (no transitions, hard cuts).
   * For merges with transitions use VideoAssemblyLine.concatWithTransitions().
   *
   * @param {string[]} clipPaths
   * @param {string} outputPath
   * @returns {Promise<string>}
   */
  async mergeVideos(clipPaths, outputPath) {
    if (clipPaths.length === 1) return clipPaths[0];

    const listPath = resolve(this.tempDir, `merge_list_${Date.now()}.txt`);
    const listContent = clipPaths.map(p => `file '${p}'`).join('\n');
    writeFileSync(listPath, listContent);

    await ffmpeg(
      `-f concat -safe 0 -i "${listPath}" ` +
      `-c copy ` +
      `"${outputPath}"`
    );
    return outputPath;
  }

  /**
   * Auto-cut a video into scene segments using detect_scenes.
   *
   * @param {string} inputPath
   * @param {object} opts — passed to detectScenes()
   * @returns {Promise<string[]>} — array of cut scene clip paths
   */
  async autoCut(inputPath, opts = {}) {
    const scenes = await this.detectScenes(inputPath, opts);
    const cuts = [];
    for (const scene of scenes) {
      const out = resolve(this.tempDir, `cut_scene_${String(scene.index).padStart(3, '0')}.mp4`);
      const cut = await this.cutScene(inputPath, scene.start, scene.end, out);
      cuts.push(cut);
    }
    return cuts;
  }
}

// ---------------------------------------------------------------------------
// VideoEffects — brightness, contrast, saturation, speed, stabilization
// ---------------------------------------------------------------------------

export class VideoEffects {
  constructor({ tempDir = 'output/_temp' } = {}) {
    this.tempDir = tempDir;
    mkdirSync(this.tempDir, { recursive: true });
  }

  /**
   * Adjust video brightness, contrast, saturation, and gamma.
   *
   * @param {string} inputPath
   * @param {object} opts
   * @param {number} [opts.brightness=0] — range -1.0 to 1.0 (0 = unchanged)
   * @param {number} [opts.contrast=1] — range 0.0 to 2.0 (1 = unchanged)
   * @param {number} [opts.saturation=1] — range 0.0 to 3.0 (1 = unchanged)
   * @param {number} [opts.gamma=1] — range 0.0 to 3.0 (1 = unchanged)
   * @param {string} [outputPath]
   * @returns {Promise<string>}
   */
  async adjust(inputPath, {
    brightness = 0,
    contrast   = 1,
    saturation = 1,
    gamma      = 1,
  } = {}, outputPath) {
    const out = outputPath ?? resolve(this.tempDir, `effects_${Date.now()}.mp4`);

    // eq filter: brightness=-1 to 1, contrast=0 to 2, saturation=0 to 3
    // gamma defaults to 1
    const eq = `eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}:gamma=${gamma}`;

    await ffmpeg(
      `-i "${inputPath}" ` +
      `-vf "${eq}" ` +
      `-c:a copy ` +
      `"${out}"`
    );
    return out;
  }

  /**
   * Change video playback speed (without pitch shift on audio).
   *
   * @param {string} inputPath
   * @param {number} speed — multiplier (0.5 = half speed/slow-mo, 2.0 = 2x speed/fast)
   * @param {string} [outputPath]
   * @param {boolean} [keepAudioPitch=true] — use rubberband/atempo for natural audio
   * @returns {Promise<string>}
   */
  async changeSpeed(inputPath, speed, outputPath, keepAudioPitch = true) {
    if (speed <= 0 || speed > 100) {
      throw new Error(`Speed must be between 0.01 and 100. Got: ${speed}`);
    }

    const out = outputPath ?? resolve(this.tempDir, `speed_${Date.now()}.mp4`);

    if (keepAudioPitch) {
      // atempo: 0.5 to 2.0 range; chain two atempo if speed is outside range
      const pts = (1 / speed).toFixed(6);
      if (speed >= 0.5 && speed <= 2.0) {
        await ffmpeg(
          `-i "${inputPath}" ` +
          `-filter:a "atempo=${speed}" -filter:v "setpts=${pts}*PTS" ` +
          `-c:a aac -b:a 192k -ar 48000 ` +
          `"${out}"`
        );
      } else if (speed < 0.5) {
        // Chain two atempo filters for very slow motion
        const atempoVal = Math.sqrt(speed).toFixed(4);
        await ffmpeg(
          `-i "${inputPath}" ` +
          `-filter:a "atempo=${atempoVal},atempo=${atempoVal}" -filter:v "setpts=${pts}*PTS" ` +
          `-c:a aac -b:a 192k -ar 48000 ` +
          `"${out}"`
        );
      } else {
        // For fast-forward, use setpts only (audio will be high-pitched naturally)
        const atempoVal = Math.min(2.0, speed).toFixed(4);
        await ffmpeg(
          `-i "${inputPath}" ` +
          `-filter:a "atempo=${atempoVal}" -filter:v "setpts=${pts}*PTS" ` +
          `-c:a aac -b:a 192k -ar 48000 ` +
          `"${out}"`
        );
      }
    } else {
      await ffmpeg(
        `-i "${inputPath}" ` +
        `-filter:v "setpts=${(1 / speed).toFixed(6)}*PTS" ` +
        `-c:a copy ` +
        `"${out}"`
      );
    }

    return out;
  }

  /**
   * Apply a Gaussian blur to the video.
   *
   * @param {string} inputPath
   * @param {object} opts
   * @param {number} [opts.radiusX=5]
   * @param {number} [opts.radiusY=5]
   * @param {string} [outputPath]
   * @returns {Promise<string>}
   */
  async blur(inputPath, { radiusX = 5, radiusY = 5 } = {}, outputPath) {
    const out = outputPath ?? resolve(this.tempDir, `blur_${Date.now()}.mp4`);
    await ffmpeg(
      `-i "${inputPath}" ` +
      `-vf "gaussianblur=${radiusX}:${radiusY}" ` +
      `-c:a copy ` +
      `"${out}"`
    );
    return out;
  }

  /**
   * Fade in / fade out video at start and end.
   *
   * @param {string} inputPath
   * @param {object} opts
   * @param {number} [opts.fadeIn=0.5]
   * @param {number} [opts.fadeOut=0.5]
   * @param {number} [opts.fadeOutStart] — auto-calculated from video duration if omitted
   * @param {string} [outputPath]
   * @returns {Promise<string>}
   */
  async fade(inputPath, {
    fadeIn       = 0.5,
    fadeOut      = 0.5,
    fadeOutStart = null,
  } = {}, outputPath) {
    const out = outputPath ?? resolve(this.tempDir, `fade_${Date.now()}.mp4`);

    // Get duration if fadeOutStart not provided
    let fos = fadeOutStart;
    if (fos == null) {
      try {
        const { stdout } = await execAsync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`
        );
        fos = parseFloat(stdout.trim()) - fadeOut;
      } catch {
        fos = 0; // fallback
      }
    }

    const vf = `fade=t=in:st=0:d=${fadeIn},fade=t=out:st=${fos}:d=${fadeOut}`;
    await ffmpeg(
      `-i "${inputPath}" ` +
      `-vf "${vf}" ` +
      `-c:a copy ` +
      `"${out}"`
    );
    return out;
  }
}

// ---------------------------------------------------------------------------
// TextOverlay — add_text standalone overlay (not watermark)
// ---------------------------------------------------------------------------

export class TextOverlay {
  constructor({ tempDir = 'output/_temp' } = {}) {
    this.tempDir = tempDir;
    mkdirSync(this.tempDir, { recursive: true });
  }

  /**
   * Add styled text overlay to a video using FFmpeg drawtext.
   *
   * @param {string} inputPath
   * @param {string} text — text to display
   * @param {string} outputPath
   * @param {object} opts
   * @param {string} [opts.font='Arial'] — font family
   * @param {number} [opts.fontSize=48]
   * @param {string} [opts.fontColor='white'] — CSS color name or hex (#FFFFFF)
   * @param {number} [opts.x='(w-text_w)/2'] — horizontal position (FFmpeg expression)
   * @param {number} [opts.y='(h-text_h)/2'] — vertical position
   * @param {number} [opts.startTime=0] — when to start showing text (seconds)
   * @param {number} [opts.duration=null] — how long to show text (null = until end)
   * @param {boolean} [opts.bold=false]
   * @param {string} [opts.borderColor='black']
   * @param {number} [opts.borderWidth=2]
   * @param {number} [opts.shadowX=1] — shadow offset x
   * @param {number} [opts.shadowY=1] — shadow offset y
   * @param {number} [opts.shadowOpacity=0.5]
   * @returns {Promise<string>}
   */
  async addText(inputPath, text, outputPath, {
    font         = 'Arial',
    fontSize     = 48,
    fontColor    = 'white',
    x            = '(w-text_w)/2',
    y            = '(h-text_h)/2',
    startTime    = 0,
    duration     = null,
    bold         = false,
    borderColor  = 'black',
    borderWidth  = 2,
    shadowX      = 1,
    shadowY      = 1,
    shadowOpacity = 0.5,
  } = {}) {
    // Escape text for FFmpeg drawtext filter
    const escaped = text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "'\\''")
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/:/g, '\\:')
      .replace(/\n/g, '|');

    // FFmpeg drawtext bold: specify bold font file path instead of a non-existent Bold=1 flag
    // On Windows: Arial Bold at C:/Windows/Fonts/arialbd.ttf
    const fontPath = (bold && font === 'Arial')
      ? 'C\\:/Windows/Fonts/arialbd.ttf'
      : font;

    let enableStr = '';
    if (duration != null) {
      enableStr = `:enable='between(t,${startTime},${startTime + duration})'`;
    } else if (startTime > 0) {
      enableStr = `:enable='gte(t,${startTime})'`;
    }

    // FFmpeg drawtext shadow: use shadowcolor with alpha (e.g. black@0.5)
    // shadowopacity param is converted to alpha in shadowcolor
    const shadow = shadowOpacity > 0
      ? `:shadowx=${shadowX}:shadowy=${shadowY}:shadowcolor=black@${shadowOpacity}`
      : '';

    const vf = `drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=${fontColor}` +
      `:x=${x}:y=${y}:font='${fontPath}'` +
      `:borderw=${borderWidth}:bordercolor=${borderColor}${shadow}${enableStr}`;

    await ffmpeg(
      `-i "${inputPath}" ` +
      `-vf "${vf}" ` +
      `-c:a copy ` +
      `"${outputPath}"`
    );
    return outputPath;
  }

  /**
   * Add multiple text overlays from an array of text segments.
   *
   * @param {string} inputPath
   * @param {Array<{ text: string, x?: string, y?: string, fontSize?: number, fontColor?: string, startTime?: number, duration?: number }>} segments
   * @param {string} outputPath
   * @param {object} [defaultOpts] — defaults for all segments
   * @returns {Promise<string>}
   */
  async addTextSegments(inputPath, segments, outputPath, defaultOpts = {}) {
    if (segments.length === 0) return inputPath;

    const filters = segments.map((seg, i) => {
      const opts = { ...defaultOpts, ...seg };
      const escaped = (opts.text || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "'\\''")
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/:/g, '\\:')
        .replace(/\n/g, '|');

      const x = opts.x ?? '(w-text_w)/2';
      const y = opts.y ?? '(h-text_h)/2';
      const fs = opts.fontSize ?? 48;
      const fc = opts.fontColor ?? 'white';
      const st = opts.startTime ?? 0;
      const dur = opts.duration;
      const bc = opts.borderColor ?? 'black';
      const bw = opts.borderWidth ?? 2;
      const fFont = opts.font ?? 'Arial';
      const fontPath = (opts.bold && fFont === 'Arial')
        ? 'C\\:/Windows/Fonts/arialbd.ttf'
        : fFont;

      let enableStr = '';
      if (dur != null) {
        enableStr = `:enable='between(t,${st},${st + dur})'`;
      } else if (st > 0) {
        enableStr = `:enable='gte(t,${st})'`;
      }

      return `drawtext=text='${escaped}':fontsize=${fs}:fontcolor=${fc}:x=${x}:y=${y}:font='${fontPath}':borderw=${bw}:bordercolor=${bc}${enableStr}`;
    });

    const vf = filters.join(',');
    await ffmpeg(
      `-i "${inputPath}" ` +
      `-vf "${vf}" ` +
      `-c:a copy ` +
      `"${outputPath}"`
    );
    return outputPath;
  }
}

// ---------------------------------------------------------------------------
// video_editing_pipeline — full end-to-end orchestrator
// ---------------------------------------------------------------------------

/**
 * High-level video editing pipeline that orchestrates all modules.
 *
 * @param {object} config
 * @param {string} config.inputVideo — path to source video
 * @param {object} config.script — { audioPath, wordTimings, textOverlays? }
 * @param {object} [config.effects] — { brightness?, contrast?, saturation?, speed? }
 * @param {object} [config.transitions] — { type?, duration? }
 * @param {string} [config.musicPath]
 * @param {string} [config.outputBasename]
 * @param {string} [config.channel='productivity']
 * @returns {Promise<{ masterFile: string, scenes: Array }>}
 */
export async function videoEditingPipeline(config) {
  const {
    inputVideo,
    script,
    effects      = {},
    transitions  = {},
    musicPath    = null,
    outputBasename = 'video_edit',
    channel      = 'productivity',
  } = config;

  const assembly = new VideoAssemblyLine({ channel });
  const cutter    = new VideoCutter({ tempDir: assembly.tempDir });
  const fx       = new VideoEffects({ tempDir: assembly.tempDir });
  const textOv   = new TextOverlay({ tempDir: assembly.tempDir });

  // Step 1: Detect scenes (optional — only if no clips provided)
  let workingVideo = inputVideo;

  // Step 2: Apply video effects (brightness, contrast, speed)
  if (Object.keys(effects).length > 0) {
    const hasBrightness = effects.brightness != null || effects.contrast != null ||
                          effects.saturation != null || effects.gamma != null;
    const hasSpeed      = effects.speed != null && effects.speed !== 1;

    if (hasBrightness) {
      const out = resolve(assembly.tempDir, `${outputBasename}_color.mp4`);
      workingVideo = await fx.adjust(workingVideo, effects, out);
    }
    if (hasSpeed) {
      const out = resolve(assembly.tempDir, `${outputBasename}_speed.mp4`);
      workingVideo = await fx.changeSpeed(workingVideo, effects.speed, out);
    }
  }

  // Step 3: Apply text overlays if provided
  if (script.textOverlays && script.textOverlays.length > 0) {
    const out = resolve(assembly.tempDir, `${outputBasename}_text.mp4`);
    workingVideo = await textOv.addTextSegments(workingVideo, script.textOverlays, out);
  }

  // Step 4: Mix audio (TTS + music)
  let audioMixed = workingVideo;
  if (script.audioPath && musicPath && existsSync(musicPath)) {
    const out = resolve(assembly.tempDir, `${outputBasename}_audio.mp4`);
    audioMixed = await assembly.mixAudio(workingVideo, script.audioPath, musicPath, {
      musicVolume: channel === 'growth' ? 0.12 : 0.15,
    });
  } else if (script.audioPath) {
    // Replace audio with TTS only
    const out = resolve(assembly.tempDir, `${outputBasename}_audio.mp4`);
    await ffmpeg(
      `-i "${workingVideo}" -i "${script.audioPath}" ` +
      `-map 0:v -map 1:a ` +
      `-c:v copy -c:a aac -b:a 192k -ar 48000 ` +
      `"${out}"`
    );
    audioMixed = out;
  }

  // Step 5: Burn subtitles
  let subtitled = audioMixed;
  if (script.wordTimings && script.wordTimings.length > 0) {
    const out = resolve(assembly.outputDir, `${outputBasename}_subs.mp4`);
    subtitled = await assembly.burnSubtitles(audioMixed, script.wordTimings, out);
  }

  // Step 6: Add watermark
  const wmPath = resolve(assembly.outputDir, `${outputBasename}_wm.mp4`);
  const logoPath = channel === 'growth'
    ? resolve(assembly.outputDir, '..', '..', 'assets', 'logos', 'tkp-watermark-growth.png')
    : resolve(assembly.outputDir, '..', '..', 'assets', 'logos', 'tkp-watermark-prod.png');

  let watermarked = subtitled;
  if (existsSync(logoPath)) {
    watermarked = await assembly.addWatermark(subtitled, logoPath, wmPath);
  } else {
    await ffmpeg(`-i "${subtitled}" -c copy "${wmPath}"`);
    watermarked = wmPath;
  }

  // Step 7: Platform exports
  const masterPath = resolve(assembly.outputDir, `${outputBasename}_master.mp4`);
  await ffmpeg(`-i "${watermarked}" -c copy "${masterPath}"`);

  return { masterFile: masterPath, workingFile: watermarked };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('lib/ffmpeg-pro.js loaded.');
  const ok = await ffmpegAvailable();
  console.log('FFmpeg available:', ok ? 'YES' : 'NO — install from https://ffmpeg.org');
}
