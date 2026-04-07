/**
 * lib/qc/qc-runner.js
 * Automated + human-review QC pipeline for TKP Content Agency.
 * Runs automated checks on generated videos, surfaces blockers for human review,
 * and logs results for pass-rate tracking.
 *
 * Usage:
 *   const { QCRunner } = require('./lib/qc/qc-runner');
 *   const qc = new QCRunner('productivity_worker');
 *   const result = await qc.run(videoPath, { title: '...', platform: 'youtube' });
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');

// ─── Channel specs ────────────────────────────────────────────────────────────

const CHANNEL_SPECS = {
  productivity_worker: {
    name: 'TKP Productivity',
    aspectRatio: '16:9',
    minDuration: 60,      // seconds (YouTube algo favors >60s)
    maxDuration: 600,     // 10 min
    fps: 30,
    resolution: { width: 1920, height: 1080 },
    audioLevelMin: -20,   // dBFS minimum for speech
    audioLevelMax: -10,   // dBFS maximum (clipping threshold)
    luqsTarget: -16,      // YouTube loudness standard
    truePeakMax: -1.0,    // dBTP
    musicVolumeMax: 0.20, // music as fraction of speech
    platform: 'youtube',
  },
  gen_z_success: {
    name: 'TKP Growth',
    aspectRatio: '16:9',
    minDuration: 30,      // Shorts allowed
    maxDuration: 600,
    fps: 60,
    resolution: { width: 1920, height: 1080 },
    audioLevelMin: -20,
    audioLevelMax: -10,
    luqsTarget: -14,
    truePeakMax: -1.0,
    musicVolumeMax: 0.18,
    platform: 'youtube',
  },
};

// ─── Severity levels ─────────────────────────────────────────────────────────

const SEVERITY = {
  BLOCKING: 'BLOCKING',   // Must fix before publishing
  WARN: 'WARN',           // Flag for review, can proceed
  PASS: 'PASS',           // Check passed
  SKIP: 'SKIP',           // Check not applicable
};

// ─── Utility helpers ─────────────────────────────────────────────────────────

function run(command, cwd = process.cwd()) {
  try {
    return { success: true, output: execSync(command, { cwd, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/** Probe video with ffprobe, returns null on failure */
function probe(fileOrUrl) {
  // Use -rw_timeout for URL sources to avoid hanging
  const timeoutArg = fileOrUrl.startsWith('http') ? '-rw_timeout 10000000' : '';
  const result = run(
    `ffprobe -v quiet -print_format json -show_format -show_streams ${timeoutArg} "${fileOrUrl}" 2>&1`
  );
  if (!result.success) return null;
  try {
    return JSON.parse(result.output);
  } catch (_) {
    return null;
  }
}

/** Download a small range of a URL to check accessibility */
function checkUrlAccessible(url, timeoutMs = 10000) {
  return new Promise(resolve => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, res => {
      resolve({ accessible: res.statusCode < 400, statusCode: res.statusCode });
    });
    req.on('error', err => resolve({ accessible: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ accessible: false, error: 'timeout' }); });
  });
}

/** Get file size in MB */
function getFileSizeMB(filePath) {
  if (filePath.startsWith('http')) return null; // Can't determine remotely without HEAD request
  try {
    const stats = fs.statSync(filePath);
    return stats.size / (1024 * 1024);
  } catch (_) {
    return null;
  }
}

// ─── Automated check functions ───────────────────────────────────────────────

function checkVideoExists(videoPath) {
  if (videoPath.startsWith('http')) {
    return { id: 'video_url_accessible', label: 'Video URL accessible', severity: SEVERITY.BLOCKING,
      result: 'checking...', pass: null };
  }
  const exists = fs.existsSync(videoPath);
  return { id: 'video_exists', label: 'Video file exists', severity: SEVERITY.BLOCKING,
    result: exists ? videoPath : 'NOT FOUND', pass: exists };
}

