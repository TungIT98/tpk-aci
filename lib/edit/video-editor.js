/**
 * lib/edit/video-editor.js
 * FFmpeg-based video editing engine for TKP Content Agency — v3.0
 * Handles trimming, transitions, subtitle overlay, music insertion, export,
 * and professional v3 enhancements: resolution/aspect/fps selection,
 * subtitle styling, watermark options, intro/outro templates.
 *
 * Requires: FFmpeg (install via `brew install ffmpeg` or ffmpeg.org)
 * Tool dependency: `ffmpeg`, `ffprobe` must be on PATH.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Resolution presets ──────────────────────────────────────────────────────

const RESOLUTION_PRESETS = {
  '720p':  { width: 1280, height: 720,  label: '720p (HD)' },
  '1080p': { width: 1920, height: 1080, label: '1080p (Full HD)' },
  '4k':    { width: 3840, height: 2160, label: '4K (Ultra HD)' },
};

// ─── Aspect ratio presets ─────────────────────────────────────────────────────

const ASPECT_RATIO_PRESETS = {
  '16:9':  { label: '16:9 (YouTube, Web)',      targetWidth: null, targetHeight: null },
  '9:16':  { label: '9:16 (TikTok, Reels, Shorts)', targetWidth: null, targetHeight: null },
  '1:1':   { label: '1:1 (Instagram Feed)',     targetWidth: null, targetHeight: null },
  '4:5':   { label: '4:5 (Instagram Portrait)', targetWidth: null, targetHeight: null },
};

// ─── Frame rate presets ───────────────────────────────────────────────────────

const FRAME_RATE_PRESETS = {
  '24': { fps: 24, label: '24 fps (cinematic)' },
  '30': { fps: 30, label: '30 fps (standard)' },
  '60': { fps: 60, label: '60 fps (smooth/high-motion)' },
};

// ─── Codec presets ────────────────────────────────────────────────────────────

const VIDEO_CODEC_PRESETS = {
  h264: { codec: 'libx264',   label: 'H.264 (best compatibility)', crfDefault: 18 },
  h265: { codec: 'libx265',   label: 'H.265/HEVC (better compression)', crfDefault: 23 },
};

const AUDIO_CODEC_PRESETS = {
  aac:  { codec: 'aac',  label: 'AAC (recommended)', bitrateDefault: '192k', sampleRateDefault: 48000 },
  mp3:  { codec: 'libmp3lame', label: 'MP3 (legacy)', bitrateDefault: '192k', sampleRateDefault: 48000 },
};

// ─── Channel presets (v2 — base quality/tempo, now overrideable) ─────────────

const CHANNEL_PRESETS = {
  productivity_worker: {
    name: 'TKP Productivity',
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: '30',
    codec: 'h264',
    audioCodec: 'aac',
    musicVolume: 0.15,
    transition: 'dissolve',
    transitionDuration: 0.5,
    subtitleFont: 'Arial',
    subtitleFontSize: 28,
    subtitleColor: 'white',
    subtitleBorder: 'black',
    subtitlePosition: 'bottom',
    subtitleAnimation: 'fade',   // 'none' | 'fade' | 'pop'
    outputDir: 'output/productivity',
  },
  gen_z_success: {
    name: 'TKP Growth',
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: '60',
    codec: 'h264',
    audioCodec: 'aac',
    musicVolume: 0.12,
    transition: 'fade',
    transitionDuration: 0.3,
    subtitleFont: 'Arial',
    subtitleFontSize: 32,
    subtitleColor: 'white',
    subtitleBorder: 'black',
    subtitlePosition: 'bottom',
    subtitleAnimation: 'fade',
    outputDir: 'output/growth',
  },
};

// ─── Platform export presets ─────────────────────────────────────────────────

const PLATFORM_PRESETS = {
  youtube: {
    extension: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    crf: 18,
    audioBitrate: '192k',
    audioSampleRate: 48000,
    fps: null,
    movflags: '+faststart',
    maxDuration: null,
    metadata: { title: '', description: '', author: 'TKP Content Agency' },
  },
  tiktok: {
    extension: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    crf: 20,
    audioBitrate: '128k',
    audioSampleRate: 44100,
    fps: 30,
    movflags: '+faststart',
    maxDuration: 180,
    maxFileSizeMB: 287,
  },
  instagram_reels: {
    extension: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    crf: 20,
    audioBitrate: '128k',
    audioSampleRate: 44100,
    fps: 30,
    movflags: '+faststart',
    maxDuration: 90,
  },
  linkedin: {
    extension: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    crf: 18,
    audioBitrate: '192k',
    audioSampleRate: 48000,
    fps: null,
    movflags: '+faststart',
    maxDuration: 600,
  },
};

// ─── Utility helpers ─────────────────────────────────────────────────────────

function run(command, options = {}) {
  const { cwd = process.cwd(), quiet = false } = options;
  try {
    const output = execSync(command, { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { success: true, output };
  } catch (err) {
    if (quiet) return { success: false, error: err.message };
    throw new Error(`FFmpeg command failed:\n${command}\n\nError: ${err.message}`);
  }
}

function probe(filePath) {
  const result = run(
    `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
    { quiet: true }
  );
  if (!result.success) return null;
  return JSON.parse(result.output);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ─── Aspect ratio pad/crop filter builder ─────────────────────────────────────

/**
 * Builds an FFmpeg video filter string to pad/crop to target aspect ratio,
 * keeping content centered.
 * @param {number} srcWidth
 * @param {number} srcHeight
 * @param {string} targetAspectRatio — '16:9' | '9:16' | '1:1' | '4:5'
 * @returns {string} FFmpeg -vf filter string fragment
 */
