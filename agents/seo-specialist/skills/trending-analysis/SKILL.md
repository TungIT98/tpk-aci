---
name: trending-analysis
description: >
  Use when: Discovering trending topics, analyzing viral content patterns, monitoring
  platform trends (TikTok, YouTube), or identifying content opportunities.
  Do NOT use when: Writing scripts, creating videos, or uploading content.
---

# Trending Analysis Skill

## Trending Discovery Process

### TikTok Vietnam
```bash
WebSearch(query="TikTok Vietnam trending today 2026")
WebSearch(query="TikTok viral hashtags Vietnam April 2026")
WebFetch(url="https://www.tiktok.com/discover", prompt="What is trending on TikTok Vietnam?")
```

### YouTube Shorts
```bash
WebSearch(query="YouTube Shorts trending Vietnam 2026")
WebSearch(query="youtube shorts viral content this week")
```

### Xianxia-Specific Trends
```bash
WebSearch(query="xianxia trending TikTok 2026")
WebSearch(query="chinese drama viral TikTok Vietnam")
WebSearch(query="Trieu Tien trending hashtag")
```

## Trend Evaluation Framework

### Virality Indicators
- View count trajectory (10K+ in 24h = viral)
- Engagement rate (likes/views > 5% = good)
- Comment sentiment (positive = keep going)
- Share rate (shares/views > 1% = exceptional)

### Platform-Specific Factors

**TikTok:**
- Algorithm favors early engagement
- Trending sounds + hashtags boost discovery
- Duet/Stitch opportunities
- Local language (Vietnamese) advantage

**YouTube Shorts:**
- Watch time > 80% = algorithm boost
- CTR from thumbnail + title
- Consistency matters (daily upload helps)
- Subscribers don't matter as much as views

## Trending Topics Output

Save to: `content/trending-topics.md`

```json
{
  "date": "2026-04-01",
  "week": "2026-W14",
  "xianxia_trending": [
    {
      "rank": 1,
      "topic": "Trieu Tien saga continues",
      "platform": "TikTok",
      "hashtags": ["#xianxia", "#truyencotich", "#trieutien"],
      "potential_views": "500K+",
      "competition": "medium",
      "why_trending": "Episode cliffhanger from previous video"
    }
  ],
  "general_trending": [
    {
      "rank": 1,
      "topic": "Chinese fantasy drama compilation",
      "platform": "TikTok",
      "hashtags": ["#chinesedrama", "#fantasy", "#viral"],
      "potential_views": "1M+",
      "competition": "high"
    }
  ]
}
```

## Content Calendar Integration

| Day | Content Theme | Notes |
|-----|---------------|-------|
| Mon-Fri | Xianxia Episodes | Trieu Tien series |
| Sat | Compilation/Best moments | User engagement |
| Sun | Behind scenes / Teaser | Build anticipation |

## Trend Monitoring Schedule
- Daily: Check TikTok Discover page
- Weekly: Full trend report
- Per-heartbeat: Quick scan for breaking trends
