/**
 * lib/hailuo-character/index.js
 * Main entry point for the Hailuo Character Consistency Tool.
 *
 * Re-exports all public classes and utilities.
 *
 * Usage:
 *   import { CharacterPipeline, CharacterLibrary, S2VGenerator } from './lib/hailuo-character/index.js';
 *
 *   // Generate a video
 *   const pipeline = new CharacterPipeline();
 *   const result = await pipeline.generateFromScript({ scriptPath: '...' });
 *
 *   // Manage characters
 *   const lib = new CharacterLibrary();
 *   const chars = await lib.list();
 *
 *   // S2V direct access
 *   const s2v = new S2VGenerator();
 */

export { S2VGenerator }              from './video-generator.js';
export { CharacterLibrary, REF_TYPES } from './character-library.js';
export { CharacterGenerator, REF_ANGLES } from './character-generator.js';
export { CharacterPipeline, STAGES }  from './pipeline.js';