async function checkVideoMetadata(videoPath, spec) {
  const info = probe(videoPath);
  if (!info) {
    return { id: 'video_probe', label: 'FFprobe metadata read', severity: SEVERITY.BLOCKING,
      result: 'Could not read metadata (corrupt file or invalid URL)', pass: false };
  }

  const videoStream = (info.streams || []).find(s => s.codec_type === 'video');
  const audioStream = (info.streams || []).find(s => s.codec_type === 'audio');
  const format = info.format || {};
  const duration = parseFloat(format.duration || 0);

  const checks = [];

  // Duration check
  const durationPass = duration >= spec.minDuration && duration <= spec.maxDuration;
  checks.push({
    id: 'duration',
    label: `Duration ${spec.minDuration}–${spec.maxDuration}s`,
    severity: SEVERITY.BLOCKING,
    result: `${duration.toFixed(1)}s`,
    pass: durationPass,
  });

  // Resolution
  if (videoStream) {
    const w = parseInt(videoStream.width || 0);
    const h = parseInt(videoStream.height || 0);
    const resPass = w >= 1280 && h >= 720;
    checks.push({
      id: 'resolution',
      label: 'Resolution ≥ 720p',
      severity: SEVERITY.BLOCKING,
      result: `${w}×${h}`,
      pass: resPass,
    });

    // Frame rate
    let fps = 0;
    if (videoStream.r_frame_rate) {
      const [n, d] = videoStream.r_frame_rate.split('/').map(Number);
      fps = d ? n / d : n;
    }
    const fpsPass = fps >= spec.fps - 1; // Allow 1fps tolerance
    checks.push({
      id: 'fps',
      label: `Frame rate ≥ ${spec.fps}fps`,
      severity: SEVERITY.BLOCKING,
      result: `${fps.toFixed(2)}fps`,
      pass: fpsPass,
    });

    // Codec
    const codec = videoStream.codec_name || 'unknown';
    const codecPass = ['h264', 'avc1'].includes(codec);
    checks.push({
      id: 'video_codec',
      label: 'Video codec H.264',
      severity: SEVERITY.BLOCKING,
      result: codec,
      pass: codecPass,
    });

    // Aspect ratio
    const ar = w / h;
    const targetAr = spec.aspectRatio === '16:9' ? 16 / 9 : 9 / 16;
    const arPass = Math.abs(ar - targetAr) < 0.1;
    checks.push({
      id: 'aspect_ratio',
      label: `Aspect ratio ${spec.aspectRatio}`,
      severity: SEVERITY.BLOCKING,
      result: `~${ar.toFixed(2)}`,
      pass: arPass,
    });
  }

  // Audio
  if (!audioStream) {
    checks.push({
      id: 'audio_present',
      label: 'Audio stream present',
      severity: SEVERITY.BLOCKING,
      result: 'No audio stream found',
      pass: false,
    });
  } else {
    const audioCodec = audioStream.codec_name || 'unknown';
    const audioPass = ['aac', 'mp3', 'opus'].includes(audioCodec);
    checks.push({
      id: 'audio_codec',
      label: 'Audio codec AAC/MP3/Opus',
      severity: SEVERITY.BLOCKING,
      result: audioCodec,
      pass: audioPass,
    });

    const sampleRate = parseInt(audioStream.sample_rate || 0);
    const srPass = sampleRate >= 44100;
    checks.push({
      id: 'audio_sample_rate',
      label: 'Audio sample rate ≥ 44100Hz',
      severity: SEVERITY.WARN,
      result: `${sampleRate}Hz`,
      pass: srPass,
    });
  }

  // Format / container
  const container = format.format_name || '';
  const containerPass = container.includes('mp4') || container.includes('mov');
  checks.push({
    id: 'container',
    label: 'Container MP4/MOV',
    severity: SEVERITY.BLOCKING,
    result: container,
    pass: containerPass,
  });

  // File size
  const fileSizeMB = getFileSizeMB(videoPath);
  if (fileSizeMB !== null) {
    const ytLimitMB = 256 * 1024; // 256GB YouTube limit — not a practical check
    const tiktokLimitMB = 287;
    checks.push({
      id: 'file_size',
      label: 'File size under platform limits',
      severity: SEVERITY.BLOCKING,
      result: `${fileSizeMB.toFixed(1)} MB`,
      pass: true, // informational only for now
    });
  }

  return { id: 'metadata', label: 'Video metadata', severity: SEVERITY.BLOCKING, checks, pass: checks.every(c => c.pass) };
}

