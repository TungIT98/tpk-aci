/**
 * lib/registry.js — Video Production Registry CRUD
 *
 * Provides read/write access to logs/production-registry.json.
 * Used by upload scripts and the check-registry dedup gate.
 *
 * Usage:
 *   import { Registry } from './lib/registry.js';
 *   const reg = new Registry();
 *
 *   // Check if a video was already uploaded to a platform
 *   const entry = reg.findById('PW-01');
 *   if (entry && entry.platforms.includes('youtube')) {
 *     console.log('Already uploaded to YouTube!');
 *   }
 *
 *   // Record a successful upload
 *   reg.recordUpload({ id: 'PW-01', platform: 'youtube', url: 'https://youtube.com/watch?v=...', videoId: 'abc123' });
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = resolve(__dirname, '..', 'logs', 'production-registry.json');

function loadEnv() {
  try {
    const e = {};
    for (const l of readFileSync(resolve(__dirname, '..', '..', '.env'), 'utf-8').split('\n')) {
      const t = l.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      e[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return e;
  } catch { return process.env; }
}

export class Registry {
  constructor({ path = REGISTRY_PATH } = {}) {
    this.path = path;
    this._data = null;
  }

  /** Lazy-load and cache the registry file */
  _read() {
    if (!this._data) {
      try {
        this._data = JSON.parse(readFileSync(this.path, 'utf-8'));
      } catch {
        this._data = { version: '1.0', videos: [], lastUpdated: null };
      }
    }
    return this._data;
  }

  _write(data) {
    data.lastUpdated = new Date().toISOString();
    this._data = data;
    writeFileSync(this.path, JSON.stringify(data, null, 2), 'utf-8');
  }

  /** Return all videos */
  list() {
    return this._read().videos;
  }

  /** Find a video entry by its ID (e.g. "PW-01") */
  findById(id) {
    return this._read().videos.find(v => v.id === id) || null;
  }

  /** Search videos by topic keyword (case-insensitive substring match) */
  searchByTopic(keyword) {
    const kw = keyword.toLowerCase();
    return this._read().videos.filter(v =>
      (v.topic || '').toLowerCase().includes(kw) ||
      (v.title || '').toLowerCase().includes(kw)
    );
  }

  /** Check if a video has already been uploaded to a specific platform */
  isUploaded(videoId, platform) {
    const entry = this.findById(videoId);
    if (!entry) return false;
    return entry.platforms.some(p => p.platform === platform);
  }

  /** Check if a video is in "uploaded" status (any platform) */
  isFullyUploaded(videoId) {
    const entry = this.findById(videoId);
    return entry ? entry.status === 'uploaded' : false;
  }

  /** Record a successful upload into the registry */
  recordUpload({ id, platform, url, videoId }) {
    const data = this._read();
    let entry = data.videos.find(v => v.id === id);

    if (!entry) {
      // Auto-create entry if it doesn't exist
      entry = {
        id,
        title: id,
        topic: '',
        status: 'created',
        createdAt: new Date().toISOString(),
        uploadedAt: null,
        platforms: [],
      };
      data.videos.push(entry);
    }

    // Add or update platform entry
    const existingIdx = entry.platforms.findIndex(p => p.platform === platform);
    const uploadRecord = {
      platform,
      url: url || null,
      videoId: videoId || null,
      uploadedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      entry.platforms[existingIdx] = uploadRecord;
    } else {
      entry.platforms.push(uploadRecord);
    }

    // Update status
    entry.uploadedAt = new Date().toISOString();
    entry.status = 'uploaded';

    this._write(data);
    return entry;
  }

  /** Add a new video entry to the registry (for newly produced videos) */
  addVideo({ id, title, topic, file }) {
    const data = this._read();
    if (data.videos.some(v => v.id === id)) {
      throw new Error(`Video ${id} already exists in registry`);
    }
    data.videos.push({
      id,
      title: title || id,
      topic: topic || '',
      status: 'created',
      createdAt: new Date().toISOString(),
      uploadedAt: null,
      platforms: [],
      file: file || null,
    });
    this._write(data);
    return this.findById(id);
  }

  /** Get upload summary: counts by status */
  summary() {
    const videos = this._read().videos;
    return {
      total: videos.length,
      created: videos.filter(v => v.status === 'created').length,
      uploaded: videos.filter(v => v.status === 'uploaded').length,
      byPlatform: videos.reduce((acc, v) => {
        v.platforms.forEach(p => { acc[p.platform] = (acc[p.platform] || 0) + 1; });
        return acc;
      }, {}),
    };
  }
}
