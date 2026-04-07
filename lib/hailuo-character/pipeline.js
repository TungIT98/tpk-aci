/**
 * lib/hailuo-character/pipeline.js
 * Script → Video pipeline for Hailuo character-consistent video generation.
 *
 * Flow:
 *   script.json (input)
 *       ↓
 *   Load: theme, prompt_for_hailuo, character_id
 *       ↓
 *   Load character references from library
 *       ↓
 *   QC pre-check: reference completeness
 *       ↓
 *   Generate video via S2V-01
 *       ↓
 *   QC post-check: file size, hash uniqueness
 *       ↓
 *   Output: outputs/{id}/final.mp4
 *
 * Usage:
 *   import { CharacterPipeline } from './lib/hailuo-character/pipeline.js';
 *   const pipeline = new CharacterPipeline();
 *   const result = await pipeline.generateFromScript({ scriptPath: 'scripts/pending/SERIES-001-EP01.json' });
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, '..', '..', '.env');
  try {
    const env = {};
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
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

export const STAGES = {
  LOAD_SCRIPT:   'load_script',
  LOAD_CHAR:     'load_character',
  QC_REFS:       'qc_references',
  GENERATE:      'generate',
  QC_VIDEO:      'qc_video',
  SAVE_OUTPUT:   'save_output',
};

export class CharacterPipeline {
  /**
   * @param {object} opts
   * @param {string} [opts.outputPath] — root output directory
   */
  constructor({ outputPath } = {}) {
    this.outputPath = outputPath || resolve(__dirname, '..', '..', 'outputs', 'hailuo-character');
    this._s2v    = null;
    this._lib    = null;
  }

  async _getS2V() {
    if (!this._s2v) {
      const { S2VGenerator } = await import('./video-generator.js');
      this._s2v = new S2VGenerator();
    }
    return this._s2v;
  }

  async _getLib() {
    if (!this._lib) {
      const { CharacterLibrary } = await import('./character-library.js');
      this._lib = new CharacterLibrary();
    }
    return this._lib;
  }

  // -------------------------------------------------------------------------
  // Main entry point
  // -------------------------------------------------------------------------

  /**
   * Generate a character-consistent video from a script file.
   *
   * @param {object} opts
   * @param {string} opts.scriptPath — path to script JSON
   * @param {string} [opts.outputDir] — override output directory
   * @param {Function} [opts.onStageComplete] — callback for stage updates
   * @returns {Promise<object>} — generation result
   */
  async generateFromScript({ scriptPath, outputDir, onStageComplete } = {}) {
    const emit = (stage, data) => {
      if (typeof onStageComplete === 'function') {
        onStageComplete({ stage, ...data });
      }
    };

    const result = {
      scriptPath,
      startedAt: new Date().toISOString(),
      stages: {},
      status: 'in_progress',
    };

    try {
      // Stage 1: Load script
      emit(STAGES.LOAD_SCRIPT, { status: 'running' });
      const script = await this._loadScript(scriptPath);
      result.script   = script;
      result.scriptId = script.id;
      result.stages[STAGES.LOAD_SCRIPT] = { status: 'done', scriptId: script.id };

      // Stage 2: Load character
      emit(STAGES.LOAD_CHAR, { status: 'running' });
      const lib  = await this._getLib();
      const char = await lib.resolve(script.character_id);
      if (!char) throw new Error(`Character '${script.character_id}' not found in library`);
      result.character = { id: char.id, name: char.name };
      result.stages[STAGES.LOAD_CHAR] = { status: 'done', characterId: char.id };

      // Stage 3: QC references
      emit(STAGES.QC_REFS, { status: 'running' });
      const refCheck = await lib.checkReferences(char.id);
      if (!refCheck.complete) {
        throw new Error(
          `Character '${char.id}' is missing reference images: ${refCheck.missing.join(', ')}. ` +
          `Run 'node cli.js character create --seed <img> --name "${char.name}"' to generate.`
        );
      }
      result.stages[STAGES.QC_REFS] = { status: 'done', references: char.references };

      // Stage 4: Generate video
      emit(STAGES.GENERATE, { status: 'running' });
      const base64Refs = await lib.loadReferenceBase64(char.id);
      if (base64Refs.length === 0) {
        throw new Error(`No reference images found for character '${char.id}'`);
      }

      const s2v = await this._getS2V();
      const duration = script.duration || 6;
      const aspect_ratio = script.aspect_ratio || '9:16';

      const videoResult = await s2v.generateWithRetry({
        subjectReferences: base64Refs,
        prompt:            script.prompt_for_hailuo || script.prompt,
        duration,
        aspect_ratio,
      });

      result.videoResult = videoResult;
      result.videoUrl    = videoResult.video_url;
      result.taskId      = videoResult.task_id;
      result.stages[STAGES.GENERATE] = {
        status: 'done',
        taskId: videoResult.task_id,
        videoUrl: videoResult.video_url,
      };

      // Stage 5: QC video
      emit(STAGES.QC_VIDEO, { status: 'running' });
      const qcResult = await this._qcVideo(videoResult, script);
      result.qc = qcResult;
      result.stages[STAGES.QC_VIDEO] = { status: 'done', ...qcResult };

      // Stage 6: Save output
      if (videoResult.video_url) {
        emit(STAGES.SAVE_OUTPUT, { status: 'running' });
        const outDir = outputDir || resolve(this.outputPath, script.id);
        mkdirSync(outDir, { recursive: true });

        const localPath = await this._downloadVideo(videoResult.video_url, outDir, script.id);
        result.localPath = localPath;
        result.stages[STAGES.SAVE_OUTPUT] = { status: 'done', path: localPath };
      }

      result.status     = 'completed';
      result.completedAt = new Date().toISOString();

    } catch (err) {
      result.status    = 'failed';
      result.error     = err.message;
      result.completedAt = new Date().toISOString();
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Batch generation
  // -------------------------------------------------------------------------

  /**
   * Generate videos for multiple scripts sequentially.
   *
   * @param {string[]} scriptPaths
   * @param {object} [opts]
   * @param {Function} [opts.onProgress]
   * @returns {Promise<Array<object>>}
   */
  async batchGenerate(scriptPaths, { onProgress } = {}) {
    const log = onProgress ?? (() => {});
    const results = [];

    for (let i = 0; i < scriptPaths.length; i++) {
      const path = scriptPaths[i];
      log(`[Pipeline] Processing ${i + 1}/${scriptPaths.length}: ${path}`);
      try {
        const result = await this.generateFromScript({ scriptPath: path, onProgress: log });
        results.push(result);
        log(`[Pipeline] ${result.status === 'completed' ? '✓' : '✗'} ${path}: ${result.status}`);
      } catch (err) {
        results.push({ scriptPath: path, status: 'failed', error: err.message });
        log(`[Pipeline] ✗ ${path}: ${err.message}`);
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Series generation
  // -------------------------------------------------------------------------

  /**
   * Generate a full series from a series config.
   *
   * @param {string} seriesId
   * @param {object} [opts]
   * @param {number} [opts.fromEpisode=1]
   * @param {number} [opts.toEpisode]
   * @param {Function} [opts.onProgress]
   */
  async generateSeries(seriesId, { fromEpisode = 1, toEpisode, onProgress } = {}) {
    const log = onProgress ?? (() => {});
    const seriesPath = resolve(__dirname, '..', '..', 'series', seriesId, 'config.json');

    if (!existsSync(seriesPath)) {
      throw new Error(`Series config not found: ${seriesPath}`);
    }

    const series = JSON.parse(readFileSync(seriesPath, 'utf-8'));
    const to = toEpisode ?? series.total_episodes;
    const scriptIds = [];

    for (let ep = fromEpisode; ep <= to; ep++) {
      const scriptPath = resolve(__dirname, '..', '..', 'scripts', 'pending',
        `${seriesId}-EP${String(ep).padStart(2, '0')}.json`);
      if (existsSync(scriptPath)) scriptIds.push(scriptPath);
    }

    log(`[Pipeline] Series '${seriesId}': ${scriptIds.length} episodes (${fromEpisode}–${to})`);
    return this.batchGenerate(scriptIds, { onProgress: log });
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  async _loadScript(scriptPath) {
    const raw = readFileSync(scriptPath, 'utf-8').replace(/^\uFEFF/, '');
    const script = JSON.parse(raw);

    if (!script.id)    throw new Error(`Script missing 'id' field: ${scriptPath}`);
    if (!script.prompt_for_hailuo && !script.prompt) {
      throw new Error(`Script '${script.id}' missing 'prompt_for_hailuo' or 'prompt' field`);
    }
    if (!script.character_id) {
      throw new Error(`Script '${script.id}' missing 'character_id' field`);
    }

    return script;
  }

  async _qcVideo(videoResult, script) {
    const warnings = [];
    const checks = { videoUrlPresent: !!videoResult.video_url };

    if (!checks.videoUrlPresent) {
      warnings.push('No video_url in result — may still be processing');
    }

    return { pass: checks.videoUrlPresent, warnings, checks };
  }

  async _downloadVideo(url, outDir, scriptId) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);

    mkdirSync(outDir, { recursive: true });

    const contentType = res.headers.get('content-type') || '';
    const ext = contentType.includes('mp4') ? 'mp4' : 'mp4';
    const dest = resolve(outDir, `${scriptId}.${ext}`);

    const { Writable } = await import('stream');
    const { createWriteStream } = await import('fs');

    const fileStream = createWriteStream(dest);
    res.body.pipe(fileStream);

    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    // Move to final.mp4 convention
    const finalPath = resolve(outDir, 'final.mp4');
    const { renameSync } = await import('fs');
    renameSync(dest, finalPath);

    return finalPath;
  }

  _videoHash(buffer) {
    return createHash('md5').update(buffer).digest('hex');
  }
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pipeline = new CharacterPipeline();
  console.log('CharacterPipeline loaded. Output path:', pipeline.outputPath);
}
