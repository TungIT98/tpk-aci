# TN-01 (Xianxia Episode 1) Performance Report

**Channel:** Tien Nghich (Xianxia) — TikTok + YouTube Shorts
**Video:** TN-01 — "When Heaven Denies You Everything, You Rewrite Destiny"
**Prepared by:** Analytics Agent
**Date:** 2026-04-02

---

## Publication Status — ⚠️ UNCERTAIN

| Platform | Claimed Status | Evidence | Confidence |
|----------|---------------|----------|------------|
| TikTok | Claimed SUCCESS | `batch-upload-20260401-124149.log` line 1230 | ⚠️ Unreliable |
| TikTok | FAILED | `batch-upload-20260401-231248.log` (re-run, improved uploader) | Higher confidence |
| YouTube Shorts | Not attempted | — | N/A |

**Conclusion:** TN-01's TikTok publish status is **unknown**. The video was in the first batch (91 claimed successes) and failed on re-run. The most likely scenario: initial upload succeeded before TikTok's anti-spam threshold was triggered; subsequent uploads (including re-run) failed. Manual TikTok login verification required to confirm.

---

## Performance Metrics — NO DATA AVAILABLE

| Metric | Value | Reason |
|--------|-------|--------|
| Views | — | TikTok Creator API unavailable (rate-blocked); YouTube API unavailable (OAuth revoked) |
| Likes | — | Same |
| Comments | — | Same |
| Shares | — | Same |
| Watch Time | — | Same |
| Engagement Rate | — | Same |
| Profile Visits | — | Same |

> **Source:** Both TikTok and YouTube APIs are inaccessible. No performance data can be retrieved without API access or manual entry from YouTube Studio / TikTok Analytics.

---

## Confirmed vs. Claimed Pipeline Status

| Item | Status | Source |
|------|--------|--------|
| TN-01 video file | ✅ Produced | `output_topic/videos/TN-01.mp4` |
| TN-01 first batch upload attempt | ⚠️ Claimed SUCCESS | `batch-upload-20260401-124149.log` |
| TN-01 re-run upload | ❌ FAILED | `batch-upload-20260401-231248.log` |
| TN-01 actual TikTok publish | ❓ UNKNOWN | Requires manual TikTok login check |
| TN-01 YouTube Shorts | ❌ Not uploaded | WC-01–05 and TN-01 YT Shorts pending |

---

## TN Series Status

| Video | TikTok Status | YouTube Shorts | Notes |
|-------|--------------|----------------|-------|
| TN-01 | ⚠️ Unknown | ❌ Pending | Batch 1: claimed SUCCESS; re-run: FAILED |
| TN-02 | ⚠️ Unknown | ❌ Pending | Batch 1: claimed SUCCESS; re-run: FAILED |
| TN-03 | ⚠️ Unknown | ❌ Pending | Batch 1: claimed SUCCESS; re-run: FAILED |
| TN-04 | ⚠️ Unknown | ❌ Pending | Batch 1: claimed SUCCESS; re-run: FAILED |
| TN-05 | ⚠️ Unknown | ❌ Pending | Batch 1: claimed SUCCESS; re-run: FAILED |

> All 5 Xianxia (TN) episodes claimed SUCCESS in first batch; all FAILED on re-run. Manual verification needed for all 5.

---

## Platform Blockers

| Platform | Blocker | Owner | Action |
|----------|---------|-------|--------|
| TikTok | Rate-blocked (100% failure on re-run) | Board | Manually verify TikTok login; wait for cooldown |
| YouTube | OAuth revoked (TKP-485) | Board | Re-authenticate YouTube OAuth |
| YouTube Data API | `YOUTUBE_API_KEY` is placeholder | Founding Engineer | Configure real API key |
| TikTok Creator API | Not connected | Founding Engineer | Connect via TikTok Developer Portal |

---

## Next Steps (Unblocked)

1. **Board: Verify TikTok account** — log into TikTok Studio manually and confirm if TN-01–05 are visible under published videos
2. **Board: Re-authenticate YouTube OAuth** — complete [TKP-485](/TKP/issues/TKP-485)
3. **Founding Engineer: Configure TikTok Creator API** — to enable programmatic performance tracking
4. **Analytics Agent: Log performance** — once APIs are connected, pull TN-01 metrics and update this report

---

## Historical Baseline (Pre-TN-01)

- **vid_005 "Second Brain"** (most comparable deep-content video): 6,947 views, 530 likes, 175.8h watch time, 3.01% CTR — from 5-video aggregate baseline as of 2026-03-25
- TN-01 is a Xianxia fantasy narrative (6-second Shorts format) — performance benchmark not yet established

---

*Report generated: 2026-04-02 by Analytics Agent*
*Data sources: `batch-upload-20260401-124149.log`, `batch-upload-20260401-231248.log`, `logs/video-stats.json`*
*Next update: Upon TikTok/YouTube API unblock or manual platform verification*
