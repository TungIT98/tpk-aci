/**
 * scripts/analytics-report.js
 * Weekly performance report generator
 *
 * Generates reports covering:
 * - View counts and trends
 * - CTR analysis
 * - Subscriber growth
 * - YPP progress
 * - Top performing videos
 *
 * Usage:
 *   node scripts/analytics-report.js              # this week
 *   node scripts/analytics-report.js --weekly      # explicit weekly
 *   node scripts/analytics-report.js --since 2026-03-20  # custom date range
 */

const fs = require('fs');
const path = require('path');
const yppTracker = require('../analytics/ypp-tracker');

const REPORT_DIR = path.join(__dirname, '..', 'logs');
const VIDEO_STATS_FILE = path.join(__dirname, '..', 'logs', 'video-stats.json');

function loadVideoStats() {
  try {
    return JSON.parse(fs.readFileSync(VIDEO_STATS_FILE, 'utf8'));
  } catch (_) {
    return { videos: [], lastUpdated: null };
  }
}

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

function filterByDateRange(entries, since) {
  const sinceDate = new Date(since);
  return entries.filter(e => new Date(e.timestamp) >= sinceDate);
}

/**
 * Calculate CTR from views and impressions
 */
function calculateCTR(video) {
  if (!video.impressions || video.impressions === 0) return null;
  return Math.round((video.views / video.impressions) * 10000) / 100; // percentage
}

/**
 * Calculate retention score (placeholder until retention API data available)
 */
function estimateRetention(video) {
  if (!video.avgViewDuration || !video.duration) return null;
  return Math.min(100, Math.round((video.avgViewDuration / video.duration) * 100));
}

/**
 * Rank videos by performance score
 */
