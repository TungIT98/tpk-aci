#!/usr/bin/env node
/**
 * scripts/qc-check.js
 * CLI tool for running QC checks on a video.
 *
 * Usage:
 *   node scripts/qc-check.js --video path/to/video.mp4 --channel productivity_worker --platform youtube
 *   node scripts/qc-check.js --video https://example.com/video.mp4 --channel gen_z_success --platform tiktok
 */

const { QCRunner } = require('../lib/qc/qc-runner');

// Simple arg parser
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.join('=') || true];
  })
);

const video = args.video || args.v;
const channel = args.channel || args.c || 'productivity_worker';
const platform = args.platform || args.p || 'youtube';
const output = args.output || args.o || null;
const skipHuman = args['skip-human'] || false;

if (!video) {
  console.error('Usage: node scripts/qc-check.js --video <path or URL> [--channel productivity_worker|gen_z_success] [--platform youtube|tiktok|instagram_reels|linkedin] [--output logs/qc-results.json] [--skip-human]');
  console.error('\nExamples:');
  console.error('  node scripts/qc-check.js --video output/pw01_final.mp4 --channel productivity_worker --platform youtube');
  console.error('  node scripts/qc-check.js --video output/gz01_final.mp4 --channel gen_z_success --platform tiktok');
  process.exit(1);
}

async function main() {
  console.log(`\nQC Runner — TKP Content Agency`);
  console.log(`Video: ${video}`);
  console.log(`Channel: ${channel}`);
  console.log(`Platform: ${platform}`);
  console.log(`Human review: ${skipHuman ? 'SKIPPED' : 'REQUIRED'}`);
  console.log(`\nRunning automated checks...\n`);

  const qc = new QCRunner(channel);

  try {
    const result = await qc.run(video, { platform, skipHumanReview: skipHuman });

    qc.printReport(result);

    if (output) {
      qc.log(result, output);
      console.log(`\nResult logged to: ${output}`);
    }

    // Exit code based on pass/fail
    process.exit(result.summary.overallPass ? 0 : 1);
  } catch (err) {
    console.error(`\n❌ QC run error: ${err.message}`);
    process.exit(2);
  }
}

main();