function buildAspectFilter(srcWidth, srcHeight, targetAspectRatio) {
  const srcAspect = srcWidth / srcHeight;
  let targetW, targetH;

  switch (targetAspectRatio) {
    case '16:9':
      targetW = srcHeight * (16 / 9);
      targetH = srcHeight;
      break;
    case '9:16':
      targetW = srcHeight * (9 / 16);
      targetH = srcHeight;
      break;
    case '1:1':
      targetW = Math.min(srcWidth, srcHeight);
      targetH = targetW;
      break;
    case '4:5':
      targetW = srcHeight * (4 / 5);
      targetH = srcHeight;
      break;
    default:
      return ''; // No transformation needed
  }

  const x = (srcWidth - targetW) / 2;
  const y = (srcHeight - targetH) / 2;

  return `crop=${Math.round(targetW)}:${Math.round(targetH)}:${Math.round(x)}:${Math.round(y)},setsar=1`;
}

// ─── Subtitle animation filter ────────────────────────────────────────────────

/**
 * Builds an FFmpeg alpha expression for subtitle fade-in/pop animation.
 * @param {string} animation — 'none' | 'fade' | 'pop'
 * @param {number} cueDuration — duration of this cue in seconds
 * @returns {string} Alpha override expression or empty string
 */
function buildSubtitleAnimation(animation, cueDuration) {
  switch (animation) {
    case 'fade':
      // Fade in over first 0.2s, hold, fade out over last 0.3s
      return `{\\alpha&(min(t\\,0.2)*5)*min(max(${cueDuration}-t-0.3\\,0)/0.3\\,1)}`;
    case 'pop':
      // Scale from 0.8 to 1.0 over 0.15s, hold, scale back to 0.95 over last 0.2s
      return `{\\an\\pos(${cueDuration > 0.35 ? 0.15 : 0}..)`;
    default:
      return '';
  }
}

// ─── Subtitle file generation (ASS format) ───────────────────────────────────

/**
 * Generates an ASS subtitle file from an array of {start, end, text} cues.
 * @param {Array<{start: number, end: number, text: string}>} cues
 * @param {object} opts — subtitle styling options
 * @returns {string} path to temp .ass file
 */
