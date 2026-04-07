/**
 * analytics/channel-dashboard.js
 * Channel Performance Dashboard — pull, record, and report
 *
 * Tracks: views, subscribers, watch hours, CTR, RPM, video-level stats
 *
 * Usage:
 *   node analytics/channel-dashboard.js --pull             Pull latest from YouTube API
 *   node analytics/channel-dashboard.js --manual           Prompt for manual data entry
 *   node analytics/channel-dashboard.js --report           Print formatted report to console
 *   node analytics/channel-dashboard.js --update           Update dashboards/content files
 *   node analytics/channel-dashboard.js --weekly          Generate weekly report
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DASHBOARD_FILE = path.join(ROOT, 'content', 'dashboards', 'channel-performance.md');
const SUBS_FILE = path.join(ROOT, 'content', 'dashboards', 'subscriber-growth.md');
const WATCH_FILE = path.join(ROOT, 'content', 'dashboards', 'watch-time-optimization.md');
const ADSENSE_FILE = path.join(ROOT, 'content', 'dashboards', 'adsense-revenue.md');
const DATA_FILE = path.join(ROOT, 'logs', 'channel-metrics.json');
const VIDEO_DATA_FILE = path.join(ROOT, 'logs', 'video-stats.json');

// YPP thresholds
const YPP_SUBS = 1000;
const YPP_WATCH_HRS = 4000;

// ── ENV ──────────────────────────────────────────────────────────────────────

function loadEnv() {
  const env = {};
  try {
    const lines = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of lines.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  } catch (_) {}
  return env;
}

// ── DATA PERSISTENCE ─────────────────────────────────────────────────────────

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (_) {
    return {
      lastUpdated: null,
      channels: {
        primary: { name: 'Productivity Worker', baseline: null },
        secondary: { name: 'Gen Z Success', baseline: null },
      },
      entries: [],
    };
  }
}

function saveData(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadVideoData() {
  try {
    return JSON.parse(fs.readFileSync(VIDEO_DATA_FILE, 'utf8'));
  } catch (_) {
    return { videos: [] };
  }
}

function saveVideoData(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(VIDEO_DATA_FILE, JSON.stringify(data, null, 2));
}

// ── YOUTUBE API ──────────────────────────────────────────────────────────────

async function fetchChannelStats(channelId, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (!json.items || json.items.length === 0) throw new Error(`Channel ${channelId} not found`);
  const s = json.items[0].statistics;
  const snippet = json.items[0].snippet;
  return {
    channelId,
    channelName: snippet.title,
    subscribers: parseInt(s.subscriberCount, 10) || 0,
    totalViews: parseInt(s.viewCount, 10) || 0,
    videoCount: parseInt(s.videoCount, 10) || 0,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchAnalytics(accessToken, channelId) {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  // 30-day summary
  const url = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==${channelId}` +
    `&startDate=${thirtyDaysAgo}&endDate=${today}` +
    `&metrics=estimatedMinutesWatched,views,subscribersGained,subscribersLost,estimatedRevenue,averageViewDuration` +
    `&dimensions=day&sort=day&access_token=${accessToken}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube Analytics API ${res.status}`);
  const json = await res.json();

  let watchMinutes = 0;
  let views = 0;
  let subsGained = 0;
  let subsLost = 0;
  let revenue = 0;
  let totalDurationSec = 0;
  let dayCount = 0;

  if (json.rows) {
    for (const row of json.rows) {
      watchMinutes += row[0] || 0;
      views += row[1] || 0;
      subsGained += row[2] || 0;
      subsLost += row[3] || 0;
      revenue += row[4] || 0;
      totalDurationSec += row[5] || 0;
      dayCount++;
    }
  }

  const watchHours = Math.round(watchMinutes / 60 * 100) / 100;
  const avgDurationSec = dayCount > 0 ? Math.round(totalDurationSec / dayCount) : 0;
  const avgDurationMin = Math.round(avgDurationSec / 60 * 100) / 100;

  return {
    watchHours,
    views,
    subsGained,
    subsLost,
    netSubs: subsGained - subsLost,
    revenue,
    avgDurationSec,
    avgDurationMin,
  };
}

// ── METRICS ENTRY ────────────────────────────────────────────────────────────

async function recordMetrics(channelId, opts = {}) {
  const env = loadEnv();
  const data = loadData();

  const entry = {
    timestamp: new Date().toISOString(),
    channelId: channelId || env.YOUTUBE_CHANNEL_ID || 'unknown',
    channelName: opts.channelName || 'Unknown Channel',
    subscribers: null,
    totalViews: null,
    videoCount: null,
    watchHours: null,
    views30d: null,
    subsGained: null,
    subsLost: null,
    netSubs: null,
    revenue: null,
    avgDuration: null,
    source: 'unknown',
  };

  // API pull
  if (channelId && env.YOUTUBE_API_KEY) {
    try {
      const stats = await fetchChannelStats(channelId, env.YOUTUBE_API_KEY);
      entry.subscribers = stats.subscribers;
      entry.totalViews = stats.totalViews;
      entry.videoCount = stats.videoCount;
      entry.channelName = stats.channelName;
      entry.source = 'youtube_api';
    } catch (e) {
      console.error(`[Dashboard] Channel stats fetch failed: ${e.message}`);
    }

    if (env.YOUTUBE_ACCESS_TOKEN) {
      try {
        const analytics = await fetchAnalytics(env.YOUTUBE_ACCESS_TOKEN, channelId);
        entry.watchHours = analytics.watchHours;
        entry.views30d = analytics.views;
        entry.subsGained = analytics.subsGained;
        entry.subsLost = analytics.subsLost;
        entry.netSubs = analytics.netSubs;
        entry.revenue = analytics.revenue;
        entry.avgDuration = analytics.avgDurationMin;
      } catch (e) {
        console.error(`[Dashboard] Analytics fetch failed: ${e.message}`);
      }
    }
  }

  // Manual overrides
  if (opts.subscribers != null) entry.subscribers = opts.subscribers;
  if (opts.totalViews != null) entry.totalViews = opts.totalViews;
  if (opts.videoCount != null) entry.videoCount = opts.videoCount;
  if (opts.watchHours != null) entry.watchHours = opts.watchHours;
  if (opts.views30d != null) entry.views30d = opts.views30d;
  if (opts.subsGained != null) entry.subsGained = opts.subsGained;
  if (opts.subsLost != null) entry.subsLost = opts.subsLost;
  if (opts.netSubs != null) entry.netSubs = opts.netSubs;
  if (opts.revenue != null) entry.revenue = opts.revenue;
  if (opts.avgDuration != null) entry.avgDuration = opts.avgDuration;
  if (opts.source) entry.source = opts.source;
  if (opts.channelName) entry.channelName = opts.channelName;

  data.entries.push(entry);
  saveData(data);

  const subPct = entry.subscribers != null
    ? Math.min(100, Math.round((entry.subscribers / YPP_SUBS) * 1000) / 10).toFixed(1)
    : 'N/A';
  const whPct = entry.watchHours != null
    ? Math.min(100, Math.round((entry.watchHours / YPP_WATCH_HRS) * 1000) / 10).toFixed(1)
    : 'N/A';

  console.log(`[Dashboard] Recorded ${entry.channelName}:`);
  console.log(`  Subscribers: ${entry.subscribers ?? 'N/A'} (${subPct}% of YPP)`);
  console.log(`  Watch Hours: ${entry.watchHours ?? 'N/A'}h (${whPct}% of YPP)`);
  console.log(`  30d Views: ${entry.views30d ?? 'N/A'}`);
  console.log(`  Revenue: $${entry.revenue ?? 'N/A'}`);
  console.log(`  Source: ${entry.source}`);

  return entry;
}

// ── REPORTING ────────────────────────────────────────────────────────────────

function getLatestForChannel(data, channelId) {
  const entries = data.entries.filter(e => e.channelId === channelId);
  return entries[entries.length - 1] || null;
}

function calcRPM(views, revenue) {
  if (!views || views === 0 || revenue == null) return null;
  return (revenue / views) * 1000;
}

function printReport(data, env) {
  const primaryId = env.YOUTUBE_CHANNEL_ID;
  const secondaryId = env.YOUTUBE_SECONDARY_CHANNEL_ID;

  const primary = getLatestForChannel(data, primaryId);
  const secondary = getLatestForChannel(data, secondaryId);

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   CHANNEL PERFORMANCE REPORT                  ║');
  console.log(`║   ${new Date().toLocaleDateString()}                              ║`);
  console.log('╚══════════════════════════════════════════════╝\n');

  for (const [channel, entry] of [['Productivity Worker', primary], ['Gen Z Success', secondary]]) {
    if (!entry) {
      console.log(`${channel}: No data recorded yet.\n`);
      continue;
    }

    const subPct = entry.subscribers != null
      ? Math.min(100, Math.round((entry.subscribers / YPP_SUBS) * 100)).toFixed(1)
      : 'N/A';
    const whPct = entry.watchHours != null
      ? Math.min(100, Math.round((entry.watchHours / YPP_WATCH_HRS) * 100)).toFixed(1)
      : 'N/A';
    const rpm = (entry.views30d && entry.revenue != null) ? calcRPM(entry.views30d, entry.revenue) : null;
    const subRate = entry.views30d && entry.netSubs != null
      ? ((entry.netSubs / entry.views30d) * 100).toFixed(2)
      : null;

    console.log(`${channel} (${entry.channelName})`);
    console.log('─'.repeat(42));
    console.log(`  Subscribers:     ${entry.subscribers?.toLocaleString() ?? 'N/A'} / 1,000 (${subPct}%)`);
    console.log(`  Watch Hours:      ${entry.watchHours ?? 'N/A'}h / 4,000h (${whPct}%)`);
    console.log(`  Total Views:      ${entry.totalViews?.toLocaleString() ?? 'N/A'}`);
    console.log(`  30d Views:        ${entry.views30d?.toLocaleString() ?? 'N/A'}`);
    console.log(`  Videos:           ${entry.videoCount ?? 'N/A'}`);
    console.log(`  Avg Duration:     ${entry.avgDuration ? entry.avgDuration + ' min' : 'N/A'}`);
    console.log(`  30d Subs Gained:  ${entry.subsGained ?? 'N/A'}`);
    console.log(`  30d Unsubs:       ${entry.subsLost ?? 'N/A'}`);
    console.log(`  Net Subs:         ${entry.netSubs ?? 'N/A'}`);
    console.log(`  Sub Rate:         ${subRate ? subRate + '%' : 'N/A'}`);
    console.log(`  30d Revenue:      $${entry.revenue != null ? entry.revenue.toFixed(2) : 'N/A'}`);
    console.log(`  RPM:              ${rpm != null ? '$' + rpm.toFixed(2) : 'N/A'}`);
    console.log(`  Source:           ${entry.source}`);
    console.log('');
  }
}

// ── MANUAL ENTRY ─────────────────────────────────────────────────────────────

async function promptManual() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = (p) => new Promise((res) => rl.question(p, res));

  console.log('\n── Manual Data Entry ──────────────────────────────\n');

  const channelId = await q('Channel ID (or press Enter for primary): ');
  const channelName = await q('Channel name (e.g. "Productivity Worker"): ');
  const subscribers = await q('Total subscribers: ');
  const totalViews = await q('Total channel views: ');
  const videoCount = await q('Videos published: ');
  const watchHours = await q('Watch hours (12-mo): ');
  const views30d = await q('Views (last 30 days): ');
  const subsGained = await q('Subscribers gained (30d): ');
  const subsLost = await q('Subscribers lost (30d): ');
  const revenue = await q('Revenue (30d, USD): ');
  const avgDuration = await q('Avg view duration (minutes): ');

  rl.close();

  const entry = await recordMetrics(channelId.trim() || undefined, {
    channelName: channelName.trim() || 'Manual Entry',
    subscribers: subscribers.trim() ? parseInt(subscribers) : null,
    totalViews: totalViews.trim() ? parseInt(totalViews) : null,
    videoCount: videoCount.trim() ? parseInt(videoCount) : null,
    watchHours: watchHours.trim() ? parseFloat(watchHours) : null,
    views30d: views30d.trim() ? parseInt(views30d) : null,
    subsGained: subsGained.trim() ? parseInt(subsGained) : null,
    subsLost: subsLost.trim() ? parseInt(subsLost) : null,
    netSubs: (subsGained.trim() && subsLost.trim())
      ? parseInt(subsGained) - parseInt(subsLost)
      : null,
    revenue: revenue.trim() ? parseFloat(revenue) : null,
    avgDuration: avgDuration.trim() ? parseFloat(avgDuration) : null,
    source: 'manual',
  });

  return entry;
}

// ── DASHBOARD UPDATE ─────────────────────────────────────────────────────────

function updateDashboards(data, env) {
  const primaryId = env.YOUTUBE_CHANNEL_ID;
  const secondaryId = env.YOUTUBE_SECONDARY_CHANNEL_ID;

  const primary = getLatestForChannel(data, primaryId);
  const secondary = getLatestForChannel(data, secondaryId);

  const today = new Date().toISOString().slice(0, 10);

  // Update channel-performance.md
  if (fs.existsSync(DASHBOARD_FILE)) {
    let content = fs.readFileSync(DASHBOARD_FILE, 'utf8');

    // Replace overview table rows
    const replaceRow = (searchStr, newVal) => {
      const re = new RegExp(searchStr + '.*\\|.*', 'g');
      content = content.replace(re, `${newVal} | ${newVal === 0 ? '0' : '—'}`);
    };

    // Update "Last Updated" footer
    content = content.replace(
      /\*Last updated:.*\*/,
      `*Last updated: ${today}*\n*Managed by: Analytics Agent*`
    );

    fs.writeFileSync(DASHBOARD_FILE, content);
    console.log(`[Dashboard] Updated ${DASHBOARD_FILE}`);
  }

  // Append to weekly-delivered table if data exists
  if (primary || secondary) {
    const weekLabel = `Week ${(data.entries.length)}`;
    const dateLabel = today;
    const pwViews = primary?.views30d ?? '—';
    const pwSubs = primary?.netSubs ?? '—';
    const pwWH = primary?.watchHours ?? '—';
    const pwDur = primary?.avgDuration ?? '—';
    const gzViews = secondary?.views30d ?? '—';
    const gzSubs = secondary?.netSubs ?? '—';
    const gzWH = secondary?.watchHours ?? '—';
    const gzDur = secondary?.avgDuration ?? '—';

    const newRow = `\n| ${weekLabel} | ${dateLabel} | ${pwViews} | ${pwSubs} | ${pwWH} | ${pwDur} | ${gzViews} | ${gzSubs} | ${gzWH} | ${gzDur} |`;
    console.log(`[Dashboard] Weekly row prepared (append to channel-performance.md manually or via --update):`);
    console.log(newRow);
  }

  console.log('\n[Dashboard] Manual steps remaining:');
  console.log('  1. Open content/dashboards/channel-performance.md');
  console.log('  2. Paste the weekly row above into the "Weekly Delivered Metrics" table');
  console.log('  3. Update "Last Updated" timestamp');
}

