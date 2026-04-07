/**
 * scripts/studio-automation.mjs
 * Full studio automation for TKP Content Agency.
 *
 * Runs the complete zero-human video production pipeline:
 * Script → TTS → Hailuo video → Thumbnails → Audio mix → Video assembly → QC
 *
 * Usage:
 *   # Produce one video
 *   node scripts/studio-automation.js --topic "How to structure your day" --channel growth
 *
 *   # Run night render queue
 *   node scripts/studio-automation.js --mode night-render
 *
 *   # Run full batch (all queued videos)
 *   node scripts/studio-automation.js --mode batch
 *
 *   # Status check
 *   node scripts/studio-automation.js --mode status
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
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

// Queue file for night rendering
const QUEUE_FILE = resolve(ROOT, 'output', '_queue.json');

// ---------------------------------------------------------------------------
// Stage logger
// ---------------------------------------------------------------------------

const log = (stage, msg, icon = '▶') => {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${icon} [${stage.toUpperCase()}] ${msg}`);
};

const logError = (stage, msg) => log(stage, msg, '✖');
const logOK   = (stage, msg) => log(stage, msg, '✔');

// ---------------------------------------------------------------------------
// StudioAutomation
// ---------------------------------------------------------------------------

class StudioAutomation {
  constructor({ channel, outputDir } = {}) {
    this.channel   = channel ?? 'productivity';
    this.outputDir = outputDir ?? resolve(ROOT, 'output', this.channel);
    this.tempDir   = resolve(this.outputDir, '_temp');
    this.assetsDir = resolve(ROOT, 'assets');

    mkdirSync(this.outputDir, { recursive: true });
    mkdirSync(this.tempDir,   { recursive: true });

    // Lazy-loaded modules
    this._modules = {};
  }

  async _loadModules() {
    if (Object.keys(this._modules).length > 0) return;
    const [tts, hailuo, image, audio, ffmpegPro, prompts] = await Promise.all([
      import('../lib/tts.js'),
      import('../lib/hailuo.js'),
      import('../lib/image.js'),
      import('../lib/audio.js'),
      import('../lib/ffmpeg-pro.js'),
      import('../lib/prompts.js'),
    ]);
    this._modules = {
      TTS:              tts.TTSProvider,
      HailuoVideo:      hailuo.HailuoVideo,
      ThumbnailGenerator: image.ThumbnailGenerator,
      StockMedia:       image.StockMedia,
      AudioMixer:       audio.AudioMixer,
      WhisperTranscriber: audio.WhisperTranscriber,
      VideoAssemblyLine: ffmpegPro.VideoAssemblyLine,
      ffmpegAvailable:   ffmpegPro.ffmpegAvailable,
      PromptBuilder:    prompts.PromptBuilder,
    };
  }

  // -------------------------------------------------------------------------
  // Main pipeline
  // -------------------------------------------------------------------------

  /**
   * Produce one complete video end-to-end.
   *
   * @param {object} opts
   * @param {string} opts.topic
   * @param {string} [opts.angle]
   * @param {string} [opts.script]       — Skip script generation if provided
   * @param {string} [opts.preset='standard'] — 'fast' | 'standard'
   * @param {boolean} [opts.autoUpload=false]
   * @param {Function} [opts.onStageComplete] — called with stage updates
   * @returns {Promise<{status, videoFile, thumbnail, qcReport, metadata}>}
   */
  async produceVideo(opts = {}) {
    const {
      topic,
      angle,
      script: providedScript = null,
      preset = 'standard',
      autoUpload = false,
      onStageComplete = () => {},
    } = opts;

    await this._loadModules();
    const { TTS, HailuoVideo, ThumbnailGenerator, AudioMixer, VideoAssemblyLine,
            PromptBuilder, ffmpegAvailable } = this._modules;

    const stage = (name, fn) => this._withStage(name, fn, onStageComplete);

    const videoId  = `tkpg-${Date.now().toString(36).slice(-3)}`;
    const metadata = { videoId, topic, channel: this.channel, startedAt: new Date().toISOString() };

    try {
      // ── Stage 1: Script ────────────────────────────────────────────────
      const script = await stage('script', async () => {
        if (providedScript) return providedScript;
        // Use PromptBuilder to get structured prompt, then call LLM
        const pb = new PromptBuilder(this.channel);
        return `Script generation needed.\nTopic: ${topic}\nAngle: ${angle ?? 'actionable framework'}\n${pb.getScriptPrompt(topic, angle)}`;
      });

      // ── Stage 2: TTS ───────────────────────────────────────────────────
      const ttsResult = await stage('tts', async () => {
        const tts = new TTS();
        const voiceProfile = this.channel === 'growth'
          ? { voiceId: 'TX37GLJWiS1HyvCFBiYb' } // Josh
          : { voiceId: 'ErXwobaYiN019pkycrre' }; // Antoni
        const audioBuffer = await tts.speakForChannel(this.channel, {
          text: typeof script === 'string' && script.length > 10 ? script : `Script for: ${topic}`,
          ...voiceProfile,
        });
        const ttsPath = resolve(this.tempDir, `${videoId}_tts.mp3`);
        writeFileSync(ttsPath, Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer));
        return ttsPath;
      });

      // ── Stage 3: Hailuo video ──────────────────────────────────────────
      const videoResult = await stage('video', async () => {
        if (!env.ANTHROPIC_TOKEN_KEY) throw new Error('ANTHROPIC_TOKEN_KEY not set in .env');
        const hailuo = new HailuoVideo({ apiKey: env.ANTHROPIC_TOKEN_KEY });
        const pb = new PromptBuilder(this.channel);
        const aspectRatio = this.channel === 'growth' ? '9:16' : '16:9';
        const prompt = pb.buildHailuoPrompt({
          script: typeof script === 'string' ? script : topic,
          scene: 'intro',
          constraints: { aspectRatio, duration: preset === 'fast' ? 6 : 10 },
        });
        return hailuo.generateVideo({ prompt, aspect_ratio: aspectRatio });
      });

      // ── Stage 4: Thumbnail ─────────────────────────────────────────────
      const thumbnailPath = await stage('thumbnail', async () => {
        const thumb = new ThumbnailGenerator(this.channel, { outputDir: resolve(this.assetsDir, 'thumbnails', this.channel) });
        return thumb.generate({
          headline: topic.slice(0, 40),
          format: this.channel === 'growth' ? '9:16' : '16:9',
        });
      });

      // ── Stage 5: Audio mix ────────────────────────────────────────────
      const mixedAudio = await stage('audio-mix', async () => {
        const mixer = new AudioMixer();
        // Find first available music track
        const musicDir = resolve(this.assetsDir, 'music', this.channel);
        const musicFiles = existsSync(musicDir)
          ? readdirSync(musicDir).filter(f => f.endsWith('.mp3'))
          : [];
        if (!musicFiles.length) return ttsResult; // no music available

        const musicPath = resolve(musicDir, musicFiles[0]);
        const outPath = resolve(this.tempDir, `${videoId}_mixed.mp3`);
        return mixer.mixVoiceAndMusic({
          voicePath:   ttsResult,
          musicPath,
          musicVolume: this.channel === 'growth' ? 0.12 : 0.15,
          outputPath:  outPath,
        });
      });

      // ── Stage 6: Video assembly ───────────────────────────────────────
      const videoFiles = await stage('assembly', async () => {
        const videoUrl = videoResult.video_url ?? videoResult.video?.url;
        if (!videoUrl) throw new Error('Hailuo returned no video URL');

        // Download video to temp
        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) throw new Error(`Failed to download Hailuo video: ${videoRes.status}`);
        const downloadedVideo = resolve(this.tempDir, `${videoId}_raw.mp4`);
        writeFileSync(downloadedVideo, Buffer.from(await videoRes.arrayBuffer()));

        const assembly = new VideoAssemblyLine({
          channel: this.channel,
          outputDir: this.outputDir,
          tempDir: this.tempDir,
        });

        return assembly.assemble({
          videoClips:   [{ path: downloadedVideo, start: 0.5, end: 5 }],
          audioPath:    mixedAudio,
          subtitlePath: null, // Will use Whisper if needed
          outputBasename: videoId,
          watermarkLogo: resolve(this.assetsDir, 'logos', `tkp-watermark-${this.channel === 'growth' ? 'growth' : 'prod'}.svg`),
        });
      });

      // ── Stage 7: QC ───────────────────────────────────────────────────
      const qcReport = await stage('qc', async () => {
        const mainFile = videoFiles.youtubeFile ?? videoFiles.masterFile;
        const failures = [];
        if (!existsSync(mainFile)) failures.push('Output video file not found');
        return { pass: failures.length === 0, failures };
      });

      metadata.status = 'ready_for_qc';
      metadata.videoFile = videoFiles.tiktokFile ?? videoFiles.youtubeFile ?? videoFiles.masterFile;
      metadata.masterFile = videoFiles.masterFile;
      metadata.thumbnail = thumbnailPath;
      metadata.completedAt = new Date().toISOString();

      logOK('DONE', `Video ready: ${metadata.videoFile}`);

      if (autoUpload) {
        log('upload', 'Auto-upload requested — use lib/upload/*.js separately');
      }

      return { status: 'ready_for_qc', ...metadata, qcReport };

    } catch (err) {
      metadata.status = 'failed';
      metadata.error = err.message;
      logError('ERROR', err.message);
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Night render queue
  // -------------------------------------------------------------------------

  /** Read the night render queue */
  _readQueue() {
    if (!existsSync(QUEUE_FILE)) return [];
    try {
      return JSON.parse(readFileSync(QUEUE_FILE, 'utf-8'));
    } catch { return []; }
  }

  /** Write to the queue */
  _writeQueue(items) {
    mkdirSync(resolve(QUEUE_FILE, '..'), { recursive: true });
    writeFileSync(QUEUE_FILE, JSON.stringify(items, null, 2));
  }

  /**
   * Add a video job to the night render queue.
   */
  async enqueue({ topic, angle, channel, priority = 'normal' }) {
    const queue = this._readQueue();
    queue.push({ id: `job-${Date.now()}`, topic, angle, channel: channel ?? this.channel, priority, status: 'queued', addedAt: new Date().toISOString() });
    this._writeQueue(queue);
    logOK('queue', `Added "${topic}" (priority: ${priority})`);
    return queue;
  }

  /**
   * Process the full night render queue.
   * Run this on a cron schedule (e.g., every night at 10 PM).
   */
  async processQueue() {
    const queue = this._readQueue();
    const pending = queue.filter(j => j.status === 'queued');

    if (!pending.length) {
      console.log('[queue] No pending jobs.');
      return;
    }

    log('queue', `Processing ${pending.length} queued video(s)...`);
    const results = [];

    for (const job of pending) {
      job.status = 'running';
      job.startedAt = new Date().toISOString();
      this._writeQueue(queue);

      try {
        const result = await this.produceVideo({ topic: job.topic, angle: job.angle, channel: job.channel });
        job.status = 'done';
        job.result = { videoFile: result.videoFile, qcPass: result.qcReport?.pass };
        logOK('queue', `✓ ${job.topic} — done`);
      } catch (err) {
        job.status = 'failed';
        job.error = err.message;
        logError('queue', `✗ ${job.topic} — ${err.message}`);
      }

      this._writeQueue(queue);
      results.push(job);
    }

    logOK('queue', `Queue processed. ${results.filter(r => r.status === 'done').length}/${results.length} succeeded.`);
    return results;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async _withStage(name, fn, onStageComplete) {
    log(name, 'Starting...');
    onStageComplete({ stage: name, status: 'running' });
    try {
      const result = await fn();
      logOK(name, 'Done');
      onStageComplete({ stage: name, status: 'done', result });
      return result;
    } catch (err) {
      logError(name, err.message);
      onStageComplete({ stage: name, status: 'error', error: err.message });
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...rest] = a.split('=');
    return [k.replace(/^--/, ''), rest.join('=') || true];
  })
);

