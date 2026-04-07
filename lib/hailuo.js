/**
 * lib/hailuo.js
 * Hailuo AI video generation integration via MiniMax API.
 *
 * MiniMax Video API docs: https://api.minimax.io/docs/guide/others/video
 * Valid models: MiniMax-Hailuo-2.3, MiniMax-Hailuo-02, T2V-01-Director
 * (film.03 is NOT a valid model name — use MiniMax-Hailuo-2.3)
 *
 * Usage:
 *   import { HailuoVideo } from './lib/hailuo.js';
 *   const hailuo = new HailuoVideo();
 *   const job = await hailuo.generate({ prompt: '...', model: 'film.03' });
 */

import { readFileSync } from 'fs';
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
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
    return env;
  } catch {
    // fallback to process.env
    return process.env;
  }
}

const env = loadEnv();

export const MINIMAX_BASE_URL     = env.MINIMAX_BASE_URL     || 'https://api.minimax.io';
export const ANTHROPIC_TOKEN_KEY  = env.ANTHROPIC_TOKEN_KEY || '';
// MINIMAX_API_KEY is the native API key (sk-api-...) — use for Hailuo video generation
export const MINIMAX_API_KEY      = env.MINIMAX_API_KEY     || ANTHROPIC_TOKEN_KEY || '';
export const DAILY_VIDEO_LIMIT   = 3;

// ---------------------------------------------------------------------------
// Cost tracking
// ---------------------------------------------------------------------------

/**
 * Tracks approximate cost per model. These are estimates — verify against
 * current MiniMax pricing. film.03 is a paid model; current estimate ~$0.05
 * per generation, subject to length.
 */
export const VIDEO_COST_ESTIMATE_USD = {
  'film.03-standard': 0.05,
  'film.03-fast':     0.03,
};

/**
 * Simple in-memory cost tracker. Persists across calls within a session.
 * For durable tracking, append to logs/hailuo-costs.md.
 */
export class CostTracker {
  constructor(logPath = resolve(__dirname, '..', 'logs', 'hailuo-costs.md')) {
    this.logPath = logPath;
    this.totalUsd = 0;
    this.count = 0;
  }

  record(model, costUsd = VIDEO_COST_ESTIMATE_USD[model] ?? 0.05) {
    this.totalUsd += costUsd;
    this.count++;
  }

  summary() {
    return {
      totalGenerations: this.count,
      totalEstimatedUsd: this.totalUsd,
    };
  }
}

// ---------------------------------------------------------------------------
// Prompt Templates
// ---------------------------------------------------------------------------

/**
 * Prompt templates for different content types.
 * Hailuo film.03 works best with vivid, visual descriptions.
 */
export const PROMPT_TEMPLATES = {
  /** Productivity Worker channel — office/workspace visual */
  productivity_worker: {
    intro: (topic) =>
      `Cinematic wide shot of a modern office workspace, soft natural lighting. ` +
      `A professional worker at a standing desk, focused and productive. ` +
      `Dynamic camera push-in. Topic: ${topic}.`,
    body: (point) =>
      `Over-the-shoulder shot transitioning to a close-up of notepad and coffee. ` +
      `Text overlay appears: "${point}". Smooth zoom transition.`,
    hook: (question) =>
      `Eye-level tracking shot along a busy office corridor. ` +
      `Bold text overlay: "${question}". Professional lighting, warm tone.`,
    cta: () =>
      `Wide establishing shot slowly pulling back. ` +
      `Text overlay: "Subscribe for more productivity tips." Fade to black.`,
  },

  /** Gen Z Success channel — energetic, modern, social-media feel */
  gen_z_success: {
    intro: (topic) =>
      `Fast-paced montage: phone screen, coffee shop, sunrise timelapse. ` +
      `Quick zoom into a laptop screen. Topic: ${topic}. Energetic cuts.`,
    body: (point) =>
      `Quick cuts between TikTok-style text overlays and b-roll footage. ` +
      `Bright, punchy. Text: "${point}". 2-second cuts.`,
    hook: (question) =>
      `Dramatic slow-motion close-up of a surprised face, then quick cut to ` +
      `phone showing "${question}". High energy. Vertical format ready.`,
    cta: () =>
      `Rapid-fire text overlay: "Follow for more! 🔥" + channel name. ` +
      `Warp-speed transition. Vertical 9:16 format.`,
  },

  /** Neutral template — works for either channel with customization */
  neutral: {
    intro: (topic) =>
      `Professional studio lighting, clean background. ` +
      `Topic: ${topic}. Camera slowly pushes in.`,
    body: (point) =>
      `B-roll cutaway: relevant imagery illustrating "${point}". ` +
      `Clean text overlay. 3-second hold.`,
    hook: (question) =>
      `Direct address to camera: "${question}" in bold text. ` +
      `Confident energy. Eye contact with lens.`,
    cta: () =>
      `End screen: subscribe button suggestion + related video preview. ` +
      `Channel watermark in corner.`,
  },
};

