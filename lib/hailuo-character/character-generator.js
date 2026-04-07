/**
 * lib/hailuo-character/character-generator.js
 * Standard Five Reference Set generator.
 *
 * Takes a seed image and generates the 5 standard reference angles:
 *   1. Front portrait (0°)
 *   2. Profile (90°)
 *   3. Three-quarter view (45°)
 *   4. Full-body shot
 *   5. Lighting stress test (varied lighting conditions)
 *
 * Uses MiniMax Image API to generate each angle.
 *
 * Usage:
 *   import { CharacterGenerator } from './lib/hailuo-character/character-generator.js';
 *   const gen = new CharacterGenerator();
 *   const refs = await gen.generateReferenceSet({
 *     seedImagePath: './photos/anna.jpg',
 *     characterDescription: 'Professional female, 30s, navy blazer',
 *     outputDir: './characters/anna_references/',
 *   });
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const MINIMAX_KEY = env.MINIMAX_API_KEY || env.ANTHROPIC_TOKEN_KEY || '';
const MINIMAX_BASE = env.MINIMAX_BASE_URL || 'https://api.minimax.io';

export const REF_ANGLES = [
  {
    id: 'front',
    label: 'Front portrait (0°)',
    promptTemplate: (desc) =>
      `Professional portrait photo of ${desc}. Straight-on face view, neutral expression, even studio lighting, passport-style composition, shoulder-up framing. High detail, photorealistic.`,
  },
  {
    id: 'profile',
    label: 'Profile (90°)',
    promptTemplate: (desc) =>
      `Professional portrait photo of ${desc}. Side profile view, 90-degree angle, neutral expression, even lighting on the visible half of face. High detail, photorealistic.`,
  },
  {
    id: 'three_quarter',
    label: 'Three-quarter view (45°)',
    promptTemplate: (desc) =>
      `Professional portrait photo of ${desc}. Three-quarter turn angle, slight face rotation showing both eyes and one cheek fully, confident expression, soft key light from the side. High detail, photorealistic.`,
  },
  {
    id: 'full_body',
    label: 'Full-body shot',
    promptTemplate: (desc) =>
      `Full body photo of ${desc}. Standing pose, professional attire visible, even lighting from above, neutral background, capturing full height and posture. High detail, photorealistic.`,
  },
  {
    id: 'lighting',
    label: 'Lighting stress test',
    promptTemplate: (desc) =>
      `Portrait photo of ${desc} under dramatic chiaroscuro lighting — strong contrast between light and shadow across the face, Rembrandt-style. Same character appearance as previous angles. High detail, photorealistic.`,
  },
];

export class CharacterGenerator {
  constructor({ apiKey = MINIMAX_KEY, baseUrl = MINIMAX_BASE } = {}) {
    if (!apiKey) throw new Error('CharacterGenerator: No API key. Set MINIMAX_API_KEY in .env');
    this.apiKey  = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Generate a single reference image for an angle.
   *
   * @param {string} angleId
   * @param {string} characterDescription
   * @param {string} [aspectRatio='1:1']
   * @returns {Promise<{ angleId: string, imageData: Buffer, url: string }>}
   */
  async generateAngle(angleId, characterDescription, aspectRatio = '1:1') {
    const angle = REF_ANGLES.find(a => a.id === angleId);
    if (!angle) throw new Error(`Unknown angle: ${angleId}`);

    const prompt = angle.promptTemplate(characterDescription);

    const res = await fetch(`${this.baseUrl}/v1/image_generation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model: 'image-01',
        prompt,
        aspect_ratio: aspectRatio,
        num_images: 1,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`CharacterGenerator angle '${angleId}' failed: ${res.status} — ${text}`);
    }

    const data = await res.json();
    const imageUrl = data.data?.[0]?.url ?? data.images?.[0]?.url;

    if (!imageUrl) {
      throw new Error(`CharacterGenerator angle '${angleId}': no image URL in response: ${JSON.stringify(data)}`);
    }

    // Download the image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to download generated image: ${imgRes.status}`);
    const imageData = Buffer.from(await imgRes.arrayBuffer());

    return { angleId, imageData, url: imageUrl };
  }

  /**
   * Generate all 5 standard reference angles for a character.
   *
   * @param {object} opts
   * @param {string} opts.characterDescription — Description of the character for prompt generation
   * @param {string} [opts.seedImagePath]     — Optional seed image to guide generation
   * @param {string} [opts.outputDir]         — Directory to save reference images
   * @param {string} [opts.characterId]       — Used to organize output if outputDir not specified
   * @param {Function} [opts.onProgress]      — Progress callback (angleId, done, total)
   * @returns {Promise<Array<{ angleId: string, localPath: string, url: string }>>}
   */
  async generateReferenceSet({
    characterDescription,
    seedImagePath,
    outputDir,
    characterId,
    onProgress,
  }) {
    const log = onProgress ?? (() => {});

    let saveDir = outputDir;
    if (!saveDir && characterId) {
      saveDir = resolve(
        characterDescription.includes('/') ? characterDescription : resolve(__dirname, '..', '..', 'characters'),
        characterId,
        'references'
      );
    }

    if (saveDir && !existsSync(saveDir)) {
      mkdirSync(saveDir, { recursive: true });
    }

    const results = [];

    for (let i = 0; i < REF_ANGLES.length; i++) {
      const angle = REF_ANGLES[i];
      log(`[CharacterGenerator] Generating ${angle.id} (${i + 1}/${REF_ANGLES.length})...`);

      const { angleId, imageData, url } = await this.generateAngle(angle.id, characterDescription);

      let localPath = '';
      if (saveDir) {
        localPath = resolve(saveDir, `${angleId}.png`);
        writeFileSync(localPath, imageData);
        log(`[CharacterGenerator] Saved ${angleId} → ${localPath}`);
      }

      results.push({ angleId, localPath, url, imageData });
    }

    log(`[CharacterGenerator] Reference set complete: ${results.length} images`);
    return results;
  }

  /**
   * Generate reference set and save directly into a character library entry.
   * Combines character creation + reference generation.
   *
   * @param {object} opts
   * @param {string} opts.name                    — Character name
   * @param {string} opts.description             — Character description
   * @param {string} opts.characterDescription    — Prompt description for image generation
   * @param {string} [opts.seedImagePath]         — Path to seed image
   * @param {string} [opts.libraryPath]           — Characters root directory
   * @param {Function} [opts.onProgress]
   */
  async createCharacterWithReferences({
    name,
    description,
    characterDescription,
    seedImagePath,
    libraryPath,
    onProgress,
  }) {
    const { CharacterLibrary } = await import('./character-library.js');
    const lib = new CharacterLibrary({ libraryPath });

    const { mkdirSync, copyFileSync } = await import('fs');

    // Create character entry
    let seedDest = '';
    if (seedImagePath && existsSync(seedImagePath)) {
      // We'll store it after we know the charId
    }

    // Use a temp creation to get the ID
    const tempId = `char_${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const char = await lib.create({ name, description, seedImagePath, id: tempId });
    const charId = char.id;

    // Generate and save all references
    const refDir = resolve(lib._charDir(charId), 'references');
    mkdirSync(refDir, { recursive: true });

    // Copy seed image if provided
    if (seedImagePath && existsSync(seedImagePath)) {
      const ext = seedImagePath.split('.').pop();
      const seedDest = resolve(lib._charDir(charId), `seed_image.${ext}`);
      copyFileSync(seedImagePath, seedDest);
      await lib.update(charId, { seed_image: `seed_image.${ext}` });
    }

    const refs = await this.generateReferenceSet({
      characterDescription,
      outputDir: refDir,
      characterId: charId,
      onProgress,
    });

    // Update metadata with reference paths
    const refPaths = {};
    for (const ref of refs) {
      const rel = ref.localPath ? ref.localPath.split(/[\\/]/).slice(-2).join('/') : '';
      refPaths[ref.angleId] = rel;
    }

    await lib.update(charId, { references: refPaths });

    return { ...char, references: refPaths };
  }
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const gen = new CharacterGenerator();
  console.log('CharacterGenerator loaded. API key:', MINIMAX_KEY ? 'set' : 'MISSING');
  console.log('Available angles:', REF_ANGLES.map(a => a.id).join(', '));
}
