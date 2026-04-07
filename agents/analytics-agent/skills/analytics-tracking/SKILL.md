---
name: analytics-tracking
description: >
  Use when: Tracking video performance metrics, monitoring subscriber counts, analyzing
  engagement data, or compiling analytics reports.
  Do NOT use when: Creating content, uploading videos, or writing scripts.
---

# Analytics Tracking Skill

## Platform Analytics

### YouTube Studio
```
WebFetch(url="https://studio.youtube.com", prompt="Extract: total views, subscribers, watch time, top video")
```

### TikTok Analytics
```
WebFetch(url="https://www.tiktok.com/business/en/analytics", prompt="Extract: followers, views, engagement rate, top video")
```

## Metrics to Track

| Metric | YouTube | TikTok |
|--------|---------|--------|
| Views | Total, per video | Total, per video |
| Watch Time | Minutes | N/A |
| Subscribers | Followers | Followers |
| Engagement | Likes, Comments, Shares | Likes, Comments, Shares |
| CTR | Thumbnail CTR | N/A |
| Revenue | AdSense | Creator fund |

## Performance Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Views (per video) | < 100 in 24h | < 50 in 48h |
| Engagement Rate | < 3% | < 1% |
| Subscriber Growth | < 10/week | < 20/week |
| Watch Time (YT) | < 50% retention | < 30% retention |

## YPP Progress Tracking

Target: 1000 subscribers + 4000 watch hours (or 10M Shorts views)

Track milestones:
- 100 subscribers
- 500 subscribers
- 1000 subscribers (YPP eligible)

## Output Files

Save to: `content/dashboards/channel-performance.md`

```markdown
# Channel Performance Dashboard
Last Updated: 2026-04-01

## YouTube
- Total Views: [N]
- Subscribers: [N]
- Watch Time: [N] hours
- Top Video: [title] ([views] views)

## TikTok
- Followers: [N]
- Total Views: [N]
- Top Video: [title] ([views] views)

## YPP Status
- Subscribers: [N]/1000
- Watch Hours: [N]/4000 (or Shorts: [N]/10M)
```

Update: Daily or after each upload
