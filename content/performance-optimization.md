# Performance Optimization Strategy (TKP-39)

**VID-28 | Analytics Agent | 2026-03-25**

Monitor and optimize video performance: CTR analysis, audience retention, search vs browse traffic. Feed insights back into content strategy and Hailuo prompt refinement.

---

## CTR Optimization

### CTR Benchmarks by Format

| Format | Poor | Average | Good | Excellent |
|--------|------|---------|------|-----------|
| Tutorial | <2% | 2–4% | 4–7% | >7% |
| Listicle | <3% | 3–6% | 6–10% | >10% |
| Reaction | <3% | 3–5% | 5–8% | >8% |
| Story | <2% | 2–4% | 4–6% | >6% |
| Short | <5% | 5–10% | 10–15% | >15% |

### CTR Improvement Tactics

1. **Thumbnail A/B testing** — Test 2–3 thumbnails via YouTube Studio A/B tests
   - Record in `logs/video-stats.json` with `thumbnailVariant` field
2. **Title optimization** — Front-load keywords, use numbers, create curiosity gaps
3. **Hook improvement** — First 30 seconds determine 60% of CTR
   - Feed insights back into `lib/script-generator.js` hook templates
4. **Impression tracking** — Enable custom thumbnails + cards for all videos

### Hailuo Prompt Refinement (CTR feedback loop)

```
When CTR < benchmark for format:
  → Review generated video's visual hook
  → Adjust scene descriptions in hailuo prompts:
    - Add "dynamic opening shot"
    - Include "text overlay with curiosity gap"
    - Specify "face/camera at 0:00-0:05"
  → Log change in logs/prompt-a-b-tests.md
```

---

## Audience Retention

### Retention Benchmarks

| Video Length | Poor | Average | Good | Excellent |
|-------------|------|---------|------|-----------|
| < 3 min | <30% | 30–50% | 50–65% | >65% |
| 3–8 min | <40% | 40–55% | 55–70% | >70% |
| 8–15 min | <45% | 45–60% | 60–75% | >75% |
| 15+ min | <50% | 50–65% | 65–80% | >80% |

### Retention Optimization Tactics

1. **Chapter/segment markers** — Add chapters in first 30 seconds
2. **Pattern interrupt** — Visual change every 2–3 minutes (B-roll, zoom, cut)
3. **Back-half payoff** — Promise revealed in second half of video
4. **End-screen retention** — Tease next video in final 30 seconds
5. **Retention curve analysis** — Drop-off points indicate pacing issues

### Retention Drop-Off Analysis

| Drop-off Point | Likely Cause | Fix |
|---------------|-------------|-----|
| 0–15 sec | Weak hook / misleading thumbnail | Strengthen intro script template |
| 30–60 sec | Slow start | Move to point faster |
| 2–4 min | Pacing lull | Add pattern interrupt or cut |
| 5–7 min | Mid-video sag | Add chapter marker or recap |
| Final 10% | Natural — most viewers don't finish | Ensure end-screen + CTA |

---

## Traffic Source Analysis

### Source Benchmarks (% of total views)

| Source | Healthy % | Indicates |
|--------|-----------|---------|
| Suggested/Recommended | 35–55% | Good algorithm traction |
| YouTube Search | 20–35% | Strong SEO keywords |
| Browse/Home | 10–20% | Thumbnails working |
| External | 5–15% | Good promotion |
| Hashtags | 2–8% | Active community |

### Source Strategy

| Source | Goal | Optimization |
|--------|------|-------------|
| Search | 25%+ of views | Target keywords via `content/keyword-research.md` |
| Suggested | 40%+ | Improve CTR and watch time |
| Browse | 15%+ | Better thumbnails |
| External | Grow over time | Share on TikTok, Reddit, LinkedIn |

> Track traffic sources via: YouTube Studio → Analytics → Reach → Traffic Sources

---

## Composite Performance Score

```
Score = (views × 0.3) + (ctr × 200) + (retention × 100) + (subsGained × 5)
```

| Score Range | Rating | Action |
|-------------|--------|--------|
| >500 | 🔥 Viral | Analyze why, replicate |
| 300–500 | ✅ Strong | Standard promotion |
| 150–300 | ⚠️ Average | Improve weakest metric |
| <150 | 🔴 Weak | Review full strategy |

---

## Prompt Refinement Log

Use this to feed CTR/retention insights back into Hailuo prompt generation.

| Date | Video | Format | CTR | Retention | Prompt Change |
|------|-------|--------|-----|-----------|--------------|
| | | | | | |
| | | | | | |

*Log additional entries via `node scripts/record-video-stats.js --manual` + notes field*

---

## Weekly Performance Checklist

```bash
# 1. Pull weekly analytics report
node scripts/analytics-report.js

# 2. Review retention drops in video-stats.json
node scripts/record-video-stats.js --summary

# 3. Check YPP metrics
node analytics/ypp-tracker.js --report

# 4. Flag underperforming videos for re-editing or re-upload
# 5. Update Hailuo prompt templates based on retention insights
```

---

## Thumbnail & Title Testing Protocol

1. Upload video → immediately create 2 thumbnail variants in YouTube Studio
2. Run A/B test for 48–72 hours
3. Select winner → update primary thumbnail
4. Record in video-stats.json:
   ```json
   {
     "videoId": "...",
     "thumbnailWinner": "variant_b",
     "ctrVariantA": 4.2,
     "ctrVariantB": 7.1
   }
   ```

---

## Success Metrics

- [ ] CTR above format benchmark for 80% of videos
- [ ] Retention above length-appropriate benchmark for 70% of videos
- [ ] Search traffic ≥ 25% of total views by month 2
- [ ] Composite score ≥ 200 for 60% of videos
- [ ] Prompt refinement log updated after each video analysis

---

*Tracking file: `logs/video-stats.json`*
*Report: `node scripts/analytics-report.js`*
