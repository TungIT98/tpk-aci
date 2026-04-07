# YPP Tracking Dashboard

> **This file is deprecated.** Content has been merged into `ypp-status.md`.
> Use `ypp-status.md` as the canonical YPP tracking file.
>
> The weekly check-in log and per-video CTR/retention tracking tables are now in `ypp-status.md`.

---

## Quick Reference

### Scripts

```bash
# Auto-fetch from YouTube API (requires YOUTUBE_API_KEY in .env)
node analytics/ypp-tracker.js

# Manual entry
node analytics/ypp-tracker.js --manual

# View latest report
node analytics/ypp-tracker.js --report

# View milestone status
node analytics/ypp-tracker.js --milestones
```

### YPP Thresholds

| Requirement | Threshold |
|-------------|-----------|
| Subscribers | 1,000 |
| Watch Hours (12-month rolling) | 4,000 |
| Shorts Views (90-day rolling) | 10,000,000 |

> **Primary path:** 1,000 subscribers + 4,000 watch hours.
> **Shorts path:** 10M Shorts views + 1,000 subscribers — focus on standard path.

---

*Redirects to: `ypp-status.md`*
*Managed by: Analytics Agent*
