# Scaling Playbook: 1000 Videos in 30 Days — TKP Content Agency

> Operational playbook for scaling from 10 pilot videos to 1000 videos/30 days.
> Created for TKP-36. Built with `lib/production/queue-manager.js` and `scripts/production-dashboard.js`.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Target | 1,000 videos |
| Timeline | 30 days |
| Run rate required | ~33 videos/day |
| Current Hailuo free tier | 3/day |
| **Paid tier minimum** | **50/day (recommended 100/day)** |

**Hard blocker**: The Hailuo film.03 free tier caps at 3 generations/day. This makes 1,000 videos in 30 days mathematically impossible without upgrading to a paid plan.

---

## Bottleneck Analysis

### 1. Hailuo Video Generation — CRITICAL BOTTLENECK

**Problem**: Free tier = 3 videos/day. Required = ~33/day.

**Required action**: Contact MiniMax/Hailuo to upgrade to paid tier.

| Tier | Daily Cap | Cost Est. | Status |
|------|-----------|-----------|--------|
| Free | 3/day | $0 | Current |
| Starter | 50/day | ~$50/mo | Required minimum |
| Pro | 200/day | ~$200/mo | Recommended |
| Enterprise | Unlimited | Custom | For 10K+ scale |

**Workaround while waiting for paid tier**:
- Run Hailuo at full free capacity (3/day) during onboarding
- Parallelize all non-Hailuo steps (script, TTS, editing) to be ready when paid tier activates
- Queue all video generation jobs — `lib/scaling.js` handles the rate limiting automatically

### 2. Script Generation — PARALLELIZABLE

- MiniMax M2 model: Fast, ~5s per script
- Can run 100% parallel — no external API bottleneck
- Build a topic bank upfront → batch-generate scripts → feed into queue

**Optimization**:
- Pre-generate 2 weeks of script outlines before paid tier activates
- Build topic calendar in `content/content-calendar.md` — already done by FE2

### 3. TTS Audio — PARALLELIZABLE

- ElevenLabs + MiniMax TTS: Fast, ~10s per audio file
- Can run 100% parallel with script generation
- No rate limit issues for standard tiers

### 4. Video Editing (FFmpeg Assembly) — PARALLELIZABLE

- FFmpeg can run in parallel across multiple machines
- Currently a placeholder in `video-pipeline.js` (Stage 5: EXPORT)
- **Action needed**: FFmpeg node execution required — confirm `node` bash permission

### 5. QC Process — REQUIRE HUMAN SIGN-OFF

- Automated checks: technical specs, resolution, aspect ratio
- Manual checks: brand compliance, voice accuracy, hook effectiveness
- At 33 videos/day: requires dedicated QC reviewer or very fast spot-check process

### 6. Upload — AUTOMATED (OAuth tokens needed)

- TikTok: OAuth user auth required — CEO handles account setup
- YouTube: OAuth + refresh token — CEO handles channel auth
- Instagram: OAuth — CEO handles
- LinkedIn: OAuth — CEO handles
- Upload libs are built (`lib/upload/*.js`) — just need OAuth tokens

---

## Architecture

### Production Queue System

```
Topic Bank (pre-generated scripts)
    ↓
ProductionQueue (lib/production/queue-manager.js)
    ├── Priority-sorted job queue
    ├── Rate-limited by Hailuo cap (auto-tracks daily usage)
    ├── maxConcurrent: 3 parallel workers
    └── 3-attempt retry with exponential backoff
    ↓
BatchScheduler (run via `scripts/production-dashboard.js --run`)
    → picks next N jobs (fills available worker slots)
    ↓
ParallelPipeline per worker
    Hailuo → VideoEditor → QCRunner → Platform Export → UploadDispatcher
    ↓
MetricsTracker
    Daily stats: logs/production/YYYY-MM-DD.json
    Queue state: logs/queue/queue-state.json
    QC reports: logs/production/{jobId}_qc_report.txt
```

### Daily Run Rate

| Day | Free Tier | Paid Tier (100/day) |
|-----|-----------|---------------------|
| 1–10 | 3/day | 100/day |
| 11–20 | 3/day | 100/day |
| 21–30 | 3/day | 100/day |
| **Total free** | **30** | **30** |
| **Total needed** | **1,000** | **1,000** |
| **Gap** | **970** | **Paid tier fills gap** |

---

## Pre-Flight Checklist

Before running `ProductionScaler.run()`:

- [ ] Hailuo paid tier activated (daily cap > 33)
- [ ] `HAILUO_DAILY_CAP` set in `.env` to actual paid limit
- [ ] Topic bank populated with 30+ topics per channel
- [ ] Script outlines pre-generated for all queued videos
- [ ] OAuth tokens obtained for all platforms (TikTok, YouTube, Instagram, LinkedIn)
- [ ] FFmpeg installed/available for export step
- [ ] QC reviewer identified (human sign-off required)
- [ ] `output/` directory created (scaling.js creates it automatically)

