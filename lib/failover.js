/**
 * lib/failover.js
 * Auto-failover orchestration for the video pipeline.
 *
 * Tries services in priority order, retries on transient failures,
 * and falls back to backup providers when primary fails.
 *
 * Usage:
 *   import { FailoverOrchestrator } from './lib/failover.js';
 *   const fo = new FailoverOrchestrator({ hailuo, tts, sdWebUI });
 *   const result = await fo.runVideoPipeline({ prompt, channel });
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function logDir() {
  const dir = resolve(__dirname, '..', 'logs');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function log(level, event, details = {}) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...details,
  });
  const path = resolve(logDir(), `failover_${new Date().toISOString().slice(0, 10)}.jsonl`);
  try { appendFileSync(path, entry + '\n'); } catch { /* ignore */ }
  if (level === 'ERROR') console.error(`[failover] ERROR: ${event}`, details);
  else console.log(`[failover] ${event}`, details);
}

// ---------------------------------------------------------------------------
// FailoverOrchestrator
// ---------------------------------------------------------------------------

export class FailoverOrchestrator {
  /**
   * @param {object} deps
   * @param {import('./hailuo.js').HailuoVideo} deps.hailuo
   * @param {import('./tts.js').TTSProvider} deps.tts
   * @param {string} [deps.sdWebUIUrl] — Stable Diffusion WebUI URL (default: http://localhost:7860)
   */
  constructor({ hailuo, tts, sdWebUIUrl = 'http://localhost:7860' } = {}) {
    this.hailuo = hailuo;
    this.tts = tts;
    this.sdWebUIUrl = sdWebUIUrl;
  }

  // -------------------------------------------------------------------------
  // Video generation with failover
  // -------------------------------------------------------------------------

  /**
   * Generate a video with automatic failover.
   *
   * Tries: Hailuo (MiniMax) → Stable Diffusion + FFmpeg animation
   *
   * @param {object} opts
   * @param {string} opts.prompt — video prompt
   * @param {string} [opts.aspect_ratio='16:9']
   * @param {string} [opts.hailuo_model='film.03']
   * @param {string} [opts.hailuo_quality_preset='standard']
   * @param {number} [opts.maxRetries=2]
   * @param {Function} [opts.onStageChange] — called with { stage, status, detail }
   * @returns {Promise<{ videoUrl: string, method: string, tookMs: number }>}
   */
  async generateVideo({ prompt, aspect_ratio = '16:9', hailuo_model = 'film.03', hailuo_quality_preset = 'standard', maxRetries = 2, onStageChange } = {}) {
    const stage = (s, detail) => onStageChange?.({ stage: s, status: 'running', detail });

    // ── Try Hailuo ────────────────────────────────────────────────────────
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      stage('hailuo', `attempt ${attempt + 1}/${maxRetries + 1}`);
      try {
        const start = Date.now();
        const result = await this.hailuo.generateVideo({
          prompt,
          model: hailuo_model,
          aspect_ratio,
          quality_preset: hailuo_quality_preset,
        });
        const videoUrl = await this.hailuo.getVideoUrl(result.task_id);
        log('info', 'hailuo_success', { attempt: attempt + 1, tookMs: Date.now() - start, task_id: result.task_id });
        return { videoUrl, method: 'hailuo', tookMs: Date.now() - start, taskId: result.task_id };
      } catch (err) {
        log('warn', 'hailuo_failed', { attempt: attempt + 1, error: err.message });
        if (attempt === maxRetries) {
          stage('hailuo', `failed after ${maxRetries + 1} attempts: ${err.message}`);
        }
      }
    }