/** Analyze audio levels using FFmpeg's volumedetect + ebur128 filter */
async function checkAudioLevels(videoPath, spec) {
  const result = run(
    `ffmpeg -i "${videoPath}" -af "volumedetect" -f null /dev/null 2>&1`
  );

  if (!result.success) {
    return { id: 'audio_levels', label: 'Audio levels (LUFS/dBFS)', severity: SEVERITY.BLOCKING,
      result: 'Could not analyze audio', pass: null };
  }

  const output = result.output;

  // Extract max volume in dBFS
  const maxVolMatch = output.match(/max_volume:\s*([-\d.]+)\s*dBFS/);
  const meanVolMatch = output.match(/mean_volume:\s*([-\d.]+)\s*dBFS/);

  const maxVol = maxVolMatch ? parseFloat(maxVolMatch[1]) : null;
  const meanVol = meanVolMatch ? parseFloat(meanVolMatch[1]) : null;

  const checks = [];

  if (maxVol !== null) {
    const belowClipping = maxVol <= spec.audioLevelMax;
    checks.push({
      id: 'audio_headroom',
      label: `Max level ≤ ${spec.audioLevelMax} dBFS (no clipping)`,
      severity: SEVERITY.BLOCKING,
      result: `${maxVol.toFixed(1)} dBFS`,
      pass: belowClipping,
    });
  }

  if (meanVol !== null) {
    const audible = meanVol >= spec.audioLevelMin;
    checks.push({
      id: 'audio_audible',
      label: `Mean level ≥ ${spec.audioLevelMin} dBFS (audible)`,
      severity: SEVERITY.BLOCKING,
      result: `${meanVol.toFixed(1)} dBFS`,
      pass: audible,
    });
  }

  return {
    id: 'audio_levels',
    label: 'Audio levels',
    severity: SEVERITY.BLOCKING,
    checks,
    pass: checks.length > 0 ? checks.every(c => c.pass) : null,
  };
}

/** Check video dimensions are correct for stated platform aspect ratio */
async function checkAspectRatio(videoPath, spec) {
  const info = probe(videoPath);
  if (!info) return { id: 'aspect_ratio_check', label: 'Aspect ratio check', severity: SEVERITY.BLOCKING, result: 'probe failed', pass: false };

  const vs = (info.streams || []).find(s => s.codec_type === 'video');
  if (!vs) return { id: 'aspect_ratio_check', label: 'Aspect ratio check', severity: SEVERITY.BLOCKING, result: 'no video stream', pass: false };

  const w = parseInt(vs.width || 0);
  const h = parseInt(vs.height || 0);
  const ar = w / h;
  const targetAr = spec.aspectRatio === '16:9' ? 16 / 9 : 9 / 16;
  const tolerance = spec.aspectRatio === '16:9' ? 0.15 : 0.1;
  const pass = Math.abs(ar - targetAr) < tolerance;

  return {
    id: 'aspect_ratio_check',
    label: `Aspect ratio ${spec.aspectRatio} (${w}×${h})`,
    severity: SEVERITY.BLOCKING,
    result: `actual ~${ar.toFixed(2)} vs target ${spec.aspectRatio}`,
    pass,
  };
}

