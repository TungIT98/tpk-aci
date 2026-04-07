/**
 * lib/audio.js
 * Audio processing pipeline for TKP Studio System.
 *
 * Provides:
 * - WhisperTranscriber: Auto-transcribe audio → word timings → subtitle file
 * - AudioMixer: Mix TTS voice + background music at brand-compliant volumes
 * - AudioQC: Validate audio quality before publishing
 *
 * Usage:
 *   import { WhisperTranscriber, AudioMixer, AudioQC } from './lib/audio.js';
 */

import { exec, spawnSync } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
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

export const OPENAI_API_KEY    = env.OPENAI_API_KEY    ?? '';
export const WHISPER_MODEL    = env.WHISPER_MODEL     ?? 'whisper-1'; // or 'whisper-small' for local
export const FFMPROBE_PATH    = env.FFPROBE_PATH     ?? 'ffprobe';   // 'ffprobe.exe' on Windows

// ---------------------------------------------------------------------------
// WhisperTranscriber
// ---------------------------------------------------------------------------

/**
 * Auto-transcribes audio files using OpenAI Whisper API.
 * Generates word-level timings for subtitle generation.
 */
export class WhisperTranscriber {
  constructor({ apiKey = OPENAI_API_KEY } = {}) {
    this.apiKey = apiKey;
    this.model  = WHISPER_MODEL;
  }

