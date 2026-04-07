#!/usr/bin/env node
/**
 * projects/hailuo-character-tool/cli.js
 * CLI for Hailuo Character Consistency Tool.
 *
 * Commands:
 *   node cli.js character create --seed ./photos/anna.jpg --name "Business Woman Anna" --description "..."
 *   node cli.js character list
 *   node cli.js character info --id char_xxx
 *   node cli.js character refs --id char_xxx
 *   node cli.js generate --script scripts/pending/SERIES-001-EP01.json
 *   node cli.js generate --series SERIES-001 --from 1 --to 10
 *   node cli.js status --task-id xxx
 *   node cli.js qc --video outputs/xxx.mp4 --character char_xxx
 *
 * Environment (.env):
 *   MINIMAX_API_KEY, HAILUO_API_HOST, CHARACTER_LIBRARY_PATH, OUTPUT_PATH
 */

import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// TKP_ACI root — cli.js is at projects/hailuo-character-tool/cli.js
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const LIB_ROOT    = resolve(PROJECT_ROOT, 'lib');

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const { CharacterPipeline, CharacterLibrary, CharacterGenerator, S2VGenerator, REF_ANGLES } =
  await import(`file://${LIB_ROOT}/hailuo-character/index.js`);

const [, , command, ...rawArgs] = process.argv;
const args = parseArgs(rawArgs);

function log(...msg) { console.log('[CLI]', new Date().toISOString().slice(11,19), ...msg); }
function die(msg) { console.error('[CLI] ERROR:', msg); process.exit(1); }

// ---------------------------------------------------------------------------
// Argument parser
// ---------------------------------------------------------------------------

