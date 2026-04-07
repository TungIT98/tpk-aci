/**
 * monitoring/alerting.js
 * Discord/Slack webhook alerting for service health events.
 *
 * Usage:
 *   import { AlertManager } from './monitoring/alerting.js';
 *   const alerts = new AlertManager({ discordWebhook: process.env.DISCORD_WEBHOOK_URL });
 *   await alerts.sendAlert({ type: 'error_rate', service: 'hailuo', message: '...' });
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function loadEnv() {
  try {
    const env = {};
    for (const line of readFileSync(resolve(__dirname, '..', '.env'), 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();

// ---------------------------------------------------------------------------
// Alert types
// ---------------------------------------------------------------------------

export const ALERT_TYPES = {
  SERVICE_DOWN: 'service_down',
  ERROR_RATE_HIGH: 'error_rate_high',
  LATENCY_HIGH: 'latency_high',
  COST_SPIKE: 'cost_spike',
  FAILOVER_TRIGGERED: 'failover_triggered',
  JOB_FAILED: 'job_failed',
  VIDEO_COMPLETE: 'video_complete',
};

// ---------------------------------------------------------------------------
// AlertManager
// ---------------------------------------------------------------------------

export class AlertManager {
  /**
   * @param {object} opts
   * @param {string} [opts.discordWebhook] — Discord webhook URL
   * @param {string} [opts.slackWebhook] — Slack webhook URL
   * @param {string} [opts.emailTo] — email recipient (if smtp configured)
   * @param {object} [opts.thresholds] — custom alert thresholds
   */
  constructor({
    discordWebhook = env.DISCORD_WEBHOOK_URL,
    slackWebhook = env.SLACK_WEBHOOK_URL,
    emailTo = env.ALERT_EMAIL_TO,
    thresholds = {},
  } = {}) {
    this.discordWebhook = discordWebhook;
    this.slackWebhook = slackWebhook;
    this.emailTo = emailTo;
    this.thresholds = {
      errorRate: thresholds.errorRate ?? 0.05,   // 5%
      latencyP95Ms: thresholds.latencyP95Ms ?? 300_000, // 5 min
      costSpikeUsd: thresholds.costSpikeUsd ?? 10, // $10/day
      ...thresholds,
    };
    this._cooldowns = {}; // prevent alert spam
  }

  // -------------------------------------------------------------------------
  // Cooldown — prevent repeated alerts for same issue
  // -------------------------------------------------------------------------

  /**
   * Should we send an alert? (cooldown: 15 min per service + alert type)
   */
  _canAlert(service, alertType) {
    const key = `${service}:${alertType}`;
    const now = Date.now();
    const last = this._cooldowns[key] ?? 0;
    const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
    if (now - last < COOLDOWN_MS) return false;
    this._cooldowns[key] = now;
    return true;
  }

  // -------------------------------------------------------------------------
  // Discord
  // -------------------------------------------------------------------------

  /**
   * Send a Discord webhook message.
   * @param {object} payload — Discord embed object
   */
  async sendDiscord(payload) {
    if (!this.discordWebhook) return;
    try {
      const res = await fetch(this.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err) {
      console.error('[alerting] Discord send failed:', err.message);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Slack
  // -------------------------------------------------------------------------

  /**
   * Send a Slack webhook message.
   * @param {object} payload — Slack Block Kit payload
   */
  async sendSlack(payload) {
    if (!this.slackWebhook) return;
    try {
      const res = await fetch(this.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err) {
      console.error('[alerting] Slack send failed:', err.message);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Alert builders
  // -------------------------------------------------------------------------

  _colorFor(type) {
    switch (type) {
      case ALERT_TYPES.SERVICE_DOWN:     return 15_000_00;   // red
      case ALERT_TYPES.ERROR_RATE_HIGH:  return 16_079_616;   // orange
      case ALERT_TYPES.LATENCY_HIGH:      return 16_793_088;   // yellow
      case ALERT_TYPES.COST_SPIKE:        return 8_399_870;    // gold
      case ALERT_TYPES.FAILOVER_TRIGGERED: return 16_079_616;  // orange
      case ALERT_TYPES.VIDEO_COMPLETE:    return 3_066_350;    // green
      default:                            return 7_778_978;    // grey
    }
  }

  _emojiFor(type) {
    switch (type) {
      case ALERT_TYPES.SERVICE_DOWN:       return '🔴';
      case ALERT_TYPES.ERROR_RATE_HIGH:   return '🟠';
      case ALERT_TYPES.LATENCY_HIGH:      return '🟡';
      case ALERT_TYPES.COST_SPIKE:        return '💰';
      case ALERT_TYPES.FAILOVER_TRIGGERED: return '🔄';
      case ALERT_TYPES.JOB_FAILED:        return '❌';
      case ALERT_TYPES.VIDEO_COMPLETE:     return '✅';
      default:                             return '📊';
    }
  }

  // -------------------------------------------------------------------------
  // Send alert
  // -------------------------------------------------------------------------

  /**
   * Send an alert to all configured channels.
   *
   * @param {object} opts
   * @param {string} opts.type — ALERT_TYPES value
   * @param {string} opts.service — service key (e.g. 'hailuo')
   * @param {string} opts.serviceName — human-readable name
   * @param {string} opts.message — alert message
   * @param {object} [opts.details] — extra fields to show
   * @param {boolean} [opts.force] — skip cooldown
   */
  async sendAlert({ type, service, serviceName, message, details = {}, force = false }) {
    if (!force && !this._canAlert(service, type)) {
      console.log(`[alerting] Cooldown active for ${service}:${type}, skipping.`);
      return;
    }

    const emoji = this._emojiFor(type);
    const color = this._colorFor(type);
    const ts = Math.floor(Date.now() / 1000);

    // Discord embed
    const discordPayload = {
      username: 'TKP Alert Bot',
      avatar_url: 'https://i.imgur.com/AfFp7pu.png',
      embeds: [{
        title: `${emoji} [${serviceName}] ${message}`,
        color,
        fields: Object.entries(details).map(([k, v]) => ({ name: k, value: String(v), inline: true })),
        footer: { text: `TKP Content Agency • ${new Date().toISOString()}` },
        timestamp: new Date().toISOString(),
      }],
    };

    // Slack Block Kit
    const slackPayload = {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${emoji} ${message}`, emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Service:*\n${serviceName}` },
            { type: 'mrkdwn', text: `*Type:*\n${type}` },
            ...Object.entries(details).map(([k, v]) => ({ type: 'mrkdwn', text: `*${k}:*\n${v}` })),
          ],
        },
        { type: 'divider' },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `TKP Content Agency • ${new Date().toISOString()}` }],
        },
      ],
    };

    await Promise.allSettled([
      this.sendDiscord(discordPayload),
      this.sendSlack(slackPayload),
    ]);
  }

  // -------------------------------------------------------------------------
  // Convenience methods
  // -------------------------------------------------------------------------

  async alertServiceDown(service, serviceName, error = '') {
    await this.sendAlert({
      type: ALERT_TYPES.SERVICE_DOWN,
      service,
      serviceName,
      message: 'Service is DOWN',
      details: { Error: error || 'Connection refused / timeout', 'Immediate Action': 'Check service status' },
    });
  }

  async alertErrorRateHigh(service, serviceName, errorRate, totalRequests) {
    await this.sendAlert({
      type: ALERT_TYPES.ERROR_RATE_HIGH,
      service,
      serviceName,
      message: `High Error Rate: ${(errorRate * 100).toFixed(1)}%`,
      details: {
        'Error Rate': `${(errorRate * 100).toFixed(1)}%`,
        'Total Requests': String(totalRequests),
        'Threshold': `${(this.thresholds.errorRate * 100).toFixed(0)}%`,
      },
    });
  }

  async alertLatencyHigh(service, serviceName, p95LatencyMs) {
    await this.sendAlert({
      type: ALERT_TYPES.LATENCY_HIGH,
      service,
      serviceName,
      message: `High P95 Latency: ${(p95LatencyMs / 1000).toFixed(0)}s`,
      details: {
        'P95 Latency': `${(p95LatencyMs / 1000).toFixed(0)}s (${Math.round(p95LatencyMs)}ms)`,
        'Threshold': `${Math.round(this.thresholds.latencyP95Ms / 1000)}s`,
      },
    });
  }

  async alertCostSpike(service, serviceName, costUsd, thresholdUsd) {
    await this.sendAlert({
      type: ALERT_TYPES.COST_SPIKE,
      service,
      serviceName,
      message: `Cost Spike: $${costUsd.toFixed(2)}`,
      details: {
        'Total Cost': `$${costUsd.toFixed(2)}`,
        'Daily Threshold': `$${thresholdUsd.toFixed(2)}`,
      },
    });
  }

  async alertFailoverTriggered(service, serviceName, fromMethod, toMethod) {
    await this.sendAlert({
      type: ALERT_TYPES.FAILOVER_TRIGGERED,
      service,
      serviceName,
      message: `Failover: ${fromMethod} → ${toMethod}`,
      details: { 'From': fromMethod, 'To': toMethod },
    });
  }

  async alertJobFailed(service, serviceName, jobId, error) {
    await this.sendAlert({
      type: ALERT_TYPES.JOB_FAILED,
      service,
      serviceName,
      message: `Job Failed: ${jobId}`,
      details: { 'Job ID': jobId || 'N/A', 'Error': error || 'Unknown' },
    });
  }

  async alertVideoComplete(service, serviceName, videoId, method) {
    await this.sendAlert({
      type: ALERT_TYPES.VIDEO_COMPLETE,
      service,
      serviceName,
      message: `Video Complete`,
      details: { 'Video ID': videoId || 'N/A', 'Method': method },
    });
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (process.argv[1] === process.scriptName || import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const alertType = process.argv[2];
  const service = process.argv[3] || 'hailuo';
  const message = process.argv[4] || 'Test alert';

  const manager = new AlertManager();
  manager.sendAlert({
    type: alertType || ALERT_TYPES.SERVICE_DOWN,
    service,
    serviceName: 'Test Service',
    message,
    details: { Test: 'This is a test alert' },
    force: true,
  }).then(() => console.log('Alert sent.'));
}
