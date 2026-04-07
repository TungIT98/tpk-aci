# TKP Studio — Production Runbook

> Operational manual for running the TKP Content Agency video production studio.
> Companion to `content/studio-system.md` and `content/qc-checklist.md`.
> For use by the Production Manager agent and human operators.

---

## 1. Pre-Flight Checklist (Before Every Session)

Run this before starting production:

```bash
# 1. Verify all systems
node scripts/production-dashboard.js --stats

# 2. Check Hailuo quota
node scripts/hailuo-test.js

# 3. Verify FFmpeg
ffmpeg -version | head -1

# 4. Check music library
ls assets/music/productivity/
ls assets/music/growth/

# 5. Check output space (need ~500MB per video)
df -h .
```

### Pre-Flight Gate

| Check | Pass | Fail → Fix |
|-------|------|------------|
| Hailuo quota available | `hailuo-test.js` returns video_url | Wait for daily reset (midnight UTC) or add billing |
| FFmpeg available | `ffmpeg -version` works | Reinstall from `choco install ffmpeg` |
| Music library populated | `assets/music/{channel}/` has MP3s | Download royalty-free tracks (see §5) |
| FFmpeg works | No error on `ffmpeg -version` | Reinstall |
| 500MB+ free disk | `df -h .` shows space | Clear old renders from `output/` |
| API keys present | `ANTHROPIC_TOKEN_KEY`, `ELEVENLABS_API_KEY` set | Add to `.env` |

---

## 2. First Video — Step-by-Step

This section walks through producing the very first video end-to-end.

### 2.1 Choose a Topic

```bash
# View the keyword research for topic ideas
cat content/keyword-research.md

# View trending topics baseline
cat content/trending-topics.md

# Choose a topic and format
TOPIC="The 90-minute deep work system"
CHANNEL=productivity  # or: growth
```

### 2.2 Run the Pipeline

```bash
# Productivity channel — standard quality
node scripts/studio-automation.mjs \
  --channel=productivity \
  --topic="$TOPIC" \
  --preset=standard

# Growth channel — fast preset (3 Hailuo gens/day free tier)
node scripts/studio-automation.mjs \
  --channel=growth \
  --topic="Your growth topic" \
  --preset=fast
```

### 2.3 Monitor Progress

Each stage logs to console with timestamps:

```
[12:00:01] ▶ [SCRIPT] Starting...
[12:00:03] ✔ [SCRIPT] Done
[12:00:03] ▶ [TTS] Starting...
[12:00:15] ✔ [TTS] Done
[12:00:15] ▶ [VIDEO] Starting...
[12:01:30] ✔ [VIDEO] Done
[12:01:30] ▶ [THUMBNAIL] Starting...
[12:01:32] ✔ [THUMBNAIL] Done
...
```

Expected total time per video:
- `fast` preset: ~5–10 min (shorter video, no QC retry)
- `standard` preset: ~15–30 min (longer video, full QC)

### 2.4 QC Review

After the pipeline completes, review the output:

```bash
# Run automated QC
node scripts/qc-check.js --file output/productivity/<video-id>.mp4

# Review QC report
cat output/productivity/<video-id>_qc_report.txt
```

Manual QC review steps — see `content/qc-checklist.md`:
1. Watch full video — note any visual glitches or audio issues
2. Check thumbnail — does it stop the scroll?
3. Verify subtitles sync with audio
4. Confirm aspect ratio is correct for target platform

### 2.5 Publish

```bash
# Add to YouTube upload queue
node scripts/queue-add.js \
  --file=output/productivity/<video-id>.mp4 \
  --title="The 90-Minute Deep Work System (Productivity Framework)" \
  --channel=productivity \
  --platform=youtube

# Or use direct upload (requires OAuth tokens)
node scripts/publish.js \
  --file=output/productivity/<video-id>.mp4 \
  --platform=youtube
```

---

## 3. Daily Operations

### 3.1 Morning Check (5 min)

```bash
# Check dashboard
node scripts/production-dashboard.js

# View queue status
node scripts/production-dashboard.js --jobs

# Check Hailuo quota status
node scripts/hailuo-test.js
```

### 3.2 Add Videos to Queue

```bash
# Interactive add
node scripts/production-dashboard.js --add

# Or command-line add
node scripts/production-dashboard.js \
  --add \
  --channel=productivity \
  --title="Morning routine for deep work" \
  --priority=3
```

Priority scale: 1 (urgent) to 10 (low). Default is 5.
Productivity channel priority: 1–3 for high-value evergreen content.
Growth channel priority: 1–2 for viral hooks.

### 3.3 Run Batch (Daytime)

```bash
# Run 1–3 videos at a time (Hailuo free tier = 3/day)
node scripts/production-dashboard.js --run

# Check results
node scripts/production-dashboard.js --jobs
```

### 3.4 Evening Queue (Before Night Render)