// ── MAIN CLI ─────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const env = loadEnv();
  const mode = args[0];

  if (mode === '--report' || mode === '-r') {
    const data = loadData();
    printReport(data, env);
    return;
  }

  if (mode === '--manual' || mode === '-m') {
    await promptManual();
    return;
  }

  if (mode === '--update') {
    const data = loadData();
    updateDashboards(data, env);
    return;
  }

  if (mode === '--weekly') {
    // Generate weekly report in content/reports/weekly/
    const data = loadData();
    const primaryId = env.YOUTUBE_CHANNEL_ID;
    const secondaryId = env.YOUTUBE_SECONDARY_CHANNEL_ID;

    const primaryEntries = primaryId ? data.entries.filter(e => e.channelId === primaryId) : [];
    const secondaryEntries = secondaryId ? data.entries.filter(e => e.channelId === secondaryId) : [];
    const primary = primaryEntries[primaryEntries.length - 1] || null;
    const secondary = secondaryEntries[secondaryEntries.length - 1] || null;

    const primaryPrev = primaryEntries.length >= 2 ? primaryEntries[primaryEntries.length - 2] : null;

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    const todayStr = today.toISOString().slice(0, 10);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    if (!primary && !secondary) {
      console.error('[Dashboard] No metrics data found. Run --pull or --manual first.');
      process.exit(1);
    }

    function channelSection(entry, prev, label, channelName) {
      if (!entry) return `### ${label}\n\n*No data recorded for this channel yet.*\n`;
      const rpm = (entry.views30d && entry.revenue != null)
        ? ((entry.revenue / entry.views30d) * 1000).toFixed(2)
        : '—';
      const subRate = (entry.views30d && entry.netSubs != null)
        ? ((entry.netSubs / entry.views30d) * 100).toFixed(2)
        : '—';
      const wowViews = prev && entry.views30d && prev.views30d
        ? ((entry.views30d - prev.views30d) / prev.views30d * 100).toFixed(1) + '%'
        : '—';
      const wowSubs = prev && entry.netSubs != null && prev.netSubs != null
        ? (entry.netSubs - prev.netSubs).toString()
        : '—';
      const wowWH = prev && entry.watchHours && prev.watchHours
        ? ((entry.watchHours - prev.watchHours) / prev.watchHours * 100).toFixed(1) + '%'
        : '—';
      return `### ${label} (${channelName || entry.channelName || 'Unknown'})

| Metric | This Week | WoW Change | Source |
|--------|----------|-----------|--------|
| Subscribers | ${entry.subscribers?.toLocaleString() ?? '—'} | — | ${entry.source} |
| Watch Hours (12 mo) | ${entry.watchHours ?? '—'}h | ${wowWH} | ${entry.source} |
| To 1K Subs | ${Math.max(0, YPP_SUBS - (entry.subscribers || 0)).toLocaleString()} | — | — |
| To 4K Watch Hrs | ${Math.max(0, YPP_WATCH_HRS - (entry.watchHours || 0)).toLocaleString()}h | — | — |
| 30d Views | ${entry.views30d?.toLocaleString() ?? '—'} | ${wowViews} | ${entry.source} |
| 30d Subs Gained | ${entry.subsGained ?? '—'} | — | ${entry.source} |
| 30d Unsubs | ${entry.subsLost ?? '—'} | — | ${entry.source} |
| Net Subs | ${entry.netSubs ?? '—'} | ${wowSubs} | ${entry.source} |
| Sub Rate | ${subRate}% | — | ${entry.source} |
| Revenue | $${entry.revenue != null ? entry.revenue.toFixed(2) : '—'} | — | ${entry.source} |
| RPM | $${rpm} | — | ${entry.source} |

`;
    }

    const report = `# Weekly Performance Report — ${weekStartStr} to ${todayStr}

**Channel(s):** Both Channels (Productivity Worker + Gen Z Success)
**Period:** ${weekStartStr} – ${todayStr}
**Prepared by:** Analytics Agent

---

## Executive Summary

Weekly data snapshot for both channels. ${(primary?.source === 'youtube_api' || secondary?.source === 'youtube_api') ? 'Data sourced from YouTube API.' : 'Data entered manually — verify against YouTube Studio.'}

---

## Channel Breakdown

${channelSection(primary, primaryPrev, 'Productivity Worker', env.YOUTUBE_CHANNEL_NAME || 'Primary')}
${channelSection(secondary, null, 'Gen Z Success', env.YOUTUBE_SECONDARY_CHANNEL_NAME || 'Secondary')}

---

## YPP Progress

| Channel | Subscribers | Watch Hours | To 1K Subs | To 4K Watch Hrs | Eligible? |
|---------|-------------|-------------|-----------|-----------------|-----------|
| Productivity Worker | ${primary?.subscribers ?? '—'} | ${primary?.watchHours ?? '—'} | ${Math.max(0, YPP_SUBS - (primary?.subscribers || 0)).toLocaleString()} | ${Math.max(0, YPP_WATCH_HRS - (primary?.watchHours || 0)).toLocaleString()}h | **No** |
| Gen Z Success | ${secondary?.subscribers ?? '—'} | ${secondary?.watchHours ?? '—'} | ${Math.max(0, YPP_SUBS - (secondary?.subscribers || 0)).toLocaleString()} | ${Math.max(0, YPP_WATCH_HRS - (secondary?.watchHours || 0)).toLocaleString()}h | **No** |

---

## Data Source Configuration

| Setting | Value |
|---------|-------|
| YOUTUBE_API_KEY | ${env.YOUTUBE_API_KEY ? '✅ Set (' + env.YOUTUBE_API_KEY.slice(0, 8) + '...)' : '❌ Not set'} |
| YOUTUBE_ACCESS_TOKEN | ${env.YOUTUBE_ACCESS_TOKEN ? '✅ Set' : '❌ Not set'} |
| Primary Channel ID | ${env.YOUTUBE_CHANNEL_ID || '❌ Not set'} |
| Secondary Channel ID | ${env.YOUTUBE_SECONDARY_CHANNEL_ID || '❌ Not set'} |

---

## Key Insights

1. **[Biggest positive this week]**
2. **[Biggest concern — content quality, CTR, retention]**
3. **[Anything unusual — algorithm changes, content release impact]**

---

## Recommended Actions

- [ ] **Verify data** — cross-check against YouTube Studio (studio.youtube.com)
- [ ] **Set up YouTube API** — add YOUTUBE_API_KEY + YOUTUBE_ACCESS_TOKEN to .env for automated pulls
- [ ] **Enter missing channel data** — run \`node analytics/channel-dashboard.js --manual\` for any channel showing "No data recorded"

---

## Notes

- Report generated: ${new Date().toISOString()}
- Primary source: ${primary?.source || '—'}
- Secondary source: ${secondary?.source || '—'}
- Next run: \`node analytics/channel-dashboard.js --pull\` (API) or \`node analytics/channel-dashboard.js --manual\` (manual)

---

*Prepared by: Analytics Agent*
*Next report: Weekly, upon next data pull*
`;

    const reportPath = path.join(ROOT, 'content', 'reports', 'weekly', `WEEKLY-${todayStr}.md`);
    fs.writeFileSync(reportPath, report);
    console.log(`[Dashboard] Weekly report written to ${reportPath}`);
    return;
  }

  // Default: --pull
  const channelId = env.YOUTUBE_CHANNEL_ID;
  if (!channelId || !env.YOUTUBE_API_KEY) {
    console.error('[Dashboard] Error: YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID must be set in .env');
    console.error('[Dashboard] Run with --manual to enter data manually.');
    process.exit(1);
  }

  console.log('[Dashboard] Pulling data from YouTube API...');
  const entry = await recordMetrics(channelId, { channelName: env.YOUTUBE_CHANNEL_NAME || 'Primary Channel' });
  const data = loadData();
  printReport(data, env);
  console.log('\nRun --update to update the dashboard files.');
}

module.exports = { recordMetrics, loadData, saveData, loadEnv, printReport, YPP_SUBS, YPP_WATCH_HRS };

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