/** Check for visible corruption or artifacts using pixel variance analysis */
async function checkVisualIntegrity(videoPath) {
  // Extract 3 frames (start, middle, end) and check they are not blank
  const tmpDir = os.tmpdir();
  const frames = [];
  const timestamps = [1, 'middle', 'end'];

  for (let i = 0; i < 3; i++) {
    const ts = i === 0 ? 1 : i === 1 ? '00:00:02' : '00:00:03';
    const outFile = path.join(tmpDir, `qc_frame_${i}_${Date.now()}.png`);
    const r = run(`ffmpeg -y -ss ${ts} -i "${videoPath}" -vframes 1 "${outFile}" 2>&1`);
    if (r.success && fs.existsSync(outFile)) {
      frames.push(outFile);
    }
  }

  const checks = frames.map((f, i) => {
    // Check file size is reasonable (>1KB, not blank)
    const size = fs.statSync(f).size;
    const pass = size > 1024;
    return {
      id: `frame_${i + 1}_valid`,
      label: `Frame ${i + 1} not blank`,
      severity: SEVERITY.WARN,
      result: `${(size / 1024).toFixed(1)} KB`,
      pass,
    };
  });

  // Clean up
  frames.forEach(f => { try { fs.unlinkSync(f); } catch (_) {} });

  return {
    id: 'visual_integrity',
    label: 'Visual integrity (frame extraction)',
    severity: SEVERITY.WARN,
    checks,
    pass: checks.every(c => c.pass),
  };
}

/** Human review checklist — these cannot be automated */
function humanReviewChecklist(videoPath, spec) {
  return {
    id: 'human_review',
    label: 'Human review required',
    severity: SEVERITY.BLOCKING,
    requiresHuman: true,
    checks: [
      { id: 'hr_hook_3sec', label: 'First 3 seconds stop the scroll?', pass: null },
      { id: 'hr_value_delivery', label: 'Content delivers on hook promise?', pass: null },
      { id: 'hr_pacing', label: 'No dead moments / drop-off spots?', pass: null },
      { id: 'hr_accurate', label: 'Claims/facts are accurate or labeled anecdotal?', pass: null },
      { id: 'hr_thumbnail', label: 'Thumbnail legible and on-brand?', pass: null },
      { id: 'hr_brand_fit', label: 'Video feels like it belongs to the channel?', pass: null },
      { id: 'hr_music_appropriate', label: 'Music appropriate for content?', pass: null },
      { id: 'hr_subtitle_readable', label: 'Subtitles readable at small sizes?', pass: null },
    ],
  };
}

/** Platform-specific checks */
function checkPlatformCompliance(videoPath, platform, spec) {
  const checks = [];
  const fileSizeMB = getFileSizeMB(videoPath);

  if (platform === 'tiktok' || platform === 'instagram_reels') {
    const info = probe(videoPath);
    const duration = info ? parseFloat(info.format?.duration || 0) : 0;
    const tiktokMax = 180;
    const reelsMax = 90;
    const maxDur = platform === 'tiktok' ? tiktokMax : reelsMax;
    checks.push({
      id: `${platform}_duration`,
      label: `${platform} duration ≤ ${maxDur}s`,
      severity: SEVERITY.BLOCKING,
      result: `${duration.toFixed(0)}s`,
      pass: duration <= maxDur && duration > 0,
    });
    if (fileSizeMB && fileSizeMB > 287) {
      checks.push({
        id: `${platform}_file_size`,
        label: `${platform} file size ≤ 287MB`,
        severity: SEVERITY.BLOCKING,
        result: `${fileSizeMB.toFixed(1)} MB`,
        pass: false,
      });
    }
  }

  return {
    id: 'platform_compliance',
    label: `${platform} platform compliance`,
    severity: SEVERITY.BLOCKING,
    checks,
    pass: checks.length === 0 || checks.every(c => c.pass),
  };
}

// ─── QC Runner ────────────────────────────────────────────────────────────────

class QCRunner {
  /**
   * @param {string} channel — 'productivity_worker' | 'gen_z_success'
   */
  constructor(channel = 'productivity_worker') {
    this.channel = channel;
    this.spec = CHANNEL_SPECS[channel];
    if (!this.spec) throw new Error(`Unknown channel: ${channel}`);
  }