  /**
   * Transcribe an audio file.
   *
   * @param {string} audioPath — MP3, WAV, M4A, or FLAC file
   * @param {object} opts
   * @param {string} [opts.language='en']
   * @param {string} [opts.model='whisper-1']
   * @param {boolean} [opts.wordTimings=true] — request word-level timing data
   * @returns {Promise<{text: string, wordTimings: Array<{word, start, end}>, segments: Array}>}
   */
  async transcribe(audioPath, {
    language   = 'en',
    model      = this.model,
    wordTimings = true,
  } = {}) {
    if (!existsSync(audioPath)) throw new Error(`Audio file not found: ${audioPath}`);
    if (!this.apiKey) throw new Error('OpenAI API key not set. Set OPENAI_API_KEY in .env');

    // Build form data
    const formData = new FormData();
    formData.append('file', await this._fileFromPath(audioPath));
    formData.append('model', model);
    formData.append('language', language);
    formData.append('response_format', wordTimings ? 'verbose_json' : 'text');
    if (wordTimings) formData.append('timestamp_granularities[]', 'word');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Whisper transcription failed (${res.status}): ${err}`);
    }

    const data = await res.json();

    return {
      text:       data.text ?? '',
      wordTimings: (data.words ?? data.segments?.flatMap(s => s.words ?? []) ?? [])
                    .map(w => ({
                      word:  w.word?.trim() ?? '',
                      start: w.start ?? 0,
                      end:   w.end   ?? 0,
                    })),
      segments:   data.segments ?? [],
      language,
    };
  }

  /**
   * Convert word timings → .SRT subtitle file.
   * @param {Array} wordTimings
   * @param {string} outputPath
   */
  async toSRT(wordTimings, outputPath) {
    const { SubtitleRenderer } = await import('./ffmpeg-pro.js');
    const renderer = new SubtitleRenderer();
    const cues = renderer.groupWords(wordTimings, { maxWordsPerCue: 8 });
    renderer.toSRT(cues, outputPath);
    return outputPath;
  }

  /**
   * Convert word timings → .ASS subtitle file.
   * @param {Array} wordTimings
   * @param {string} outputPath
   * @param {object} opts — styling options
   */
  async toASS(wordTimings, outputPath, opts = {}) {
    const { SubtitleRenderer } = await import('./ffmpeg-pro.js');
    const renderer = new SubtitleRenderer();
    const cues = renderer.groupWords(wordTimings, { maxWordsPerCue: 8 });
    renderer.toASS(cues, outputPath, opts);
    return outputPath;
  }

  /**
   * Full pipeline: transcribe → generate subtitle file.
   * @param {string} audioPath
   * @param {string} outputPath — with .srt or .ass extension
   * @param {object} opts
   */
  async transcribeAndGenerateSubs(audioPath, outputPath, opts = {}) {
    const result = await this.transcribe(audioPath);
    if (!result.wordTimings.length) {
      throw new Error('Whisper returned no word timings — audio may be silent or too short');
    }
    const ext = outputPath.toLowerCase().endsWith('.ass') ? 'ass' : 'srt';
    if (ext === 'ass') {
      await this.toASS(result.wordTimings, outputPath, opts);
    } else {
      await this.toSRT(result.wordTimings, outputPath);
    }
    return { ...result, subtitlePath: outputPath };
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /** Polyfill-free file fetch for Node 18 */
  async _fileFromPath(filePath) {
    const { readFileSync } = await import('fs');
    const buffer = readFileSync(filePath);
    const name   = filePath.split(/[\\/]/).pop();
    return new File([buffer], name);
  }
}

// ---------------------------------------------------------------------------
// AudioMixer
// ---------------------------------------------------------------------------

/**
 * Mix TTS voice audio with background music at brand-compliant volumes.
 * Uses FFmpeg for mixing.
 */
export class AudioMixer {
  constructor() {}

  /**
   * Mix voice track with background music.
   *
   * @param {object} opts
   * @param {string} opts.voicePath — TTS MP3 file
   * @param {string} opts.musicPath — Background music MP3 file
   * @param {number} [opts.musicVolume=0.15] — music volume multiplier
   * @param {number} [opts.fadeOutSeconds=3] — music fade out at end
   * @param {string} [opts.outputPath] — derived if omitted
   * @returns {Promise<string>} outputPath
   */
  async mixVoiceAndMusic({ voicePath, musicPath, musicVolume = 0.15, fadeOutSeconds = 3, outputPath }) {
    if (!existsSync(voicePath)) throw new Error(`Voice file not found: ${voicePath}`);
    if (!existsSync(musicPath)) throw new Error(`Music file not found: ${musicPath}`);

    const out = outputPath ?? voicePath.replace('.mp3', '_mixed.mp3');

    const cmd = [
      'ffmpeg -y',
      `-i "${voicePath}"`,
      `-i "${musicPath}"`,
      `-filter_complex "[1:a]volume=${musicVolume},afade=t=out:st=0:d=${fadeOutSeconds}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[a]"`,
      `-map "[a]"`,
      `-c:a aac -b:a 192k -ar 48000`,
      `"${out}"`,
    ].join(' ');

    try {
      await execAsync(cmd, { timeout: 120_000 });
    } catch (err) {
      throw new Error(`Audio mix failed: ${err.stderr ?? err.message}`);
    }

    return out;
  }

  /**
   * Normalize audio to target LUFS level.
   * Useful for ensuring consistent loudness across videos.
   *
   * @param {string} inputPath
   * @param {string} outputPath
   * @param {number} [opts.targetLUFS=-14] — YouTube standard: -14 LUFS
   */
  async normalizeLoudness(inputPath, outputPath, { targetLUFS = -14 } = {}) {
    const cmd = [
      'ffmpeg -y',
      `-i "${inputPath}"`,
      `-af loudnorm=I=${targetLUFS}:TP=-1.5:LRA=11`,
      `-c:a aac -b:a 192k`,
      `"${outputPath}"`,
    ].join(' ');

    try {
      await execAsync(cmd, { timeout: 120_000 });
    } catch (err) {
      throw new Error(`Loudness normalization failed: ${err.stderr ?? err.message}`);
    }

    return outputPath;
  }

  /**
   * Measure audio levels (LUFS and true peak) without modifying file.
   *
   * @param {string} audioPath
   * @returns {Promise<{integratedLUFS: number, truePeak: number, loudnessRange: number}>}
   */
  async measureLevels(audioPath) {
    const cmd = [
      'ffmpeg -y',
      `-i "${audioPath}"`,
      `-af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json`,
      `-f null -`,
    ].join(' ');

    let stderr = '';
    try {
      const { stderr: err } = await execAsync(cmd, { timeout: 60_000 });
      stderr = err;
    } catch (err) {
      stderr = err.stderr ?? err.message;
    }

    // Parse JSON output from stderr
    const match = stderr.match(/\{[\s\S]*?"input_integrated_loudness"[\s\S]*?\}/);
    if (!match) {
      return { integratedLUFS: null, truePeak: null, loudnessRange: null };
    }

    try {
      const data = JSON.parse(match[0]);
      return {
        integratedLUFS: parseFloat(data.input_integrated_loudness),
        truePeak:       parseFloat(data.input_true_peak),
        loudnessRange:  parseFloat(data.input_loudness_range),
      };
    } catch {
      return { integratedLUFS: null, truePeak: null, loudnessRange: null };
    }
  }

  /**
   * Convert any audio to MP3 192kbps 48kHz stereo.
   * Use as a normalization step before FFmpeg video assembly.
   *
   * @param {string} inputPath
   * @param {string} [outputPath]
   * @returns {Promise<string>}
   */
  async standardizeAudio(inputPath, outputPath) {
    const out = outputPath ?? inputPath.replace(/\.[^.]+$/, '_std.mp3');
    const cmd = [
      'ffmpeg -y',
      `-i "${inputPath}"`,
      `-c:a libmp3lame -b:a 192k -ar 48000 -ac 2`,
      `"${out}"`,
    ].join(' ');

    try {
      await execAsync(cmd, { timeout: 60_000 });
    } catch (err) {
      throw new Error(`Audio standardization failed: ${err.stderr ?? err.message}`);
    }

    return out;
  }
}

// ---------------------------------------------------------------------------
// AudioQC
// ---------------------------------------------------------------------------

/**
 * Automated audio quality checks before publishing.
 */
export class AudioQC {
  constructor() {}

  /**
   * Run automated QC checks on an audio file.
   *
   * @param {string} audioPath
   * @param {object} opts
   * @param {number} [opts.minDurationSec=5]
   * @param {number} [opts.maxDurationSec=600]
   * @param {number} [opts.maxLUFS=-8] — reject if louder than this
   * @param {number} [opts.minLUFS=-20] — reject if quieter than this
   * @returns {{ pass: boolean, failures: string[], warnings: string[], metadata: object }}
   */
  async check(audioPath, {
    minDurationSec = 5,
    maxDurationSec = 600,
    maxLUFS        = -8,
    minLUFS        = -20,
  } = {}) {
    const failures = [];
    const warnings = [];
    const mixer    = new AudioMixer();

    // 1. File exists
    if (!existsSync(audioPath)) {
      failures.push(`File not found: ${audioPath}`);
      return { pass: false, failures, warnings, metadata: {} };
    }

    // 2. Get audio duration via ffprobe
    let durationSec;
    try {
      const { stdout } = await execAsync(
        `${FFMPROBE_PATH} -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`
      );
      durationSec = parseFloat(stdout.trim());
    } catch {
      warnings.push('Could not read audio duration via ffprobe');
    }

    if (durationSec !== undefined) {
      if (durationSec < minDurationSec) failures.push(`Audio too short: ${durationSec.toFixed(1)}s (min: ${minDurationSec}s)`);
      if (durationSec > maxDurationSec) warnings.push(`Audio very long: ${durationSec.toFixed(1)}s (max: ${maxDurationSec}s)`);
    }

    // 3. Measure LUFS
    const levels = await mixer.measureLevels(audioPath);
    if (levels.integratedLUFS !== null) {
      if (levels.integratedLUFS > maxLUFS) failures.push(`Audio too loud: ${levels.integratedLUFS} LUFS (max: ${maxLUFS} LUFS)`);
      if (levels.integratedLUFS < minLUFS) warnings.push(`Audio quiet: ${levels.integratedLUFS} LUFS — may be hard to hear`);
    }

    // 4. True peak check
    if (levels.truePeak !== null && levels.truePeak > -0.5) {
      warnings.push(`True peak near clipping: ${levels.truePeak} dB (should be < -1 dB)`);
    }

    return {
      pass:      failures.length === 0,
      failures,
      warnings,
      metadata:  { durationSec, ...levels },
    };
  }
}

// ---------------------------------------------------------------------------
// Audio extraction utilities
// ---------------------------------------------------------------------------

function _tempDir() {
  const dir = resolve(__dirname, '..', 'output', '_temp', 'audio');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Run a command, throw on non-zero exit.
 * @param {string} cmd
 * @param {string[]} args
 * @returns {{ stdout: string, stderr: string }}
 */
function _run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf-8', shell: true });
  if (r.status !== 0) {
    throw new Error(`[${cmd}] exit ${r.status}: ${r.stderr || r.stdout}`);
  }
  return { stdout: r.stdout, stderr: r.stderr };
}

/**
 * Extract audio track from a video file as MP3.
 *
 * @param {string} videoPath  — source video (any format FFmpeg supports)
 * @param {string} [outputPath] — output MP3 path (auto-generated if omitted)
 * @returns {Promise<string>} — path to the extracted MP3
 */
export async function extract_audio(videoPath, outputPath) {

  const absVideo = resolve(videoPath);
  if (!existsSync(absVideo)) throw new Error(`Video not found: ${absVideo}`);

  const out = outputPath ?? join(_tempDir(), `extract_${Date.now()}.mp3`);

  const r = spawnSync('ffmpeg', [
    '-i', absVideo,
    '-vn',
    '-acodec', 'libmp3lame',
    '-qscale:a', '2',
    '-ar', '44100',
    '-ac', '2',
    '-y', out,
  ], { encoding: 'utf-8', shell: true });

  if (r.status !== 0) throw new Error(`extract_audio FFmpeg failed: ${r.stderr || r.stdout}`);
  return out;
}

/**
 * Get duration of an audio file in seconds.
 * @param {string} audioPath
 * @returns {number}
 */
export function get_audio_duration(audioPath) {

  const r = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ], { encoding: 'utf-8', shell: true });
  if (r.status !== 0) throw new Error(`get_audio_duration ffprobe failed: ${r.stderr}`);
  return parseFloat(r.stdout.trim()) || 0;
}

/**
 * Split an audio file into segments by timestamp ranges.
 *
 * @param {string} audioPath — source audio file
 * @param {Array<{start: number, end: number, label?: string}>} timestamps
 *   start/end in seconds. Labels are optional metadata.
 * @returns {Promise<Array<{index: number, label: string|null, start: number, end: number, path: string}>>}
 */
export async function split_audio(audioPath, timestamps) {

  const absAudio = resolve(audioPath);
  if (!existsSync(absAudio)) throw new Error(`Audio not found: ${absAudio}`);

  const dir = _tempDir();
  const results = [];

  for (let i = 0; i < timestamps.length; i++) {
    const { start, end, label } = timestamps[i];
    if (end <= start) throw new Error(`Invalid segment: start ${start} >= end ${end}`);

    const outPath = join(dir, `seg_${i}_${Date.now()}.mp3`);

    const r = spawnSync('ffmpeg', [
      '-i', absAudio,
      '-ss', String(start),
      '-to', String(end),
      '-acodec', 'copy',
      '-y', outPath,
    ], { encoding: 'utf-8', shell: true });

    if (r.status !== 0) throw new Error(`split_audio FFmpeg failed: ${r.stderr || r.stdout}`);
    results.push({ index: i, label: label ?? null, start, end, path: outPath });
  }

  return results;
}

/**
 * Merge audio segments into a single file.
 *
 * @param {Array<{index: number, label?: string, start: number, end: number, path: string}>} segments
 * @param {string} outputPath — final merged MP3 path
 * @param {object} [opts]
 * @param {Array<{index: number, audio: Buffer|string, startOffset?: number}>} [opts.voiceoverSegments]
 *   Per-segment voiceover replacement. audio is a Buffer or file path.
 *   startOffset shifts when the voiceover begins relative to segment start.
 * @returns {Promise<string>} — path to the merged file
 */
export async function merge_audio_segments(segments, outputPath, opts = {}) {
  const { voiceoverSegments = [] } = opts;
  const dir = _tempDir();

  const voMap = new Map(voiceoverSegments.map(s => [s.index, s]));
  const processedPaths = [];

  for (const seg of segments) {
    const vo = voMap.get(seg.index);

    if (vo) {
      const segOut = join(dir, `vo_mix_${seg.index}_${Date.now()}.mp3`);
      const voPath = typeof vo.audio === 'string' ? vo.audio : join(dir, `vo_${seg.index}_${Date.now()}.mp3`);

      if (typeof vo.audio !== 'string') {
        wf(voPath, vo.audio);
      }

      const ssOffset = vo.startOffset ?? 0;
      const r = spawnSync('ffmpeg', [
        '-i', seg.path,
        '-i', voPath,
        '-filter_complex',
        `[0:a]volume=0.3[bg];[1:a]adelay=${Math.round(ssOffset * 1000)}|${Math.round(ssOffset * 1000)}[vo];[bg][vo]amix=inputs=2:duration=longest[aout]`,
        '-map', '[aout]',
        '-acodec', 'libmp3lame',
        '-qscale:a', '2',
        '-y', segOut,
      ], { encoding: 'utf-8', shell: true });

      if (r.status !== 0) throw new Error(`merge_audio_segments FFmpeg mix failed: ${r.stderr || r.stdout}`);
      processedPaths.push(segOut);
    } else {
      const segOut = join(dir, `copy_${seg.index}_${Date.now()}.mp3`);
      const r = spawnSync('ffmpeg', ['-i', seg.path, '-acodec', 'copy', '-y', segOut], { encoding: 'utf-8', shell: true });
      if (r.status !== 0) throw new Error(`merge_audio_segments FFmpeg copy failed: ${r.stderr || r.stdout}`);
      processedPaths.push(segOut);
    }
  }

  // Concat all processed segments
  const concatFile = join(dir, `concat_${Date.now()}.txt`);
  const concatContent = processedPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
  writeFileSync(concatFile, concatContent);

  const r = spawnSync('ffmpeg', [
    '-f', 'concat', '-safe', '0',
    '-i', concatFile,
    '-acodec', 'libmp3lame',
    '-qscale:a', '2',
    '-y', outputPath,
  ], { encoding: 'utf-8', shell: true });

  if (r.status !== 0) throw new Error(`merge_audio_segments FFmpeg concat failed: ${r.stderr || r.stdout}`);
  return outputPath;
}

/**
 * Apply a full voiceover to a video — replaces the original audio track.
 *
 * @param {string} videoPath — source video
 * @param {Buffer|string} voiceoverAudio — voiceover MP3 buffer or file path
 * @param {string} [outputPath] — output video path
 * @param {number} [delayMs=0] — ms to delay voiceover relative to video start
 * @returns {Promise<string>} — path to output video
 */
export async function apply_voiceover(videoPath, voiceoverAudio, outputPath, delayMs = 0) {
  const absVideo = resolve(videoPath);
  if (!existsSync(absVideo)) throw new Error(`Video not found: ${absVideo}`);

  const out = outputPath ?? join(_tempDir(), `vo_video_${Date.now()}.mp4`);
  const voPath = typeof voiceoverAudio === 'string' ? voiceoverAudio : join(_tempDir(), `vo_${Date.now()}.mp3`);
  if (typeof voiceoverAudio !== 'string') {
    writeFileSync(voPath, voiceoverAudio);
  }

  const r = spawnSync('ffmpeg', [
    '-i', absVideo,
    '-i', voPath,
    '-filter_complex',
    `[1:a]adelay=${delayMs}|${delayMs}[vo];[0:a]volume=0[bg];[bg][vo]amix=inputs=2:duration=longest[aout]`,
    '-map', '0:v',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-y', out,
  ], { encoding: 'utf-8', shell: true });

  if (r.status !== 0) throw new Error(`apply_voiceover FFmpeg failed: ${r.stderr || r.stdout}`);
  return out;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'extract') {
    const [video, out] = args;
    extract_audio(video, out).then(p => console.log('Extracted:', p)).catch(e => { console.error(e); process.exit(1); });
  } else if (cmd === 'duration') {
    console.log(get_audio_duration(args[0]), 'seconds');
  } else {
    console.log('lib/audio.js: extract_audio, split_audio, merge_audio_segments + existing WhisperTranscriber, AudioMixer, AudioQC');
    console.log('Usage: node lib/audio.js extract <video> [output.mp3]');
    console.log('       node lib/audio.js duration <audio>');
  }
}