// ---------------------------------------------------------------------------
// Generation Settings
// ---------------------------------------------------------------------------

/**
 * Generation quality presets for video models.
 * NOTE: `film.03` is NOT a valid model name — use `MiniMax-Hailuo-2.3`.
 * Valid models: MiniMax-Hailuo-2.3, MiniMax-Hailuo-02, T2V-01-Director, T2V-01
 */
export const GENERATION_PRESETS = {
  /** 2x faster generation — good for previews */
  fast: {
    model:       'MiniMax-Hailuo-2.3',
    resolution:  '720P',
    duration:    6,    // seconds
  },
  /** Standard quality — use for final production videos */
  standard: {
    model:       'MiniMax-Hailuo-2.3',
    resolution:  '1080P',
    duration:    10,   // seconds
  },
};

// ---------------------------------------------------------------------------
// HailuoVideo class
// ---------------------------------------------------------------------------

export class HailuoVideo {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey  — defaults to ANTHROPIC_TOKEN_KEY from .env
   * @param {string} opts.baseUrl — defaults to MINIMAX_BASE_URL from .env
   */
  constructor({ apiKey = MINIMAX_API_KEY, baseUrl = MINIMAX_BASE_URL } = {}) {
    if (!apiKey) throw new Error('HailuoVideo: No API key provided. Set MINIMAX_API_KEY in .env');
    this.apiKey  = apiKey;
    this.baseUrl = baseUrl;
    this.costTracker = new CostTracker();
  }

  // -------------------------------------------------------------------------
  // Core API call
  // -------------------------------------------------------------------------

  /**
   * Submit a video generation job.
   *
   * @param {object}   opts
   * @param {string}   opts.prompt       — Text description of the video scene
   * @param {string}   [opts.model]      — Model name, default 'MiniMax-Hailuo-2.3'. Valid: MiniMax-Hailuo-2.3, MiniMax-Hailuo-02, T2V-01-Director, T2V-01. NOTE: 'film.03' is NOT valid.
   * @param {string}   [opts.aspect_ratio] — '16:9' | '9:16' | '1:1', default '16:9'
   * @param {number}   [opts.duration]    — Video length in seconds, default 6
   * @param {string}   [opts.callback_url] — Optional webhook for async notification
   * @returns {Promise<object>}          — { status, task_id, ... }
   */
  async generate({ prompt, model = 'MiniMax-Hailuo-2.3', aspect_ratio = '16:9', duration = 6, callback_url }) {
    const body = {
      model,
      prompt,
      aspect_ratio,
      duration,
    };
    if (callback_url) body.callback_url = callback_url;

    const res = await fetch(`${this.baseUrl}/v1/video_generation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hailuo generate failed: ${res.status} ${res.statusText} — ${text}`);
    }

