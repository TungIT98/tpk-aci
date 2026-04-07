/**
 * scripts/record-video-stats.js
 * Record per-video performance metrics
 *
 * Usage:
 *   node scripts/record-video-stats.js --manual          # interactive
 *   node scripts/record-video-stats.js --file <path>     # import from CSV
 */

const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '..', 'logs', 'video-stats.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  } catch (_) {
    return { videos: [], lastUpdated: null };
  }
}

function save(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Add or update a video entry
 */
function upsertVideo(videos, video) {
  const idx = videos.findIndex(v => v.videoId === video.videoId);
  if (idx !== -1) {
    videos[idx] = { ...videos[idx], ...video, updatedAt: new Date().toISOString() };
  } else {
    videos.push({ ...video, addedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
}

/**
 * Calculate format performance summary
 */
function formatSummary(videos) {
  const formats = {};
  for (const v of videos) {
    const fmt = v.format || 'unknown';
    if (!formats[fmt]) {
      formats[fmt] = { count: 0, totalViews: 0, totalCTR: 0, ctrCount: 0, avgRetention: 0, retCount: 0 };
    }
    formats[fmt].count++;
    formats[fmt].totalViews += v.views || 0;
    if (v.ctr != null) {
      formats[fmt].totalCTR += v.ctr;
      formats[fmt].ctrCount++;
    }
    if (v.retention != null) {
      formats[fmt].avgRetention += v.retention;
      formats[fmt].retCount++;
    }
  }

  const result = {};
  for (const [fmt, s] of Object.entries(formats)) {
    result[fmt] = {
      videos: s.count,
      avgViews: Math.round(s.totalViews / s.count),
      avgCTR: s.ctrCount > 0 ? Math.round((s.totalCTR / s.ctrCount) * 100) / 100 : null,
      avgRetention: s.retCount > 0 ? Math.round(s.avgRetention / s.retCount) : null,
    };
  }
  return result;
}

async function manualEntry() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = p => new Promise(res => rl.question(p, res));

  const video = {};
  video.videoId = await q('Video ID: ');
  video.title = await q('Title: ');
  video.format = await q('Format (tutorial/listicle/reaction/story/short): ');
  video.duration = parseInt(await q('Duration (seconds): ')) || null;
  video.views = parseInt(await q('Views: ')) || 0;
  video.impressions = parseInt(await q('Impressions: ')) || null;
  video.ctr = video.impressions ? Math.round((video.views / video.impressions) * 10000) / 100 : null;
  video.avgViewDuration = parseInt(await q('Avg view duration (seconds): ')) || null;
  video.retention = video.duration && video.avgViewDuration
    ? Math.min(100, Math.round((video.avgViewDuration / video.duration) * 100))
    : null;
  video.subscribersGained = parseInt(await q('Subscribers gained from video: ')) || 0;
  video.publishedAt = await q('Published date (YYYY-MM-DD): ') || null;
  video.channel = await q('Channel (pw/gz): ') || 'pw';

  rl.close();

  const data = load();
  upsertVideo(data.videos, video);
  save(data);

  console.log('\nSaved! Format summary:');
  console.log(JSON.stringify(formatSummary(data.videos), null, 2));
}

async function importCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const data = load();
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    const video = {};
    for (let j = 0; j < headers.length; j++) {
      const v = vals[j]?.trim();
      if (v) {
        if (['views', 'impressions', 'duration', 'avgviewduration', 'subscribersgained'].includes(headers[j])) {
          video[headers[j]] = parseInt(v) || 0;
        } else {
          video[headers[j]] = v;
        }
      }
    }
    if (video.videoId || video.title) {
      upsertVideo(data.videos, video);
    }
  }
  save(data);
  console.log(`Imported ${lines.length - 1} videos.`);
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];

  if (mode === '--manual') {
    await manualEntry();
    return;
  }

  if (mode === '--file' && args[1]) {
    await importCSV(args[1]);
    return;
  }

  if (mode === '--summary') {
    const data = load();
    console.log('Format Performance Summary:');
    console.log(JSON.stringify(formatSummary(data.videos), null, 2));
    return;
  }

  console.log('Usage:');
  console.log('  node scripts/record-video-stats.js --manual           # interactive entry');
  console.log('  node scripts/record-video-stats.js --file <path>     # import CSV');
  console.log('  node scripts/record-video-stats.js --summary         # show format summary');
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