```bash
# Add videos for night render
node scripts/studio-automation.mjs --mode=enqueue \
  --channel=productivity \
  --topic="Time blocking for knowledge workers"

# Verify queue
node scripts/studio-automation.mjs --mode=status
```

### 3.5 Night Render

Night render processes the queue while you sleep. Requires cron/scheduler setup:

```bash
# Manual trigger
node scripts/studio-automation.mjs --mode=night-render

# Expected duration: ~4–8 hours for a full queue
# Check progress next morning:
node scripts/production-dashboard.js --jobs
```

---

## 4. Night Render Setup

### 4.1 Cron Job (Linux/macOS/WSL)

```bash
# Edit crontab
crontab -e

# Add: run night render at 2:00 AM daily
0 2 * * * cd /path/to/TKP_ACI && node scripts/studio-automation.mjs --mode=night-render >> logs/night-render.log 2>&1

# Also: run at noon (Hailuo daily reset)
0 12 * * * cd /path/to/TKP_ACI && node scripts/studio-automation.mjs --mode=night-render >> logs/night-render-noon.log 2>&1
```

### 4.2 Windows Task Scheduler

```powershell
# Create task to run night render
schtasks /create \
  /tn "TKP Night Render" \
  /tr "node scripts\studio-automation.mjs --mode=night-render" \
  /sc daily \
  /st 02:00 \
  /ru SYSTEM
```

### 4.3 Monitor Night Render

```bash
# Check logs next morning
tail -50 logs/night-render.log

# Check for failures
node scripts/production-dashboard.js --failed

# Re-queue any failed jobs
# (failed jobs auto-retry up to 3 times)
```

---

## 5. Music Library Setup

The pipeline runs without music (TTS-only fallback), but full production requires background music.

### 5.1 Royalty-Free Sources

| Source | License | URL |
|--------|---------|-----|
| Pixabay Music | Commercial free | pixabay.com/music |
| Free Music Archive | Varies | freemusicarchive.org |
| YouTube Audio Library | YouTube-safe | studio.youtube.com/audio-library |
| Uppbeat | Creator-specific | uppbeat.io |
| Artlist | Commercial paid | artlist.io |

### 5.2 Channel-Specific Requirements

**TKP Productivity** (`assets/music/productivity/`):
- Tempo: 60–80 BPM
- Style: Ambient, lo-fi, cinematic instrumental
- Mood: Calm, focused, professional
- File format: MP3, 320kbps
- Min: 10 tracks

**TKP Growth** (`assets/music/growth/`):
- Tempo: 100–130 BPM
- Style: Upbeat, energetic, Gen Z trending
- Mood: Energetic, viral, fresh
- File format: MP3, 320kbps
- Min: 10 tracks

### 5.3 Naming Convention

```
assets/
├── music/
│   ├── productivity/
│   │   ├── 001_ambient-focus-1.mp3
│   │   ├── 002_lofi-work-1.mp3
│   │   └── ...
│   └── growth/
│       ├── 001_energy-viral-1.mp3
│       └── ...
```

### 5.4 Adding to the Pipeline

Once MP3s are in place, the `AudioMixer` stage in `studio-automation.mjs` automatically picks a random track per video.

---

## 6. Scaling to 1000 Videos

### 6.1 Production Targets

| Metric | Target |
|--------|--------|
| Videos per day | 33 |
| Videos per week | ~230 |
| Time to 1000 videos | ~30 days |
| Daily Hailuo gens (free) | 3 |
| Hailuo gens needed | 1000+ |

### 6.2 Hailuo Billing (Critical Path)

The free tier (3 gens/day) yields ~90 videos/month — far short of 1000.

**Required**: MiniMax paid plan for video generation.
```
MiniMax Video API: ~$0.05–0.10/video (verify current pricing)
1000 videos × $0.08 = ~$80 total
```

Add billing: `platform.minimax.io` → Account → Billing

### 6.3 Parallelization

Once paid Hailuo is active, run multiple workers:

```bash
# Worker 1 — Productivity
node scripts/studio-automation.mjs --channel=productivity --mode=batch &
# Worker 2 — Growth
node scripts/studio-automation.mjs --channel=growth --mode=batch &
# Wait for both
wait
```

### 6.4 Platform Distribution

| Platform | Format | Output |
|----------|--------|--------|
| YouTube (Productivity) | 16:9 | `output/productivity/` |
| YouTube (Growth) | 16:9 | `output/growth/` |
| TikTok | 9:16 1080×1920 | `uploads/tiktok/` |
| Instagram Reels | 9:16 1080×1920 | `uploads/instagram/` |
| LinkedIn | 16:9 | `uploads/linkedin/` |

Video export formats auto-adjust per platform in `lib/video-pipeline.js`.

---

## 7. Common Failures and Recovery

### Hailuo: `usage limit exceeded`

**Cause**: Free tier daily limit (3 gens/day) exhausted.
**Fix**: Wait for reset (midnight UTC), or add MiniMax billing.
**Recovery**: Jobs retry automatically next day.

