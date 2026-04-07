/**
 * lib/video-pipeline.js
 * Unified video production pipeline.
 *
 * Orchestrates: script generation -> TTS -> Hailuo video -> QC -> export
 *
 * Usage:
 *   import { VideoPipeline } from './lib/video-pipeline.js';
 *   const pipeline = new VideoPipeline();
 *   const result = await pipeline.run({
 *     channel: 'productivity_worker',
 *     topic: 'The 90-minute deep work system',
 *   });
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

// Lazy imports — loaded once via async init()
let _TTS, _ScriptGenerator, _HailuoVideo, _HailuoApp;

async function _loadDeps() {
  if (_TTS) return;
  const [ttsMod, scriptMod, hailuoMod, hailuoAppMod] = await Promise.all([
    import('./tts.js'),
    import('./script-generator.js'),
    import('./hailuo.js'),
    import('./hailuo-app.js'),
  ]);
  _TTS             = new ttsMod.TTSProvider();
  _ScriptGenerator = new scriptMod.ScriptGenerator();
  _HailuoVideo     = new hailuoMod.HailuoVideo();
  _HailuoApp       = new hailuoAppMod.HailuoApp();
}

export { CHANNELS } from './script-generator.js';
export { ELEVENLABS_VOICES } from './tts.js';
export { GENERATION_PRESETS, PROMPT_TEMPLATES } from './hailuo.js';

import { CHANNELS } from './script-generator.js';
import { GENERATION_PRESETS } from './hailuo.js';

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

export const STAGES = {
  SCRIPT:      'script',
  TTS:         'tts',
  VIDEO_GEN:   'video_gen',
  QC:          'qc',
  EXPORT:      'export',
  UPLOAD:      'upload',
};

// ---------------------------------------------------------------------------
// VideoPipeline
// ---------------------------------------------------------------------------

export class VideoPipeline {
  constructor(opts = {}) {
    this.tts         = opts.tts         ?? null;   // set in .run() after _loadDeps()
    this.scriptGen   = opts.scriptGen   ?? null;
    this.hailuo      = opts.hailuo      ?? null;
    this.hailuoApp    = opts.hailuoApp   ?? null;   // Hailuo App browser fallback
    this.outputDir   = opts.outputDir   ?? resolve(__dirname, '..', 'output');
    this.stageResults = {};
    this._depsLoaded = false;
  }

  async _ensureDeps() {
    if (this._depsLoaded) return;
    await _loadDeps();
    this.tts        ??= _TTS;
    this.scriptGen  ??= _ScriptGenerator;
    this.hailuo     ??= _HailuoVideo;
    this.hailuoApp  ??= _HailuoApp;
    this._depsLoaded = true;
  }

  async run({ channel, topic, angle, preset = 'fast', onStageComplete } = {}) {
    await this._ensureDeps();
    const results = { channel, topic, startedAt: new Date().toISOString(), stages: {} };

    try {
      // Stage 1: Script generation
      this._emit(onStageComplete, STAGES.SCRIPT, { status: 'running' });
      const script = await this.scriptGen.generate({ channel, topic, angle });
      results.stages[STAGES.SCRIPT] = { status: 'done', script: script.slice(0, 80) + '...' };
      this._emit(onStageComplete, STAGES.SCRIPT, results.stages[STAGES.SCRIPT]);

      // Stage 2: TTS generation
      this._emit(onStageComplete, STAGES.TTS, { status: 'running' });
      const ch = CHANNELS[channel];
      const ttsResult = await this.tts.speak({ text: script, voiceId: ch?.voiceId });
      results.stages[STAGES.TTS] = { status: 'done', hasAudio: true };
      this._emit(onStageComplete, STAGES.TTS, results.stages[STAGES.TTS]);

      // Stage 3: Hailuo video generation
      // Try API first; if 1008 insufficient_balance, fall back to Hailuo App browser
      this._emit(onStageComplete, STAGES.VIDEO_GEN, { status: 'running' });
      const presetConfig = GENERATION_PRESETS[preset] ?? GENERATION_PRESETS.fast;
      let videoResult;
      let videoSource = 'api';

      try {
        videoResult = await this.hailuo.generateVideo({
          prompt: this._buildVideoPrompt(script, channel),
          ...presetConfig,
          aspect_ratio: ch?.aspectRatio ?? '16:9',
        });
      } catch (apiErr) {
        const isInsufficientBalance =
          apiErr.message.includes('1008') ||
          apiErr.message.includes('insufficient balance') ||
          apiErr.message.includes('insufficient_balance') ||
          apiErr.message.includes('balance');

        if (isInsufficientBalance) {
          console.warn('[Pipeline] MiniMax API insufficient balance. Falling back to Hailuo App browser...');
          // HailuoApp uses app credits (separate from API credits)
          // Map preset to aspect ratio
          const aspectRatio = ch?.aspectRatio ?? '16:9';
          videoResult = await this.hailuoApp.generateVideo({
            prompt:    this._buildVideoPrompt(script, channel),
            aspectRatio,
            maxWaitMs: 15 * 60 * 1000,
          });
          videoSource = 'app';
        } else {
          throw apiErr; // re-throw unrelated errors
        }
      }

      const videoUrl = videoSource === 'api'
        ? (videoResult.video_url ?? videoResult.video?.url)
        : (videoResult.localPath ?? videoResult.url ?? videoResult.video_url);

      results.stages[STAGES.VIDEO_GEN] = {
        status: 'done',
        videoUrl,
        source: videoSource,   // 'api' | 'app'
      };
      this._emit(onStageComplete, STAGES.VIDEO_GEN, results.stages[STAGES.VIDEO_GEN]);

      // Stage 4: QC placeholder
      results.stages[STAGES.QC] = { status: 'pending', note: 'QC step requires human review or automated frame analysis' };

      // Stage 5: Export placeholder
      results.stages[STAGES.EXPORT] = { status: 'pending', note: 'FFmpeg assembly step — pending node execution' };

      results.status = 'in_progress';
      results.completedAt = null;

    } catch (err) {
      results.status = 'failed';
      results.error = err.message;
    }

    return results;
  }

  _emit(cb, stage, data) {
    if (typeof cb === 'function') cb({ stage, ...data });
  }

  _buildVideoPrompt(script, channel) {
    const template = (channel === 'gen_z_success')
      ? 'Fast-paced cuts, phone screens, energetic vibe, bright and punchy. Script: {script}'
      : 'Professional workspace, clean and cinematic, soft natural lighting, camera push-in. Script: {script}';
    return template.replace('{script}', script.slice(0, 300));
  }
}

// ---------------------------------------------------------------------------
// Pipeline CLI entry
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('VideoPipeline module loaded.');
  console.log('Usage: import { VideoPipeline } from "./lib/video-pipeline.js"');
  console.log('Then: await pipeline.run({ channel: "productivity_worker", topic: "..." })');
}