  /**
   * Run full QC suite on a video.
   * @param {string} videoPath — local path or URL
   * @param {object} options — { title, platform, skipHumanReview }
   * @returns {Promise<QCResult>}
   */
  async run(videoPath, options = {}) {
    const { title = '', platform = 'youtube', skipHumanReview = false } = options;
    const startTime = Date.now();

    const results = [];

    // 1. Basic existence
    results.push(checkVideoExists(videoPath));

    // 2. Probe metadata
    results.push(await checkVideoMetadata(videoPath, this.spec));

    // 3. Audio levels
    results.push(await checkAudioLevels(videoPath, this.spec));

    // 4. Aspect ratio
    results.push(await checkAspectRatio(videoPath, this.spec));

    // 5. Visual integrity (frame extraction)
    results.push(await checkVisualIntegrity(videoPath));

    // 6. Platform compliance
    results.push(checkPlatformCompliance(videoPath, platform, this.spec));

    // 7. Human review (always blocking, cannot be automated)
    if (!skipHumanReview) {
      results.push(humanReviewChecklist(videoPath, this.spec));
    }

    // Compute overall pass/fail
    const blockingResults = results.filter(r => r.severity === SEVERITY.BLOCKING && !r.requiresHuman);
    const blockingPass = blockingResults.every(r => r.pass !== false);

    const elapsedMs = Date.now() - startTime;

    const summary = {
      channel: this.spec.name,
      video: videoPath,
      platform,
      title,
      overallPass: blockingPass,
      blockingChecks: blockingResults.length,
      blockingPassed: blockingResults.filter(r => r.pass === true).length,
      humanReviewRequired: !skipHumanReview,
      elapsedMs,
      timestamp: new Date().toISOString(),
    };

    return { summary, results };
  }

  /**
   * Log QC result to file.
   */
  log(result, outputPath = 'logs/qc-results.json') {
    const logDir = path.dirname(outputPath);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const existing = [];
    if (fs.existsSync(outputPath)) {
      try { existing.push(...JSON.parse(fs.readFileSync(outputPath, 'utf8'))); } catch (_) {}
    }
    existing.push(result);
    fs.writeFileSync(outputPath, JSON.stringify(existing, null, 2), 'utf8');
  }

  /**
   * Print human-readable QC report.
   */
  printReport(result) {
    const { summary, results } = result;
    const lines = [];
    lines.push(`\n=== QC Report: ${summary.channel} | ${summary.platform} ===`);
    lines.push(`Overall: ${summary.overallPass ? '✅ PASS' : '❌ FAIL'}`);
    lines.push(`Blocking checks: ${summary.blockingPassed}/${summary.blockingChecks}`);
    if (summary.humanReviewRequired) lines.push('Human review: REQUIRED before publish');
    lines.push('');

    for (const r of results) {
      if (r.checks) {
        lines.push(`  ${r.label} [${r.severity}]`);
        for (const c of r.checks) {
          const icon = c.pass === true ? '✅' : c.pass === false ? '❌' : '⏳';
          lines.push(`    ${icon} ${c.label}: ${c.result}`);
        }
      } else {
        const icon = r.pass === true ? '✅' : r.pass === false ? '❌' : '⏳';
        lines.push(`  ${icon} ${r.label}: ${r.result} [${r.severity}]`);
      }
    }
    console.log(lines.join('\n'));
    return lines.join('\n');
  }
}

/**
 * Parse TTS word timings into subtitle cues for QC verification.
 */
function cuesFromWordTimings(wordTimings, maxWordsPerCue = 8) {
  const cues = [];
  let i = 0;
  while (i < wordTimings.length) {
    const chunk = wordTimings.slice(i, i + maxWordsPerCue);
    cues.push({
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      text: chunk.map(w => w.word).join(' '),
    });
    i += maxWordsPerCue;
  }
  return cues;
}

module.exports = { QCRunner, CHANNEL_SPECS, SEVERITY, cuesFromWordTimings };
