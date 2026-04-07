#!/usr/bin/env node
/**
 * scripts/production-dashboard.js
 * Production dashboard CLI — displays queue status, daily progress,
 * cost tracking, and bottleneck alerts.
 *
 * Usage:
 *   node scripts/production-dashboard.js              # Show current status
 *   node scripts/production-dashboard.js --jobs       # Show all queued jobs
 *   node scripts/production-dashboard.js --failed     # Show failed jobs
 *   node scripts/production-dashboard.js --add --channel=productivity_worker --title="How I Structure My Morning"
 */

const { ProductionQueue } = require('../lib/production/queue-manager');
const path = require('path');
const fs = require('fs');

// ─── Simple ANSI colors ───────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  brightGreen: '\x1b[92m',
  brightRed: '\x1b[91m',
  brightYellow: '\x1b[93m',
};

function color(n, text) { return `${c[n]}${text}${c.reset}`; }

// ─── Dashboard renderer ───────────────────────────────────────────────────────

async function renderDashboard(queue) {
  const stats = queue.getStats();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const logDir = queue.logDir;

  // Load recent logs
  const logFile = path.join(logDir, `production_${today}.json`);
  const recentEvents = fs.existsSync(logFile)
    ? JSON.parse(fs.readFileSync(logFile, 'utf8')).slice(-10)
    : [];

  // Load QC logs
  const qcLogs = [];
  if (fs.existsSync(logDir)) {
    for (const f of fs.readdirSync(logDir)) {
      if (f.endsWith('_qc_report.txt')) {
        qcLogs.push(path.join(logDir, f));
      }
    }
  }

  console.clear();

  // ── Header ──
  console.log(color('bold', `\n  TKP CONTENT AGENCY — Production Dashboard`));
  console.log(`  ${now.toISOString().replace('T', ' ').slice(0, 19)} UTC`);
  console.log('  ' + '─'.repeat(70));

  // ── Daily progress bar ──
  const barLen = 30;
  const filled = Math.round((stats.todayDone / stats.dailyTarget) * barLen);
  const bar = color('brightGreen', '█'.repeat(filled)) + color('dim', '░'.repeat(barLen - filled));
  const pct = stats.dailyPercent;
  const pctColor = pct >= 100 ? 'brightGreen' : pct >= 60 ? 'yellow' : 'red';
  console.log(`\n  ${color('bold', 'Daily Progress')}  ${bar}  ${color(pctColor, `${pct}%`)}  (${stats.todayDone}/${stats.dailyTarget} videos)`);

  // ── Stats grid ──
  const grid = [
    ['Queue', stats.total, color('cyan', String(stats.total))],
    ['Pending', stats.pending, color('yellow', String(stats.pending))],
    ['Running', stats.running, color('cyan', String(stats.running))],
    ['Done (all)', stats.done, color('brightGreen', String(stats.done))],
    ['Failed', stats.failed, color('red', String(stats.failed))],
    ['QC Fail', stats.qcFail, color('red', String(stats.qcFail))],
    ['Hailuo Today', `${stats.hailuoUsedToday}/${stats.hailuoDailyLimit}`,
      stats.hailuoUsedToday >= stats.hailuoDailyLimit ? color('red', `${stats.hailuoUsedToday}/${stats.hailuoDailyLimit}`) : color('green', `${stats.hailuoUsedToday}/${stats.hailuoDailyLimit}`)],
    ['Cost (est.)', `$${(stats.totalCostEstimate / 100).toFixed(2)}`, color('cyan', `$${(stats.totalCostEstimate / 100).toFixed(2)}`)],
  ];

  console.log(`\n  ${color('bold', 'Metrics')}`);
  console.log('  ' + '─'.repeat(70));
  for (let i = 0; i < grid.length; i += 2) {
    const a = grid[i];
    const b = grid[i + 1] || ['', '', ''];
    console.log(`  ${pad(a[0], 18)} ${a[2]}    ${pad(b[0], 18)} ${b[2]}`);
  }

  // ── Bottleneck alerts ──
  console.log(`\n  ${color('bold', 'Bottleneck Alerts')}`);
  console.log('  ' + '─'.repeat(70));
  const alerts = [];
  if (stats.hailuoUsedToday >= stats.hailuoDailyLimit) {
    alerts.push({ level: 'ERROR', msg: `Hailuo daily limit reached (${stats.hailuoUsedToday}/${stats.hailuoDailyLimit}). Add billing at platform.minimax.io.` });
  }
  if (stats.todayDone < stats.dailyTarget && stats.running === 0 && stats.pending === 0) {
    alerts.push({ level: 'WARN', msg: `No jobs running or pending. Add videos to queue.` });
  }
  if (stats.failed > 0) {
    alerts.push({ level: 'ERROR', msg: `${stats.failed} job(s) failed permanently — check logs/production/*.json` });
  }
  if (stats.qcFail > 0) {
    alerts.push({ level: 'WARN', msg: `${stats.qcFail} job(s) failed QC — review logs/queue/*_qc_report.txt` });
  }
  if (alerts.length === 0) {
    console.log(`  ${color('green', '  ✓ No bottlenecks detected')}`);
  } else {
    for (const a of alerts) {
      const lvlColor = a.level === 'ERROR' ? 'red' : 'yellow';
      console.log(`  ${color(lvlColor, `  ${a.level}:`)} ${a.msg}`);
    }
  }

  // ── Recent activity ──
  console.log(`\n  ${color('bold', 'Recent Activity')}`);
  console.log('  ' + '─'.repeat(70));
  if (recentEvents.length === 0) {
    console.log(`  ${color('dim', '  No events yet today')}`);
  } else {
    for (const e of recentEvents.slice(-6).reverse()) {
      const t = e.time.slice(11, 19);
      console.log(`  ${color('dim', t)} ${e.message}${e.jobId ? ` (${e.jobId.slice(0, 16)})` : ''}`);
    }
  }

  // ── Next jobs in queue ──
  const pending = queue.getJobs({ status: 'pending' }).slice(0, 5);
  console.log(`\n  ${color('bold', 'Next Jobs (Priority Queue)')}`);
  console.log('  ' + '─'.repeat(70));
  if (pending.length === 0) {
    console.log(`  ${color('dim', '  Queue empty')}`);
  } else {
    for (const j of pending) {
      const ch = j.channel === 'productivity_worker' ? 'PW' : 'GZ';
      const title = j.title ? j.title.slice(0, 50) : j.script.slice(0, 50);
      console.log(`  [${color('cyan', ch)}] ${color('bold', `P${j.priority}`)} ${title}`);
    }
  }

  // ── Help ──
  console.log(`\n  ${color('dim', 'Commands: --jobs  --failed  --add  --stats  --help')}`);
  console.log('');
}

