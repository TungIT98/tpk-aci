#!/usr/bin/env node
/**
 * scripts/preflight-check.js
 * Pre-flight system check — validates all prerequisites before running production.
 *
 * Usage:
 *   node scripts/preflight-check.js          # Full check
 *   node scripts/preflight-check.js --quick  # Skip slow checks
 */

const { execSync } = require('child_process');
const { existsSync, readFileSync, readdirSync, statSync } = require('fs');
const { resolve, dirname } = require('path');
const path = require('path');

const ROOT = resolve(__dirname, '..');
const ENV_FILE = resolve(ROOT, '.env');
const LOG_FILE = resolve(ROOT, 'logs', 'preflight.json');

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const BOLD  = t => `\x1b[1m${t}\x1b[0m`;
const GREEN = t => `\x1b[32m${t}\x1b[0m`;
const RED   = t => `\x1b[31m${t}\x1b[0m`;
const YEL   = t => `\x1b[33m${t}\x1b[0m`;
const CYAN  = t => `\x1b[36m${t}\x1b[0m`;
const DIM   = t => `\x1b[2m${t}\x1b[0m`;

const pass = label => console.log(`  ${GREEN('✔')} ${label}`);
const fail = (label, hint) => {
  console.log(`  ${RED('✖')} ${label}`);
  if (hint) console.log(`    ${DIM('→')} ${hint}`);
  fails.push(label);
};
const warn = (label, hint) => {
  console.log(`  ${YEL('⚠')} ${label}`);
  if (hint) console.log(`    ${DIM('→')} ${hint}`);
  warns.push(label);
};
const info = (label, detail) => {
  console.log(`  ${CYAN('ℹ')} ${label}${detail ? ` — ${DIM(detail)}` : ''}`);
};

// ─── Core checks ─────────────────────────────────────────────────────────────

function checkFFmpeg() {
  console.log(`\n${BOLD('FFmpeg')}`);
  try {
    const v = execSync('ffmpeg -version', { timeout: 10000 })
      .toString().split('\n')[0];
    const match = v.match(/ffmpeg version ([^\s]+)/);
    pass(`FFmpeg installed: ${match ? match[1] : 'unknown'}`);
    return true;
  } catch {
    fail('FFmpeg not found', 'Run: choco install ffmpeg (Windows) or brew install ffmpeg (macOS)');
    return false;
  }
}

function checkEnvFile() {
  console.log(`\n${BOLD('.env File')}`);
  if (!existsSync(ENV_FILE)) {
    fail('.env file not found', 'Create .env in the workspace root');
    return false;
  }
  pass('.env file exists');
  return true;
}

