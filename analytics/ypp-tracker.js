/**
 * analytics/ypp-tracker.js
 * YouTube Partner Program (YPP) eligibility tracker
 *
 * Tracks: subscribers, watch hours, Shorts views
 * Targets: 1000 subscribers + 4000 watch hours (OR 10M Shorts views)
 *
 * Usage:
 *   node analytics/ypp-tracker.js               # pull latest from YouTube API
 *   node analytics/ypp-tracker.js --manual     # prompt for manual entry
 *   node analytics/ypp-tracker.js --report     # print formatted report
 *   node analytics/ypp-tracker.js --milestones  # show milestone status
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'logs', 'ypp-metrics.json');
const CHANNEL_FILE = path.join(__dirname, '..', '.env');

// YPP thresholds
const YPP_THRESHOLDS = {
  subscribers: 1000,
  watchHours: 4000,
  shortsViews: 10_000_000,
};

// Milestone checkpoints (%)
const MILESTONES = [1, 5, 10, 25, 50, 75, 90, 100];

/**
 * Load environment variables from .env
 */
function loadEnv() {
  const env = {};
  try {
    const lines = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    for (const line of lines.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  } catch (_) {}
  return env;
}

/**
 * Read stored metrics from disk
 */
function loadMetrics() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (_) {
    return {
      entries: [],
      channels: {
        primary: { name: 'Productivity Worker', baseline: null },
        secondary: { name: 'Gen Z Success', baseline: null },
      },
    };
  }
}

/**
 * Save metrics to disk
 */
