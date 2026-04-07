/**
 * scripts/monitor-services.js
 * Periodic service health monitoring — run via cron or n8n schedule.
 *
 * Usage:
 *   node scripts/monitor-services.js           # probe all services
 *   node scripts/monitor-services.js --alerts  # check and send active alerts
 *   node scripts/monitor-services.js --report   # print health report
 *   node scripts/monitor-services.js --weekly  # generate weekly report
 *
 * Schedule (n8n or cron):
 *   Every 15 minutes: probe all services
 *   Daily at 09:00: check for alerts
 *   Weekly on Monday 09:00: generate weekly report
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Load environment
// ---------------------------------------------------------------------------

function loadEnv() {
  try {
    const env = {};
    const lines = readFileSync(resolve(REPO_ROOT, '.env'), 'utf-8').split('\n');
    for (const line of lines) {
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
// Modules
// ---------------------------------------------------------------------------

const { HealthTracker, SERVICES } = await import('../monitoring/health_tracker.js');
const { AlertManager, ALERT_TYPES } = await import('../monitoring/alerting.js');

const tracker = new HealthTracker(resolve(__dirname, '..', 'monitoring', 'dashboard_data.json'));
const alertManager = new AlertManager();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`[monitor:${new Date().toISOString().slice(0, 16)}] ${msg}`);
}

function loadFailoverLogs() {
  const logFile = resolve(__dirname, '..', 'logs', `failover_${new Date().toISOString().slice(0, 10)}.jsonl`);
  if (!existsSync(logFile)) return [];
  try {
    return readFileSync(logFile, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Probe all services
// ---------------------------------------------------------------------------

async function probeServices() {
  log('Probing all services...');
  const results = await tracker.probeAll();
  let allOk = true;

  for (const [key, result] of Object.entries(results)) {
    const def = SERVICES[key];
    if (!def?.baseUrl) continue; // skip local services without baseUrl

    // Record the probe as an event
    tracker.record(key, {
      latencyMs: result.latencyMs,
      success: result.ok,
      cost: 0,
      errorType: result.ok ? null : 'probe_failed',
    });

    if (!result.ok) {
      allOk = false;
      log(`  🔴 ${def.name}: DOWN — ${result.error}`);
      if (result.error) {
        await alertManager.alertServiceDown(key, def.name, result.error);
      }
    } else {
      log(`  ✅ ${def.name}: OK (${result.latencyMs}ms)`);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Check alerts
// ---------------------------------------------------------------------------

async function checkAlerts() {
  log('Checking for active alerts...');
  const report = tracker.getReport();
  let alertsSent = 0;

  for (const [key, svc] of Object.entries(report.services)) {
    if (!svc.alerts?.length) continue;
    const def = SERVICES[key];
    for (const alertMsg of svc.alerts) {
      if (alertMsg.includes('error rate') || alertMsg.includes('Error Rate')) {
        await alertManager.alertErrorRateHigh(key, def?.name || key, (svc.errorRate ?? 0) / 100, svc.totalRequests);
        alertsSent++;
      } else if (alertMsg.includes('latency') || alertMsg.includes('Latency')) {
        await alertManager.alertLatencyHigh(key, def?.name || key, svc.p95LatencyMs);
        alertsSent++;
      }
    }
  }

  log(`  Sent ${alertsSent} alert(s).`);
  return alertsSent;
}

// ---------------------------------------------------------------------------
// Weekly report
// ---------------------------------------------------------------------------

async function generateWeeklyReport() {
  log('Generating weekly report...');
  const report = tracker.getReport();
  const since = report.since;

  // Load template
  const templatePath = resolve(__dirname, '..', 'monitoring', 'weekly_report_template.md');
  let template = readFileSync(templatePath, 'utf-8');

  // Build service table rows
  const svcRows = Object.entries(report.services).map(([key, svc]) => {
    const alerts = svc.alerts?.length ? `⚠️ ${svc.alerts.length}` : '✅';
    return `| ${svc.name} | ${svc.successRate ?? 'N/A'}% | ${svc.avgLatencyMs}ms | ${svc.p95LatencyMs}ms | ${svc.successRate ?? 'N/A'}% | $${svc.totalCostUsd} | ${alerts} |`;
  }).join('\n');

  // Cost table
  const costRows = Object.entries(report.services)
    .filter(([, svc]) => svc.totalCostUsd > 0)
    .map(([key, svc]) => {
      const dailyAvg = svc.totalCostUsd / 7;
      return `| ${svc.name} | $${dailyAvg.toFixed(2)} | $${svc.totalCostUsd.toFixed(2)} | — |`;
    }).join('\n');

  const totalCost = Object.values(report.services).reduce((s, v) => s + (v.totalCostUsd || 0), 0);
  const weeklyBudget = 80; // MiniMax plan
  const budgetUtil = ((totalCost / weeklyBudget) * 100).toFixed(1);

  // Volume table
  const volumeRows = Object.entries(report.services)
    .filter(([, svc]) => svc.totalRequests > 0)
    .map(([key, svc]) => {
      const avgDay = (svc.totalRequests / 7).toFixed(1);
      return `| ${svc.name} | ${svc.totalRequests} | ${avgDay} | — |`;
    }).join('\n');

  // Failover events
  const failoverEvents = loadFailoverLogs();
  const failoverSection = failoverEvents.length > 0
    ? failoverEvents.slice(-10).map(e => `- *${e.ts}* [${e.level}] ${e.event}: ${JSON.stringify(e.details || {})}`).join('\n')
    : null;

  // Incidents
  const incidents = Object.entries(report.services)
    .filter(([, svc]) => svc.errorRate > 5)
    .map(([key, svc]) => `### 🔴 ${svc.name}: ${svc.errorRate}% error rate (${svc.totalRequests} requests)`)
    .join('\n');

  // Executive summary
  const totalAlerts = Object.values(report.services).reduce((s, v) => s + (v.alerts?.length || 0), 0);
  const execSummary = totalAlerts === 0
    ? 'All services operating normally. No incidents or error rate breaches this week.'
    : `${totalAlerts} alert(s) triggered this week. See details below.`;

  // Recommendations
  const recommendations = [];
  if (totalCost > weeklyBudget * 0.8) {
    recommendations.push(`⚠️ Budget alert: ${budgetUtil}% of weekly budget consumed. Consider monitoring usage closely.`);
  }
  const highErrorSvcs = Object.entries(report.services).filter(([, v]) => (v.errorRate || 0) > 3);
  if (highErrorSvcs.length) {
    recommendations.push(`⚠️ ${highErrorSvcs.map(([k]) => SERVICES[k]?.name || k).join(', ')} had elevated error rates this week.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('✅ No immediate action items. Continue standard operations.');
  }

  // Week start/end
  const genAt = new Date().toISOString();
  const weekEnd = new Date(genAt);
  const weekStart = new Date(weekEnd.getTime() - 6 * 24 * 60 * 60 * 1000);

  // Substitute template vars
  template = template
    .replace(/\{\{WEEK_START\}\}/g, weekStart.toISOString().slice(0, 10))
    .replace(/\{\{WEEK_END\}\}/g, weekEnd.toISOString().slice(0, 10))
    .replace(/\{\{GENERATED_AT\}\}/g, genAt)
    .replace(/\{\{EXECUTIVE_SUMMARY\}\}/g, execSummary)
    .replace(/\{\{SERVICE_TABLE_ROWS\}\}/g, svcRows || '| — | — | — | — | — | — | — |')
    .replace(/\{\{INCIDENTS\}\}/g, incidents || 'No incidents.')
    .replace(/\{\{COST_TABLE_ROWS\}\}/g, costRows || '| — | — | — | — |')
    .replace(/\{\{TOTAL_COST\}\}/g, totalCost.toFixed(2))
    .replace(/\{\{WEEKLY_BUDGET\}\}/g, String(weeklyBudget))
    .replace(/\{\{BUDGET_UTIL\}\}/g, budgetUtil)
    .replace(/\{\{VOLUME_TABLE_ROWS\}\}/g, volumeRows || '| — | — | — | — |')
    .replace(/\{\{FAILOVER_EVENTS\}\}/g, failoverSection || 'No failover events triggered this week.')
    .replace(/\{\{RECOMMENDATIONS\}\}/g, recommendations.join('\n\n'));

  // Write report
  const outPath = resolve(__dirname, '..', 'monitoring', `weekly_report_${weekEnd.toISOString().slice(0, 10)}.md`);
  writeFileSync(outPath, template);
  log(`  Weekly report written to: ${outPath}`);

  // Also send to Discord/Slack if configured
  if (env.DISCORD_WEBHOOK_URL || env.SLACK_WEBHOOK_URL) {
    await alertManager.sendAlert({
      type: ALERT_TYPES.VIDEO_COMPLETE,
      service: 'monitoring',
      serviceName: 'Health Monitor',
      message: `Weekly Report Ready: ${weekEnd.toISOString().slice(0, 10)}`,
      details: { 'Total Cost': `$${totalCost.toFixed(2)}`, 'Alerts': String(totalAlerts), 'Report': outPath },
      force: true,
    });
  }

  return outPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const action = process.argv[2];

if (action === '--probe') {
  await probeServices();
} else if (action === '--alerts') {
  await checkAlerts();
} else if (action === '--report') {
  console.log(JSON.stringify(tracker.getReport(), null, 2));
} else if (action === '--weekly') {
  await generateWeeklyReport();
} else if (action === '--csv') {
  console.log(tracker.getTodaySummary());
} else {
  // Default: probe + check alerts
  await probeServices();
  await checkAlerts();
  log('Health check complete.');
}