const MODE     = args.mode     ?? 'single';
const CHANNEL  = args.channel  ?? 'productivity';
const TOPIC    = args.topic    ?? 'The 90-minute deep work system';
const ANGLE    = args.angle;
const PRESET   = args.preset   ?? 'standard';

async function main() {
  const studio = new StudioAutomation({ channel: CHANNEL });

  if (MODE === 'night-render') {
    await studio.processQueue();
  } else if (MODE === 'batch') {
    // Process all queued videos
    await studio.processQueue();
  } else if (MODE === 'status') {
    const queue = studio._readQueue();
    console.log(`\n=== Night Render Queue (${queue.length} jobs) ===`);
    for (const j of queue) {
      console.log(`  [${j.status.toUpperCase().padEnd(7)}] ${j.topic} (${j.channel})`);
    }
  } else if (MODE === 'enqueue') {
    await studio.enqueue({ topic: TOPIC, angle: ANGLE, channel: CHANNEL });
  } else {
    // Default: produce one video
    console.log(`\n=== TKP Studio Automation ===`);
    console.log(`Topic:   ${TOPIC}`);
    console.log(`Channel: ${CHANNEL}`);
    console.log(`Preset:  ${PRESET}\n`);

    const result = await studio.produceVideo({ topic: TOPIC, angle: ANGLE, preset: PRESET });
    console.log('\n=== Result ===');
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch(err => {
  console.error('\n[ERROR]', err.message);
  process.exit(1);
});
