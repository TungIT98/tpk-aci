/**
 * lib/scaling.js
 * Production scaling infrastructure for 1000 videos / 30 days.
 *
 * Key bottleneck: Hailuo film.03 free tier = 3 videos/day.
 * To hit 1000 videos in 30 days (~33/day), paid tier is REQUIRED.
 *
 * Architecture:
 *   VideoQueue → BatchScheduler → HailuoRateLimiter → ParallelPipeline → MetricsTracker
 *
 * Usage:
 *   import { ProductionScaler } from './lib/scaling.js';
 *   const scaler = new ProductionScaler({ targetVideos: 1000, days: 30 });
 *   await scaler.run();
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
  try {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();

// ---------------------------------------------------------------------------
// ProductionScaler
// ---------------------------------------------------------------------------

/**
 * ProductionScaler — orchestrates scaled video production.
 *
 * @param {object} opts
 * @param {number} opts.targetVideos  — Total videos to produce (default 1000)
 * @param {number} opts.days          — Days to complete in (default 30)
 * @param {string} opts.outputDir     — Where to write queue state (default ./output/queue)
 */
export class ProductionScaler {
  constructor({
    targetVideos  = 1000,
    days          = 30,
    outputDir     = resolve(__dirname, '..', 'output'),
  } = {}) {
    this.targetVideos  = targetVideos;
    this.days          = days;
    this.outputDir     = outputDir;
    this.queueDir      = resolve(outputDir, 'queue');
    this.metricsPath   = resolve(outputDir, 'metrics.json');
    this.logDir        = resolve(outputDir, 'logs');

    // Derived targets
    this.videosPerDay    = Math.ceil(targetVideos / days);
    this.hailuoDailyCap  = parseInt(env.HAILUO_DAILY_CAP || '3', 10);  // free tier = 3
    this.requiresPaidTier = this.videosPerDay > this.hailuoDailyCap;

    // State
    this.queue    = [];   // pending videos
    this.done     = [];   // completed videos
    this.failed   = [];   // failed videos
    this.metrics  = { startedAt: null, lastUpdated: null, dailyStats: {} };

    // Rate limiter
    this.rateLimiter = new HailuoRateLimiter({ dailyCap: this.hailuoDailyCap });

    // Pipeline (lazy-loaded)
    this._pipeline = null;

    this._ensureDirs();
  }

  _ensureDirs() {
    for (const d of [this.outputDir, this.queueDir, this.logDir]) {
      if (!existsSync(d)) mkdirSync(d, { recursive: true });
    }
  }

  _loadPipeline() {
    if (!this._pipeline) {
      // Lazy import to avoid circular deps
      const { VideoPipeline } = await import('./video-pipeline.js').catch(() => ({ VideoPipeline: null }));
      if (!VideoPipeline) {
        throw new Error('video-pipeline.js not found — run TKP-35 pilot first');
      }
      this._pipeline = new VideoPipeline();
    }
    return this._pipeline;
  }

  // -------------------------------------------------------------------------
  // Queue Management
  // -------------------------------------------------------------------------