    const data = await res.json();
    return data;
  }

  // -------------------------------------------------------------------------
  // Polling helpers
  // -------------------------------------------------------------------------

  /**
   * Poll a generation task until completion or failure.
   *
   * @param {string}   taskId
   * @param {object}   [opts]
   * @param {number}   [opts.maxWaitMs]   — Max total wait time, default 10 min
   * @param {number}   [opts.pollIntervalMs] — Poll every N ms, default 15 000
   * @returns {Promise<object>}            — Final task object with video URL
   */
  async waitForCompletion(taskId, {
    maxWaitMs        = 10 * 60 * 1000,
    pollIntervalMs   = 15_000,
  } = {}) {
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const status = await this.getTaskStatus(taskId);

      if (status.status === 'completed') {
        return status;
      }
      if (status.status === 'failed') {
        throw new Error(`Hailuo task ${taskId} failed: ${JSON.stringify(status)}`);
      }

      // Still processing — wait and retry
      await this._sleep(pollIntervalMs);
    }

    throw new Error(`Hailuo task ${taskId} timed out after ${maxWaitMs}ms`);
  }

  /**
   * Map MiniMax API status values to hailuo internal values.
   * API returns: Preparing | Queueing | Processing | Success | Fail
   * Internal: pending | processing | completed | failed
   */
  _mapStatus(apiStatus) {
    const map = {
      'Preparing':  'pending',
      'Queueing':   'pending',
      'Processing': 'processing',
      'Success':   'completed',
      'Fail':      'failed',
    };
    return map[apiStatus] ?? apiStatus;
  }

  /**
   * Get the status of a generation task.
   *
   * @param {string} taskId
   * @returns {Promise<object>} — mapped status object with video_url if completed
   */
  async getTaskStatus(taskId) {
    const res = await fetch(`${this.baseUrl}/v1/query/video_generation?task_id=${taskId}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hailuo status check failed: ${res.status} — ${text}`);
    }

    const data = await res.json();

    // Map API status to internal status
    const mapped = { ...data, status: this._mapStatus(data.status) };

    // If completed, fetch video URL via file_id
    if (mapped.status === 'completed' && data.file_id) {
      try {
        const videoData = await this.getVideoUrl(data.file_id);
        mapped.video_url = videoData.download_url ?? videoData.url;
        mapped.file_id   = data.file_id;
        mapped.video_width  = data.video_width;
        mapped.video_height = data.video_height;
      } catch (err) {
        // Non-fatal: still return completed status even if URL fetch fails
        mapped._videoUrlError = err.message;
      }
    }

    return mapped;
  }

  /**
   * Retrieve a video download URL by file_id.
   *
   * @param {string|number} fileId — file_id from getTaskStatus response
   * @returns {Promise<object>} — { download_url, file_id, filename, ... }
   */
  async getVideoUrl(fileId) {
    const res = await fetch(`${this.baseUrl}/v1/files/retrieve?file_id=${fileId}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Hailuo getVideoUrl failed: ${res.status} — ${text}`);
    }

    return res.json();
  }

  // -------------------------------------------------------------------------
  // High-level convenience methods
  // -------------------------------------------------------------------------

  /**
   * Generate a video with automatic retry on transient failures.
   *
   * @param {object} opts — Same as generate() + { maxRetries }
   * @returns {Promise<object>}
   */
  async generateWithRetry(opts, maxRetries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.generate(opts);
        this.costTracker.record(opts.model ?? 'film.03');
        return result;
      } catch (err) {
        lastError = err;
        // Only retry on potentially transient errors (5xx, network)
        if (!err.message.includes(' 5') && !err.message.includes('fetch failed')) {
          throw err;
        }
        if (attempt < maxRetries) {
          const backoffMs = (attempt + 1) * 5000;
          console.warn(`Hailuo generate attempt ${attempt + 1} failed, retrying in ${backoffMs}ms...`);
          await this._sleep(backoffMs);
        }
      }
    }
    throw lastError;
  }

  /**
   * Full generate + poll pipeline. Returns the completed video object.
   *
   * @param {object} opts
   * @returns {Promise<object>} — { task_id, video_url, status, ... }
   */
  async generateVideo(opts) {
    const task = await this.generateWithRetry(opts);

    // Check for billing/credit errors even when HTTP status is 200
    // The status_code is nested inside base_resp: { task_id, base_resp: { status_code, status_msg } }
    const billingCode = task.base_resp?.status_code ?? task.status_code;
    const billingMsg  = task.base_resp?.status_msg ?? task.status_msg;
    if (billingCode === 1008 || String(billingMsg).includes('insufficient')) {
      const err = new Error(`MiniMax billing error: ${billingMsg} (code ${billingCode})`);
      err.code = 'INSUFFICIENT_BALANCE';
      throw err;
    }

    // If response already contains video (sync), return directly
    if (task.video_url || task.video?.url) {
      return task;
    }
    // Otherwise poll
    const taskId = task.task_id ?? task.id;
    return this.waitForCompletion(taskId);
  }

  // -------------------------------------------------------------------------
  // Batch Generation
  // -------------------------------------------------------------------------

  /**
   * Load today's generation count from the persistent cost log.
   * Returns 0 if no entry exists for today.
   * @returns {Promise<{count: number, date: string}>}
   */
  async _loadDailyCount() {
    const { existsSync, readFileSync } = await import('fs');
    const logPath = this.costTracker.logPath;
    if (!existsSync(logPath)) return { count: 0, date: this._todayStr() };

    const content = readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const today = this._todayStr();
    // Last non-header line with today's date is the current count
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;
      // Format: YYYY-MM-DD | N | $X.XX
      const match = line.match(/^(\d{4}-\d{2}-\d{2})\s+\|\s*(\d+)\s*\|/);
      if (match) {
        return { count: parseInt(match[2], 10), date: match[1] };
      }
    }
    return { count: 0, date: today };
  }

  /**
   * Append a new daily tally row to logs/hailuo-costs.md.
   * Called after each successful generation.
   */
  async _appendCostLog(model, costUsd) {
    const { existsSync, readFileSync, appendFileSync, mkdirSync } = await import('fs');
    const logPath = this.costTracker.logPath;
    const dir = logPath.replace(/[/\\][^/\\]+$/, '');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const today = this._todayStr();
    const entry = `${today} | 1 | $${costUsd.toFixed(4)}\n`;

    if (!existsSync(logPath)) {
      // Write header
      appendFileSync(logPath, `# Hailuo/MiniMax Video Generation Cost Log\n# Date     | Count | Est. Cost\n# ---------+-------+-----------\n`, 'utf-8');
    }
    appendFileSync(logPath, entry, 'utf-8');
  }

  _todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Sleep helper.
   * @param {number} ms
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate multiple videos with rate limiting and daily cap enforcement.
   *
   * MiniMax free tier: 3 video generations/day. This method tracks usage
   * persistently in logs/hailuo-costs.md and queues excess for the next day.
   *
   * @param {Array<object>} prompts  — Array of { prompt, model?, aspect_ratio?, duration? }
   * @param {object}     [opts]
   * @param {number}     [opts.maxConcurrent]          — Max simultaneous submissions (default 1)
   * @param {boolean}    [opts.waitForCompletion]      — Poll until each video is done (default true)
   * @param {number}     [opts.maxWaitMsPerVideo=600000] — Max poll wait per video (default 10 min)
   * @param {number}     [opts.pollIntervalMs=15000]   — Poll interval
   * @returns {Promise<Array<object>>} — Array of result objects
   */
  async batch_generate(prompts, {
    maxConcurrent         = 1,
    waitForCompletion    = true,
    maxWaitMsPerVideo    = 600_000,
    pollIntervalMs       = 15_000,
  } = {}) {
    const results = [];
    let { count: usedToday, date } = await this._loadDailyCount();
    const today = this._todayStr();

    // Reset count if it's a new day
    if (date !== today) {
      usedToday = 0;
    }

    const availableNow = Math.max(0, DAILY_VIDEO_LIMIT - usedToday);

    // Separate into immediate (within daily cap) and queued (excess)
    const immediatePrompts = prompts.slice(0, availableNow);
    const queuedPrompts     = prompts.slice(availableNow);

    // Helper: exponential backoff retry for a single generate call
    async function generateWithBackoff(hailuo, opts, maxRetries = 3) {
      let lastError;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await hailuo.generate(opts);
        } catch (err) {
          lastError = err;
          const is5xx = /^[45]\d\d/.test(err.message) || err.message.includes(' 5') || err.message.includes('fetch failed');
          if (!is5xx || attempt === maxRetries) throw err;
          const backoffMs = Math.min(30000, (2 ** attempt) * 2000);
          console.warn(`[Hailuo] attempt ${attempt + 1} failed (${err.message}), retrying in ${backoffMs}ms...`);
          await hailuo._sleep(backoffMs);
        }
      }
      throw lastError;
    }

    // Process immediate prompts with concurrency limit
    const running = [];
    for (const p of immediatePrompts) {
      const model = p.model ?? 'MiniMax-Hailuo-2.3';
      const costUsd = VIDEO_COST_ESTIMATE_USD[model] ?? 0.05;

      const pResolve = (async () => {
        try {
          const task = await generateWithBackoff(this, p);
          // Record in memory and persist to log
          this.costTracker.record(model, costUsd);
          await this._appendCostLog(model, costUsd);

          const taskId = task.task_id ?? task.id;

          if (waitForCompletion && taskId) {
            try {
              const finalStatus = await this.waitForCompletion(taskId, {
                maxWaitMs:      maxWaitMsPerVideo,
                pollIntervalMs,
              });
              return {
                task_id:   taskId,
                status:    'completed',
                video_url: finalStatus.video_url,
                model,
                estimated_cost_usd: costUsd,
              };
            } catch (pollErr) {
              return { task_id: taskId, status: 'poll_failed', error: pollErr.message, model, estimated_cost_usd: costUsd };
            }
          } else {
            return { task_id: taskId ?? null, status: 'submitted', model, estimated_cost_usd: costUsd };
          }
        } catch (err) {
          return { task_id: null, status: 'failed', error: err.message, model, estimated_cost_usd: costUsd };
        }
      })();

      running.push(pResolve);

      if (running.length >= maxConcurrent) {
        const result = await running.shift();
        results.push(await result);
      }
    }

    // Drain remaining concurrent slots
    while (running.length > 0) {
      results.push(await running.shift());
    }

    // Queue excess prompts for next-day processing
    for (const p of queuedPrompts) {
      results.push({
        task_id: null,
        status:  'queued',
        prompt:  p.prompt,
        model:   p.model ?? 'MiniMax-Hailuo-2.3',
        message: `Queued: daily cap of ${DAILY_VIDEO_LIMIT} reached. Will process when quota resets.`,
      });
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /**
   * Build a prompt from a template type and parameters.
   *
   * @param {string} channelType  — 'productivity_worker' | 'gen_z_success' | 'neutral'
   * @param {string} section      — 'intro' | 'body' | 'hook' | 'cta'
   * @param {string} content      — The variable content (topic, point, question)
   */
  buildPrompt(channelType, section, content) {
    const templates = PROMPT_TEMPLATES[channelType] ?? PROMPT_TEMPLATES.neutral;
    const fn = templates[section];
    if (!fn) throw new Error(`Unknown prompt section: ${section}`);
    return fn(content);
  }

  costSummary() {
    return this.costTracker.summary();
  }

  /**
   * Current batch queue status (in-memory only — resets on server restart).
   * For persistent tracking, see logs/hailuo-costs.md.
   */
  batchStatus() {
    return {
      daily_limit:    DAILY_VIDEO_LIMIT,
      daily_used:    this.costTracker.count,
      daily_remaining: Math.max(0, DAILY_VIDEO_LIMIT - this.costTracker.count),
      total_cost_usd: this.costTracker.totalUsd,
    };
  }
}