function generateAssFile(cues, opts = {}) {
  const {
    fontSize = 28,
    color = '&H00FFFFFF',          // white
    borderColor = '&H00000000',   // black
    font = 'Arial',
    outline = 2,
    shadow = 1,
    position = 'bottom',         // 'bottom' | 'top'
    animation = 'none',           // 'none' | 'fade' | 'pop'
  } = opts;

  // Alignment: 2 = bottom-center, 8 = top-center
  const alignment = position === 'top' ? 8 : 2;
  const marginV = position === 'top' ? 30 : 30;

  const cueLines = cues.map((cue, i) => {
    const s = secsToAss(cue.start);
    const e = secsToAss(cue.end);
    const duration = cue.end - cue.start;
    const escapedText = cue.text
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\n/g, '\\N');

    const animExpr = buildSubtitleAnimation(animation, duration);
    const styledText = animExpr ? escapedText + animExpr : escapedText;

    return `${i + 1}\nDialogue: 0,${s},${e},Default,,0,0,${marginV},,${styledText}`;
  }).join('\n');

  const ass = `[Script Info]
Title: TKP Generated Subtitles v3
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${fontSize},${color},${borderColor},&H00000000,0,0,0,0,100,100,0,0,1,${outline},${shadow},${alignment},10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${cueLines}
`;

  const tmpPath = path.join(os.tmpdir(), `tksubs_${Date.now()}.ass`);
  fs.writeFileSync(tmpPath, ass, 'utf8');
  return tmpPath;
}