function rankVideos(videos) {
  return videos
    .filter(v => v.views > 0)
    .map(v => ({
      ...v,
      ctr: calculateCTR(v),
      retention: estimateRetention(v),
      score: (v.views * 0.4) + (calculateCTR(v) || 0) * 100 + (estimateRetention(v) || 0) * 50,
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Calculate trend (comparing two periods)
 */
function calcTrend(current, previous) {
  if (!previous || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

/**
 * Format a number for display
 */
const fmt = (n) => n != null ? n.toLocaleString() : 'N/A';
const fmtPct = (n) => n != null ? `${n}%` : 'N/A';

/**
 * Generate markdown report
 */
function generateMarkdownReport(data) {
  const { weekStart, weekEnd, views, subscribers, videos, ypp, topVideos, env } = data;

  const channelName = env.YOUTUBE_CHANNEL_NAME || 'Primary Channel';

  let md = `# Analytics Report\n`;
  md += `**Channel:** ${channelName}\n`;
  md += `**Period:** ${weekStart} → ${weekEnd}\n`;
  md += `**Generated:** ${new Date().toLocaleString()}\n\n`;

  // ── Overview ───────────────────────────────────────────────
  md += `## Overview\n\n`;
  md += `| Metric | This Week | Change | Cumulative |\n`;
  md += `|--------|-----------|--------|------------|\n`;
  md += `| Views | ${fmt(views.weekly)} | ${fmtPct(views.trend)} | ${fmt(views.total)} |\n`;
  md += `| Subscribers | ${fmt(subscribers.gained)} | ${fmtPct(subscribers.trend)} | ${fmt(subscribers.total)} |\n`;
  md += `| Videos Published | ${videos.published} | — | ${fmt(videos.total)} |\n\n`;

  // ── YPP Progress ────────────────────────────────────────────
  md += `## YPP Progress\n\n`;
  const e = ypp.eligibility;
  md += `**YPP Status:** ${e.eligible ? '✅ ELIGIBLE — Apply at youtube.com/partner' : '⏳ In Progress'}\n\n`;

  md += `| Requirement | Current | Target | Progress |\n`;
  md += `|-------------|---------|--------|----------|\n`;
  md += `| Subscribers | ${fmt(ypp.current.subscribers)} | ${fmt(yppTracker.YPP_THRESHOLDS.subscribers)} | ${fmtPct(e.subscriber.pct)} |\n`;
  md += `| Watch Hours | ${fmt(ypp.current.watchHours)} | ${fmt(yppTracker.YPP_THRESHOLDS.watchHours)} | ${fmtPct(e.watchHours.pct)} |\n`;
  md += `| Shorts Views | ${fmt(ypp.current.shortsViews)} | ${fmt(yppTracker.YPP_THRESHOLDS.shortsViews)} | ${fmtPct(e.shortsViews.pct)} |\n\n`;

  const remainingSubs = Math.max(0, yppTracker.YPP_THRESHOLDS.subscribers - (ypp.current.subscribers || 0));
  const remainingWatch = Math.max(0, yppTracker.YPP_THRESHOLDS.watchHours - (ypp.current.watchHours || 0));
  const remainingShorts = Math.max(0, yppTracker.YPP_THRESHOLDS.shortsViews - (ypp.current.shortsViews || 0));

  if (!e.eligible) {
    md += `**Remaining to qualify (standard path):**\n`;
    if (remainingSubs > 0) md += `- ${fmt(remainingSubs)} more subscribers\n`;
    if (remainingWatch > 0) md += `- ${fmt(remainingWatch)} more watch hours\n`;
    md += `\n**OR (Shorts path):**\n`;
    if (remainingShorts > 0) md += `- ${fmt(remainingShorts)} more Shorts views\n`;
    md += `\n`;
  }

  // ── CTR Analysis ────────────────────────────────────────────
  md += `## CTR Analysis\n\n`;
  const videosWithCTR = topVideos.filter(v => v.ctr != null);
  if (videosWithCTR.length > 0) {
    md += `| Video | Views | CTR | Retention |\n`;
    md += `|-------|-------|-----|----------|\n`;
    for (const v of videosWithCTR.slice(0, 5)) {
      md += `| ${v.title || v.videoId} | ${fmt(v.views)} | ${fmtPct(v.ctr)} | ${fmtPct(v.retention)} |\n`;
    }
    md += `\n`;
  } else {
    md += `No CTR data available yet. Ensure impression tracking is enabled in YouTube Studio.\n\n`;
  }

  // ── Top Videos ─────────────────────────────────────────────
  if (topVideos.length > 0) {
    md += `## Top Performing Videos\n\n`;
    md += `| Rank | Title | Views | CTR | Retention |\n`;
    md += `|------|-------|-------|-----|----------|\n`;
    for (let i = 0; i < Math.min(topVideos.length, 10); i++) {
      const v = topVideos[i];
      md += `| ${i + 1} | ${v.title || v.videoId} | ${fmt(v.views)} | ${fmtPct(v.ctr)} | ${fmtPct(v.retention)} |\n`;
    }
    md += `\n`;
  }

  // ── Insights ────────────────────────────────────────────────
  md += `## Insights & Recommendations\n\n`;

  const topCTR = videosWithCTR.sort((a, b) => (b.ctr || 0) - (a.ctr || 0))[0];
  const topRetention = topVideos.sort((a, b) => (b.retention || 0) - (a.retention || 0))[0];

  if (topCTR) {
    md += `- **Best CTR:** "${topCTR.title || topCTR.videoId}" at ${fmtPct(topCTR.ctr)} — review its thumbnail and title for patterns.\n`;
  }
  if (topRetention && topRetention.retention != null) {
    md += `- **Best Retention:** "${topRetention.title || topRetention.videoId}" at ${fmtPct(topRetention.retention)} — identify what keeps viewers engaged.\n`;
  }

  md += `- **Publishing cadence:** ${videos.published} videos this week.\n`;
  if (views.trend && views.trend > 20) {
    md += `- **Growth signal:** Views up ${fmtPct(views.trend)} week-over-week — maintain current output.\n`;
  } else if (views.trend && views.trend < -10) {
    md += `- **Decline warning:** Views down ${fmtPct(views.trend)}. Review posting times and thumbnail quality.\n`;
  }

  md += `\n---\n*Generated by TKP Analytics Agent*\n`;
  return md;
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  const env = loadEnv();

  // Parse date range
  let since;
  const sinceIdx = args.indexOf('--since');
  if (sinceIdx !== -1 && args[sinceIdx + 1]) {
    since = args[sinceIdx + 1];
  } else {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    since = d.toISOString().slice(0, 10);
  }

  const until = new Date().toISOString().slice(0, 10);
  const weekStart = since;
  const weekEnd = until;

  // Load data
  const metrics = yppTracker.loadMetrics();
  const videoStats = loadVideoStats();

  // Get latest YPP snapshot
  const latestEntry = metrics.entries[metrics.entries.length - 1] || {};
  const previousEntry = metrics.entries.length >= 2 ? metrics.entries[metrics.entries.length - 2] : null;
  const yppEligibility = yppTracker.checkEligibility(latestEntry);

  // Process video stats
  const recentVideos = filterByDateRange(videoStats.videos, since);
  const rankedVideos = rankVideos(videoStats.videos);
  const topVideos = rankedVideos.slice(0, 10);

  // Calculate trends
  const weeklyViews = recentVideos.reduce((s, v) => s + (v.views || 0), 0);
  const prevVideos = filterByDateRange(videoStats.videos,
    new Date(new Date(since).getTime() - 7 * 86400000).toISOString().slice(0, 10));
  const prevViews = prevVideos.reduce((s, v) => s + (v.views || 0), 0);

  // Subscribers trend
  const subTrend = calcTrend(latestEntry.subscribers, previousEntry?.subscribers);

  const data = {
    weekStart, weekEnd, env,
    views: {
      weekly: weeklyViews,
      total: latestEntry.totalViews || 0,
      trend: calcTrend(weeklyViews, prevViews),
    },
    subscribers: {
      gained: latestEntry.subscribers - (previousEntry?.subscribers || 0),
      total: latestEntry.subscribers || 0,
      trend: subTrend,
    },
    videos: {
      published: recentVideos.length,
      total: videoStats.videos.length,
    },
    ypp: {
      current: latestEntry,
      eligibility: yppEligibility,
    },
    topVideos,
  };

  const report = generateMarkdownReport(data);

  // Save report
  const reportFile = path.join(REPORT_DIR, `analytics-report-${weekEnd}.md`);
  fs.writeFileSync(reportFile, report);
  console.log(`[Analytics] Report saved: ${reportFile}`);
  console.log(report);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