// ---------------------------------------------------------------------------
// MiniMax Image Generation
// ---------------------------------------------------------------------------

export const IMAGE_MODELS = {
  image01: 'image-01',   // most capable, 200/day free tier
  image02: 'image-02',   // faster / lower cost when available
};

export const IMAGE_ASPECT_RATIOS = {
  '1:1':   { width: 1024, height: 1024 },
  '16:9':  { width: 1280, height: 720  },
  '9:16':  { width: 720,  height: 1280  },
  '4:3':   { width: 1024, height: 768   },
  '3:4':   { width: 768,  height: 1024  },
};

export class MiniMaxImage {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey   — defaults to ANTHROPIC_TOKEN_KEY from .env
   * @param {string} opts.baseUrl  — defaults to MINIMAX_BASE_URL from .env
   */
  constructor({ apiKey = MINIMAX_API_KEY, baseUrl = MINIMAX_BASE_URL } = {}) {
    if (!apiKey) throw new Error('MiniMaxImage: No API key. Set MINIMAX_API_KEY in .env');
    this.apiKey  = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Generate image(s) via MiniMax Image API.
   *
   * @param {object}   opts
   * @param {string}   opts.prompt        — Text description of the desired image
   * @param {string}   [opts.model]       — Model name, default 'image-01'
   * @param {string}   [opts.aspect_ratio] — '1:1' | '16:9' | '9:16' | '4:3' | '3:4', default '1:1'
   * @param {number}   [opts.num_images]  — Number of images to generate (1–4), default 1
   * @returns {Promise<object>}            — { images: [{url, ...}], ... }
   */
  async generate({ prompt, model = 'image-01', aspect_ratio = '1:1', num_images = 1 }) {
    const body = {
      model,
      prompt,
      num_images: Math.min(Math.max(num_images, 1), 4),
    };

    // Resolution is optional; MiniMax accepts aspect_ratio directly
    if (aspect_ratio && IMAGE_ASPECT_RATIOS[aspect_ratio]) {
      body.aspect_ratio = aspect_ratio;
    }

    const res = await fetch(`${this.baseUrl}/v1/image_generation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MiniMaxImage generate failed: ${res.status} ${res.statusText} — ${text}`);
    }

    return res.json();
  }

