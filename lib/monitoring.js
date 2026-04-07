/**
 * lib/monitoring.js
 * Service health checker + cost tracker for all pipeline APIs.
 *
 * Services tracked: Hailuo/MiniMax, ElevenLabs, SD WebUI, YouTube, TikTok, Pexels, FFmpeg
 *
 * Usage:
 *   import { ServiceMonitor } from './lib/monitoring.js';
 *   const monitor = new ServiceMonitor();
 *   const stats = await monitor.getStats();
 *   await monitor.checkAll();          // run health checks
 *   await monitor.logCost('hailuo', 0.05);  // record an API call cost
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const require2 = (spec) => require(spec);

// ---------------------------------------------------------------------------
// Config & constants
// ---------------------------------------------------------------------------

const LOGS_DIR = resolve(__dirname, '..', 'logs');
const COSTS_FILE = resolve(LOGS_DIR, 'service-costs.md');
const STATE_FILE = resolve(LOGS_DIR, 'monitoring-state.json');

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Service endpoints and cost-per-call estimates
const SERVICES = {
  hailuo: {
    name: 'Hailuo/MiniMax',
    healthEndpoint: 'https://api.minimax.io/v1/video_generation',
    method: 'HEAD',
    timeoutMs: 5000,
    costPerCall: 0.05,
    unit: 'video',
    targetUptime: 0.99,
    targetLatencyMs: 120000,
    criticalLatencyMs: 30000,
  },
  elevenlabs: {
    name: 'ElevenLabs',
    healthEndpoint: 'https://api.elevenlabs.io/v1/voices',
    method: 'GET',
    timeoutMs: 5000,
    costPerCall: 0.02,
    unit: 'voice_request',
    targetUptime: 0.99,
    targetLatencyMs: 30000,
    criticalLatencyMs: 10000,
  },
  sd_webui: {
    name: 'SD WebUI',
    healthEndpoint: 'http://localhost:7860/sdapi/v1/sd-models',
    method: 'GET',
    timeoutMs: 5000,
    costPerCall: 0,
    unit: 'image',
    targetUptime: 1.0,
    targetLatencyMs: 60000,
    criticalLatencyMs: 20000,
  },
  ffmpeg: {
    name: 'FFmpeg',
    healthEndpoint: null, // checked via spawn, not HTTP
    method: null,
    timeoutMs: 5000,
    costPerCall: 0,
    unit: 'render',
    targetUptime: 1.0,
    targetLatencyMs: 60000,
    criticalLatencyMs: 30000,
  },
  pexels: {
    name: 'Pexels',
    healthEndpoint: 'https://api.pexels.com/videos/search?query=test&per_page=1',
    method: 'GET',
    timeoutMs: 5000,
    costPerCall: 0,
    unit: 'video_download',
    targetUptime: 1.0,
    targetLatencyMs: 10000,
    criticalLatencyMs: 5000,
  },
  youtube: {
    name: 'YouTube API',
    healthEndpoint: 'https://www.googleapis.com/youtube/v3/channels?part&id=mine&mine=true',
    method: 'GET',
    timeoutMs: 5000,
    costPerCall: 0,
    unit: 'api_call',
    targetUptime: 0.99,
    targetLatencyMs: 10000,
    criticalLatencyMs: 5000,
  },
  tiktok: {
    name: 'TikTok API',
    healthEndpoint: 'https://open.tiktokapis.com/v2/video/list/',
    method: 'POST',
    timeoutMs: 5000,
    costPerCall: 0,
    unit: 'api_call',
    targetUptime: 0.99,
    targetLatencyMs: 15000,
    criticalLatencyMs: 5000,
  },
};

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (_) { /* ignore */ }
  return _defaultState();
}

function _defaultState() {
  return {
    services: Object.fromEntries(
      Object.keys(SERVICES).map((key) => [
        key,
        {
          status: 'unknown',
          latencyMs: null,
          uptimePct: null,
          lastChecked: null,
          lastSuccess: null,
          lastFailure: null,
          consecutiveFailures: 0,
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          totalCost: 0,
          dailyCost: 0,
          weeklyCost: 0,
          monthlyCost: 0,
          lastCostReset: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
        },
      ])
    ),
    lastHealthCheck: null,
    alerts: [], // { id, service, type, message, severity, timestamp, resolved }
  };
}