function loadEnv() {
  const env = {};
  if (!existsSync(ENV_FILE)) return env;
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

function checkApiKeys(env) {
  console.log(`\n${BOLD('API Keys')}`);
  const required = [
    ['ANTHROPIC_TOKEN_KEY', 'Hailuo video generation'],
    ['ELEVENLABS_API_KEY', 'Text-to-speech'],
  ];
  const optional = [
    ['PEXELS_API_KEY', 'Stock video/image search'],
    ['OPENAI_API_KEY', 'Whisper transcription'],
    ['TIKTOK_ACCESS_TOKEN', 'TikTok upload (live)'],
  ];

  let ok = true;
  for (const [key, label] of required) {
    if (env[key]) {
      pass(`${key} set`);
    } else {
      fail(`${key} missing — ${label} unavailable`, `Add ${key}=... to .env`);
      ok = false;
    }
  }
  for (const [key, label] of optional) {
    if (env[key]) {
      pass(`${key} set`);
    } else {
      warn(`${key} not set — ${label} will use fallback`);
    }
  }
  return ok;
}

function checkDirectories() {
  console.log(`\n${BOLD('Directory Structure')}`);
  const dirs = [
    ['assets/music/productivity', 'Productivity channel music'],
    ['assets/music/growth', 'Growth channel music'],
    ['assets/thumbnails/productivity', 'Productivity thumbnails'],
    ['assets/thumbnails/growth', 'Growth thumbnails'],
    ['assets/broll/raw', 'Raw B-roll footage'],
    ['assets/logos', 'Logo files'],
    ['output/productivity', 'Productivity renders'],
    ['output/growth', 'Growth renders'],
    ['logs', 'Logs directory'],
  ];

  let allOk = true;
  for (const [dir, label] of dirs) {
    const full = resolve(ROOT, dir);
    if (existsSync(full)) {
      pass(`${dir}`);
    } else {
      fail(`${dir} missing`, `mkdir -p ${dir}`);
      allOk = false;
    }
  }
  return allOk;
}

function checkMusicLibrary() {
  console.log(`\n${BOLD('Music Library')}`);
  const channels = ['productivity', 'growth'];
  let hasMusic = true;

  for (const ch of channels) {
    const musicDir = resolve(ROOT, 'assets', 'music', ch);
    if (!existsSync(musicDir)) {
      warn(`assets/music/${ch}/ not found`);
      hasMusic = false;
      continue;
    }
    const mp3s = readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
    if (mp3s.length === 0) {
      warn(`assets/music/${ch}/ is empty — pipeline will use TTS-only`, 'Add royalty-free MP3s to assets/music/');
      hasMusic = false;
    } else {
      pass(`assets/music/${ch}/ — ${mp3s.length} track(s)`);
    }
  }
  return hasMusic;
}

function checkDiskSpace() {
  console.log(`\n${BOLD('Disk Space')}`);
  try {
    // Simple check — just verify output dirs are writable
    const testFile = resolve(ROOT, 'output', '.preflight-write-test');
    require('fs').writeFileSync(testFile, 'test');
    require('fs').unlinkSync(testFile);
    pass('output/ is writable (~200–500MB needed per video)');
    return true;
  } catch (e) {
    fail('output/ is not writable', 'Fix permissions: chmod +w output/');
    return false;
  }
}

function checkNodeModules() {
  console.log(`\n${BOLD('Node.js Modules')}`);
  const modules = ['lib/hailuo.js', 'lib/tts.js', 'lib/image.js', 'lib/audio.js'];
  let allOk = true;
  for (const mod of modules) {
    const full = resolve(ROOT, mod);
    if (existsSync(full)) {
      pass(mod);
    } else {
      fail(`${mod} not found`);
      allOk = false;
    }
  }
  return allOk;
}

function checkScripts() {
  console.log(`\n${BOLD('Scripts')}`);
  const scripts = [
    'scripts/studio-automation.mjs',
    'scripts/production-dashboard.js',
    'scripts/qc-check.js',
    'scripts/publish.js',
  ];
  let allOk = true;
  for (const s of scripts) {
    const full = resolve(ROOT, s);
    if (existsSync(full)) {
      pass(s);
    } else {
      fail(`${s} not found`);
      allOk = false;
    }
  }
  return allOk;
}

function checkLogs() {
  console.log(`\n${BOLD('Logs')}`);
  const logFile = resolve(ROOT, 'logs', 'video-stats.json');
  if (existsSync(logFile)) {
    try {
      const stats = JSON.parse(readFileSync(logFile, 'utf8'));
      const count = Array.isArray(stats.videos) ? stats.videos.length : 0;
      pass(`video-stats.json — ${count} video(s) tracked`);
    } catch {
      warn('video-stats.json is corrupted', 'Will be reset on next write');
    }
  } else {
    info('video-stats.json not found', 'Will be created on first stats record');
  }
}

function checkHailuoQuota() {
  console.log(`\n${BOLD('Hailuo Quota (API test)')}`);
  const hailuoTest = resolve(ROOT, 'scripts', 'hailuo-test.js');
  if (!existsSync(hailuoTest)) {
    warn('scripts/hailuo-test.js not found — skipping quota check');
    return;
  }
  try {
    const out = execSync(`node "${hailuoTest}"`, { timeout: 30000 }).toString();
    if (out.includes('error') || out.includes('fail') || out.includes('quota')) {
      warn('Hailuo quota appears exhausted or API error', 'Check Hailuo dashboard or wait for daily reset');
    } else {
      pass('Hailuo API responding');
    }
  } catch (e) {
    const errMsg = e.stdout?.toString() || e.message || '';
    if (errMsg.includes('quota') || errMsg.includes('exceeded') || errMsg.includes('usage limit')) {
      warn('Hailuo usage limit reached', 'Add billing at platform.minimax.io or wait for daily reset');
    } else {
      warn('Hailuo API test failed', errMsg.slice(0, 120));
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function summarize(fails, warns) {
  console.log(`\n${'─'.repeat(60)}`);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  console.log(`  ${BOLD('Pre-Flight Summary')} — ${now}`);

  if (fails.length === 0 && warns.length === 0) {
    console.log(`\n  ${GREEN('✔ ALL CHECKS PASSED')} — Ready to produce.`);
    console.log(`\n  Run your first video:`);
    console.log(`  ${CYAN('node scripts/studio-automation.mjs --channel=productivity --topic="..." --preset=fast')}`);
  } else {
    if (fails.length > 0) {
      console.log(`\n  ${RED(`✖ ${fails.length} failure(s) — fix before production:`)}`);
      fails.forEach(f => console.log(`    • ${f}`));
    }
    if (warns.length > 0) {
      console.log(`\n  ${YEL(`⚠ ${warns.length} warning(s) — non-blocking:`)}`);
      warns.forEach(w => console.log(`    • ${w}`));
    }
    console.log(`\n  ${DIM('Failures block production. Warnings allow TTS-only fallback.')}`);
  }

  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    passed: fails.length === 0,
    failures: fails,
    warnings: warns,
  };
  try {
    const logDir = resolve(ROOT, 'logs');
    if (!existsSync(logDir)) require('fs').mkdirSync(logDir, { recursive: true });
    require('fs').writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));
  } catch (_) {}

  return fails.length === 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const fails = [];
const warns = [];

console.log(`\n${BOLD('TKP STUDIO — Pre-Flight Check')}`);
console.log(`${'─'.repeat(60)}`);

checkFFmpeg();
const env = loadEnv();
if (Object.keys(env).length > 0) {
  checkApiKeys(env);
} else {
  warn('.env not loaded — cannot check API keys');
}
checkDirectories();
checkMusicLibrary();
checkDiskSpace();
checkNodeModules();
checkScripts();
checkLogs();

const quick = process.argv.includes('--quick');
if (!quick) {
  checkHailuoQuota();
} else {
  info('Skipping slow checks (--quick mode)');
}

const ok = summarize(fails, warns);
process.exit(ok ? 0 : 1);