function parseArgs(raw) {
  const opts = {};
  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = raw[i + 1];
      if (next && !next.startsWith('--')) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = true;
      }
    } else if (arg.startsWith('-')) {
      opts[arg.slice(1)] = true;
    } else {
      opts._ = opts._ || [];
      opts._.push(arg);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

switch (command) {
  case 'character': {
    const sub = args._[0];
    switch (sub) {
      case 'create': await cmdCharacterCreate(); break;
      case 'list':   await cmdCharacterList();   break;
      case 'info':    await cmdCharacterInfo();  break;
      case 'refs':    await cmdCharacterRefs();  break;
      default:        die(`Unknown character subcommand: ${sub}. Use: create | list | info | refs`);
    }
    break;
  }

  case 'generate': {
    await cmdGenerate(); break;
  }

  case 'batch': {
    await cmdBatchGenerate(); break;
  }

  case 'status': {
    await cmdStatus(); break;
  }

  case 'qc': {
    await cmdQC(); break;
  }

  case 's2v-test': {
    await cmdS2VTest(); break;
  }

  default: {
    if (!command) {
      console.log(`Hailuo Character Tool CLI
Usage: node cli.js <command> [options]

Commands:
  character create --seed <path> --name <name> [--description <desc>]
  character list
  character info  --id <char_id>
  character refs  --id <char_id>
  generate        --script <path>
  generate        --series <series_id> [--from N] [--to N]
  batch           --dir <scripts_dir>
  status          --task-id <id>
  qc              --video <path> --character <char_id>
  s2v-test        --prompt <text> [--refs <char_id>]

Environment (.env):
  MINIMAX_API_KEY, HAILUO_API_HOST, CHARACTER_LIBRARY_PATH
`);
    } else {
      die(`Unknown command: ${command}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Character commands
// ---------------------------------------------------------------------------

async function cmdCharacterCreate() {
  const seedPath  = args.seed  || die('--seed is required');
  const name      = args.name  || die('--name is required');
  const desc      = args.description || '';
  const charDesc  = args.description2 || args.char_description || desc;
  const libPath   = args.lib   || resolve(PROJECT_ROOT, 'characters');

  log(`Creating character '${name}' from seed: ${seedPath}`);

  const lib = new CharacterLibrary({ libraryPath: libPath });

  // Check if name already exists
  const existing = await lib.list();
  const dup = existing.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (dup) {
    log(`Character '${name}' already exists as '${dup.id}'. Use --force to overwrite.`);
    if (!args.force) process.exit(0);
    await lib.delete(dup.id);
  }

  const gen = new CharacterGenerator();

  log('Generating reference set (5 angles)...');
  const char = await gen.createCharacterWithReferences({
    name,
    description: desc,
    characterDescription: charDesc || desc,
    seedImagePath: seedPath,
    libraryPath: libPath,
    onProgress: (msg) => log(msg),
  });

  log(`✓ Character created: ${char.id}`);
  log(`  Name:        ${char.name}`);
  log(`  Description: ${char.description}`);
  log(`  References:  ${Object.values(char.references || {}).filter(Boolean).length}/5 complete`);
  log(`  Library:     ${resolve(libPath, char.id)}`);
}

async function cmdCharacterList() {
  const libPath = args.lib || resolve(PROJECT_ROOT, 'characters');
  const lib = new CharacterLibrary({ libraryPath: libPath });
  const chars = await lib.list();

  if (chars.length === 0) {
    log('No characters found. Run: node cli.js character create --seed <img> --name <name>');
    return;
  }

  console.log(`\nCharacters (${chars.length}):`);
  console.log('─'.repeat(70));
  for (const c of chars) {
    const refCount = Object.values(c.references || {}).filter(Boolean).length;
    const status = refCount === 5 ? '✓' : `⚠ ${refCount}/5`;
    console.log(`  ${status}  ${c.id.padEnd(30)} ${c.name} (${c.created})`);
  }
  console.log('');
}

async function cmdCharacterInfo() {
  const charId = args.id || die('--id is required');
  const libPath = args.lib || resolve(PROJECT_ROOT, 'characters');
  const lib = new CharacterLibrary({ libraryPath: libPath });

  const char = await lib.get(charId);
  if (!char) die(`Character not found: ${charId}`);

  console.log(`\nCharacter: ${char.name} (${char.id})`);
  console.log('─'.repeat(50));
  console.log(`  Created:      ${char.created}`);
  console.log(`  Description:  ${char.description}`);
  console.log(`  Active:       ${char.active}`);
  console.log(`  Seed image:   ${char.seed_image}`);
  console.log(`  Variants:     ${(char.variants || []).join(', ') || 'none'}`);
  console.log('\n  References:');
  for (const [type, path] of Object.entries(char.references || {})) {
    const present = path ? '✓' : '✗';
    console.log(`    ${present}  ${type.padEnd(15)} ${path || '(missing)'}`);
  }

  // Check for actual files
  const check = await lib.checkReferences(charId);
  if (!check.complete) {
    console.log(`\n  ⚠ Missing references: ${check.missing.join(', ')}`);
  }

  console.log('');
}

async function cmdCharacterRefs() {
  const charId = args.id || die('--id is required');
  const libPath = args.lib || resolve(PROJECT_ROOT, 'characters');
  const lib = new CharacterLibrary({ libraryPath: libPath });

  const base64 = await lib.loadReferenceBase64(charId);
  console.log(`\nCharacter '${charId}' reference images:`);
  console.log(`  Count: ${base64.length}`);
  for (let i = 0; i < base64.length; i++) {
    console.log(`  [${i + 1}] ${base64[i].slice(0, 20)}... (${Math.round(base64[i].length / 1024)}KB base64)`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Generate commands
// ---------------------------------------------------------------------------

async function cmdGenerate() {
  if (args.script) {
    await cmdGenerateScript();
  } else if (args.series) {
    await cmdGenerateSeries();
  } else {
    die('--script <path> or --series <id> is required');
  }
}

async function cmdGenerateScript() {
  const scriptPath = resolve(PROJECT_ROOT, args.script);
  const { existsSync } = await import('fs');
  if (!existsSync(scriptPath)) die(`Script not found: ${scriptPath}`);

  log(`Generating from script: ${scriptPath}`);
  const pipeline = new CharacterPipeline();

  const result = await pipeline.generateFromScript({
    scriptPath,
    onStageComplete: (stageData) => {
      const { stage, status, ...rest } = stageData;
      log(`[${stage}] ${status}`, Object.keys(rest).length > 0 ? JSON.stringify(rest) : '');
    },
  });

  if (result.status === 'completed') {
    log(`✓ Video generated successfully`);
    log(`  Script:   ${result.scriptId}`);
    log(`  Video URL: ${result.videoUrl}`);
    log(`  Local:    ${result.localPath || '(not downloaded)'}`);
    log(`  Task ID:  ${result.taskId}`);
  } else {
    die(`Generation failed: ${result.error}`);
  }
}

async function cmdGenerateSeries() {
  const seriesId  = args.series;
  const fromEp    = parseInt(args.from || '1', 10);
  const toEp      = parseInt(args.to   || '0', 10) || undefined;

  log(`Generating series '${seriesId}' episodes ${fromEp}–${toEp || '?'}`);
  const pipeline = new CharacterPipeline();

  const results = await pipeline.generateSeries(seriesId, {
    fromEpisode: fromEp,
    toEpisode:   toEp,
    onProgress: (msg) => log(msg),
  });

  const done = results.filter(r => r.status === 'completed').length;
  log(`\nSeries complete: ${done}/${results.length} episodes generated`);

  for (const r of results) {
    const icon = r.status === 'completed' ? '✓' : '✗';
    log(`  ${icon} ${r.scriptId}: ${r.status}${r.error ? ` — ${r.error}` : ''}`);
  }
}

async function cmdBatchGenerate() {
  const dirPath = resolve(PROJECT_ROOT, args.dir || 'scripts/pending');
  const { readdirSync, existsSync } = await import('fs');

  if (!existsSync(dirPath)) die(`Directory not found: ${dirPath}`);

  const files = readdirSync(dirPath)
    .filter(f => f.endsWith('.json'))
    .map(f => resolve(dirPath, f));

  if (files.length === 0) die(`No .json scripts found in: ${dirPath}`);

  log(`Batch generating ${files.length} scripts from: ${dirPath}`);
  const pipeline = new CharacterPipeline();
  const results = await pipeline.batchGenerate(files, { onProgress: (m) => log(m) });

  const done = results.filter(r => r.status === 'completed').length;
  log(`\nBatch complete: ${done}/${results.length} generated`);
  for (const r of results) {
    const icon = r.status === 'completed' ? '✓' : '✗';
    log(`  ${icon} ${r.scriptId || r.scriptPath}: ${r.status}${r.error ? ` — ${r.error}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Status command
// ---------------------------------------------------------------------------

async function cmdStatus() {
  // Status command requires manual checking on hailuoai.video
  log('S2V task status is checked via the Hailuo web UI at:');
  log('  https://hailuoai.video/create/subject-reference-to-video');
  log('Browser automation does not expose a separate task ID polling API.');
  console.log('');
}

// ---------------------------------------------------------------------------
// QC command
// ---------------------------------------------------------------------------

async function cmdQC() {
  const videoPath = args.video      || die('--video is required');
  const charId    = args.character  || die('--character is required');

  log(`QC check for: ${videoPath} (character: ${charId})`);

  const { existsSync, statSync } = await import('fs');
  if (!existsSync(videoPath)) die(`Video not found: ${videoPath}`);

  const stats = statSync(videoPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log(`\nQC Results for: ${videoPath}`);
  console.log('─'.repeat(40));
  console.log(`  File size: ${sizeMB} MB ${stats.size < 1_000_000 ? '⚠ TOO SMALL (<1MB)' : stats.size < 100_000 ? '⚠ Small' : '✓'}`);

  if (stats.size < 1_000_000) {
    console.log('  ⚠ Video suspiciously small — likely broken or incomplete');
  }

  const lib = new CharacterLibrary();
  const char = await lib.get(charId);
  if (char) {
    const check = await lib.checkReferences(charId);
    console.log(`  Character refs: ${check.complete ? '✓ Complete' : '⚠ Missing: ' + check.missing.join(', ')}`);
  }

  console.log('');
}

// ---------------------------------------------------------------------------
// S2V test command
// ---------------------------------------------------------------------------

async function cmdS2VTest() {
  const prompt   = args.prompt  || 'A person walking confidently through a modern office corridor.';
  const refsId   = args.refs;

  const s2v = new S2VGenerator();
  await s2v.init();

  // Check login
  const loggedIn = await s2v.isLoggedIn();
  if (!loggedIn) {
    die('Not logged in to Hailuo. Run: node scripts/setup-hailuo-app-session.js');
  }

  let subjectReferences = [];
  if (refsId) {
    const lib = new CharacterLibrary();
    const char = await lib.get(refsId);
    if (!char) die(`Character not found: ${refsId}`);
    subjectReferences = await lib.loadReferenceFilePaths(refsId);
    log(`Loaded ${subjectReferences.length} reference images for '${refsId}'`);
  } else {
    // Use a test image if available
    const testImg = resolve(PROJECT_ROOT, 'test-character.png');
    if (existsSync(testImg)) {
      subjectReferences = [testImg];
      log('Using test-character.png as reference');
    } else {
      log('⚠ No reference images provided and no test image found. S2V requires reference images.');
    }
  }

  log(`Starting S2V generation...`);
  log(`Prompt: ${prompt.slice(0, 80)}...`);

  const result = await s2v.generate({
    subjectReferences,
    prompt,
    duration: 6,
    aspect_ratio: '9:16',
  });

  log(`✓ Video ready: ${result.videoUrl}`);
  if (result.localPath) log(`  Saved to: ${result.localPath}`);
  log(`  Task ID: ${result.taskId}`);

  await s2v.close();
}

// ---------------------------------------------------------------------------
// Entry guard
// ---------------------------------------------------------------------------
