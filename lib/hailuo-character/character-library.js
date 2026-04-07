/**
 * lib/hailuo-character/character-library.js
 * Character library manager — CRUD for character profiles.
 *
 * Storage structure:
 *   characters/
 *   ├── {character_id}/
 *   │   ├── metadata.json
 *   │   ├── seed_image.jpg
 *   │   ├── references/
 *   │   │   ├── front.png
 *   │   │   ├── profile.png
 *   │   │   ├── three_quarter.png
 *   │   │   ├── full_body.png
 *   │   │   └── lighting.png
 *   │   └── variants/
 *
 * Usage:
 *   import { CharacterLibrary } from './lib/hailuo-character/character-library.js';
 *   const lib = new CharacterLibrary();
 *   const chars = await lib.list();
 *   const anna = await lib.get('char_001');
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { resolve, dirname, join } from 'path';
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

export const DEFAULT_LIBRARY_PATH = env.CHARACTER_LIBRARY_PATH ||
  resolve(__dirname, '..', '..', 'characters');

export const REF_TYPES = ['front', 'profile', 'three_quarter', 'full_body', 'lighting'];

export class CharacterLibrary {
  /**
   * @param {object} opts
   * @param {string} [opts.libraryPath] — root characters/ directory
   */
  constructor({ libraryPath = DEFAULT_LIBRARY_PATH } = {}) {
    this.libraryPath = libraryPath;
    this._ensureRoot();
  }

  _ensureRoot() {
    if (!existsSync(this.libraryPath)) {
      mkdirSync(this.libraryPath, { recursive: true });
    }
  }

  _charDir(id) {
    return resolve(this.libraryPath, id);
  }

  _metaPath(id) {
    return resolve(this._charDir(id), 'metadata.json');
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  /**
   * Create a new character profile. Does NOT generate reference images.
   *
   * @param {object} opts
   * @param {string} opts.name         — Human-readable name
   * @param {string} [opts.description]
   * @param {string} opts.seedImagePath — Path to the seed image file
   * @param {string} [opts.id]         — Optional ID (auto-generated if not provided)
   * @returns {Promise<object>} — created character metadata
   */
  async create({ name, description = '', seedImagePath, id, variants = [] }) {
    const charId = id || this._generateId(name);
    const dir = this._charDir(charId);

    if (existsSync(dir)) {
      throw new Error(`Character '${charId}' already exists. Use .update() to modify.`);
    }

    mkdirSync(resolve(dir, 'references'), { recursive: true });
    mkdirSync(resolve(dir, 'variants'),    { recursive: true });

    // Copy seed image
    let seedImageFile = '';
    if (seedImagePath && existsSync(seedImagePath)) {
      const ext = seedImagePath.split('.').pop();
      seedImageFile = `seed_image.${ext}`;
      const dest = resolve(dir, seedImageFile);
      writeFileSync(dest, readFileSync(seedImagePath));
    }

    const metadata = {
      id: charId,
      name,
      description,
      created: new Date().toISOString().slice(0, 10),
      seed_image: seedImageFile,
      references: Object.fromEntries(REF_TYPES.map(t => [t, ''])),
      variants,
      active: true,
    };

    writeFileSync(this._metaPath(charId), JSON.stringify(metadata, null, 2), 'utf-8');
    return metadata;
  }

  /**
   * Get character metadata by ID.
   *
   * @param {string} charId
   * @returns {Promise<object|null>}
   */
  async get(charId) {
    const path = this._metaPath(charId);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      return null;
    }
  }

  /**
   * List all characters. Returns sorted by created date (newest first).
   *
   * @returns {Promise<Array<object>>}
   */
  async list() {
    if (!existsSync(this.libraryPath)) return [];
    const entries = readdirSync(this.libraryPath, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory());

    const chars = [];
    for (const dir of dirs) {
      const meta = await this.get(dir.name);
      if (meta) chars.push(meta);
    }

    return chars.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''));
  }

  /**
   * Update character metadata fields.
   *
   * @param {string} charId
   * @param {object} updates
   * @returns {Promise<object>} — updated metadata
   */
  async update(charId, updates) {
    const meta = await this.get(charId);
    if (!meta) throw new Error(`Character '${charId}' not found`);

    const updated = { ...meta, ...updates, id: charId };
    writeFileSync(this._metaPath(charId), JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  /**
   * Delete a character and all its files.
   *
   * @param {string} charId
   */
  async delete(charId) {
    const dir = this._charDir(charId);
    if (!existsSync(dir)) return;

    // Recursively delete
    const { rmSync } = await import('fs');
    rmSync(dir, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // Reference image management
  // -------------------------------------------------------------------------

  /**
   * Add or update a reference image for a character.
   *
   * @param {string} charId
   * @param {string} refType — one of REF_TYPES
   * @param {string|Buffer} imageData — file path or Buffer
   * @param {string} [filename] — optional filename
   * @returns {Promise<string>} — saved file path relative to character dir
   */
  async setReference(charId, refType, imageData, filename) {
    if (!REF_TYPES.includes(refType)) {
      throw new Error(`Invalid refType '${refType}'. Use one of: ${REF_TYPES.join(', ')}`);
    }

    const meta = await this.get(charId);
    if (!meta) throw new Error(`Character '${charId}' not found`);

    const refDir = resolve(this._charDir(charId), 'references');
    if (!existsSync(refDir)) mkdirSync(refDir, { recursive: true });

    const ext = filename ? filename.split('.').pop() : 'png';
    const savedName = `${refType}.${ext}`;
    const dest = resolve(refDir, savedName);

    if (typeof imageData === 'string') {
      if (!existsSync(imageData)) throw new Error(`Reference image not found: ${imageData}`);
      writeFileSync(dest, readFileSync(imageData));
    } else {
      writeFileSync(dest, Buffer.isBuffer(imageData) ? imageData : Buffer.from(imageData));
    }

    // Update metadata
    await this.update(charId, {
      references: { ...meta.references, [refType]: `references/${savedName}` },
    });

    return `references/${savedName}`;
  }

  /**
   * Load reference images as base64 strings for S2V API.
   *
   * @param {string} charId
   * @returns {Promise<string[]>} — array of base64 image strings
   */
  async loadReferenceImages(charId) {
    const meta = await this.get(charId);
    if (!meta) throw new Error(`Character '${charId}' not found`);

    const refs = [];
    for (const refType of REF_TYPES) {
      const relPath = meta.references?.[refType];
      if (!relPath) continue;
      const absPath = resolve(this._charDir(charId), relPath);
      if (!existsSync(absPath)) {
        console.warn(`[CharacterLibrary] Reference missing: ${absPath}`);
        continue;
      }
      const buf = readFileSync(absPath);
      const ext = relPath.split('.').pop();
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      refs.push(`data:${mime};base64,${buf.toString('base64')}`);
    }

    return refs;
  }

  /**
   * Load reference image file paths for browser upload.
   *
   * @param {string} charId
   * @returns {Promise<string[]>} — Array of absolute file paths
   */
  async loadReferenceFilePaths(charId) {
    const meta = await this.get(charId);
    if (!meta) throw new Error(`Character '${charId}' not found`);

    const paths = [];
    for (const refType of REF_TYPES) {
      const relPath = meta.references?.[refType];
      if (!relPath) continue;
      const absPath = resolve(this._charDir(charId), relPath);
      if (existsSync(absPath)) paths.push(absPath);
    }
    return paths;
  }

  /**
   * Load reference images as raw base64 (without data URI prefix) for API.
   *
   * @param {string} charId
   * @returns {Promise<string[]>}
   */
  async loadReferenceBase64(charId) {
    const meta = await this.get(charId);
    if (!meta) throw new Error(`Character '${charId}' not found`);

    const refs = [];
    for (const refType of REF_TYPES) {
      const relPath = meta.references?.[refType];
      if (!relPath) continue;
      const absPath = resolve(this._charDir(charId), relPath);
      if (!existsSync(absPath)) continue;
      const buf = readFileSync(absPath);
      refs.push(buf.toString('base64'));
    }

    return refs;
  }

  /**
   * Check if a character has a complete reference set.
   *
   * @param {string} charId
   * @returns {{ complete: boolean, missing: string[] }}
   */
  async checkReferences(charId) {
    const meta = await this.get(charId);
    if (!meta) return { complete: false, missing: [...REF_TYPES] };

    const missing = [];
    for (const refType of REF_TYPES) {
      const relPath = meta.references?.[refType];
      if (!relPath) { missing.push(refType); continue; }
      const absPath = resolve(this._charDir(charId), relPath);
      if (!existsSync(absPath)) missing.push(refType);
    }

    return { complete: missing.length === 0, missing };
  }

  // -------------------------------------------------------------------------
  // Variants
  // -------------------------------------------------------------------------

  /**
   * Add a variant outfit/expression to a character.
   *
   * @param {string} charId
   * @param {string} variantName
   * @param {string|Buffer} imageData
   * @param {string} [filename]
   */
  async addVariant(charId, variantName, imageData, filename) {
    const meta = await this.get(charId);
    if (!meta) throw new Error(`Character '${charId}' not found`);

    const varDir = resolve(this._charDir(charId), 'variants');
    if (!existsSync(varDir)) mkdirSync(varDir, { recursive: true });

    const ext = filename ? filename.split('.').pop() : 'png';
    const safeName = variantName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const savedName = `${safeName}.${ext}`;
    const dest = resolve(varDir, savedName);

    if (typeof imageData === 'string') {
      writeFileSync(dest, readFileSync(imageData));
    } else {
      writeFileSync(dest, Buffer.isBuffer(imageData) ? imageData : Buffer.from(imageData));
    }

    const variants = [...(meta.variants || []), savedName];
    await this.update(charId, { variants });
    return savedName;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  _generateId(name) {
    const clean = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const hash  = createHash('md5').update(name + Date.now()).digest('hex').slice(0, 6);
    return `char_${clean}_${hash}`;
  }

  /**
   * Resolve character ID to metadata, supporting name lookup.
   * @param {string} charIdOrName
   */
  async resolve(charIdOrName) {
    const byId = await this.get(charIdOrName);
    if (byId) return byId;

    const all = await this.list();
    return all.find(c => c.name.toLowerCase() === charIdOrName.toLowerCase()) || null;
  }
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const lib = new CharacterLibrary();
  console.log('CharacterLibrary loaded. Path:', lib.libraryPath);
  console.log('Type: object');
}