  /**
   * Download a generated image URL to a local file path.
   *
   * @param {string} imageUrl  — URL of the generated image
   * @param {string} destPath  — Local destination path
   * @returns {Promise<Buffer>} — Image buffer
   */
  async downloadImage(imageUrl, destPath) {
    const { writeFileSync } = await import('fs');
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(destPath, buf);
    return buf;
  }

  /**
   * High-level: generate and save image to disk.
   *
   * @param {object} opts
   * @returns {Promise<{ localPath: string, width: number, height: number }>}
   */
  async generateAndSave({ prompt, model, aspect_ratio, num_images, outputDir, filename }) {
    const result = await this.generate({ prompt, model, aspect_ratio, num_images });
    const images = result.data ?? result.images ?? [result];
    const saved = [];

    const dir = outputDir ?? resolve(__dirname, '..', 'output', 'images');
    const { mkdirSync } = await import('fs');
    mkdirSync(dir, { recursive: true });

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const ext = (img.url ?? '').includes('.png') ? '.png' : '.jpg';
      const path = resolve(dir, filename ?? `minimax_img_${Date.now()}_${i}${ext}`);
      await this.downloadImage(img.url, path);
      saved.push({
        localPath: path,
        width: img.width ?? IMAGE_ASPECT_RATIOS[aspect_ratio]?.width ?? 1024,
        height: img.height ?? IMAGE_ASPECT_RATIOS[aspect_ratio]?.height ?? 1024,
        url: img.url,
      });
    }

