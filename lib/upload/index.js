/**
 * lib/upload/index.js
 * Upload dispatcher — routes to platform-specific uploaders.
 *
 * Usage:
 *   import { UploadDispatcher } from './lib/upload/index.js';
 *   const dispatcher = new UploadDispatcher();
 *   const result = await dispatcher.upload({ platform: 'tiktok', videoPath: '...' });
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const env = {};
    for (const line of readFileSync(resolve(__dirname, '..', '..', '.env'), 'utf-8').split('\n')) {
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

export class UploadDispatcher {
  constructor() {
    this.uploaders = {};
  }

  /** Lazy-load uploader modules */
  _getUploader(platform) {
    if (!this.uploaders[platform]) {
      const mod = { tiktok: './tiktok.js', youtube: './youtube.js', instagram: './instagram.js', linkedin: './linkedin.js' }[platform];
      if (!mod) throw new Error(`Unknown platform: ${platform}`);
      this.uploaders[platform] = { tiktok: () => import('./tiktok.js'), youtube: () => import('./youtube.js'), instagram: () => import('./instagram.js'), linkedin: () => import('./linkedin.js') }[platform]();
    }
    return this.uploaders[platform];
  }

  /**
   * Upload a video to a single platform.
   * @param {object} opts
   * @param {string} opts.platform  — 'tiktok' | 'youtube' | 'instagram' | 'linkedin'
   * @param {string} opts.videoPath — Local path to video file
   * @param {object} opts.metadata  — Title, description, tags, etc.
   */
  async upload({ platform, videoPath, metadata = {} }) {
    const mod = await this._getUploader(platform);
    const UploaderClass = Object.values(mod).find(v => typeof v === 'function');
    if (!UploaderClass) throw new Error(`No uploader found for ${platform}`);
    const uploader = new UploaderClass();
    return uploader.upload({ videoPath, ...metadata });
  }

  /**
   * Upload to multiple platforms simultaneously.
   */
  async uploadAll({ platforms, videoPath, metadata }) {
    return Promise.all(platforms.map(p => this.upload({ platform: p, videoPath, metadata })));
  }
}
