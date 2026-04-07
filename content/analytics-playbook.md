# Analytics Operations Playbook
> Complete guide for running the TKP Content Agency analytics system.
> Maintained by: Analytics Agent
> Last updated: 2026-03-27

---

## Overview

The analytics system tracks both TKP channels across six metric categories:

| Channel | Internal Name | YouTube Handle | Primary Niche |
|---------|--------------|----------------|---------------|
| Channel 1 | **Productivity Worker** | @TKPProductivity | Evidence-based productivity for knowledge workers |
| Channel 2 | **Gen Z Success** | @TKPGrowth | Real results for Gen Z building income & career |

> **Naming convention:** Internal dashboards and reports use "Productivity Worker" and "Gen Z Success." The YouTube channel names are TKP Productivity and TKP Growth respectively. Do not mix these — always use the internal names in dashboards and reports.

---

## System Architecture

```
YouTube Studio (manual) ──or── YouTube API (automated)
                                      │
                            analytics/ypp-tracker.js
                            analytics/channel-dashboard.js
                                      │
                              logs/channel-metrics.json
                              logs/ypp-metrics.json
                              logs/video-stats.json
                                      │
                    content/dashboards/channel-performance.md
                    content/dashboards/subscriber-growth.md
                    content/dashboards/watch-time-optimization.md
                    content/dashboards/adsense-revenue.md
                    content/dashboards/diversification.md
                    content/ypp-status.md
                                      │
                    content/reports/weekly/WEEKLY-YYYY-MM-DD.md
                    content/reports/monthly/MONTHLY-YYYY-MM.md
                    content/reports/diversification.md
```

---

## Required Environment Configuration

### YouTube API Setup

Before automated data collection works, you must configure the `.env` file:

```env
# YouTube Data API v3 — for channel stats (subscribers, views, video count)
# Get key: https://console.cloud.google.com → APIs & Services → Credentials
# Enable: YouTube Data API v3
YOUTUBE_API_KEY=YOUR_YOUTUBE_DATA_API_V3_KEY

# YouTube Analytics OAuth — for watch hours, revenue, retention
# Requires OAuth 2.0 flow. See "OAuth Setup" section below.
YOUTUBE_ACCESS_TOKEN=YOUR_OAUTH_ACCESS_TOKEN
YOUTUBE_REFRESH_TOKEN=YOUR_OAUTH_REFRESH_TOKEN

# Channel IDs — found in YouTube Studio → Settings → Channel → Advanced
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxxxx
YOUTUBE_SECONDARY_CHANNEL_ID=UCyyyyyyyyyyyyyyyyyyyy

# Optional — channel names for cleaner reporting
YOUTUBE_CHANNEL_NAME=Productivity Worker
YOUTUBE_SECONDARY_CHANNEL_NAME=Gen Z Success
```

### OAuth Setup (Required for Watch Hours + Revenue)