    // ── Fallback: Stable Diffusion + FFmpeg ──────────────────────────────
    stage('sd_fallback', 'Hailuo failed — falling back to SD + FFmpeg');
    log('info', 'sd_fallback_triggered', {});
    try {
      const start = Date.now();
      const videoUrl = await this._generateWithSDAnimation(prompt, { aspect_ratio });
      log('info', 'sd_success', { tookMs: Date.now() - start });
      return { videoUrl, method: 'sd_ffmpeg', tookMs: Date.now() - start };
    } catch (err) {
      log('ERROR', 'sd_fallback_failed', { error: err.message });
      throw new Error(`Video generation failed: Hailuo ${maxRetries + 1} attempts exhausted, SD fallback also failed: ${err.message}`);
    }
  }

  /**
   * Stable Diffusion image-to-video via FFmpeg motion.
   * Uses the SD WebUI's img2img to generate frames, then FFmpeg to animate.
   */
  async _generateWithSDAnimation(prompt, { aspect_ratio } = {}) {
    const { spawnSync } = await import('child_process');

    // Determine resolution from aspect ratio
    const resMap = { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [1024, 1024] };
    const [w, h] = resMap[aspect_ratio] || [1280, 720];

    const tempDir = resolve(__dirname, '..', 'output', '_temp', 'sd_fallback');
    mkdirSync(tempDir, { recursive: true });

    // 1. Generate base image with SD WebUI
    stage('sd_fallback', 'Generating SD base image...');
    const imgRes = await this._callSDWebUI('/sdapi/v1/img2img', {
      prompt,
      width: w,
      height: h,
      steps: 20,
      cfg_scale: 7.5,
      sampler_name: 'Euler a',
    });
    if (!imgRes.images?.length) throw new Error('SD WebUI returned no images');

    const { writeFileSync } = await import('fs');
    const imgPath = resolve(tempDir, `sd_base_${Date.now()}.png`);
    writeFileSync(imgPath, Buffer.from(imgRes.images[0], 'base64'));

    // 2. Generate motion sequence (3 frames at different noise states → FFmpeg interpolation)
    stage('sd_fallback', 'Generating motion frames...');
    const framePaths = [];
    for (let i = 0; i < 3; i++) {
      const frameRes = await this._callSDWebUI('/sdapi/v1/img2img', {
        prompt,
        width: w,
        height: h,
        steps: 15,
        cfg_scale: 7.0,
        sampler_name: 'Euler a',
        seed: (imgRes.parameters?.seed ?? 42) + i,
        denoising_strength: 0.35 + i * 0.1,
      });
      const fPath = resolve(tempDir, `frame_${i}_${Date.now()}.png`);
      writeFileSync(fPath, Buffer.from(frameRes.images[0], 'base64'));
      framePaths.push(fPath);
    }

    // 3. Assemble into video with FFmpeg (zoom-pan Ken Burns effect as fallback motion)
    stage('sd_fallback', 'Assembling video with FFmpeg...');
    const outPath = resolve(tempDir, `sd_video_${Date.now()}.mp4`);
    const zoompanFilter = framePaths.map((p, i) => {
      const scale = i === 1 ? 1.05 : 1.0;
      return `input=${i}:zoompan=z='min(zoom+0.001,1.0)':s=${w}x${h}:d=30`;
    }).join(';');

    const r = spawnSync('ffmpeg', [
      '-loop', '1', '-i', framePaths[0],
      '-loop', '1', '-i', framePaths[1],
      '-loop', '1', '-i', framePaths[2],
      '-filter_complex',
      `[0:v]scale=${w}:${h},zoompan=z='min(zoom+0.001,1.02)':s=${w}x${h}:d=60,fade=t=out:st=1.5:d=1.5:alpha=0[intro];[1:v]scale=${w}:${h},zoompan=z='min(zoom+0.001,1.0)':s=${w}x${h}:d=90,fade=t=out:st=2:d=1.5:alpha=0[main];[2:v]scale=${w}:${h},zoompan=z='min(zoom+0.001,1.02)':s=${w}x${h}:d=60,fade=t=in:st=0:d=1.5[out];[intro][main][out]concat=n=3:v=1:a=0[aout]`,
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-pix_fmt', 'yuv420p',
      '-y', outPath,
    ], { encoding: 'utf-8', shell: true });

    if (r.status !== 0) throw new Error(`FFmpeg SD assembly failed: ${r.stderr}`);
    return outPath;
  }

  // -------------------------------------------------------------------------
  // TTS with failover
  // -------------------------------------------------------------------------

  /**
   * Generate speech with automatic failover.
   *
   * Tries: ElevenLabs → MiniMax TTS → Windows SAPI
   *
   * @param {string} text
   * @param {object} opts
   * @param {string} [opts.channel='productivity']
   * @param {Function} [opts.onProgress]
   * @returns {Promise<Buffer>} MP3 audio buffer
   */
  async generateSpeech(text, { channel = 'productivity', onProgress } = {}) {
    const log = (msg) => onProgress?.(`[TTS failover] ${msg}`);

    // ── Try ElevenLabs ───────────────────────────────────────────────────
    try {
      log('Trying ElevenLabs...');
      const audio = await this.tts.speakForChannel(channel, { text, provider: 'elevenlabs' });
      log('ElevenLabs succeeded');
      return audio;
    } catch (err) {
      log(`ElevenLabs failed: ${err.message}`);
    }

    // ── Try MiniMax TTS ──────────────────────────────────────────────────
    try {
      log('Trying MiniMax TTS...');
      const result = await this.tts.minimax({ text });
      if (result.audio_url) {
        const res = await fetch(result.audio_url);
        if (res.ok) {
          log('MiniMax TTS succeeded');
          return Buffer.from(await res.arrayBuffer());
        }
      }
    } catch (err) {
      log(`MiniMax TTS failed: ${err.message}`);
    }

    // ── Final fallback: Windows SAPI ───────────────────────────────────────
    log('Falling back to Windows SAPI...');
    const sapiVoice = channel === 'growth' ? 'Zira' : 'David';
    const { audioBuffer } = await this.tts.sapi({ text, voice: sapiVoice });
    log('SAPI succeeded');
    return audioBuffer;
  }

  // -------------------------------------------------------------------------
  // Full pipeline with failover
  // -------------------------------------------------------------------------

  /**
   * Run the full video pipeline with failover at every stage.
   *
   * @param {object} opts
   * @param {string} opts.prompt — video prompt
   * @param {string} [opts.script] — optional narration script (generates TTS if provided)
   * @param {string} [opts.channel='productivity']
   * @param {string} [opts.aspect_ratio='16:9']
   * @param {Function} [opts.onStageChange]
   * @returns {Promise<object>} — { videoPath, audioBuffer, method, tookMs }
   */
  async runVideoPipeline({ prompt, script, channel = 'productivity', aspect_ratio = '16:9', onStageChange } = {}) {
    const start = Date.now();
    const results = {};

    const stage = (s, detail) => {
      onStageChange?.({ stage: s, status: 'running', detail });
      log('info', `pipeline_stage_${s}`, { detail });
    };

    // Stage 1: TTS (if script provided)
    if (script) {
      stage('tts', 'Generating speech...');
      results.audioBuffer = await this.generateSpeech(script, { channel });
      results.ttsMethod = 'elevenlabs'; // approximate
    }

    // Stage 2: Video generation with failover
    stage('video', `Generating video (aspect: ${aspect_ratio})...`);
    const videoResult = await this.generateVideo({ prompt, aspect_ratio });
    results.videoPath = videoResult.videoUrl;
    results.videoMethod = videoResult.method;
    results.videoTookMs = videoResult.tookMs;

    // Stage 3: Merge audio into video (if TTS was generated)
    if (results.audioBuffer) {
      stage('merge', 'Merging audio into video...');
      const { apply_voiceover } = await import('./audio.js');
      const { writeFileSync, existsSync } = await import('fs');
      const mergedOut = resolve(__dirname, '..', 'output', `_temp`, `merged_${Date.now()}.mp4`);

      // Download video to local if it's a URL
      let localVideoPath = results.videoPath;
      if (results.videoPath.startsWith('http')) {
        const res = await fetch(results.videoPath);
        const tmp = resolve(__dirname, '..', 'output', '_temp', `video_${Date.now()}.mp4`);
        const fs = await import('fs');
        fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
        localVideoPath = tmp;
      }

      results.finalVideoPath = await apply_voiceover(
        localVideoPath,
        results.audioBuffer,
        mergedOut,
      );
    }

    results.totalTookMs = Date.now() - start;
    log('info', 'pipeline_complete', { method: results.videoMethod, tookMs: results.totalTookMs });
    return results;
  }

  // -------------------------------------------------------------------------
  // SD WebUI helper
  // -------------------------------------------------------------------------

  async _callSDWebUI(endpoint, body) {
    const url = `${this.sdWebUIUrl}${endpoint}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`SD WebUI ${endpoint} failed: ${res.status} ${await res.text()}`);
    return res.json();
  }
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('lib/failover.js: FailoverOrchestrator');
  console.log('Usage: import { FailoverOrchestrator } from "./lib/failover.js"');
  console.log('  const fo = new FailoverOrchestrator({ hailuo, tts });');
  console.log('  const result = await fo.runVideoPipeline({ prompt, script, channel });');
}