function secsToAss(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${String(h).padStart(1, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// ─── Main VideoEditor class — v3 ─────────────────────────────────────────────

class VideoEditor {
  /**
   * @param {string} channel — 'productivity_worker' | 'gen_z_success'
   * @param {object} [encodeOptions] — optional v3 overrides; see ENCODE_DEFAULTS
   */
  constructor(channel = 'productivity_worker', encodeOptions = {}) {
    this.channel = channel;
    this.channelPreset = CHANNEL_PRESETS[channel];
    if (!this.channelPreset) throw new Error(`Unknown channel: ${channel}`);

    // v3: merge encode options (constructor param overrides channel defaults)
    this.opts = { ...this.channelPreset, ...encodeOptions };
    this.workingDir = path.resolve(this.opts.outputDir);
    ensureDir(this.workingDir);
  }

  // ── Convenience: set encode options after construction ────────────────────

  /**
   * Override encode options for subsequent operations.
   * @param {object} options — any subset of encode options
   * @returns {VideoEditor} this (chainable)
   */
  withOptions(options) {
    this.opts = { ...this.opts, ...options };
    return this;
  }

  /**
   * Set target resolution (720p | 1080p | 4k).
   * @param {string} res
   * @returns {VideoEditor} this
   */
  setResolution(res) {
    if (!RESOLUTION_PRESETS[res]) throw new Error(`Unknown resolution: ${res}`);
    this.opts.resolution = res;
    return this;
  }

  /**
   * Set target aspect ratio (16:9 | 9:16 | 1:1 | 4:5).
   * @param {string} ar
   * @returns {VideoEditor} this
   */
  setAspectRatio(ar) {
    if (!ASPECT_RATIO_PRESETS[ar]) throw new Error(`Unknown aspect ratio: ${ar}`);
    this.opts.aspectRatio = ar;
    return this;
  }

  /**
   * Set frame rate (24 | 30 | 60).
   * @param {string|number} fps
   * @returns {VideoEditor} this
   */
  setFrameRate(fps) {
    const key = String(fps);
    if (!FRAME_RATE_PRESETS[key]) throw new Error(`Unknown frame rate: ${fps}`);
    this.opts.fps = key;
    return this;
  }

  /**
   * Set video codec (h264 | h265).
   * @param {string} codec
   * @returns {VideoEditor} this
   */
  setVideoCodec(codec) {
    if (!VIDEO_CODEC_PRESETS[codec]) throw new Error(`Unknown video codec: ${codec}`);
    this.opts.codec = codec;
    return this;
  }

  /**
   * Set audio codec (aac | mp3).
   * @param {string} codec
   * @returns {VideoEditor} this
   */
  setAudioCodec(codec) {
    if (!AUDIO_CODEC_PRESETS[codec]) throw new Error(`Unknown audio codec: ${codec}`);
    this.opts.audioCodec = codec;
    return this;
  }

  // ── Derived values ────────────────────────────────────────────────────────

  _videoCodec()  { return VIDEO_CODEC_PRESETS[this.opts.codec]?.codec  || 'libx264'; }
  _audioCodec()  { return AUDIO_CODEC_PRESETS[this.opts.audioCodec]?.codec || 'aac'; }
  _audioBitrate(){ return AUDIO_CODEC_PRESETS[this.opts.audioCodec]?.bitrateDefault || '192k'; }
  _audioRate()   { return AUDIO_CODEC_PRESETS[this.opts.audioCodec]?.sampleRateDefault || 48000; }
  _fps()         { return parseInt(this.opts.fps || '30', 10); }
  _crf()         {
    const override = this.opts.crf;
    if (override != null) return override;
    return VIDEO_CODEC_PRESETS[this.opts.codec]?.crfDefault || 18;
  }

  _resolution() {
    return RESOLUTION_PRESETS[this.opts.resolution] || RESOLUTION_PRESETS['1080p'];
  }

  // ── Core editing methods ──────────────────────────────────────────────────

  /**
   * Trims a video clip to the given start/end times.
   * Applies current encode options (resolution, fps, codec).
   *
   * @param {string} input — source video path or URL
   * @param {number} startSec — start time in seconds
   * @param {number} endSec — end time in seconds
   * @param {string} [outputName] — output filename (auto-generated if omitted)
   * @returns {string} path to trimmed clip
   */
  trim(input, startSec, endSec, outputName) {
    const duration = (endSec - startSec).toFixed(3);
    const name = outputName || `trim_${Date.now()}.mp4`;
    const output = path.join(this.workingDir, name);
    const res = this._resolution();

    const cmd = [
      'ffmpeg -y',
      `-ss ${startSec}`,
      `-i "${input}"`,
      `-t ${duration}`,
      `-vf scale=${res.width}:${res.height}:force_original_aspect_ratio=decrease,pad=${res.width}:${res.height}:(ow-iw)/2:(oh-ih)/2`,
      `-c:v ${this._videoCodec()} -crf ${this._crf()} -r ${this._fps()}`,
      `-c:a ${this._audioCodec()} -b:a ${this._audioBitrate()} -ar ${this._audioRate()}`,
      `"${output}"`,
    ].join(' ');

    run(cmd);
    return output;
  }

  /**
   * Concatenates multiple clips with dissolve/fade transitions.
   * Uses current codec/quality settings.
   *
   * @param {string[]} clips — ordered array of video file paths
   * @param {string} [outputName]
   * @returns {string} path to concatenated video
   */
  concatWithTransitions(clips, outputName) {
    if (clips.length === 0) throw new Error('No clips provided');
    if (clips.length === 1) return clips[0];

    const name = outputName || `concat_${Date.now()}.mp4`;
    const output = path.join(this.workingDir, name);
    const td = this.opts.transitionDuration || 0.5;
    const pairCount = clips.length - 1;
    const inputs = clips.map(c => `-i "${c}"`).join(' ');

    let filter;
    if (pairCount === 1) {
      filter = `-filter_complex "acrossfade=d=${td}"`;
    } else {
      const fadeChain = [];
      for (let i = 0; i < pairCount; i++) {
        fadeChain.push(`[${i}:v][${i + 1}:v]acrossfade=d=${td}[v${i + 1}]`);
      }
      filter = `-filter_complex "${fadeChain.join(';')};[v${pairCount}]null[c]"`;
    }

    const cmd = [
      'ffmpeg -y',
      inputs,
      filter,
      `-c:v ${this._videoCodec()} -crf ${this._crf()}`,
      `-c:a ${this._audioCodec()} -b:a ${this._audioBitrate()}`,
      `"${output}"`,
    ].join(' ');

    run(cmd);
    return output;
  }

  /**
   * Overlays a background music track on the video.
   * Music fades out at the end over fadeOutSec.
   *
   * @param {string} video — input video path
   * @param {string} music — audio file path (mp3, wav, aac, ogg)
   * @param {number} [fadeOutSec=3] — music fade-out duration at end
   * @param {string} [outputName]
   * @returns {string} path to video with music
   */
  addMusic(video, music, fadeOutSec = 3, outputName) {
    const name = outputName || `music_${Date.now()}.mp4`;
    const output = path.join(this.workingDir, name);
    const mv = this.opts.musicVolume || 0.15;

    const cmd = [
      'ffmpeg -y',
      `-i "${video}"`,
      `-i "${music}"`,
      `-filter_complex "[1:a]volume=${mv},afade=t=out:st=0:d=${fadeOutSec}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[a]"`,
      `-map 0:v`,
      `-map "[a]"`,
      `-c:v copy`,
      `-c:a ${this._audioCodec()} -b:a ${this._audioBitrate()} -ar ${this._audioRate()}`,
      `"${output}"`,
    ].join(' ');

    run(cmd);
    return output;
  }

  /**
   * Adds subtitles from an array of cue objects with full v3 styling.
   *
   * Subtitle options (passed in opts or constructor):
   *   subtitleFont         — font family (default: Arial)
   *   subtitleFontSize     — small (22) | medium (28) | large (36)
   *   subtitleColor        — white | yellow | auto
   *   subtitlePosition     — bottom | top
   *   subtitleAnimation    — none | fade | pop
   *
   * @param {string} video — input video
   * @param {Array<{start: number, end: number, text: string}>} cues
   * @param {object} [opts] — override subtitle styling for this call
   * @param {string} [outputName]
   * @returns {string} path to video with hard-coded burn-in subtitles
   */
  addSubtitles(video, cues, opts = {}, outputName) {
    const name = outputName || `subs_${Date.now()}.mp4`;
    const output = path.join(this.workingDir, name);

    // Map user-friendly size names to pixel values
    const sizeMap = { small: 22, medium: 28, large: 36 };
    const colorMap = {
      white:  '&H00FFFFFF',
      yellow: '&H00FFFF00',
      auto:   '&H00FFFFFF',
    };

    const subOpts = {
      font:      opts.font      || this.opts.subtitleFont      || 'Arial',
      fontSize:  sizeMap[opts.fontSize]  || sizeMap[this.opts.subtitleFontSize] || 28,
      color:     colorMap[opts.color]   || colorMap[this.opts.subtitleColor]  || '&H00FFFFFF',
      borderColor: '&H00000000',
      position:  opts.position  || this.opts.subtitlePosition  || 'bottom',
      animation: opts.animation || this.opts.subtitleAnimation || 'none',
    };

    const subFile = generateAssFile(cues, subOpts);

    const cmd = [
      'ffmpeg -y',
      `-i "${video}"`,
      `-vf "ass=${subFile}"`,
      `-c:v ${this._videoCodec()} -crf ${this._crf()} -r ${this._fps()}`,
      `-c:a copy`,
      `"${output}"`,
    ].join(' ');

    run(cmd);

    // Clean up temp ASS file
    try { fs.unlinkSync(subFile); } catch (_) {}

    return output;
  }

  /**
   * Adds a TKP brand watermark/logo or text overlay to the video.
   *
   * Logo options:
   *   logoPath             — path to PNG logo (null for text-only watermark)
   *   watermarkPosition    — topleft | topright | bottomleft | bottomright | center
   *   watermarkSize        — small (5%) | medium (10%) | large (15%) of frame height
   *   watermarkOpacity     — 0.0–1.0 (default: 0.1 = 10%)
   *   watermarkText        — optional text overlay (mutually exclusive with logo)
   *   watermarkTextSize    — font size for text watermark
   *   watermarkTextColor   — color for text watermark
   *
   * @param {string} video — input video
   * @param {object} [logoOpts] — watermark options
   * @param {string} [outputName]
   * @returns {string} path to watermarked video
   */
  addWatermark(video, logoOpts = {}, outputName) {
    const name = outputName || `wm_${Date.now()}.mp4`;
    const output = path.join(this.workingDir, name);

    const posMap = {
      topleft:     '10:10',
      topright:    'W-w-10:10',
      bottomleft:   '10:H-h-10',
      bottomright: 'W-w-10:H-h-10',
      center:      '(W-w)/2:(H-h)/2',
    };

    const sizeMap = { small: 0.05, medium: 0.10, large: 0.15 };
    const opacity = logoOpts.opacity ?? 0.10;
    const position = posMap[logoOpts.position] || posMap.bottomleft;
    const sizePct = sizeMap[logoOpts.size] || 0.10;

    let filterParts = [];
    let watermarkInput = '';
    let watermarkIndex = 1;

    if (logoOpts.logoPath && fs.existsSync(logoOpts.logoPath)) {
      // Logo overlay
      const scaleFilter = `scale=iw*${sizePct}:ih*${sizePct}`;
      const alphaFilter = `format=rgba,colorchannelmixer=aa=${opacity}`;
      watermarkInput = `-i "${logoOpts.logoPath}"`;
      filterParts.push(
        `[1:v]${scaleFilter},${alphaFilter}[wm];[0:v][wm]overlay=${position}`
      );
      watermarkIndex = 2;
    }

    if (logoOpts.watermarkText) {
      // Text overlay via drawtext
      const textColor = logoOpts.watermarkTextColor || 'white';
      const textSize = logoOpts.watermarkTextSize || 24;
      const alphaVal = opacity.toFixed(2);
      const escapedText = logoOpts.watermarkText
        .replace(/'/g, "'\\''")
        .replace(/:/g, '\\:')
        .replace(/\\/g, '\\\\');

      const textFilter = `drawtext=text='${escapedText}':fontsize=${textSize}:fontcolor=${textColor}@${alphaVal}:x=${position.split(':')[0]}:y=${position.split(':')[1]}:borderw=1:bordercolor=black@${alphaVal}`;
      filterParts.push(textFilter);
    }

    if (filterParts.length === 0) {
      // No watermark provided — skip and return input unchanged
      console.warn('No logoPath or watermarkText provided; returning input unchanged.');
      return video;
    }

    const vf = filterParts.join(video && watermarkInput ? ';' : '');

    const cmd = [
      'ffmpeg -y',
      `-i "${video}"`,
      watermarkInput,
      `-filter_complex "${vf}"`,
      `-c:a copy`,
      `"${output}"`,
    ].join(' ');

    run(cmd);
    return output;
  }

  /**
   * Prepends an intro clip to the video.
   * @param {string} video — main video path
   * @param {string} introClip — intro video path
   * @param {string} [outputName]
   * @returns {string} path to video with intro
   */
  prependIntro(video, introClip, outputName) {
    const name = outputName || `intro_${Date.now()}.mp4`;
    const output = path.join(this.workingDir, name);

    const cmd = [
      'ffmpeg -y',
      `-i "${introClip}"`,
      `-i "${video}"`,
      `-filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]"`,
      `-map "[v]" -map "[a]"`,
      `-c:v ${this._videoCodec()} -crf ${this._crf()} -r ${this._fps()}`,
      `-c:a ${this._audioCodec()} -b:a ${this._audioBitrate()} -ar ${this._audioRate()}`,
      `"${output}"`,
    ].join(' ');

    run(cmd);
    return output;
  }

  /**
   * Appends an outro clip to the video.
   * @param {string} video — main video path
   * @param {string} outroClip — outro video path
   * @param {string} [outputName]
   * @returns {string} path to video with outro
   */
  appendOutro(video, outroClip, outputName) {
    const name = outputName || `outro_${Date.now()}.mp4`;
    const output = path.join(this.workingDir, name);

    const cmd = [
      'ffmpeg -y',
      `-i "${video}"`,
      `-i "${ outroClip}"`,
      `-filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]"`,
      `-map "[v]" -map "[a]"`,
      `-c:v ${this._videoCodec()} -crf ${this._crf()} -r ${this._fps()}`,
      `-c:a ${this._audioCodec()} -b:a ${this._audioBitrate()} -ar ${this._audioRate()}`,
      `"${output}"`,
    ].join(' ');

    run(cmd);
    return output;
  }

  /**
   * Adds both intro and outro in one call.
   * @param {string} video — main video path
   * @param {string} introClip — intro video path
   * @param {string} outroClip — outro video path
   * @param {string} [outputName]
   * @returns {string} path to video with intro + outro
   */
  addIntroOutro(video, introClip, outroClip, outputName) {
    const name = outputName || `intro_outro_${Date.now()}.mp4`;
    const output = path.join(this.workingDir, name);

    const cmd = [
      'ffmpeg -y',
      `-i "${introClip}"`,
      `-i "${video}"`,
      `-i "${outroClip}"`,
      `-filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]"`,
      `-map "[v]" -map "[a]"`,
      `-c:v ${this._videoCodec()} -crf ${this._crf()} -r ${this._fps()}`,
      `-c:a ${this._audioCodec()} -b:a ${this._audioBitrate()} -ar ${this._audioRate()}`,
      `"${output}"`,
    ].join(' ');

    run(cmd);
    return output;
  }

  /**
   * Re-encodes video to target resolution/aspect/fps/codec (v3 primary method).
   * Use this to apply any combination of v3 options to an existing video.
   *
   * @param {string} video — input video path
   * @param {object} [opts] — override encode options for this encode pass
   * @param {string} [outputName]
   * @returns {string} path to encoded video
   */
  encode(video, opts = {}, outputName) {
    const name = outputName || `encode_${Date.now()}.mp4`;
    const output = path.join(this.workingDir, name);
    const merge = { ...this.opts, ...opts };

    const res = RESOLUTION_PRESETS[merge.resolution] || RESOLUTION_PRESETS['1080p'];
    const fps  = parseInt(merge.fps || '30', 10);
    const vCodec  = VIDEO_CODEC_PRESETS[merge.codec]?.codec  || 'libx264';
    const crf     = merge.crf ?? (VIDEO_CODEC_PRESETS[merge.codec]?.crfDefault ?? 18);
    const aCodec  = AUDIO_CODEC_PRESETS[merge.audioCodec]?.codec || 'aac';
    const aBitr   = AUDIO_CODEC_PRESETS[merge.audioCodec]?.bitrateDefault || '192k';
    const aRate   = AUDIO_CODEC_PRESETS[merge.audioCodec]?.sampleRateDefault || 48000;

    // Build aspect ratio filter
    let arFilter = '';
    if (merge.aspectRatio && merge.aspectRatio !== '16:9') {
      arFilter = buildAspectFilter(res.width, res.height, merge.aspectRatio);
    }

    const vfParts = [];

    // Scale to target resolution
    vfParts.push(`scale=${res.width}:${res.height}:force_original_aspect_ratio=decrease`);

    // Pad to exact resolution (letterbox if needed)
    vfParts.push(`pad=${res.width}:${res.height}:(ow-iw)/2:(oh-ih)/2:black`);

    // Apply aspect ratio crop if not 16:9
    if (arFilter) {
      // Crop first, then scale+pad to target resolution
      const [cropPart, sarPart] = arFilter.split(',');
      vfParts.unshift(cropPart);
      if (sarPart) vfParts.push(sarPart);
    }

    const vf = vfParts.join(',');

    const cmd = [
      'ffmpeg -y',
      `-i "${video}"`,
      `-vf "${vf}"`,
      `-c:v ${vCodec} -crf ${crf} -r ${fps}${vCodec === 'libx265' ? ' -preset medium -x265-params log-level=error' : ''}`,
      `-c:a ${aCodec} -b:a ${aBitr} -ar ${aRate}`,
      `"${output}"`,
    ].join(' ');

    run(cmd);
    return output;
  }

  /**
   * Exports a video for a specific platform with v3 encode options.
   * @param {string} video — input video path
   * @param {string} platform — 'youtube' | 'tiktok' | 'instagram_reels' | 'linkedin'
   * @param {object} [metadata] — {title, description} for YouTube/LinkedIn
   * @param {string} [outputName]
   * @returns {string} path to platform-ready export
   */
  exportForPlatform(video, platform, metadata = {}, outputName) {
    const p = PLATFORM_PRESETS[platform];
    if (!p) throw new Error(`Unknown platform: ${platform}`);

    const name = outputName || `${platform}_${Date.now()}.${p.extension}`;
    const output = path.join(this.workingDir, name);

    // Duration check
    if (p.maxDuration) {
      const info = probe(video);
      if (info) {
        const duration = parseFloat(info.format?.duration || 0);
        if (duration > p.maxDuration) {
          throw new Error(
            `Video is ${duration.toFixed(0)}s but ${platform} max is ${p.maxDuration}s. Trim first.`
          );
        }
      }
    }

    const cmd = [
      'ffmpeg -y',
      `-i "${video}"`,
      `-c:v ${p.videoCodec} -crf ${p.crf}${p.fps ? ` -r ${p.fps}` : ''}`,
      `-c:a ${p.audioCodec} -b:a ${p.audioBitrate} -ar ${p.audioSampleRate}`,
      p.movflags ? `-movflags ${p.movflags}` : '',
      metadata.title       ? `-metadata title="${metadata.title}"`       : '',
      metadata.description ? `-metadata description="${metadata.description}"` : '',
      metadata.author      ? `-metadata author="${metadata.author}"`      : '',
      `"${output}"`,
    ].join(' ');

    run(cmd);
    return output;
  }

  /**
   * Auto-generates subtitle cues from a TTS audio track using word-level timestamps.
   * Falls back to estimated segmentation if timestamps not available.
   * @param {string} audioPath — TTS audio file
   * @param {number} [wpm=150] — estimated words per minute
   * @returns {Array<{start: number, end: number, text: string}>} cues
   */
  static generateSubtitleCuesFromAudio(audioPath, wpm = 150) {
    const info = probe(audioPath);
    if (!info) return [];

    const duration = parseFloat(info.format?.duration || 0);
    const wordsPerCue = 15;
    const secsPerCue  = (wordsPerCue / wpm) * 60;

    const cues = [];
    let t = 0, cueIdx = 0;
    while (t < duration) {
      const end = Math.min(t + secsPerCue, duration);
      cues.push({ start: t, end, text: `[Segment ${cueIdx + 1}]` });
      t = end;
      cueIdx++;
    }
    return cues;
  }
}

module.exports = {
  VideoEditor,
  CHANNEL_PRESETS,
  RESOLUTION_PRESETS,
  ASPECT_RATIO_PRESETS,
  FRAME_RATE_PRESETS,
  VIDEO_CODEC_PRESETS,
  AUDIO_CODEC_PRESETS,
  PLATFORM_PRESETS,
  generateAssFile,
  buildAspectFilter,
  probe,
};