    return num_images === 1 ? saved[0] : saved;
  }
}

// ---------------------------------------------------------------------------
// MiniMax Video-to-Video
// ---------------------------------------------------------------------------

/**
 * Video-to-Video API status: NOT AVAILABLE.
 *
 * MiniMax's video generation API (as of 2026-03) supports:
 *   - Text-to-Video (T2V): Hailuo 2.3, Hailuo 02
 *   - Image-to-Video (I2V): Hailuo 2.3, Hailuo 2.3Fast, Hailuo 02
 *
 * There is NO video-to-video (V2V) endpoint in the MiniMax API.
 * Track this via: https://platform.minimax.io/docs
 *
 * Workaround: Use I2V with a video-frame extraction → image → I2V pipeline.
 */
export class MiniMaxVideoToVideo {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey  — defaults to ANTHROPIC_TOKEN_KEY from .env
   * @param {string} opts.baseUrl — defaults to MINIMAX_BASE_URL from .env
   */
  constructor({ apiKey = MINIMAX_API_KEY, baseUrl = MINIMAX_BASE_URL } = {}) {
    if (!apiKey) throw new Error('MiniMaxVideoToVideo: No API key. Set MINIMAX_API_KEY in .env');
    this.apiKey  = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * video_to_video — NOT SUPPORTED by MiniMax API.
   *
   * @throws {Error} Always throws, noting the API limitation.
   */
  async generate({ videoUrl, prompt, model, duration }) {
    throw new Error(
      'MiniMaxVideoToVideo: video-to-video generation is not supported by the MiniMax API. ' +
      'Supported video modes are: Text-to-Video (T2V) and Image-to-Video (I2V). ' +
      'To animate an existing video, extract key frames → HailuoVideo/I2V → reassemble.'
    );
  }

  /**
   * Alternative: extract frames and animate via I2V.
   *
   * @param {string} videoUrl    — Source video URL
   * @param {string} prompt      — Motion description for I2V
   * @param {number} [fps=1]     — Frames per second to extract
   * @param {number} [numFrames=5] — Number of frames to animate
   * @returns {Promise<string[]>} — Array of I2V-generated video URLs
   */
  async generateViaFrames(videoUrl, prompt, fps = 1, numFrames = 5) {
    // Placeholder: use FFmpeg to extract frames, then MiniMaxImage + HailuoVideo I2V
    // frames = await extractFrames(videoUrl, fps, numFrames)
    // videos = await Promise.all(frames.map(f => i2v.generate({ image: f, prompt })))
    // return videos
    throw new Error(
      'MiniMaxVideoToVideo.generateViaFrames: Frame-extraction → I2V pipeline not yet implemented. ' +
      'Use FFmpeg to extract frames, then HailuoVideo with image-to-video.'
    );
  }
}

// ---------------------------------------------------------------------------
// CLI entry point (run directly: node lib/hailuo.js)
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Called directly — run a basic connectivity test
  console.log('HailuoVideo lib loaded successfully.');
  console.log('Base URL:', MINIMAX_BASE_URL);
  console.log('API key set:', ANTHROPIC_TOKEN_KEY ? 'yes (first 8 chars: ' + ANTHROPIC_TOKEN_KEY.slice(0, 8) + '...)' : 'NO — check .env');
  console.log('Daily video limit:', DAILY_VIDEO_LIMIT);
}
