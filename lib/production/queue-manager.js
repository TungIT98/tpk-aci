/**
 * lib/production/queue-manager.js
 * Production queue and batch execution engine for TKP Content Agency.
 * Manages the queue of videos to produce, tracks status, and executes
 * generation/editing/QC/export pipeline in parallel batches.
 *
 * Target: 1000 videos / 30 days = ~33 videos/day
 *
 * Usage:
 *   const { ProductionQueue } = require('./lib/production/queue-manager');
 *   const queue = new ProductionQueue();
 *   await queue.addJob({ channel: 'productivity_worker', script: '...', priority: 1 });
 *   await queue.runBatch({ concurrency: 3 }); // 3 parallel workers
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// ─── Queue state ─────────────────────────────────────────────────────────────

const JOB_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  GENERATING: 'generating',
  EDITING: 'editing',
  QC_PENDING: 'qc_pending',
  QC_PASS: 'qc_pass',
  QC_FAIL: 'qc_fail',
  EXPORTING: 'exporting',
  UPLOADING: 'uploading',
  DONE: 'done',
  FAILED: 'failed',
};

const CHANNELS = {
  productivity_worker: {
    name: 'TKP Productivity',
    voiceId: '21cho5f0l0d5MV3y',
    aspectRatio: '16:9',
    platforms: ['youtube', 'linkedin'],
    outputDir: 'output/productivity',
    hailuoModel: 'MiniMax-Hailuo-2.3',
  },
  gen_z_success: {
    name: 'TKP Growth',
    voiceId: 'mBnDcF6bL6eJNAW8',
    aspectRatio: '16:9',
    platforms: ['youtube', 'tiktok', 'instagram_reels'],
    outputDir: 'output/growth',
    hailuoModel: 'MiniMax-Hailuo-2.3',
  },
};

// ─── Job class ────────────────────────────────────────────────────────────────

class VideoJob {
  constructor(opts = {}) {
    this.id = opts.id || `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.channel = opts.channel || 'productivity_worker';
    this.script = opts.script || opts.prompt || '';
    this.title = opts.title || '';
    this.description = opts.description || '';
    this.platforms = opts.platforms || CHANNELS[this.channel]?.platforms || ['youtube'];
    this.priority = opts.priority || 5; // 1=highest, 10=lowest
    this.status = JOB_STATUS.PENDING;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.startedAt = null;
    this.completedAt = null;
    this.attempts = 0;
    this.maxAttempts = opts.maxAttempts || 3;
    this.errors = [];
    this.artifacts = {}; // paths to generated files
    this.costEstimate = 0; // cents
    this.qcResult = null;
  }

  toJSON() {
    return {
      id: this.id,
      channel: this.channel,
      script: this.script,
      title: this.title,
      description: this.description,
      platforms: this.platforms,
      priority: this.priority,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      attempts: this.attempts,
      errors: this.errors,
      artifacts: this.artifacts,
      costEstimate: this.costEstimate,
    };
  }

  static fromJSON(obj) {
    const job = new VideoJob(obj);
    job.attempts = obj.attempts || 0;
    job.errors = obj.errors || [];
    job.artifacts = obj.artifacts || {};
    job.costEstimate = obj.costEstimate || 0;
    return job;
  }
}

// ─── Production Queue ────────────────────────────────────────────────────────

class ProductionQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.queueDir = options.queueDir || 'logs/queue';
    this.stateFile = path.join(this.queueDir, 'queue-state.json');
    this.logDir = options.logDir || 'logs/production';
    this.jobs = new Map();
    this.runningJobs = new Set();
    this.maxConcurrent = options.maxConcurrent || 3;
    this.hailuoMaxPerDay = options.hailuoMaxPerDay || 100; // Paid tier
    this.hailuoUsedToday = 0;
    this.dailyLimit = options.dailyVideoTarget || 33;
    this.initialized = false;
    ensureDir(this.queueDir);
    ensureDir(this.logDir);
  }

  async init() {
    await this._loadState();
    this._resetDailyCountIfNewDay();
    this.initialized = true;
    this._log('ProductionQueue initialized', { jobs: this.jobs.size, running: this.runningJobs.size });
  }

  // ─── Job management ───────────────────────────────────────────────────────

  /**
   * Add a video job to the queue.
   * @param {object} opts — { channel, script, title, platforms, priority }
   * @returns {VideoJob}
   */
  addJob(opts) {
    const job = new VideoJob(opts);
    this.jobs.set(job.id, job);
    this._saveState();
    this._log('Job added', { jobId: job.id, channel: job.channel, priority: job.priority });
    this.emit('job:added', job);
    return job;
  }

  /**
   * Add multiple jobs from an array.
   */
  addBatch(opsArray) {
    return opsArray.map(opts => this.addJob(opts));
  }

  /**
   * Remove a job from the queue.
   */
  removeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    if (this.runningJobs.has(jobId)) return false; // can't remove running job
    this.jobs.delete(jobId);
    this._saveState();
    return true;
  }

  /**
   * Get jobs filtered by status, channel, etc.
   */
  getJobs(filter = {}) {
    return Array.from(this.jobs.values()).filter(j => {
      if (filter.status && j.status !== filter.status) return false;
      if (filter.channel && j.channel !== filter.channel) return false;
      if (filter.platform && !j.platforms.includes(filter.platform)) return false;
      if (filter.minPriority !== undefined && j.priority > filter.minPriority) return false;
      return true;
    }).sort((a, b) => a.priority - b.priority);
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  // ─── Queue execution ───────────────────────────────────────────────────────

  /**
   * Run the next batch of jobs up to maxConcurrent.
   * Call this repeatedly (e.g. on a timer) to process the queue.
   * @param {object} ctx — pipeline context ( HailuoVideo, TTS, etc. instances )
   */
  async runBatch(ctx = {}) {
    if (!this.initialized) await this.init();

    // Fill slots up to maxConcurrent
    const slots = this.maxConcurrent - this.runningJobs.size;
    if (slots <= 0) return [];

    // Pick highest-priority pending jobs
    const pending = this.getJobs({ status: JOB_STATUS.PENDING })
      .slice(0, slots);

    if (pending.length === 0) return [];

    // Check Hailuo daily limit
    const availableToday = this.hailuoMaxPerDay - this.hailuoUsedToday;
    const toRun = pending.slice(0, availableToday);

    const launched = [];
    for (const job of toRun) {
      this._startJob(job, ctx);
      launched.push(job);
    }

    return launched;
  }

  async _startJob(job, ctx) {
    job.status = JOB_STATUS.QUEUED;
    job.startedAt = new Date().toISOString();
    this.runningJobs.add(job.id);
    this._saveState();
    this._log('Job started', { jobId: job.id, channel: job.channel });

    // Run pipeline in background (don't await — let it run)
    this._executeJob(job, ctx).catch(err => {
      this._log('Job failed', { jobId: job.id, error: err.message });
      job.errors.push({ time: new Date().toISOString(), error: err.message });
    });
  }

  async _executeJob(job, ctx) {
    try {
      // Stage 1: Generate Hailuo video
      job.status = JOB_STATUS.GENERATING;
      this._saveState();

      const HailuoVideo = ctx.HailuoVideo || require('../hailuo');
      const TTSProvider = ctx.TTSProvider || require('../tts');
      const VideoEditor = ctx.VideoEditor || require('../edit/video-editor');
      const QCRunner = ctx.QCRunner || require('../qc/qc-runner');

      const channelCfg = CHANNELS[job.channel];
      const hailuo = new HailuoVideo({ model: channelCfg.hailuoModel });
      const tts = new TTSProvider(job.channel === 'productivity_worker' ? 'elevenlabs' : 'minimax');

      // Generate TTS first (to get word timings for subtitles)
      const ttsResult = await tts.generate(job.script, {
        voiceId: channelCfg.voiceId,
      });
      job.artifacts.ttsAudio = ttsResult.localPath || ttsResult.audioUrl;
      job.costEstimate += ttsResult.costCents || 0;

      // Generate video via Hailuo
      const videoResult = await hailuo.generate(job.script, {
        aspect_ratio: channelCfg.aspectRatio,
        resolution: '720p',
      });
      job.artifacts.rawVideo = videoResult.video_url;
      job.costEstimate += videoResult.costCents || 0;
      this.hailuoUsedToday++;

      // Stage 2: Edit
      job.status = JOB_STATUS.EDITING;
      this._saveState();

      const editor = new VideoEditor(job.channel);

      // If we have a local raw video file (not URL), trim and process it
      let editedVideo = job.artifacts.rawVideo;
      if (job.artifacts.rawVideo && !job.artifacts.rawVideo.startsWith('http')) {
        editedVideo = await editor.trim(job.artifacts.rawVideo, 0, videoResult.duration || 30);
      }

      // Add music if track specified
      const musicTrack = job.musicTrack || this._getDefaultMusic(job.channel);
      if (musicTrack && fs.existsSync(musicTrack)) {
        editedVideo = await editor.addMusic(editedVideo, musicTrack, 3);
      }

      // Add subtitles from TTS word timings
      if (ttsResult.wordTimings && ttsResult.wordTimings.length > 0) {
        const { cuesFromWordTimings } = require('../qc/qc-runner');
        const cues = cuesFromWordTimings(ttsResult.wordTimings);
        editedVideo = await editor.addSubtitles(editedVideo, cues);
      }

      job.artifacts.editedVideo = editedVideo;

      // Stage 3: QC
      job.status = JOB_STATUS.QC_PENDING;
      this._saveState();

      const qc = new QCRunner(job.channel);
      const primaryPlatform = job.platforms[0];
      const qcResult = await qc.run(editedVideo, {
        platform: primaryPlatform,
        title: job.title,
        skipHumanReview: true, // Auto-only in batch mode
      });
      job.qcResult = qcResult;

      const report = qc.printReport(qcResult);
      fs.writeFileSync(
        path.join(this.logDir, `${job.id}_qc_report.txt`),
        report, 'utf8'
      );

      if (!qcResult.summary.overallPass) {
        job.status = JOB_STATUS.QC_FAIL;
        job.errors.push({
          time: new Date().toISOString(),
          error: 'QC failed — blocking issues found',
          qcReport: `${job.id}_qc_report.txt`,
        });
        this._saveState();
        this._finalizeJob(job);
        return;
      }

      // Stage 4: Export per platform
      job.status = JOB_STATUS.EXPORTING;
      this._saveState();

      job.artifacts.exports = {};
      for (const platform of job.platforms) {
        const exported = editor.exportForPlatform(editedVideo, platform, {
          title: job.title,
          description: job.description,
        });
        job.artifacts.exports[platform] = exported;
      }

      // Stage 5: Upload
      job.status = JOB_STATUS.UPLOADING;
      this._saveState();

      const UploadDispatcher = ctx.UploadDispatcher || require('../upload');
      const uploader = new UploadDispatcher();
      job.artifacts.uploadResults = {};
      for (const platform of job.platforms) {
        try {
          const exportFile = job.artifacts.exports[platform];
          const result = await uploader.upload(exportFile, platform, {
            title: job.title,
            description: job.description,
          });
          job.artifacts.uploadResults[platform] = result;
        } catch (err) {
          job.artifacts.uploadResults[platform] = { error: err.message };
          job.errors.push({ time: new Date().toISOString(), platform, error: err.message });
        }
      }

      // Done
      job.status = JOB_STATUS.DONE;
      job.completedAt = new Date().toISOString();
      this._saveState();
      this._finalizeJob(job);
      this._log('Job completed', { jobId: job.id, platforms: job.platforms.join(', ') });
      this.emit('job:done', job);

    } catch (err) {
      job.attempts++;
      job.errors.push({ time: new Date().toISOString(), error: err.message, attempt: job.attempts });

      if (job.attempts >= job.maxAttempts) {
        job.status = JOB_STATUS.FAILED;
        job.completedAt = new Date().toISOString();
        this._saveState();
        this._finalizeJob(job);
        this._log('Job failed permanently', { jobId: job.id, attempts: job.attempts });
        this.emit('job:failed', job);
      } else {
        // Retry: exponential backoff
        job.status = JOB_STATUS.PENDING;
        this._saveState();
        this._log('Job retry scheduled', { jobId: job.id, attempt: job.attempts + 1, nextIn: `${Math.pow(2, job.attempts)}s` });
        setTimeout(() => this.runBatch(ctx), Math.pow(2, job.attempts) * 1000);
      }
    }
  }

  _finalizeJob(job) {
    this.runningJobs.delete(job.id);
  }

  _getDefaultMusic(channel) {
    // Return path to default music track for channel
    const tracks = {
      productivity_worker: 'assets/music/productivity_calm_72bpm.mp3',
      gen_z_success: 'assets/music/growth_energy_118bpm.mp3',
    };
    return tracks[channel] || null;
  }

  // ─── Stats & reporting ─────────────────────────────────────────────────────

  getStats() {
    const jobs = Array.from(this.jobs.values());
    const today = new Date().toISOString().slice(0, 10);
    const todayJobs = jobs.filter(j => j.createdAt.startsWith(today));
    const todayDone = todayJobs.filter(j => j.status === JOB_STATUS.DONE).length;

    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === JOB_STATUS.PENDING).length,
      running: this.runningJobs.size,
      done: jobs.filter(j => j.status === JOB_STATUS.DONE).length,
      failed: jobs.filter(j => j.status === JOB_STATUS.FAILED).length,
      qcFail: jobs.filter(j => j.status === JOB_STATUS.QC_FAIL).length,
      todayJobs,
      todayDone,
      dailyTarget: this.dailyLimit,
      dailyProgress: `${todayDone}/${this.dailyLimit}`,
      dailyPercent: Math.round((todayDone / this.dailyLimit) * 100),
      hailuoUsedToday: this.hailuoUsedToday,
      hailuoDailyLimit: this.hailuoMaxPerDay,
      totalCostEstimate: jobs.reduce((sum, j) => sum + (j.costEstimate || 0), 0),
    };
  }

  printDashboard() {
    const stats = this.getStats();
    const lines = [
      '\n=== TKP Production Dashboard ===',
      `Date: ${new Date().toISOString().slice(0, 10)}`,
      `Daily progress: ${stats.dailyProgress} (${stats.dailyPercent}%)`,
      `Total queue: ${stats.total} | Pending: ${stats.pending} | Running: ${stats.running}`,
      `Completed: ${stats.done} | Failed: ${stats.failed} | QC Fail: ${stats.qcFail}`,
      `Hailuo used today: ${stats.hailuoUsedToday}/${stats.hailuoDailyLimit}`,
      `Total cost estimate: $${(stats.totalCostEstimate / 100).toFixed(2)}`,
      '',
      '--- Job Status ---',
    ];

    const allJobs = this.getJobs();
    for (const j of allJobs.slice(0, 20)) {
      const icon = this._statusIcon(j.status);
      lines.push(`  ${icon} [${j.channel.slice(0, 3)}] ${j.id} — ${j.status} ${j.title ? `"${j.title.slice(0, 40)}"` : ''}`);
    }
    if (allJobs.length > 20) lines.push(`  ... and ${allJobs.length - 20} more`);

    console.log(lines.join('\n'));
    return lines.join('\n');
  }

  _statusIcon(status) {
    const icons = {
      [JOB_STATUS.PENDING]: '⏳',
      [JOB_STATUS.QUEUED]: '🚀',
      [JOB_STATUS.GENERATING]: '🎬',
      [JOB_STATUS.EDITING]: '✂️',
      [JOB_STATUS.QC_PENDING]: '🔍',
      [JOB_STATUS.QC_PASS]: '✅',
      [JOB_STATUS.QC_FAIL]: '❌',
      [JOB_STATUS.EXPORTING]: '📤',
      [JOB_STATUS.UPLOADING]: '🌐',
      [JOB_STATUS.DONE]: '🎉',
      [JOB_STATUS.FAILED]: '💥',
    };
    return icons[status] || '?';
  }

  // ─── Persistence ────────────────────────────────────────────────────────────

  _saveState() {
    try {
      const data = {
        version: 1,
        savedAt: new Date().toISOString(),
        hailuoUsedToday: this.hailuoUsedToday,
        lastResetDate: this.lastResetDate,
        jobs: Array.from(this.jobs.values()).map(j => j.toJSON()),
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      this._log('State save failed', { error: err.message });
    }
  }

  async _loadState() {
    if (!fs.existsSync(this.stateFile)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      this.hailuoUsedToday = data.hailuoUsedToday || 0;
      this.lastResetDate = data.lastResetDate;
      for (const obj of (data.jobs || [])) {
        const job = VideoJob.fromJSON(obj);
        this.jobs.set(job.id, job);
        if ([JOB_STATUS.GENERATING, JOB_STATUS.EDITING, JOB_STATUS.QC_PENDING, JOB_STATUS.EXPORTING, JOB_STATUS.UPLOADING, JOB_STATUS.QUEUED].includes(job.status)) {
          // Job was running when state was saved — mark as pending for retry
          job.status = JOB_STATUS.PENDING;
          job.errors.push({ time: new Date().toISOString(), error: 'Recovered from incomplete state' });
        }
      }
    } catch (err) {
      this._log('State load failed', { error: err.message });
    }
  }

  _resetDailyCountIfNewDay() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastResetDate !== today) {
      this.hailuoUsedToday = 0;
      this.lastResetDate = today;
      this._saveState();
      this._log('Daily Hailuo count reset', { date: today });
    }
  }

  _log(message, data = {}) {
    const entry = { time: new Date().toISOString(), message, ...data };
    const logFile = path.join(this.logDir, `production_${new Date().toISOString().slice(0, 10)}.json`);
    const existing = [];
    if (fs.existsSync(logFile)) {
      try { existing.push(...JSON.parse(fs.readFileSync(logFile, 'utf8'))); } catch (_) {}
    }
    existing.push(entry);
    fs.writeFileSync(logFile, JSON.stringify(existing, null, 2), 'utf8');
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = { ProductionQueue, VideoJob, JOB_STATUS, CHANNELS };