function pad(str, len) {
  return String(str).padEnd(len);
}

// ─── CLI handlers ─────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const flags = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [k, ...v] = arg.slice(2).split('=');
      flags[k] = v.join('=') || true;
    }
  }

  if (flags.help || flags.h) {
    console.log(`
TKP Production Dashboard

Usage:
  node scripts/production-dashboard.js              Show dashboard
  node scripts/production-dashboard.js --jobs        List all queued jobs
  node scripts/production-dashboard.js --failed     List failed jobs
  node scripts/production-dashboard.js --stats       Show raw stats JSON
  node scripts/production-dashboard.js --add        Interactive job add
  node scripts/production-dashboard.js --run        Run one batch iteration
  node scripts/production-dashboard.js --help       Show this help
    `.trim());
    return;
  }

  const queue = new ProductionQueue();
  await queue.init();

  if (flags.jobs) {
    const all = queue.getJobs();
    console.log(`\nAll Jobs (${all.length} total):\n`);
    for (const j of all) {
      console.log(`  ${queue._statusIcon(j.status)} [${j.channel.slice(0, 3)}] P${j.priority} ${j.id} ${j.status}${j.title ? ` "${j.title.slice(0, 50)}"` : ''}`);
    }
    return;
  }

  if (flags.failed) {
    const failed = queue.getJobs().filter(j => ['failed', 'qc_fail'].includes(j.status));
    console.log(`\nFailed Jobs (${failed.length}):\n`);
    for (const j of failed) {
      console.log(`  ${j.id} [${j.channel}] ${j.status}`);
      for (const e of j.errors.slice(-3)) {
        console.log(`    ${e.time?.slice(11, 19)} ${e.error || e}`);
      }
    }
    return;
  }

  if (flags.stats) {
    const s = queue.getStats();
    console.log(JSON.stringify(s, null, 2));
    return;
  }

  if (flags.add) {
    // Add job from command line
    const opts = {
      channel: flags.channel || flags.c || 'productivity_worker',
      title: flags.title || '',
      script: flags.script || flags.prompt || '',
      platforms: flags.platforms ? flags.platforms.split(',') : undefined,
      priority: parseInt(flags.priority || '5'),
    };
    if (!opts.script && !opts.title) {
      console.error('--script or --title required');
      process.exit(1);
    }
    const job = queue.addJob(opts);
    console.log(`\n✓ Job added: ${job.id}`);
    console.log(`  Channel: ${job.channel}`);
    console.log(`  Priority: ${job.priority}`);
    return;
  }

  if (flags.run) {
    console.log('Running batch...\n');
    const launched = await queue.runBatch();
    console.log(`✓ Launched ${launched.length} job(s)`);
    return;
  }

  // Default: render dashboard
  await renderDashboard(queue);
}

main().catch(err => {
  console.error(`Dashboard error: ${err.message}`);
  process.exit(1);
});
