/**
 * monitoring/health_tracker.js
 * Service health tracking — uptime, latency, costs, success rates.
 *
 * Usage:
 *   import { HealthTracker } from './monitoring/health_tracker.js';
 *   const tracker = new HealthTracker();
 *   tracker.record('hailuo', { latencyMs: 45000, success: true, cost: 0.05 });
 *   const report = tracker.getReport();
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, 'dashboard_data.json');

// ---------------------------------------------------------------------------
// Service definitions
// ---------------------------------------------------------------------------

export const SERVICES = {
  hailuo: {
    name: 'Hailuo Video API',
    baseUrl: 'https://api.minimax.io',
    endpoint: '/v1/video_generation',
    method: 'POST',
    expectedLatencyMs: 120_000,  // up to 2 min per video
    alertThreshold: {
      errorRate: 0.05,   // alert if >5% errors
      latencyP95Ms: 300_000, // alert if p95 latency > 5 min
    },
  },
  elevenlabs: {
    name: 'ElevenLabs TTS',
    baseUrl: 'https://api.elevenlabs.io',
    endpoint: '/v1/text-to-speech',
    method: 'POST',
    expectedLatencyMs: 30_000,
    alertThreshold: {
      errorRate: 0.05,
      latencyP95Ms: 60_000,
    },
  },
  minimax_tts: {
    name: 'MiniMax TTS',
    baseUrl: 'https://api.minimax.io',
    endpoint: '/v1/t2a',
    method: 'POST',
    expectedLatencyMs: 20_000,
    alertThreshold: {
      errorRate: 0.05,
      latencyP95Ms: 45_000,
    },
  },
  sd_webui: {
    name: 'SD WebUI (Local)',
    baseUrl: 'http://localhost:7860',
    endpoint: '/sdapi/v1/img2img',
    method: 'POST',
    expectedLatencyMs: 60_000,
    alertThreshold: {
      errorRate: 0.05,
      latencyP95Ms: 120_000,
    },
  },
  ffmpeg: {
    name: 'FFmpeg (Local)',
    baseUrl: null,
    endpoint: null,
    method: null,
    expectedLatencyMs: 60_000,
    alertThreshold: {
      errorRate: 0.01,
      latencyP95Ms: 180_000,
    },
  },
  youtube: {
    name: 'YouTube API',
    baseUrl: 'https://www.googleapis.com/youtube/v3',
    endpoint: null,
    method: 'POST',
    expectedLatencyMs: 10_000,
    alertThreshold: {
      errorRate: 0.05,
      latencyP95Ms: 30_000,
    },
  },
  tiktok: {
    name: 'TikTok API',
    baseUrl: 'https://open.tiktokapis.com',
    endpoint: '/v2/post/',
    method: 'POST',
    expectedLatencyMs: 30_000,
    alertThreshold: {
      errorRate: 0.05,
      latencyP95Ms: 60_000,
    },
  },
  instagram: {
    name: 'Instagram Graph API',
    baseUrl: 'https://graph.instagram.com',
    endpoint: null,
    method: 'POST',
    expectedLatencyMs: 10_000,
    alertThreshold: {
      errorRate: 0.05,
      latencyP95Ms: 30_000,
    },
  },
};

// ---------------------------------------------------------------------------
// HealthTracker
// ---------------------------------------------------------------------------

export class HealthTracker {
  constructor(dataFile = DATA_FILE) {
    this.dataFile = dataFile;
    this.data = this._loadData();
  }

  _loadData() {
    if (existsSync(this.dataFile)) {
      try {
        return JSON.parse(readFileSync(this.dataFile, 'utf-8'));
      } catch { /* corrupt → reset */ }
    }
    return this._emptyState();
  }

  _emptyState() {
    return {
      services: Object.keys(SERVICES).reduce((acc, k) => {
        acc[k] = { events: [], dailyStats: {} };
        return acc;
      }, {}),
      lastUpdated: new Date().toISOString(),
    };
  }

  _save() {
    try {
      mkdirSync(resolve(this.dataFile, '..'), { recursive: true });
      writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
    } catch { /* ignore */ }
  }

  // -------------------------------------------------------------------------
  // Record an event
  // -------------------------------------------------------------------------

  /**
   * Record a service event.
   *
   * @param {string} serviceKey — e.g. 'hailuo', 'elevenlabs'
   * @param {object} event
   * @param {number} event.latencyMs — time taken in ms
   * @param {boolean} event.success — true if succeeded
   * @param {number} [event.cost] — cost in USD
   * @param {string} [event.errorType] — 'timeout' | 'rate_limit' | 'auth' | 'server' | 'unknown'
   * @param {string} [event.videoId] — associated video/job ID
   */
  record(serviceKey, { latencyMs, success, cost = 0, errorType = null, videoId = null }) {
    const svc = this.data.services[serviceKey];
    if (!svc) return; // unknown service

    const event = {
      ts: new Date().toISOString(),
      latencyMs,
      success,
      cost,
      errorType: success ? null : (errorType ?? 'unknown'),
      videoId,
    };

    svc.events.push(event);

    // Keep last 1000 events per service
    if (svc.events.length > 1000) {
      svc.events = svc.events.slice(-1000);
    }

    // Update daily stats
    const day = event.ts.slice(0, 10); // YYYY-MM-DD
    if (!svc.dailyStats[day]) {
      svc.dailyStats[day] = { requests: 0, successes: 0, errors: 0, totalCost: 0, latencies: [] };
    }
    const ds = svc.dailyStats[day];
    ds.requests++;
    if (success) ds.successes++;
    else ds.errors++;
    ds.totalCost += cost;
    ds.latencies.push(latencyMs);

    this.data.lastUpdated = event.ts;
    this._save();
  }

  // -------------------------------------------------------------------------
  // Health checks (probes)