The YouTube Analytics API requires OAuth 2.0 (not a simple API key). Steps:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or select existing)
3. Enable **YouTube Data API v3** and **YouTube Analytics API**
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
5. Application type: **Desktop app** (or Web if hosted)
6. Download the JSON credentials file
7. Use the OAuth Playground ([oauth.google.com](https://oauth.google.com)) to get a refresh token:
   - Step 1: Authorize `https://www.googleapis.com/auth/yt-analytics.readonly`
   - Step 2: Exchange authorization code for tokens
8. Copy `access_token` and `refresh_token` into `.env`

> **Note:** Refresh tokens are long-lived but can be revoked. Store them securely. Access tokens expire in ~1 hour and are auto-refreshed by the analytics scripts when using a refresh token.

### Alternative: Manual Entry (No API Required)

If YouTube API access is not configured, use manual entry every week:

```bash
# Enter data for primary channel
node analytics/channel-dashboard.js --manual

# Enter data for secondary channel
node analytics/channel-dashboard.js --manual

# Enter YPP metrics
node analytics/ypp-tracker.js --manual
```

YouTube Studio provides all metrics needed — manual entry is viable for weekly reporting.

---

## Weekly Reporting Workflow

Run this every Monday (or after the previous week's data is available in YouTube Studio).

### Step 1: Pull or Enter Data

```bash
# Option A: Automated (requires full API + OAuth setup — both channels)
node analytics/channel-dashboard.js --pull
node analytics/ypp-tracker.js --all

# Option B: Manual entry (both channels)
node analytics/channel-dashboard.js --manual
node analytics/ypp-tracker.js --manual
```

### Step 2: Update Dashboards

```bash
node analytics/channel-dashboard.js --update
```

### Step 3: Generate Weekly Report

```bash
node analytics/channel-dashboard.js --weekly
```

Output: `content/reports/weekly/WEEKLY-YYYY-MM-DD.md`

### Step 4: Update YPP Status Tracker

```bash
node analytics/ypp-tracker.js --report
```

Or manually update `content/ypp-status.md` with the latest numbers from YouTube Studio.

---

## Monthly Reporting Workflow

Run on the 1st of each month (for previous month's data).

### Step 1: Pull Monthly Data

```bash
node analytics/channel-dashboard.js --pull   # Pulls 30-day summary
node analytics/ypp-tracker.js --report        # Prints YPP status to console
```

### Step 2: Generate Monthly Report

Manually compile `content/reports/monthly/MONTHLY-YYYY-MM.md` using:
- The weekly reports from the past month
- YouTube Studio → Analytics → Advanced Mode for the full month view
- The current dashboard files for snapshots

### Step 3: Update Diversification Report

Manually update `content/reports/diversification.md` with:
- Any new affiliate revenue
- Traffic source mix from YouTube Studio
- Platform updates (TikTok milestone, etc.)

---

## Key Metrics Reference

### YPP Eligibility Thresholds

| Requirement | Threshold | Notes |
|-------------|-----------|-------|
| Subscribers | 1,000 | Hard requirement |
| Watch Hours (12-month rolling) | 4,000 | Primary bottleneck |
| Shorts Views (90-day rolling) | 10,000,000 | Shorts path — focus on standard |
| 2-Step Verification | Enabled | Must be on before applying |
| AdSense linked | Yes | Link at ~75% of thresholds |

### Target Metrics by Phase

| Phase | Target Subs | Target Watch Hrs | Weekly Videos |
|-------|------------|-----------------|--------------|
| Month 1 | 0–100 | 0–200 | 4–6 long-form |
| Month 3 | 100–500 | 200–1,000 | 6–8 long-form + Shorts |
| Month 6 | 500–1,000 | 1,000–4,000 | 8–10 long-form + daily Shorts |
| Post-YPP | 1,000+ | 4,000+ | Scale as revenue permits |

### AdSense Benchmarks

| Metric | Good | Target | Warning |
|--------|------|--------|---------|
| RPM (productivity niche) | $2–4 | $4–6 | <$2 |
| RPM (Gen Z finance niche) | $4–8 | $6–10 | <$3 |
| CTR | 4–6% | >5% | <2% |
| Retention | 50–60% | >55% | <40% |
| Sub Rate | 2–5% | >3% | <2% |
| CPM (productivity) | $3–8 | $5–10 | <$3 |
| CPM (Gen Z finance) | $8–20 | $10–25 | <$5 |

> **RPM vs CPM:** RPM = revenue per 1,000 video views (what you earn). CPM = revenue per 1,000 ad impressions (what advertisers pay). YouTube keeps 45–55%. RPM ≈ 50% of CPM in practice.

---

## Alert Thresholds

### YPP Progress Alerts

| Alert | Threshold | Action |
|-------|-----------|--------|
| 🟡 First data point | Any video published | Log baseline metrics |
| 🟡 10% milestone | 100 subs or 400 watch hrs | Celebrate + review early content |
| 🟡 25% milestone | 250 subs or 1,000 watch hrs | Intensify content cadence |
| 🟠 50% milestone | 500 subs or 2,000 watch hrs | Prepare AdSense account |
| 🟠 75% milestone | 750 subs or 3,000 watch hrs | Link AdSense; schedule YPP application |
| 🟢 100% milestone | 1,000 subs + 4,000 watch hrs | **Apply for YPP immediately** |

### Operational Alerts

| Alert | Channel | Threshold | Action |
|-------|---------|-----------|--------|
| Low CTR | Either | <2% | A/B test thumbnail/hook |
| Low retention | Either | <40% | Audit retention curve; rewrite hooks |
| Sub rate drop | Either | <2% for 3 weeks | Review content quality |
| Watch time plateau | Either | No growth for 4 weeks | Test new formats/topics |
| RPM below floor | Either | <$2 productivity / <$3 Gen Z | Check content type mix |
| Revenue at $0 despite views | Either | >1K views, $0 revenue | Check for demonetized content |

---

## Dashboard Update Schedule

| Dashboard | Update Frequency | File | Owner |
|-----------|----------------|------|-------|
| Channel Performance | Weekly | `dashboards/channel-performance.md` | Analytics Agent |
| YPP Status Tracker | Weekly | `ypp-status.md` | Analytics Agent |
| Subscriber Growth | Weekly | `dashboards/subscriber-growth.md` | Analytics Agent |
| Watch Time Optimization | Weekly | `dashboards/watch-time-optimization.md` | Analytics Agent |
| AdSense & Revenue | Monthly | `dashboards/adsense-revenue.md` | Analytics Agent |
| Diversification | Monthly | `dashboards/diversification.md` | Analytics Agent |

---

## Data Sources

### YouTube Studio (Manual — Required Even With API)

1. **studio.youtube.com → Analytics → Overview**
   - Views, watch time, subscribers (30-day summary)

2. **studio.youtube.com → Analytics → Advanced Mode**
   - Traffic sources (search, suggested, browse, external, direct)
   - Device breakdown
   - Audience demographics
   - Top videos by watch time

3. **studio.youtube.com → Content**
   - Video list with individual performance stats
   - Click "Analytics" on each video for per-video data

4. **studio.youtube.com → Reach → Impressions**
   - CTR, impressions, click-through rate by video
   - Traffic sources driving impressions

5. **AdSense (post-YPP)**
   - RPM, CPM, revenue by video and by month
   - Estimated payments

### External Tools (Optional)

| Tool | Purpose | Cost |
|------|---------|------|
| Social Blade | Competitive benchmarking, daily subscriber tracking | Free + Pro |
| TubeBuddy | SEO tags, thumbnail testing, analytics overlay | Free + paid tiers |
| VidIQ | Competitive analysis, SEO, trend alerts | Free + Pro |
| Google Trends | Topic search volume, seasonal patterns | Free |

---

## Competitive Benchmarking Setup

Track peer channels monthly using Social Blade or TubeBuddy.

### Productivity Niche Peer Channels (Track)

- Thomas Frank (2M+ subs — aspirational)
- Matt D'Avella (1M+ subs — lifestyle angle)
- Ali Abdaal (minor overlap — medical/professional)
- James Clear-adjacent channels

### Gen Z Finance Peer Channels (Track)

- Ali Abdaal (minor overlap)
- Minority Mindset (400K+ — sharp, clear finance)
- Andrei Jikh (1M+ — long-form finance)
- Debt-Free Millennials (smaller — direct competitor)

### Benchmark Metrics to Track

For each peer channel, track monthly:
- Total subscribers and monthly growth rate
- Views per video (average over last 10 videos)
- Upload frequency
- CTR and retention if visible
- Top content themes (topics driving most views)

---

## Scripts Reference

```bash
# ── channel-dashboard.js ──────────────────────────────────────────────────────
# Pull data from YouTube API (primary channel — OAuth required)
node analytics/channel-dashboard.js --pull

# Print formatted report to console (both channels if IDs set)
node analytics/channel-dashboard.js --report

# Interactive manual data entry
node analytics/channel-dashboard.js --manual

# Update dashboard markdown files from stored data
node analytics/channel-dashboard.js --update

# Generate weekly report markdown
node analytics/channel-dashboard.js --weekly

# ── ypp-tracker.js ────────────────────────────────────────────────────────────
# Pull YPP data from API for ALL configured channels
node analytics/ypp-tracker.js --all

# Pull for primary channel only
node analytics/ypp-tracker.js --channel primary

# Pull for secondary channel only
node analytics/ypp-tracker.js --channel secondary

# Print YPP report for all channels
node analytics/ypp-tracker.js --report

# Print YPP milestone status (JSON)
node analytics/ypp-tracker.js --milestones

# Manual entry (prompts for each target channel)
node analytics/ypp-tracker.js --manual
```

---

## Known Limitations

1. **No video-level API pull:** Video stats must be entered manually from YouTube Studio per-video analytics.
2. **OAuth token expiry:** Access tokens expire in ~1 hour. Scripts attempt refresh using refresh token, but if that fails, re-run OAuth flow.
3. **Shorts watch hours:** Shorts views are tracked but watch hours from Shorts do NOT count toward YPP 4,000-hour requirement.
4. **Pre-YPP revenue:** No AdSense data is accessible until YPP is approved.
5. **Both-channel support:** `ypp-tracker.js --all` and `channel-dashboard.js` support both channels. Ensure `YOUTUBE_CHANNEL_ID` and `YOUTUBE_SECONDARY_CHANNEL_ID` are both set in `.env`.

---

## Appendix: .env Configuration Checklist

```env
# ── YouTube Data API v3 ──────────────────────────────────────────────────────
# Required for: subscribers, total views, video count
YOUTUBE_API_KEY=

# ── YouTube OAuth (Analytics API) ─────────────────────────────────────────────
# Required for: watch hours, 30-day views, revenue, avg duration
# Obtain via: Google Cloud Console → OAuth 2.0 Playground
YOUTUBE_ACCESS_TOKEN=
YOUTUBE_REFRESH_TOKEN=

# ── Channel IDs ────────────────────────────────────────────────────────────────
# Found in YouTube Studio → Settings → Channel → Advanced
# Format: UCxxxxxxxxxxxxxxxxxxxxxxxx (24-char prefix)
YOUTUBE_CHANNEL_ID=         # Productivity Worker (primary)
YOUTUBE_SECONDARY_CHANNEL_ID=  # Gen Z Success (secondary)

# ── Channel Names (optional) ──────────────────────────────────────────────────
YOUTUBE_CHANNEL_NAME=Productivity Worker
YOUTUBE_SECONDARY_CHANNEL_NAME=Gen Z Success
```

---

## Appendix: YouTube Studio Data Entry Cheatsheet

When running `--manual`, here are the numbers to copy from YouTube Studio:

| Script Field | YouTube Studio Location |
|-------------|------------------------|
| Total subscribers | Analytics → Overview (top card) |
| Total channel views | Analytics → Overview → Total views |
| Videos published | Content tab (count of published videos) |
| Watch hours (12-mo) | Analytics → Watch time → 12-month view |
| Views (last 30 days) | Analytics → Overview → Views |
| Subscribers gained (30d) | Analytics → Subscriber count → Net change |
| Subscribers lost (30d) | Analytics → Subscriber count → Net change |
| Revenue (30d) | AdSense → Reports (post-YPP only) |
| Avg view duration | Analytics → Average view duration |

---

*Maintained by: Analytics Agent*
*Review: Monthly, or when new channels/video content is added*
