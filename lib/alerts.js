/**
 * lib/alerts.js
 * Discord webhook alerting for pipeline service events.
 *
 * Alert types:
 *   - down      : service unreachable
 *   - recovery  : service back online
 *   - latency   : response time exceeded threshold
 *   - cost_threshold : daily spend exceeded threshold
 *   - job_failed : video/image generation job failed
 *
 * Usage:
 *   import { AlertManager } from './lib/alerts.js';
 *   const alerts = new AlertManager();
 *   await alerts.send({ service: 'hailuo', type: 'down', severity: 'critical', message: '...' });
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
  try {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (key) env[key.trim()] = rest.join('=').trim();
    }
    return env;
  } catch (_) { return {}; }
}

const env = loadEnv();

// ---------------------------------------------------------------------------
// Alert manager
// ---------------------------------------------------------------------------

export class AlertManager {
  constructor() {
    this._webhookUrl = env.DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || null;
    this._silenced = new Set(); // {service}:{type} keys
    this._history = [];
    this._enabled = !!this._webhookUrl;
  }

  // ---- Config ----

  /**
   * Set the Discord webhook URL.
   */
  setWebhook(url) {
    this._webhookUrl = url;
    this._enabled = !!url;
  }

  /**
   * Silence alerts for a specific service or service+type combo.
   *   silence('hailuo')              — silence all hailuo alerts
   *   silence('hailuo:latency')      — silence only hailuo latency alerts
   *   silence(null)                 — clear all silence rules
   */
  silence(serviceKey = null) {
    if (serviceKey === null) {
      this._silenced.clear();
      return;
    }
    this._silenced.add(serviceKey);
  }

  // ---- Send ----

  /**
   * Send an alert. Returns true if sent, false if silenced or disabled.
   */
  async send(alert) {
    const { service = 'unknown', type = 'info', severity = 'low', message = '' } = alert;

    // Check silence rules
    if (this._silenced.has(service) || this._silenced.has(`${service}:${type}`)) {
      return false;
    }

    const record = {
      ...alert,
      service,
      type,
      severity,
      message,
      sentAt: new Date().toISOString(),
      delivered: false,
    };

    this._history.push(record);
    if (this._history.length > 200) this._history.shift();

    if (!this._enabled) return false;

    try {
      await this._sendDiscord(record);
      record.delivered = true;
      return true;
    } catch (err) {
      console.error('[alerts] Discord send failed:', err.message);
      return false;
    }
  }

  /**
   * Convenience: send a test alert to verify webhook.
   */
  async sendTest() {
    return this.send({
      service: 'system',
      type: 'test',
      severity: 'low',
      message: 'This is a test alert from the TKP monitoring system.',
    });
  }

  /**
   * Convenience: send a job failure alert.
   */
  async sendJobFailure(service, jobId, error) {
    return this.send({
      service,
      type: 'job_failed',
      severity: 'high',
      message: `Job \`${jobId}\` failed on ${service}: ${error}`,
    });
  }

  /**
   * Convenience: send a cost threshold alert.
   */
  async sendCostAlert(service, dailyCost, threshold) {
    return this.send({
      service,
      type: 'cost_threshold',
      severity: 'medium',
      message: `Daily cost $${dailyCost.toFixed(4)} for ${service} has exceeded threshold $${threshold}`,
    });
  }

  // ---- History ----

  getHistory(limit = 50) {
    return this._history.slice(-limit);
  }

  // ---- Internal ----

  async _sendDiscord(alert) {
    if (!this._webhookUrl) return;

    const color = this._severityColor(alert.severity);
    const emoji = this._severityEmoji(alert.severity);
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    const fields = [
      { name: 'Service', value: alert.serviceName || alert.service, inline: true },
      { name: 'Type', value: alert.type, inline: true },
      { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
    ];

    if (alert.latencyMs) {
      fields.push({ name: 'Latency', value: `${alert.latencyMs}ms`, inline: true });
    }

    const payload = {
      username: 'TKP Monitor',
      avatar_url: 'https://i.imgur.com/AfFp7pu.png',
      embeds: [
        {
          title: `${emoji} ${alert.type.replace('_', ' ').toUpperCase()} — ${alert.serviceName || alert.service}`,
          description: alert.message,
          color,
          fields,
          footer: { text: `TKP Pipeline Monitor • ${ts}` },
          timestamp: alert.sentAt,
        },
      ],
    };

    // Handle different Discord webhook formats (Slack-compatible vs Discord-native)
    if (this._webhookUrl.includes('hooks.slack.com')) {
      // Slack incoming webhook
      await fetch(this._webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `${emoji} [${alert.severity.toUpperCase()}] ${alert.service}: ${alert.message}` }),
      });
    } else {
      // Discord webhook
      await fetch(this._webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
  }

  _severityColor(severity) {
    const colors = {
      critical: 0xe74c3c, // red
      high: 0xe67e22,     // orange
      medium: 0xf1c40f,   // yellow
      low: 0x3498db,      // blue
      info: 0x95a5a6,      // grey
    };
    return colors[severity] || colors.info;
  }

  _severityEmoji(severity) {
    const emojis = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      info: 'ℹ️',
    };
    return emojis[severity] || 'ℹ️';
  }
}

// ---------------------------------------------------------------------------
// Singleton for use across the pipeline
// ---------------------------------------------------------------------------

let _instance = null;

export function getAlertManager() {
  if (!_instance) _instance = new AlertManager();
  return _instance;
}

// ---------------------------------------------------------------------------
// Standalone test (node lib/alerts.js)
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const alerts = new AlertManager();
  if (!alerts._enabled) {
    console.log('DISCORD_WEBHOOK_URL not set in .env — test skipped. Set it to test alerts.');
    process.exit(0);
  }
  alerts.sendTest().then((sent) => {
    console.log('Test alert sent:', sent);
    process.exit(0);
  }).catch((err) => {
    console.error('Test failed:', err.message);
    process.exit(1);
  });
}