### Hailuo: `2013 invalid params`

**Cause**: Wrong model name in API call.
**Fix**: Already fixed in `lib/hailuo.js` (uses `MiniMax-Hailuo-2.3`).
**Recovery**: Re-run failed job.

### FFmpeg: `Permission denied`

**Cause**: Output directory not writable.
**Fix**: `chmod +w output/` or run as user with write permissions.

### TTS: `401 Unauthorized`

**Cause**: `ELEVENLABS_API_KEY` expired or invalid.
**Fix**: Get new key at `elevenlabs.io` → API → Keys. Update `.env`.

### Audio mix: silent output

**Cause**: Music track not found (empty music directory).
**Fix**: Add royalty-free MP3s to `assets/music/{channel}/`. Pipeline falls back to TTS-only if no music found.

### QC fail: video too short/long

**Cause**: Script duration outside target range.
**Fix**: Adjust script length. Productivity: 3–10 min. Growth Shorts: 30–90 sec.

### YouTube OAuth: token expired

**Cause**: OAuth refresh token expired.
**Fix**: Re-run `scripts/oauth-youtube.js` to re-authenticate.

---

## 8. Cost Estimation

### Per-Video Costs

| Component | Free Tier | Paid Estimate |
|-----------|-----------|----------------|
| Hailuo video | $0 (3/day) | ~$0.05–0.10/video |
| ElevenLabs TTS | ~$0 (22min/mo free) | ~$0.003/min |
| Whisper transcription | $0 (local) | $0 (local via Ollama) |
| FFmpeg rendering | $0 (local) | $0 (local) |
| Storage (per video) | ~200–500MB | — |
| **Total per video** | **~$0** | **~$0.05–0.15** |
| **1000 videos** | **~$0** | **~$50–150** |

### Monthly Operating Costs (1000 videos)

| Item | Monthly Cost |
|------|-------------|
| MiniMax (video gen) | ~$50–100 |
| ElevenLabs (TTS) | ~$5–20 |
| Storage (2TB cloud) | ~$20 |
| **Total** | **~$75–140/month** |

---

## 9. File Inventory

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/studio-automation.mjs` | Main pipeline runner |
| `scripts/production-dashboard.js` | Dashboard and queue ops |
| `scripts/qc-check.js` | Automated QC gate |
| `scripts/queue-add.js` | Add upload jobs |
| `scripts/publish.js` | Direct platform publish |
| `scripts/hailuo-test.js` | Test Hailuo API + quota |
| `scripts/record-video-stats.js` | Record performance metrics |
| `scripts/analytics-report.js` | Weekly performance report |
| `scripts/oauth-youtube.js` | YouTube OAuth setup |
| `scripts/oauth-tiktok.js` | TikTok OAuth setup |

### Library Modules

| Module | Purpose |
|--------|---------|
| `lib/hailuo.js` | MiniMax video generation |
| `lib/tts.js` | TTS (ElevenLabs + MiniMax) |
| `lib/image.js` | Thumbnails + stock media |
| `lib/audio.js` | Whisper + audio mixing |
| `lib/ffmpeg-pro.js` | FFmpeg production tools |
| `lib/prompts.js` | Prompt engineering templates |
| `lib/video-pipeline.js` | Pipeline orchestrator |
| `lib/edit/video-editor.js` | FFmpeg video editing |
| `lib/production/queue-manager.js` | Production queue |
| `lib/upload/*.js` | Platform upload scripts |

### Logs

| File | Purpose |
|------|---------|
| `logs/video-stats.json` | Per-video performance data |
| `logs/hailuo-costs.md` | Hailuo cost tracking |
| `logs/ypp-metrics.json` | YouTube YPP progress |
| `output/_queue.json` | Night render queue |

---

## 10. Quick Reference Commands

```bash
# ── Pre-flight
node scripts/production-dashboard.js --stats
node scripts/hailuo-test.js

# ── Produce one video
node scripts/studio-automation.mjs --channel=productivity --topic="..." --preset=fast

# ── Queue operations
node scripts/studio-automation.mjs --mode=status      # view queue
node scripts/studio-automation.mjs --mode=enqueue --channel=growth --topic="..."
node scripts/studio-automation.mjs --mode=night-render  # run queue
node scripts/studio-automation.mjs --mode=batch         # run all

# ── Dashboard
node scripts/production-dashboard.js                  # live dashboard
node scripts/production-dashboard.js --jobs             # all jobs
node scripts/production-dashboard.js --failed          # failures
node scripts/production-dashboard.js --run             # run batch

# ── QC
node scripts/qc-check.js --file output/productivity/<id>.mp4

# ── Upload
node scripts/publish.js --file output/productivity/<id>.mp4 --platform=youtube

# ── Stats
node scripts/record-video-stats.js --summary
node scripts/analytics-report.js --weekly
```
