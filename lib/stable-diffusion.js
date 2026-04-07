/**
 * lib/stable-diffusion.js
 * Stable Diffusion image generation for TKP Image-Based Video Studio.
 *
 * Supports two local backends:
 *   - Stable Diffusion WebUI (AUTOMATIC1111 / vladmandic): via /sdapi/v1/txt2img
 *   - ComfyUI: via /prompt endpoint with workspace JSON workflow
 *
 * Cost: $0 (runs on local RTX 5060 GPU)
 *
 * Usage:
 *   import { StableDiffusionGenerator } from './lib/stable-diffusion.js';
 *
 *   const sd = new StableDiffusionGenerator();
 *   const imagePath = await sd.txt2img({
 *     prompt: 'minimal desk setup, warm natural lighting, 4k',
 *     negativePrompt: 'text, watermark, blurry, low quality',
 *     width: 1080,
 *     height: 1920,
 *   });
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
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
      const eq = t.indexOf('= ');
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();

export const SD_WEBUI_URL   = env.SD_WEBUI_URL   ?? 'http://127.0.0.1:7860';
export const COMFYUI_URL    = env.COMFYUI_URL     ?? 'http://127.0.0.1:8188';
export const SD_BACKEND     = env.SD_BACKEND      ?? 'webui'; // 'webui' | 'comfyui'
export const SD_OUTPUT_DIR  = resolve(__dirname, '..', 'assets', 'sd-images');
export const SD_TIMEOUT_MS  = parseInt(env.SD_TIMEOUT_MS ?? '300000', 10); // 5 min default

mkdirSync(SD_OUTPUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Prompt Engineering — channel-specific styles
// ---------------------------------------------------------------------------

/** TKP channel visual style presets for Stable Diffusion prompts */
export const SD_CHANNEL_PRESETS = {
  productivity: {
    style: (
      'high quality photography, clean minimalist aesthetic, '
      'natural warm lighting, shallow depth of field, '
      'professional workspace, calm atmosphere, film grain, 4k'
    ),
    negativePrompt: (
      'text, watermark, logo, busy cluttered background, '
      'harsh flash, overexposed, low resolution, cartoon, anime'
    ),
    defaultWidth:  1280,
    defaultHeight: 720,
    portraitWidth:  1080,
    portraitHeight: 1920,
    cfgScale: 7.0,
    steps: 25,
    sampler: 'DPM++ 2M Karras',
  },
  growth: {
    style: (
      'high quality photography, cinematic lighting, dramatic contrast, '
      'vibrant colors, energetic mood, close-up perspective, '
      'film grain, shallow DOF, 4k'
    ),
    negativePrompt: (
      'text, watermark, logo, blurry, low quality, '
      'cartoon, anime, muted colors, overexposed, boring composition'
    ),
    defaultWidth:  1080,
    defaultHeight: 1920,
    portraitWidth:  1080,
    portraitHeight: 1920,
    cfgScale: 8.5,
    steps: 30,
    sampler: 'DPM++ SDE Karras',
  },
};

/**
 * Build a full Stable Diffusion prompt for a given channel and scene description.
 * @param {string} channel — 'productivity' | 'growth'
 * @param {string} sceneDesc — natural language scene description
 * @returns {{ prompt: string, negativePrompt: string }}
 */
export function buildSDPrompt(channel, sceneDesc) {
  const preset = SD_CHANNEL_PRESETS[channel] ?? SD_CHANNEL_PRESETS.productivity;
  return {
    prompt:        `${sceneDesc}, ${preset.style}`,
    negativePrompt: preset.negativePrompt,
  };
}

// ---------------------------------------------------------------------------
// StableDiffusionGenerator
// ---------------------------------------------------------------------------

