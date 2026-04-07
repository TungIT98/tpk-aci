#!/usr/bin/env node
/**
 * scripts/hailuo-test.js
 * Test and demo script for Hailuo AI video generation integration.
 *
 * Usage:
 *   node scripts/hailuo-test.js                          # test connectivity
 *   node scripts/hailuo-test.js --prompt "A busy office" # generate one video
 *   node scripts/hailuo-test.js --poll <task_id>         # poll for completion
 *
 * Requirements:
 *   - ANTHROPIC_TOKEN_KEY set in .env (MiniMax API key)
 *   - MINIMAX_BASE_URL set in .env (https://api.minimax.io)
 */

import { HailuoVideo, GENERATION_PRESETS, PROMPT_TEMPLATES, VIDEO_COST_ESTIMATE_USD } from '../lib/hailuo.js';

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [key, val] = arg.replace(/^--/, '').split('=');
    return [key, val ?? true];
  })
);

const COMMAND = args._?.[0] ?? (args.poll ? 'poll' : args.prompt ? 'generate' : 'info');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function section(label) {
  console.log(`\n### ${label}`);
}

async function run() {
  const hailuo = new HailuoVideo();

  if (COMMAND === 'info') {
    // Print configuration and template previews
    section('Hailuo Configuration');
    console.log('Base URL:', hailuo.baseUrl);
    console.log('API key:', hailuo.apiKey ? `set (${hailuo.apiKey.slice(0, 8)}...)` : 'MISSING');
    console.log('Daily limit (free tier):', hailuo.costTracker.count, '/', 3);

    section('Generation Presets');
    for (const [name, preset] of Object.entries(GENERATION_PRESETS)) {
      console.log(`  ${name}:`, JSON.stringify(preset));
    }

    section('Prompt Template Preview — productivity_worker');
    const pw = PROMPT_TEMPLATES.productivity_worker;
    console.log('intro:', pw.intro('Deep work strategies'));
    console.log('hook:',  pw.hook('Are you productive or just busy?'));

    section('Prompt Template Preview — gen_z_success');
    const gz = PROMPT_TEMPLATES.gen_z_success;
    console.log('intro:', gz.intro('Building a $100K side hustle'));
    console.log('hook:',  gz.hook('Why your同龄人 is richer than you'));

    section('Estimated Costs');
    console.log('film.03-fast:',     VIDEO_COST_ESTIMATE_USD['film.03-fast'] ?? '?', '$/video');
    console.log('film.03-standard:', VIDEO_COST_ESTIMATE_USD['film.03-standard'] ?? '?', '$/video');
    return;
  }

  if (COMMAND === 'generate') {
    const prompt = args.prompt ?? 'A modern office workspace at golden hour, professional worker deep in focus, cinematic lighting, camera slowly pushes in';
    const preset = args.preset ?? 'fast';
    const aspect = args.aspect ?? '16:9';

    section(`Generating Video (preset: ${preset}, aspect: ${aspect})`);
    console.log('Prompt:', prompt);

    try {
      console.log('Submitting to MiniMax...');
      const result = await hailuo.generateWithRetry({
        prompt,
        ...GENERATION_PRESETS[preset],
        aspect_ratio: aspect,
      });

      console.log('\nGeneration submitted successfully!');
      console.log('Response:', JSON.stringify(result, null, 2));

      if (result.task_id || result.id) {
        console.log('\nTask ID:', result.task_id ?? result.id);
        console.log('Poll with: node scripts/hailuo-test.js --poll', result.task_id ?? result.id);
      }

      if (result.video_url) {
        console.log('Video URL:', result.video_url);
      }
    } catch (err) {
      console.error('Generation failed:', err.message);
      process.exit(1);
    }
    return;
  }

  if (COMMAND === 'poll') {
    const taskId = args.poll;
    if (!taskId) {
      console.error('Usage: node scripts/hailuo-test.js --poll=<task_id>');
      process.exit(1);
    }

    section(`Polling Task: ${taskId}`);
    try {
      const result = await hailuo.waitForCompletion(taskId);
      console.log('\nCompleted!');
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('Polling failed:', err.message);
      process.exit(1);
    }
    return;
  }

  console.log('Usage:');
  console.log('  node scripts/hailuo-test.js --info                   # show config and templates');
  console.log('  node scripts/hailuo-test.js --prompt="..."           # generate one video');
  console.log('  node scripts/hailuo-test.js --poll=<task_id>         # poll for completion');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
