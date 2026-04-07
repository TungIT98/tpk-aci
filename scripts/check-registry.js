#!/usr/bin/env node
/**
 * scripts/check-registry.js — Video Production Registry dedup gate
 *
 * Run before uploading to prevent duplicate uploads.
 * Run before writing new scripts to avoid duplicate content ideas.
 *
 * Usage:
 *   node scripts/check-registry.js --video PW-01 --platform youtube
 *   node scripts/check-registry.js --video PW-01
 *   node scripts/check-registry.js --search "productivity worker"
 *   node scripts/check-registry.js --list
 *   node scripts/check-registry.js --summary
 */

import { Registry } from '../lib/registry.js';

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    flags[key] = args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : true;
    if (flags[key] !== true) i++;
  }
}

const reg = new Registry();

// ── --summary ─────────────────────────────────────────────────────────────────
if (flags.summary) {
  const s = reg.summary();
  console.log('\n=== Production Registry Summary ===');
  console.log(`Total videos:  ${s.total}`);
  console.log(`Created:       ${s.created}`);
  console.log(`Uploaded:      ${s.uploaded}`);
  console.log('By platform:');
  for (const [platform, count] of Object.entries(s.byPlatform)) {
    console.log(`  ${platform}: ${count}`);
  }
  process.exit(0);
}

// ── --list ────────────────────────────────────────────────────────────────────
if (flags.list) {
  const videos = reg.list();
  console.log('\n=== Production Registry — All Videos ===');
  console.log(`${'ID'.padEnd(8)} ${'Status'.padEnd(10)} ${'Platforms'.padEnd(20)} Title`);
  console.log('-'.repeat(80));
  for (const v of videos) {
    const platforms = v.platforms.map(p => p.platform).join(', ') || '—';
    console.log(`${v.id.padEnd(8)} ${v.status.padEnd(10)} ${platforms.padEnd(20)} ${v.title || v.id}`);
  }
  process.exit(0);
}

// ── --search ──────────────────────────────────────────────────────────────────
if (flags.search) {
  const results = reg.searchByTopic(flags.search);
  console.log(`\n=== Topic Search: "${flags.search}" ===`);
  console.log(`Found ${results.length} video(s):\n`);
  for (const v of results) {
    const platforms = v.platforms.map(p => p.platform).join(', ') || '—';
    console.log(`  [${v.id}] ${v.title || v.id} — status: ${v.status} | platforms: ${platforms}`);
    if (v.topic) console.log(`           topic: ${v.topic}`);
    if (v.file) console.log(`           file:  ${v.file}`);
    console.log();
  }
  if (results.length === 0) {
    console.log('  No matching videos found — topic is free to use.\n');
    process.exit(0);
  }
  process.exit(0);
}

// ── --video ───────────────────────────────────────────────────────────────────
if (flags.video) {
  const id = flags.video;
  const entry = reg.findById(id);

  if (!entry) {
    console.log(`\n[REGISTRY] Video "${id}" not found in registry.`);
    console.log('  → Safe to produce/upload — no duplicate risk.\n');
    process.exit(0);
  }

  console.log(`\n[REGISTRY] Entry found for "${id}":`);
  console.log(`  Title:    ${entry.title || id}`);
  console.log(`  Topic:    ${entry.topic || '—'}`);
  console.log(`  Status:   ${entry.status}`);
  console.log(`  Platforms: ${entry.platforms.map(p => `${p.platform} (${p.uploadedAt})`).join(', ') || 'none'}`);

  // Platform-specific check
  if (flags.platform) {
    const platform = flags.platform.toLowerCase();
    const uploaded = entry.platforms.some(p => p.platform === platform);

    if (uploaded) {
      const upload = entry.platforms.find(p => p.platform === platform);
      console.log(`\n[BLOCKED] "${id}" already uploaded to ${platform}!`);
      console.log(`  URL:     ${upload.url || '—'}`);
      console.log(`  Video ID: ${upload.videoId || '—'}`);
      console.log(`  At:      ${upload.uploadedAt}`);
      console.log('\n  → Refusing to re-upload. Use --force to override.\n');
      if (!flags.force) process.exit(1);
      console.log('[FORCE] Proceeding despite existing upload...\n');
    } else {
      console.log(`\n[OK] "${id}" not yet uploaded to ${platform}.`);
      console.log('  → Safe to upload.\n');
    }
  } else {
    // General status check
    if (entry.status === 'uploaded') {
      console.log(`\n[WARNING] "${id}" has been fully uploaded.`);
      console.log('  → Check individual platforms above for details.\n');
    } else {
      console.log(`\n[OK] "${id}" is in "${entry.status}" status — not yet fully uploaded.\n`);
    }
  }

  process.exit(0);
}

// ── Default: help ─────────────────────────────────────────────────────────────
console.log(`
Video Production Registry — Dedup Gate

Usage:
  node scripts/check-registry.js --video <id>           Check video by ID
  node scripts/check-registry.js --video <id> --platform <platform>  Check specific platform
  node scripts/check-registry.js --search "<keyword>"    Search by topic/keyword
  node scripts/check-registry.js --list                 List all videos
  node scripts/check-registry.js --summary               Show registry summary

Platforms: youtube, tiktok, instagram, linkedin

Examples:
  # Before uploading — check if already on YouTube
  node scripts/check-registry.js --video PW-01 --platform youtube

  # Before writing a script — search for similar topics
  node scripts/check-registry.js --search "productivity worker"

  # Upload gate (used automatically by upload scripts)
  # Exit code 1 = blocked, exit code 0 = safe to proceed
`);
process.exit(0);