  /**
   * Add a video job to the queue.
   */
  enqueue({ channel, topic, angle, preset = 'fast', priority = 0 }) {
    const job = {
      id:        `vid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      channel,
      topic,
      angle,
      preset,
      priority,   // higher = runs first
      status:     'pending',
      enqueuedAt: new Date().toISOString(),
      attempts:   0,
    };
    this.queue.push(job);
    this._saveQueue();
    return job;
  }

  /**
   * Pop the next job from the queue (highest priority first).
   */
  _dequeue() {
    if (this.queue.length === 0) return null;
    // Sort by priority desc, then enqueuedAt asc
    this.queue.sort((a, b) => b.priority - a.priority || new Date(a.enqueuedAt) - new Date(b.enqueuedAt));
    return this.queue.shift();
  }

  /**
   * Mark a job as done.
   */
  _complete(job, result) {
    job.status     = 'done';
    job.completedAt = new Date().toISOString();
    job.result     = result;
    this.done.push(job);
    this._saveQueue();
    this._updateMetrics(job);
  }

  /**
   * Mark a job as failed.
   */
  _fail(job, error) {
    job.status    = 'failed';
    job.failedAt  = new Date().toISOString();
    job.error     = error.message ?? String(error);
    job.attempts++;
    // Re-queue if retries remain
    if (job.attempts < 3) {
      this.queue.push(job);
    } else {
      this.failed.push(job);
    }
    this._saveQueue();
  }

  // -------------------------------------------------------------------------
  // Rate Limiter
  // -------------------------------------------------------------------------

  /**
   * Wait until the Hailuo rate limiter allows the next generation.
   * Returns false if the daily cap would be exceeded.
   */
  async _waitForRateLimit() {
    const now = new Date();
    const canRun = this.rateLimiter.canGenerate(now);
    if (!canRun) {
      const waitMs = this.rateLimiter.msUntilReset(now);
      const waitHours = (waitMs / (1000 * 60 * 60)).toFixed(1);
      console.log(`[RateLimiter] Daily cap reached. Resets in ~${waitHours}h.`);
      // If paid tier, this shouldn't happen — flag it
      if (this.requiresPaidTier) {
        console.warn(`[ScalingAlert] PAID TIER REQUIRED: ${this.videosPerDay}/day needed, ${this.hailuoDailyCap}/day cap.`);
      }
      // Don't wait — return false so caller knows to pause
      return false;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Batch Processing
  // -------------------------------------------------------------------------

  /**
   * Process N videos from the queue.
   *
   * @param {number} count  — Max videos to process (default: videosPerDay target)
   * @returns {Promise<object>} — { processed, succeeded, failed }
   */
  async processBatch(count = this.videosPerDay) {
    const pipeline = await this._loadPipeline();
    const results = { processed: 0, succeeded: 0, failed: 0 };

    for (let i = 0; i < count; i++) {
      const job = this._dequeue();
      if (!job) {
        console.log(`[Batch] Queue empty after ${i} jobs.`);
        break;
      }

      // Check rate limit
      const canProceed = await this._waitForRateLimit();
      if (!canProceed) {
        // Put job back and stop this batch
        this.queue.unshift(job);
        console.log(`[Batch] Rate limit hit. Stopping. ${this.queue.length} jobs remain.`);
        break;
      }

      console.log(`[Batch] Processing ${job.id}: ${job.channel} / "${job.topic}"`);
      this.rateLimiter.record(new Date());

      try {
        const result = await pipeline.run({
          channel: job.channel,
          topic:   job.topic,
          angle:   job.angle,
          preset:  job.preset,
        });
        this._complete(job, result);
        results.succeeded++;
      } catch (err) {
        this._fail(job, err);
        results.failed++;
        console.error(`[Batch] ${job.id} failed: ${err.message}`);
      }

      results.processed++;
    }

    return results;
  }

  /**
   * Run the full production campaign.
   * Processes batches daily until target is reached.
   */
  async run() {
    console.log('=== ProductionScaler starting ===');
    console.log(`Target: ${this.targetVideos} videos in ${this.days} days (${this.videosPerDay}/day)`);
    console.log(`Hailuo daily cap: ${this.hailuoDailyCap} (free tier)`);
    console.log(`Paid tier required: ${this.requiresPaidTier ? 'YES — contact MiniMax' : 'No'}`);

    if (this.requiresPaidTier) {
      console.error('[CRITICAL] Cannot hit target with free tier. Paid tier required.');
      console.error(`  Required: ${this.videosPerDay}/day | Current cap: ${this.hailuoDailyCap}/day`);
    }

    this.metrics.startedAt = new Date().toISOString();
    let day = 1;

    while (this.done.length < this.targetVideos) {
      const dayLabel = `day_${day}`;
      console.log(`\n=== Day ${day} ===`);
      const before = this.done.length;

      const dayResult = await this.processBatch(this.videosPerDay);

      const produced = this.done.length - before;
      this.metrics.dailyStats[dayLabel] = {
        date:          new Date().toISOString(),
        produced,
        succeeded:     dayResult.succeeded,
        failed:        dayResult.failed,
        cumulativeDone: this.done.length,
        cumulativeFailed: this.failed.length,
        queueRemaining: this.queue.length,
      };

      this._saveMetrics();
      console.log(`Day ${day}: ${produced} videos produced. Total: ${this.done.length}/${this.targetVideos}`);

      if (produced === 0 && this.queue.length === 0) {
        console.error('[CRITICAL] No jobs processed and queue is empty. Stopping.');
        break;
      }

      day++;
      if (day > this.days) {
        console.warn(`[WARNING] Deadline reached. ${this.done.length}/${this.targetVideos} completed.`);
        break;
      }
    }

    if (this.done.length >= this.targetVideos) {
      console.log(`\n=== TARGET REACHED: ${this.done.length} videos ===`);
    }

    return this.getSummary();
  }

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  _updateMetrics(job) {
    this.metrics.lastUpdated = new Date().toISOString();
  }

  _saveQueue() {
    writeFileSync(
      resolve(this.queueDir, 'queue-state.json'),
      JSON.stringify({ queue: this.queue, done: this.done, failed: this.failed }, null, 2)
    );
  }

  _saveMetrics() {
    writeFileSync(this.metricsPath, JSON.stringify(this.metrics, null, 2));
  }

  getSummary() {
    return {
      target:        this.targetVideos,
      completed:      this.done.length,
      failed:        this.failed.length,
      inQueue:       this.queue.length,
      daysElapsed:   this.metrics.dailyStats ? Object.keys(this.metrics.dailyStats).length : 0,
      avgPerDay:     this.done.length / Math.max(1, Object.keys(this.metrics.dailyStats).length),
      onTrack:       this.done.length >= (this.videosPerDay * Object.keys(this.metrics.dailyStats || {}).length),
      paidTierRequired: this.requiresPaidTier,
    };
  }
}

// ---------------------------------------------------------------------------
// HailuoRateLimiter
// ---------------------------------------------------------------------------

/**
 * Tracks Hailuo API usage to respect daily generation caps.
 *
 * Free tier: 3/day
 * Paid tier (HAILUO_DAILY_CAP env): configurable
 */
export class HailuoRateLimiter {
  /**
   * @param {object} opts
   * @param {number} opts.dailyCap  — Max generations per day (default 3)
   */
  constructor({ dailyCap = 3 } = {}) {
    this.dailyCap  = dailyCap;
    this.todayDate = null;  // reset tracker when day changes
    this.todayCount = 0;
    this.generations = [];  // timestamps of all generations today
  }

  /**
   * Record a generation.
   */
  record(timestamp = new Date()) {
    const dateKey = this._dateKey(timestamp);
    if (dateKey !== this.todayDate) {
      this.todayDate  = dateKey;
      this.todayCount = 0;
      this.generations = [];
    }
    this.generations.push(timestamp);
    this.todayCount++;
  }

  /**
   * Check if we can generate now.
   */
  canGenerate(now = new Date()) {
    this._pruneOld(now);
    return this.todayCount < this.dailyCap;
  }

  /**
   * Milliseconds until the daily cap resets (midnight UTC).
   */
  msUntilReset(now = new Date()) {
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    return midnight.getTime() - now.getTime();
  }

  /**
   * How many generations remaining today.
   */
  remaining(now = new Date()) {
    this._pruneOld(now);
    return Math.max(0, this.dailyCap - this.todayCount);
  }

  _pruneOld(now) {
    const dateKey = this._dateKey(now);
    if (dateKey !== this.todayDate) {
      this.todayDate  = dateKey;
      this.todayCount = 0;
      this.generations = [];
    }
  }

  _dateKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = parseInt(process.argv[2] || '1000', 10);
  const days   = parseInt(process.argv[3] || '30',   10);
  console.log(`ProductionScaler: ${target} videos in ${days} days (${Math.ceil(target/days)}/day)`);
  console.log('Note: Call .run() from an async context with a populated queue.');
  console.log('  const scaler = new ProductionScaler({ targetVideos: 1000, days: 30 });');
  console.log('  scaler.enqueue({ channel: "productivity_worker", topic: "..." });');
  console.log('  await scaler.run();');
}
