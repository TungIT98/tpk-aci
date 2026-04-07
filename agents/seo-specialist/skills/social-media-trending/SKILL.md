---
name: social-media-trending
description: >
  Use when: Researching viral content trends, analyzing what's working on TikTok/YouTube,
  finding trending hashtags, or optimizing content for maximum viral potential.
  Do NOT use when: Creating videos, uploading content, or doing technical work.
triggers:
  - "What's trending on TikTok right now?"
  - "Find viral hashtags for Xianxia content"
  - "Analyze competitor video performance"
  - "Research trending topics for content"
---

# Social Media Trending Skill

## Trending Research Pipeline

### 1. Platform Discovery

| Platform | URL | What to Track |
|----------|-----|---------------|
| TikTok | https://www.tiktok.com | Trending sounds, hashtags, challenges |
| YouTube Shorts | https://studio.youtube.com | Top Shorts, trending topics |
| Xianxia Community | Various Chinese platforms | Genre-specific trends |

### 2. Trend Analysis Framework

#### Content Velocity
- How fast is a trend growing?
- 24h, 7d, 30d curves
- Peak timing for posting

#### Engagement Metrics
- Like-to-view ratio (target: >5%)
- Comment-to-view ratio (target: >0.5%)
- Share-to-view ratio (target: >0.3%)

#### Trend Validation
- Is trend repeatable or one-hit?
- Can we put our spin on it?
- Does it fit TKP ACI brand (Xianxia)?

### 3. Xianxia-Specific Trends

**High-Performing Content Patterns:**
- Sword fight choreography
- Hanfu costume reveals
- Romance + action combos
- Mythical beast encounters
- Cultivation breakthroughs

**Hashtag Strategy:**
```text
Primary: #xianxia #chinesedrama #fantasy
Secondary: # TrieuTien #DauPhaThuongKhau #wuxia
Viral: #fyp #viral #trending #foryou
```

## Research Tools

### Browser-Based Research
```
browser(action="open", profile="user")
browser(action="navigate", url="https://www.tiktok.com/discover")
browser(action="snapshot") // capture trending page
```

### API-Based Tools
- TikTok Analytics API
- YouTube Data API
- Social Blade for competitor tracking

## Content Calendar Integration

Save trending research to: `content/trending-topics.md`

```markdown
# Trending Topics — {date}

## TikTok Trending
| Trend | Velocity | Relevance | Action |
|-------|----------|-----------|--------|
| [trend] | High | Medium | [what to create] |

## YouTube Shorts Trending
| Trend | Velocity | Relevance | Action |
|-------|----------|-----------|--------|

## Xianxia Genre Trends
| Trend | Source | Opportunity |
|-------|--------|-------------|
```

## Competitive Analysis

### What to Track
- Top 5 Xianxia channels in Vietnam
- Their upload frequency
- Their best-performing content types
- Their engagement strategies

### Analysis Frequency
- Weekly: Full competitive audit
- Daily: Quick trend check (15 min)

## Viral Content Formulas

### TikTok Viral Hooks (First 3 Seconds)
1. "Part [N] of the Trieu Tien saga..."
2. "She never expected this when..."
3. "The moment that changed everything..."
4. "POV: You're the sword saint's daughter..."
5. "How to survive the Nine Deaths Sect..."

### YouTube Shorts Hooks
1. "This scene made 1M people cry..."
2. "The hidden detail in Episode 3..."
3. "Xianxia fans will understand..."

## Trend-to-Content Workflow

```
Research Trends → Identify Opportunities → Brief Content Director → Scripts → Production → Upload
```

## TKP ACI Integration

- SEO Specialist owns trending research
- Content Director uses trends for script ideas
- CEO approves major trend pivots
- Nova produces trend-aligned content

## Tools & Resources

| Tool | Purpose | URL |
|------|---------|-----|
| TikTok Creative Center | Trend research | https://ads.tiktok.com |
| Google Trends | Keyword tracking | https://trends.google.com |
| Social Blade | Competitor stats | https://socialblade.com |
| TubeBuddy | YouTube SEO | browser extension |
| VidIQ | YouTube analytics | browser extension |