function saveMetrics(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * Fetch channel stats from YouTube Data API v3
 */
async function fetchYouTubeStats(channelId, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API error: ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (!json.items || json.items.length === 0) throw new Error(`Channel ${channelId} not found`);
  const s = json.items[0].statistics;
  return {
    subscribers: parseInt(s.subscriberCount, 10),
    totalViews: parseInt(s.viewCount, 10),
    videoCount: parseInt(s.videoCount, 10),
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch watch hours and Shorts stats using YouTube Reporting API
 * Requires OAuth - for basic stats we estimate from channel analytics
 */
async function fetchChannelAnalytics(accessToken, channelId) {
  // Use YouTube Analytics API for real-time stats
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const url = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${channelId}&startDate=${thirtyDaysAgo}&endDate=${today}&metrics=estimatedMinutesWatched,views,subscribersGained,subscribersLost&dimensions=day&sort=day&access_token=${accessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube Analytics API error: ${res.status}`);
  const json = await res.json();

  let watchMinutes = 0;
  if (json.rows) {
    for (const row of json.rows) {
      watchMinutes += row[0] || 0;
    }
  }

  const watchHours = Math.round(watchMinutes / 60);

  // Shorts views require separate query
  const shortsUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${channelId}&startDate=${thirtyDaysAgo}&endDate=${today}&metrics=views&filters=videoType==SHORTS&access_token=${accessToken}`;
  const shortsRes = await fetch(shortsUrl);
  let shortsViews = 0;
  if (shortsRes.ok) {
    const shortsJson = await shortsRes.json();
    if (shortsJson.rows) shortsViews = shortsJson.rows.reduce((sum, r) => sum + r[0], 0);
  }

  return { watchHours, shortsViews };
}

/**
 * Record a new metrics entry
 */
async function recordEntry(channelId, opts = {}) {
  const env = loadEnv();
  const metrics = loadMetrics();

  const entry = {
    timestamp: new Date().toISOString(),
    subscribers: null,
    watchHours: null,
    shortsViews: null,
    totalViews: null,
    source: 'unknown',
  };

  if (channelId && env.YOUTUBE_API_KEY) {
    try {
      const stats = await fetchYouTubeStats(channelId, env.YOUTUBE_API_KEY);
      entry.subscribers = stats.subscribers;
      entry.totalViews = stats.totalViews;
      entry.source = 'youtube_api';
    } catch (e) {
      console.error('[YPP] YouTube API fetch failed:', e.message);
    }
  }

  if (env.YOUTUBE_ACCESS_TOKEN && channelId) {
    try {
      const analytics = await fetchChannelAnalytics(env.YOUTUBE_ACCESS_TOKEN, channelId);
      entry.watchHours = analytics.watchHours;
      entry.shortsViews = analytics.shortsViews;
    } catch (e) {
      console.error('[YPP] Analytics fetch failed:', e.message);
    }
  }

  // Allow manual override
  if (opts.subscribers != null) entry.subscribers = opts.subscribers;
  if (opts.watchHours != null) entry.watchHours = opts.watchHours;
  if (opts.shortsViews != null) entry.shortsViews = opts.shortsViews;
  if (opts.source) entry.source = opts.source;

  if (!metrics.channels[channelId]) {
    metrics.channels[channelId] = { name: opts.channelName || channelId, baseline: entry };
  }

  metrics.entries.push(entry);
  saveMetrics(metrics);

  console.log(`[YPP] Recorded: ${entry.subscribers} subs, ${entry.watchHours}h watch, ${entry.shortsViews} Shorts views`);
  return entry;
}

/**
 * Calculate milestone progress
 */
function getProgress(current, target) {
  if (!current || current <= 0) return 0;
  const pct = (current / target) * 100;
  return Math.min(100, Math.round(pct * 10) / 10);
}

function getMilestoneStatus(current, target) {
  const pct = getProgress(current, target);
  const achieved = MILESTONES.filter(m => pct >= m);
  const next = MILESTONES.find(m => pct < m) || 100;
  return { pct, achieved, next, eligible: pct >= 100 };
}

/**
 * Check YPP eligibility
 */
function checkEligibility(stats) {
  const subs = getMilestoneStatus(stats.subscribers, YPP_THRESHOLDS.subscribers);
  const watch = getMilestoneStatus(stats.watchHours, YPP_THRESHOLDS.watchHours);
  const shorts = getMilestoneStatus(stats.shortsViews, YPP_THRESHOLDS.shortsViews);

  // Eligible via either path
  const eligible =
    (subs.eligible && watch.eligible) ||
    shorts.eligible;

  return { subscriber: subs, watchHours: watch, shortsViews: shorts, eligible };
}

/**
 * Print a formatted report
 */
function printReport(stats, eligibility) {
  const bar = (pct, width = 20) => {
    const filled = Math.round((pct / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled) + ` ${pct}%`;
  };

  console.log('\n========================================');
  console.log('  YPP ELIGIBILITY TRACKER REPORT');
  console.log('  Generated:', new Date().toLocaleString());
  console.log('========================================\n');

  console.log(`  Subscribers:  ${stats.subscribers?.toLocaleString() ?? 'N/A'} / ${YPP_THRESHOLDS.subscribers.toLocaleString()}`);
  console.log(`  ${bar(eligibility.subscriber.pct)}`);
  if (eligibility.subscriber.achieved.length) {
    console.log(`  ✓ Milestones hit: ${eligibility.subscriber.achieved.join(', ')}%`);
  }
  console.log(`  Next milestone: ${eligibility.subscriber.next}%\n`);

  console.log(`  Watch Hours:  ${stats.watchHours?.toLocaleString() ?? 'N/A'} / ${YPP_THRESHOLDS.watchHours.toLocaleString()}`);
  console.log(`  ${bar(eligibility.watchHours.pct)}`);
  if (eligibility.watchHours.achieved.length) {
    console.log(`  ✓ Milestones hit: ${eligibility.watchHours.achieved.join(', ')}%`);
  }
  console.log(`  Next milestone: ${eligibility.watchHours.next}%\n`);

  console.log(`  Shorts Views: ${stats.shortsViews?.toLocaleString() ?? 'N/A'} / ${YPP_THRESHOLDS.shortsViews.toLocaleString()}`);
  console.log(`  ${bar(eligibility.shortsViews.pct)}`);
  if (eligibility.shortsViews.achieved.length) {
    console.log(`  ✓ Milestones hit: ${eligibility.shortsViews.achieved.join(', ')}%`);
  }
  console.log(`  Next milestone: ${eligibility.shortsViews.next}%\n`);

  console.log('========================================');
  if (eligibility.eligible) {
    console.log('  STATUS: ✓ YPP ELIGIBLE');
  } else {
    const remaining = [];
    if (!eligibility.subscriber.eligible) remaining.push(`${YPP_THRESHOLDS.subscribers - (stats.subscribers || 0)} subscribers`);
    if (!eligibility.watchHours.eligible) remaining.push(`${YPP_THRESHOLDS.watchHours - (stats.watchHours || 0)} watch hours`);
    if (!eligibility.shortsViews.eligible) remaining.push(`${(YPP_THRESHOLDS.shortsViews - (stats.shortsViews || 0)).toLocaleString()} Shorts views`);
    console.log('  STATUS: ✗ Not yet eligible');
    console.log(`  Remaining: ${remaining.join(', ')}`);
  }
  console.log('========================================\n');
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);
  const env = loadEnv();

  // Parse flags
  let channelArg = null; // null = auto (primary), 'primary', 'secondary', 'all'
  let mode = args[0];

  const remainingArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--channel' || args[i] === '-c') {
      channelArg = args[i + 1];
      i++;
    } else if (args[i] === '--all') {
      channelArg = 'all';
    } else {
      remainingArgs.push(args[i]);
    }
  }
  mode = remainingArgs[0];

  // Determine which channels to process
  const channels = [];
  if (channelArg === 'all' || channelArg === null) {
    if (env.YOUTUBE_CHANNEL_ID) {
      channels.push({ id: env.YOUTUBE_CHANNEL_ID, name: env.YOUTUBE_CHANNEL_NAME || 'Productivity Worker', key: 'primary' });
    }
    if (env.YOUTUBE_SECONDARY_CHANNEL_ID) {
      channels.push({ id: env.YOUTUBE_SECONDARY_CHANNEL_ID, name: env.YOUTUBE_SECONDARY_CHANNEL_NAME || 'Gen Z Success', key: 'secondary' });
    }
    if (channels.length === 0 && mode !== '--report' && mode !== '-r' && mode !== '--milestones' && mode !== '-m') {
      console.error('[YPP] Error: No channel IDs set in .env (YOUTUBE_CHANNEL_ID / YOUTUBE_SECONDARY_CHANNEL_ID)');
      process.exit(1);
    }
  } else if (channelArg === 'primary') {
    if (!env.YOUTUBE_CHANNEL_ID) { console.error('[YPP] Error: YOUTUBE_CHANNEL_ID not set'); process.exit(1); }
    channels.push({ id: env.YOUTUBE_CHANNEL_ID, name: env.YOUTUBE_CHANNEL_NAME || 'Productivity Worker', key: 'primary' });
  } else if (channelArg === 'secondary') {
    if (!env.YOUTUBE_SECONDARY_CHANNEL_ID) { console.error('[YPP] Error: YOUTUBE_SECONDARY_CHANNEL_ID not set'); process.exit(1); }
    channels.push({ id: env.YOUTUBE_SECONDARY_CHANNEL_ID, name: env.YOUTUBE_SECONDARY_CHANNEL_NAME || 'Gen Z Success', key: 'secondary' });
  } else {
    // Treat as channel ID
    channels.push({ id: channelArg, name: 'Custom Channel', key: 'custom' });
  }

  if (mode === '--report' || mode === '-r') {
    const metrics = loadMetrics();
    if (channels.length > 1) {
      console.log('\n=== YPP STATUS — ALL CHANNELS ===\n');
      for (const ch of channels) {
        const chEntries = metrics.entries.filter(e => e.channelId === ch.id);
        const latest = chEntries[chEntries.length - 1] || {};
        const eligibility = checkEligibility(latest);
        console.log(`\n--- ${ch.name} ---`);
        printReport(latest, eligibility);
      }
    } else {
      const ch = channels[0];
      const chEntries = metrics.entries.filter(e => e.channelId === ch.id);
      const latest = chEntries[chEntries.length - 1] || {};
      const eligibility = checkEligibility(latest);
      printReport(latest, eligibility);
    }
    return;
  }

  if (mode === '--milestones' || mode === '-m') {
    const metrics = loadMetrics();
    const result = {};
    for (const ch of channels) {
      const chEntries = metrics.entries.filter(e => e.channelId === ch.id);
      const latest = chEntries[chEntries.length - 1] || {};
      const e = checkEligibility(latest);
      result[ch.key] = { name: ch.name, ...e };
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (mode === '--manual') {
    const readline = require('readline');
    for (const ch of channels) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const q = (prompt) => new Promise(res => rl.question(prompt, res));

      console.log(`\n[YPP] Manual entry for: ${ch.name}`);
      const subs = await q('  Subscribers: ');
      const watch = await q('  Watch hours (last 12 months): ');
      const shorts = await q('  Shorts views (last 90 days): ');

      const entry = await recordEntry(ch.id, {
        subscribers: parseInt(subs) || null,
        watchHours: parseInt(watch) || null,
        shortsViews: parseInt(shorts) || null,
        source: 'manual',
        channelName: ch.name,
      });

      rl.close();
      const e = checkEligibility(entry);
      printReport(entry, e);
    }
    return;
  }

  // Default: fetch from API
  if (channels.length === 0) {
    console.error('[YPP] Error: YOUTUBE_CHANNEL_ID not set in .env');
    console.error('[YPP] Run with --manual to enter stats manually');
    process.exit(1);
  }

  for (const ch of channels) {
    console.log(`\n[YPP] Fetching for: ${ch.name}`);
    const entry = await recordEntry(ch.id, { channelName: ch.name });
    const e = checkEligibility(entry);
    printReport(entry, e);
  }
}

module.exports = { recordEntry, checkEligibility, getMilestoneStatus, YPP_THRESHOLDS, loadMetrics };

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