function saveState(state) {
  try {
    mkdirSync(LOGS_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Utility: simple HTTP check (no external deps needed)
// ---------------------------------------------------------------------------

async function _httpCheck(endpoint, method, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const resp = await fetch(endpoint, {
      method: method || 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    return { ok: resp.ok, status: resp.status, latencyMs: Date.now() - start };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { ok: false, status: 0, latencyMs: Date.now() - start, timeout: true };
    }
    return { ok: false, status: 0, latencyMs: Date.now() - start, error: err.message };
  }
}

async function _ffmpegCheck() {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  try {
    const { stdout } = await execAsync('ffmpeg -version', { timeout: 5000 });
    const match = stdout.match(/ffmpeg version\s+(\S+)/);
    return { ok: true, version: match ? match[1] : 'unknown', latencyMs: 0 };
  } catch (err) {
    return { ok: false, version: null, latencyMs: 0, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Cost logging
// ---------------------------------------------------------------------------

function _appendCostLog(service, cost, unit, metadata = {}) {
  try {
    mkdirSync(LOGS_DIR, { recursive: true });
    const ts = new Date().toISOString();
    const meta = Object.entries(metadata)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    const line = `| ${ts.slice(0, 19)} | ${service} | ${unit} | $${cost.toFixed(4)} | ${meta} |\n`;
    const header = '| Timestamp | Service | Unit | Cost | Notes |\n|---|---|---|---|---|\n';
    if (!existsSync(COSTS_FILE)) {
      writeFileSync(COSTS_FILE, header, 'utf-8');
    }
    writeFileSync(COSTS_FILE, line, { flag: 'a', encoding: 'utf-8' });
  } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Main monitor class
// ---------------------------------------------------------------------------

export class ServiceMonitor {
  constructor() {
    this._state = loadState();
    this._alertCallbacks = [];
    this._checkTimer = null;
    this._startAutoCheck();
  }

  // ---- Public API ----

  /**
   * Run health checks on all services. Returns stats for all services.
   */
  async checkAll() {
    const results = await Promise.allSettled(
      Object.entries(SERVICES).map(async ([key, svc]) => {
        const result = await this._checkService(key, svc);
        return [key, result];
      })
    );

    const stats = {};
    for (const res of results) {
      if (res.status === 'fulfilled') {
        const [key, result] = res.value;
        stats[key] = this._applyResult(key, result);
      }
    }

    this._state.lastHealthCheck = new Date().toISOString();
    saveState(this._state);
    return stats;
  }

  /**
   * Check a single service by key (e.g. 'hailuo').
   */
  async checkService(key) {
    const svc = SERVICES[key];
    if (!svc) throw new Error(`Unknown service: ${key}`);
    const result = await this._checkService(key, svc);
    return this._applyResult(key, result);
  }

  /**
   * Record an API call cost for a service.
   */
  async logCost(service, cost, unit, metadata = {}) {
    if (!SERVICES[service]) throw new Error(`Unknown service: ${service}`);
    this._ensureDailyReset(service);

    this._state.services[service].totalCost += cost;
    this._state.services[service].dailyCost += cost;
    this._state.services[service].weeklyCost += cost;
    this._state.services[service].monthlyCost += cost;
    this._state.services[service].totalCalls += 1;
    this._state.services[service].successfulCalls += 1;

    _appendCostLog(service, cost, unit || SERVICES[service].unit, metadata);
    saveState(this._state);

    // Alert if daily cost threshold exceeded (default $5/day)
    const threshold = parseFloat(process.env.MONITORING_DAILY_COST_THRESHOLD || '5');
    if (this._state.services[service].dailyCost > threshold) {
      this._fireAlert(service, 'cost_threshold', `Daily cost $${this._state.services[service].dailyCost.toFixed(4)} exceeded threshold $${threshold}`, 'high');
    }
  }

  /**
   * Record a failed API call (for success rate tracking).
   */
  logFailure(service) {
    if (!SERVICES[service]) return;
    const s = this._state.services[service];
    s.failedCalls += 1;
    s.totalCalls += 1;
    s.consecutiveFailures += 1;
    saveState(this._state);
  }

  /**
   * Get all stats for the dashboard.
   */
  getStats() {
    this._resetDailyCostsIfNeeded();
    return {
      lastHealthCheck: this._state.lastHealthCheck,
      services: Object.fromEntries(
        Object.entries(this._state.services).map(([key, s]) => {
          const def = SERVICES[key];
          return [
            key,
            {
              ...s,
              displayName: def?.name || key,
              costPerCall: def?.costPerCall || 0,
              unit: def?.unit || 'call',
              targetUptime: def?.targetUptime || 1.0,
              targetLatencyMs: def?.targetLatencyMs || 60000,
              criticalLatencyMs: def?.criticalLatencyMs || 30000,
              isHealthy: s.status === 'healthy',
              uptimeScore: s.totalCalls > 0 ? (s.successfulCalls / s.totalCalls) : null,
            },
          ];
        })
      ),
    };
  }

  /**
   * Get recent alerts.
   */
  getAlerts(limit = 50, includeResolved = false) {
    const alerts = this._state.alerts;
    if (!includeResolved) {
      return alerts.filter((a) => !a.resolved).slice(-limit);
    }
    return alerts.slice(-limit);
  }

  /**
   * Resolve an alert by ID.
   */
  resolveAlert(alertId) {
    const alert = this._state.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      saveState(this._state);
    }
  }

  /**
   * Register a callback for alerts (e.g. Discord webhook).
   */
  onAlert(callback) {
    this._alertCallbacks.push(callback);
  }

  /**
   * Stop auto health checks.
   */
  stopAutoCheck() {
    if (this._checkTimer) {
      clearInterval(this._checkTimer);
      this._checkTimer = null;
    }
  }

  // ---- Internal ----

  _startAutoCheck() {
    // Run immediately on startup, then every HEALTH_CHECK_INTERVAL_MS
    this.checkAll().catch(() => {});
    this._checkTimer = setInterval(() => {
      this.checkAll().catch(() => {});
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  async _checkService(key, svc) {
    if (key === 'ffmpeg') {
      return { service: key, ...(await _ffmpegCheck()), checkedAt: new Date().toISOString() };
    }
    if (!svc.healthEndpoint) {
      return { service: key, ok: true, status: 200, latencyMs: 0, checkedAt: new Date().toISOString() };
    }
    // Add API key header for services that need it
    const headers = {};
    if (key === 'pexels') {
      headers['Authorization'] = process.env.PEXELS_API_KEY || '';
    }
    const result = await _httpCheck(svc.healthEndpoint, svc.method, svc.timeoutMs);
    return { service: key, ...result, checkedAt: new Date().toISOString() };
  }

  _applyResult(key, result) {
    const s = this._state.services[key];
    const def = SERVICES[key];
    const wasUnknown = s.status === 'unknown';
    const prevStatus = s.status;

    s.lastChecked = result.checkedAt;
    s.latencyMs = result.latencyMs;

    if (result.ok) {
      s.status = 'healthy';
      s.lastSuccess = result.checkedAt;
      s.consecutiveFailures = 0;

      // Fire recovery alert if it was down
      if (!wasUnknown && prevStatus === 'down') {
        this._fireAlert(key, 'recovery', `${def?.name || key} is back online. Latency: ${result.latencyMs}ms`, 'low');
      }
    } else {
      s.status = 'down';
      s.lastFailure = result.checkedAt;
      s.consecutiveFailures += 1;

      // Fire alert only on first failure or escalation
      if (s.consecutiveFailures === 1 || (s.consecutiveFailures > 3 && s.consecutiveFailures % 5 === 0)) {
        const latencyAlert = result.latencyMs > (def?.criticalLatencyMs || 30000)
          ? ` [LATENCY ${result.latencyMs}ms]`
          : '';
        const errorNote = result.error ? ` — ${result.error}` : result.timeout ? ' [TIMEOUT]' : ` [HTTP ${result.status}]`;
        this._fireAlert(key, 'down', `${def?.name || key} is DOWN${errorNote}${latencyAlert}`, 'critical');
      }
    }

    // Latency alert
    if (result.ok && result.latencyMs > (def?.criticalLatencyMs || 30000)) {
      this._fireAlert(key, 'latency', `${def?.name || key} latency ${result.latencyMs}ms exceeds critical threshold ${def?.criticalLatencyMs}ms`, 'medium');
    }

    saveState(this._state);
    return { status: s.status, latencyMs: result.latencyMs, lastChecked: result.checkedAt };
  }

  _fireAlert(serviceKey, type, message, severity) {
    const def = SERVICES[serviceKey];
    const alert = {
      id: `${serviceKey}-${Date.now()}`,
      service: serviceKey,
      serviceName: def?.name || serviceKey,
      type,
      message,
      severity,
      timestamp: new Date().toISOString(),
      resolved: false,
      resolvedAt: null,
    };
    this._state.alerts.push(alert);
    // Keep only last 200 alerts
    if (this._state.alerts.length > 200) {
      this._state.alerts = this._state.alerts.slice(-200);
    }
    saveState(this._state);

    // Notify callbacks
    for (const cb of this._alertCallbacks) {
      try { cb(alert); } catch (_) { /* ignore */ }
    }
  }

  _ensureDailyReset(service) {
    const today = new Date().toISOString().slice(0, 10);
    if (this._state.services[service].lastCostReset !== today) {
      this._state.services[service].dailyCost = 0;
      this._state.services[service].lastCostReset = today;
    }
  }

  _resetDailyCostsIfNeeded() {
    const today = new Date().toISOString().slice(0, 10);
    for (const [key, s] of Object.entries(this._state.services)) {
      if (s.lastCostReset !== today) {
        s.dailyCost = 0;
        s.lastCostReset = today;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Standalone runner (node lib/monitoring.js)
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new ServiceMonitor();
  monitor.checkAll().then((stats) => {
    console.log(JSON.stringify({ ok: true, stats }, null, 2));
    monitor.stopAutoCheck();
    process.exit(0);
  }).catch((err) => {
    console.error(JSON.stringify({ ok: false, error: err.message }));
    monitor.stopAutoCheck();
    process.exit(1);
  });
}