---

## Running the Production Scaler

### 1. Populate the Queue

```javascript
const { ProductionQueue } = require('./lib/production/queue-manager');

const queue = new ProductionQueue({ maxConcurrent: 3 });
await queue.init();

// Add jobs — priority 1 (highest) to 10 (lowest)
const videos = [
  { channel: 'productivity_worker', script: '...', title: 'The 90-Minute Deep Work System', priority: 1 },
  { channel: 'gen_z_success', script: '...', title: 'I Made $3K in One Month Doing THIS', priority: 1 },
  // ... add all 1000 videos
];

for (const v of videos) {
  queue.addJob(v);
}
```

### 2. Run the Campaign

```bash
# Run one batch (fills up to maxConcurrent workers)
node scripts/production-dashboard.js --run

# Run repeatedly via cron or loop (every 5 min)
while true; do node scripts/production-dashboard.js --run; sleep 300; done
```

### 3. Monitor Progress

```bash
# Dashboard view
node scripts/production-dashboard.js

# Raw stats JSON
node scripts/production-dashboard.js --stats

# List all jobs
node scripts/production-dashboard.js --jobs

# View failed jobs
node scripts/production-dashboard.js --failed
```

---

## Scaling Levers

### Increase Output (without more Hailuo spend)

1. **Repurpose Long-Form → Shorts**: 1 YouTube video → 3 TikTok/Reels clips
2. **A/B variants**: Same script, different thumbnails/hooks
3. **Parallel channels**: If capacity allows, add more channels

### Reduce Burn Rate

1. **Use fast preset** for non-priority videos (`preset: 'fast'` → 720P, 6s)
2. **Reserve standard preset** for pillar content only
3. **Batch topic planning**: Generate scripts in batches of 50 to minimize API overhead

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Paid tier not activated in time | High | Critical | Pre-generate scripts/TTS while waiting; queue all jobs |
| Hailuo rate limit tighter than stated | Medium | High | Use conservative daily cap (80% of stated limit) |
| QC becomes bottleneck | High | Medium | Train second reviewer; accept automated QC for non-priority videos |
| TikTok/YT OAuth token expires | Medium | High | Implement token refresh; store refresh tokens securely |
| Node execution blocked | High | Critical | Confirm bash node permission before Day 1 |
| Content flagged for copyright | Low | High | Use only licensed music; QC checks cover this |
| Hailuo API downtime | Low | High | `generateWithRetry()` handles 5xx; 3-attempt retry in queue |

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Videos completed | 1,000 | `output/metrics.json` cumulativeDone |
| Videos/day average | 33 | `output/metrics.json` avgPerDay |
| QC pass rate | >90% | Manual review: pass / (pass + fail) |
| On-track status | true | `getSummary().onTrack` |
| Cost per video | <$0.10 | `output/logs/hailuo-costs.md` |
| Upload success rate | >95% | `output/logs/upload-*.json` |

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/production/queue-manager.js` | ProductionQueue + VideoJob — queue state, parallel execution, retry logic |
| `scripts/production-dashboard.js` | Dashboard CLI — daily progress, bottleneck alerts, job management |
| `scripts/qc-check.js` | Standalone QC runner for manual checks |
| `lib/edit/video-editor.js` | FFmpeg-based video editing — trim, transitions, music, subtitles, export |
| `lib/qc/qc-runner.js` | QCRunner — automated QC (FFprobe, audio levels, visual integrity) |
| `lib/video-pipeline.js` | Unified pipeline (script → TTS → Hailuo → QC → export → upload) |
| `lib/hailuo.js` | HailuoVideo class with retry/polling |
| `lib/tts.js` | TTSProvider (ElevenLabs + MiniMax) |
| `lib/upload/index.js` | UploadDispatcher — multi-platform upload |
| `content/qc-checklist.md` | 7-stage QC checklist (human + automated) |
| `content/video-editing-workflow.md` | Full editing workflow documentation |
| `logs/queue/queue-state.json` | Queue state (pending, done, failed) |
| `logs/hailuo-costs.md` | Cost tracking |
| `logs/production/` | Daily production event logs |

---

## Timeline

```
Week 1:  Activate paid tier. Pre-generate scripts. Run queue at full cap.
Week 2:  Production running at full speed. QC process operational.
Week 3:  First batch of videos hitting platforms. Engagement tracking begins.
Week 4:  Reach 1,000 videos. Analyze performance data. Plan next phase.
```