// -------------------------------------------------------------------------

  /**
   * Ping a service and record the result.
   * @param {string} serviceKey
   * @returns {Promise<{ok: boolean, latencyMs: number, error?: string}>}
   */
  async probe(serviceKey) {
    const def = SERVICES[serviceKey];
    if (!def || !def.baseUrl) return { ok: false, latencyMs: 0, error: 'no baseUrl' };

    const start = Date.now();
    try {
      const res = await fetch(`${def.baseUrl}${def.endpoint}`, {
        method: def.method,
        headers: { 'Content-Type': 'application/json' },
        body: def.method === 'POST' ? JSON.stringify({}) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
      const latencyMs = Date.now() - start;
      const ok = res.ok || res.status === 400 || res.status === 405; // some endpoints reject without body
      return { ok, latencyMs };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: err.message };
    }
  }

  /**
   * Run probes on all reachable services.
   * @returns {Promise<object>} — { serviceKey: { ok, latencyMs, error } }
   */
  async probeAll() {
    const results = {};
    for (const key of Object.keys(SERVICES)) {
      results[key] = await this.probe(key);
    }
    return results;
  }

  // -------------------------------------------------------------------------
  // Reports
  // -------------------------------------------------------------------------

  /**
   * Get a health report for all services.
   * @param {string} [since] — ISO date string, default: 7 days ago
   */
  getReport(since = null) {
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const report = { generatedAt: new Date().toISOString(), since: sinceDate.toISOString(), services: {} };

    for (const [key, def] of Object.entries(SERVICES)) {
      const svc = this.data.services[key];
      if (!svc) continue;

      const recentEvents = svc.events.filter(e => new Date(e.ts) >= sinceDate);
      const total = recentEvents.length;
      const successes = recentEvents.filter(e => e.success).length;
      const errors = total - successes;
      const errorRate = total > 0 ? errors / total : 0;
      const successRate = total > 0 ? successes / total : 1;
      const totalCost = recentEvents.reduce((s, e) => s + e.cost, 0);
      const latencies = recentEvents.map(e => e.latencyMs).sort((a, b) => a - b);
      const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
      const p50Latency = latencies[Math.floor(latencies.length * 0.50)] ?? 0;
      const p95Latency = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
      const p99Latency = latencies[Math.floor(latencies.length * 0.99)] ?? 0;

      const errorBreakdown = {};
      recentEvents.filter(e => !e.success).forEach(e => {
        errorBreakdown[e.errorType ?? 'unknown'] = (errorBreakdown[e.errorType ?? 'unknown'] ?? 0) + 1;
      });

      const threshold = def.alertThreshold;
      const alerts = [];
      if (total > 0 && errorRate > threshold.errorRate) {
        alerts.push(`High error rate: ${(errorRate * 100).toFixed(1)}% (threshold: ${threshold.errorRate * 100}%)`);
      }
      if (total > 0 && p95Latency > threshold.latencyP95Ms) {
        alerts.push(`High P95 latency: ${(p95Latency / 1000).toFixed(0)}s (threshold: ${threshold.latencyP95Ms / 1000}s)`);
      }

      report.services[key] = {
        name: def.name,
        totalRequests: total,
        successRate: total > 0 ? +(successRate * 100).toFixed(1) : null,
        errorRate: total > 0 ? +(errorRate * 100).toFixed(1) : null,
        avgLatencyMs: Math.round(avgLatency),
        p50LatencyMs: Math.round(p50Latency),
        p95LatencyMs: Math.round(p95Latency),
        p99LatencyMs: Math.round(p99Latency),
        totalCostUsd: +totalCost.toFixed(4),
        errorBreakdown,
        alerts,
      };
    }

    return report;
  }

  /**
   * Get a CSV-friendly summary row for today.
   */
  getTodaySummary() {
    const today = new Date().toISOString().slice(0, 10);
    const rows = [['service', 'date', 'requests', 'successes', 'errors', 'error_rate%', 'avg_latency_ms', 'p95_latency_ms', 'total_cost_usd']];

    for (const [key, svc] of Object.entries(this.data.services)) {
      const ds = svc.dailyStats[today];
      if (!ds) {
        rows.push([key, today, '0', '0', '0', '0', '0', '0', '0']);
        continue;
      }
      const lat = [...ds.latencies].sort((a, b) => a - b);
      const p95 = lat[Math.floor(lat.length * 0.95)] ?? 0;
      const avg = lat.length > 0 ? lat.reduce((a, b) => a + b, 0) / lat.length : 0;
      const errorRate = ds.requests > 0 ? (ds.errors / ds.requests * 100).toFixed(1) : '0';
      rows.push([
        key, today,
        String(ds.requests),
        String(ds.successes),
        String(ds.errors),
        errorRate,
        String(Math.round(avg)),
        String(Math.round(p95)),
        ds.totalCost.toFixed(4),
      ]);
    }

    return rows.map(r => r.join(',')).join('\n');
  }

  /**
   * Write today's summary to a CSV file.
   */
  writeTodayCSV() {
    const csvPath = resolve(__dirname, 'today_summary.csv');
    writeFileSync(csvPath, this.getTodaySummary());
    return csvPath;
  }

  /**
   * Check if any service is currently in an alert state.
   */
  getActiveAlerts() {
    const report = this.getReport();
    const alerts = [];
    for (const [key, svc] of Object.entries(report.services)) {
      if (svc.alerts?.length) {
        svc.alerts.forEach(msg => alerts.push({ service: key, serviceName: svc.name, message: msg }));
      }
    }
    return alerts;
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (process.argv[1] === process.scriptName || import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const tracker = new HealthTracker();
  const action = process.argv[2];

  if (action === 'report') {
    console.log(JSON.stringify(tracker.getReport(), null, 2));
  } else if (action === 'alerts') {
    const alerts = tracker.getActiveAlerts();
    if (alerts.length === 0) {
      console.log('No active alerts.');
    } else {
      alerts.forEach(a => console.log(`[${a.serviceName}] ${a.message}`));
    }
  } else if (action === 'probe') {
    tracker.probeAll().then(results => {
      console.log(JSON.stringify(results, null, 2));
    });
  } else if (action === 'csv') {
    console.log(tracker.getTodaySummary());
  } else {
    console.log('Usage: node health_tracker.js [report|alerts|probe|csv]');
    console.log('  report — show 7-day health report');
    console.log('  alerts — show active alerts');
    console.log('  probe  — ping all services');
    console.log('  csv    — print today CSV summary');
  }
}