export class StableDiffusionGenerator {
  /**
   * @param {object} opts
   * @param {string} [opts.backend='webui'] — 'webui' | 'comfyui'
   * @param {string} [opts.baseUrl] — override default URL
   * @param {string} [opts.outputDir] — override default output dir
   */
  constructor({ backend = SD_BACKEND, baseUrl = null, outputDir = SD_OUTPUT_DIR } = {}) {
    this.backend  = backend;
    this.baseUrl   = baseUrl ?? (backend === 'comfyui' ? COMFYUI_URL : SD_WEBUI_URL);
    this.outputDir = outputDir;
    this._pending  = new Map(); // track in-flight generation IDs
    mkdirSync(this.outputDir, { recursive: true });
  }

  // -------------------------------------------------------------------------
  // Health check
  // -------------------------------------------------------------------------

  /**
   * Check if the SD backend is reachable and ready.
   * @returns {Promise<{ok: boolean, version: string|null, model: string|null}>}
   */
  async healthCheck() {
    try {
      if (this.backend === 'webui') {
        const res = await fetch(`${this.baseUrl}/sdapi/v1/progress`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return { ok: false, version: null, model: null };
        const data = await res.json();
        return { ok: true, version: data.version ?? 'unknown', model: data.model ?? null };
      } else {
        // ComfyUI — check system stats endpoint
        const res = await fetch(`${this.baseUrl}/systemstats`, { signal: AbortSignal.timeout(5000) });
        return { ok: res.ok, version: null, model: null };
      }
    } catch (err) {
      return { ok: false, version: null, model: null, error: err.message };
    }
  }

  // -------------------------------------------------------------------------
  // txt2img — generate image(s) from text prompt
  // -------------------------------------------------------------------------

  /**
   * Generate one or more images from a text prompt.
   *
   * @param {object} opts
   * @param {string} opts.prompt — main prompt
   * @param {string} [opts.negativePrompt]
   * @param {number} [opts.width=1080]
   * @param {number} [opts.height=1920]
   * @param {number} [opts.steps=25]
   * @param {number} [opts.cfgScale=7.0]
   * @param {string} [opts.sampler='DPM++ 2M Karras']
   * @param {number} [opts.batchSize=1] — number of images to generate
   * @param {string} [opts.outputPath] — optional full output path (PNG)
   * @param {string} [opts.seed=-1] — -1 = random
   * @returns {Promise<string>} path to output image(s)
   */
  async txt2img(opts = {}) {
    const {
      prompt,
      negativePrompt = '',
      width   = 1080,
      height  = 1920,
      steps   = 25,
      cfgScale = 7.0,
      sampler  = 'DPM++ 2M Karras',
      batchSize = 1,
      outputPath = null,
      seed     = -1,
    } = opts;

    if (!prompt) throw new Error('txt2img: prompt is required');

    if (this.backend === 'webui') {
      return this._webuiTxt2img({ prompt, negativePrompt, width, height, steps, cfgScale, sampler, batchSize, outputPath, seed });
    } else {
      return this._comfyuiTxt2img({ prompt, negativePrompt, width, height, steps, cfgScale, sampler, batchSize, outputPath, seed });
    }
  }

  // -------------------------------------------------------------------------
  // SD WebUI (A1111 / vladmandic) backend
  // -------------------------------------------------------------------------

  async _webuiTxt2img(opts) {
    const { prompt, negativePrompt, width, height, steps, cfgScale, sampler, batchSize, outputPath, seed } = opts;

    const payload = {
      prompt,
      negative_prompt: negativePrompt,
      width,
      height,
      steps,
      cfg_scale: cfgScale,
      sampler_name: sampler,
      batch_size: batchSize,
      seed,
    };

    const res = await fetch(`${this.baseUrl}/sdapi/v1/txt2img`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(SD_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`SD WebUI txt2img failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (!data.images?.length) throw new Error('SD WebUI returned no images');

    // Save images
    const saved = [];
    for (let i = 0; i < data.images.length; i++) {
      const imgData = data.images[i];
      const outPath = outputPath
        ? (data.images.length === 1 ? outputPath : outputPath.replace('.png', `_${i}.png`))
        : resolve(this.outputDir, `sd_${Date.now()}_${i}.png`);

      // WebUI returns base64 PNG (may have metadata prefix)
      const raw = imgData.startsWith('data:image') ? imgData : `data:image/png;base64,${imgData}`;
      const b64 = raw.split(',')[1];
      mkdirSync(resolve(outPath, '..'), { recursive: true });
      writeFileSync(outPath, Buffer.from(b64, 'base64'));
      saved.push(outPath);
    }

    // Log generation info
    if (data.all_seeds?.length) {
      console.log(`[StableDiffusion] Generated ${saved.length} image(s). Seed(s): ${data.all_seeds.join(', ')}`);
    }

    return saved.length === 1 ? saved[0] : saved;
  }

  // -------------------------------------------------------------------------
  // ComfyUI backend
  // -------------------------------------------------------------------------

  /**
   * Submit a ComfyUI prompt and wait for completion.
   * Uses the queue endpoint + history polling pattern.
   */
  async _comfyuiTxt2img(opts) {
    const { prompt, negativePrompt, width, height, steps, cfgScale, sampler, batchSize, outputPath, seed } = opts;

    // Build a minimal default workflow (KSampler-based)
    const workflow = this._buildComfyWorkflow({ prompt, negativePrompt, width, height, steps, cfgScale, sampler, seed });

    // Submit prompt
    const submitRes = await fetch(`${this.baseUrl}/prompt`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt: workflow }),
      signal:  AbortSignal.timeout(30_000),
    });

    if (!submitRes.ok) {
      throw new Error(`ComfyUI prompt submission failed (${submitRes.status}): ${await submitRes.text()}`);
    }

    const { prompt_id } = await submitRes.json();

    // Poll for completion (up to SD_TIMEOUT_MS)
    const deadline = Date.now() + SD_TIMEOUT_MS;
    let outputs = null;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000)); // poll every 2s

      const histRes = await fetch(`${this.baseUrl}/history/${prompt_id}`, {
        signal: AbortSignal.timeout(10_000),
      });

      if (histRes.ok) {
        const history = await histRes.json();
        if (history[prompt_id]?.status?.completed) {
          outputs = history[prompt_id].outputs;
          break;
        }
      }
    }

    if (!outputs) throw new Error(`ComfyUI generation timed out after ${SD_TIMEOUT_MS}ms`);

    // Extract and save images
    const saved = [];
    for (const [nodeId, nodeOutput] of Object.entries(outputs)) {
      if (nodeOutput.images) {
        for (const img of nodeOutput.images) {
          const outPath = resolve(this.outputDir, `sd_${prompt_id}_${nodeId}.png`);
          const imgRes = await fetch(`${this.baseUrl}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}`, {
            signal: AbortSignal.timeout(30_000),
          });
          if (!imgRes.ok) throw new Error(`Failed to download ComfyUI image: ${imgRes.status}`);
          mkdirSync(resolve(outPath, '..'), { recursive: true });
          writeFileSync(outPath, Buffer.from(await imgRes.arrayBuffer()));
          saved.push(outPath);
        }
      }
    }

    if (!saved.length) throw new Error('ComfyUI returned no images');

    return saved.length === 1 ? saved[0] : saved;
  }

  /**
   * Build a minimal ComfyUI KSampler workflow JSON.
   * This is a generic stable-diffusion-xl pipeline.
   */
  _buildComfyWorkflow({ prompt, negativePrompt, width, height, steps, cfgScale, sampler, seed }) {
    // Nodes:
    // 3 = checkpoint loader (use default model — caller should configure)
    // 4 = CLIP text encode (positive)
    // 5 = CLIP text encode (negative)
    // 6 = empty latent
    // 7 = KSampler
    // 8 = VAE decode
    // 9 = save image
    const s = seed === -1 ? Math.floor(Math.random() * 0xFFFFFFFF) : seed;

    return {
      '3': {
        inputs: { ckpt_name: 'sd_xl_base_1.0.safetensors' },
        class_type: 'CheckpointLoaderSimple',
      },
      '4': {
        inputs: { text: prompt, clip: ['3', 1] },
        class_type: 'CLIPTextEncode',
      },
      '5': {
        inputs: { text: negativePrompt, clip: ['3', 1] },
        class_type: 'CLIPTextEncode',
      },
      '6': {
        inputs: { width, height, batch_size: 1 },
        class_type: 'EmptyLatentImage',
      },
      '7': {
        inputs: {
          seed: s,
          steps,
          cfg: cfgScale,
          sampler_name: sampler,
          scheduler: 'normal',
          positive: ['4', 0],
          negative: ['5', 0],
          latent_image: ['6', 0],
        },
        class_type: 'KSampler',
      },
      '8': {
        inputs: { samples: ['7', 0], vae: ['3', 2] },
        class_type: 'VAEDecode',
      },
      '9': {
        inputs: { filename_prefix: 'tkp_sd', images: ['8', 0] },
        class_type: 'SaveImage',
      },
    };
  }

  // -------------------------------------------------------------------------
  // Batch scene generation
  // -------------------------------------------------------------------------

  /**
   * Generate a batch of images for a video storyboard.
   * Each scene has a description and aspect ratio.
   *
   * @param {Array<{scene: string, prompt: string, aspectRatio?: string}>} scenes
   * @param {object} opts
   * @param {string} [opts.channel='productivity']
   * @param {number} [opts.concurrency=2] — parallel generations (GPU memory limit)
   * @returns {Promise<string[]>} paths to generated images
   */
  async batchGenerateScenes(scenes, { channel = 'productivity', concurrency = 2 } = {}) {
    const preset = SD_CHANNEL_PRESETS[channel];
    const results = [];

    // Process in batches to avoid GPU OOM
    for (let i = 0; i < scenes.length; i += concurrency) {
      const batch = scenes.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((scene, j) => {
          const fullPrompt = buildSDPrompt(channel, scene.prompt);
          const isPortrait  = (scene.aspectRatio ?? '9:16') === '9:16';
          const outPath = resolve(this.outputDir, `scene_${String(i + j).padStart(3, '0')}.png`);
          return this.txt2img({
            prompt:        fullPrompt.prompt,
            negativePrompt: fullPrompt.negativePrompt,
            width:  isPortrait ? preset.portraitWidth  : preset.defaultWidth,
            height: isPortrait ? preset.portraitHeight : preset.defaultHeight,
            steps:        preset.steps,
            cfgScale:     preset.cfgScale,
            sampler:      preset.sampler,
            outputPath:   outPath,
            seed:         -1,
          });
        })
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === 'fulfilled') {
          console.log(`[StableDiffusion] Scene ${i + j + 1}/${scenes.length} OK: ${result.value}`);
          results.push(result.value);
        } else {
          console.error(`[StableDiffusion] Scene ${i + j + 1}/${scenes.length} FAILED: ${result.reason.message}`);
          results.push(null); // placeholder so indices stay aligned
        }
      }
    }

    return results;
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sd = new StableDiffusionGenerator();
  console.log('lib/stable-diffusion.js loaded.');
  console.log('Backend:', sd.backend, '| URL:', sd.baseUrl);

  sd.healthCheck().then(h => {
    if (h.ok) {
      console.log('Health check: OK', h.version ? `(v${h.version})` : '', h.model ? `| Model: ${h.model}` : '');
    } else {
      console.error('Health check: FAILED', h.error ? `| ${h.error}` : '| backend unreachable');
      console.error('  → Set SD_WEBUI_URL or COMFYUI_URL in .env');
      console.error('  → Start Stable Diffusion WebUI with: --api flag');
      console.error('  → Or start ComfyUI with: python main.py --listen');
    }
  }).catch(err => {
    console.error('Health check error:', err.message);
  });
}
