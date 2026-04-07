# Content Diversification Strategy (TKP-38)

**VID-27 | Analytics Agent | 2026-03-25**

Tracks performance by format to optimize the content mix across both channels.

---

## Channels & Formats

| Channel | Format Mix Target | Rationale |
|---------|------------------|-----------|
| **PW (Product/Service reviews, comparisons, how-tos)** | 40% tutorials, 25% listicles, 20% reaction, 15% story | Evergreen discovery content |
| **GZ (Gaming, tech, entertainment)** | 35% gameplay/reaction, 30% listicles, 20% shorts, 15% story | Engagement-heavy for algorithm |

---

## Content Formats Defined

| Format | Length | Typical CTR | Best For |
|--------|--------|-------------|---------|
| **Tutorial** | 8–20 min | 4–8% | SEO, evergreen discovery |
| **Listicle** | 5–12 min | 5–10% | Clicks, shareability |
| **Reaction** | 10–20 min | 7–12% | Views, watch time, algorithm |
| **Story** | 3–8 min | 3–6% | Brand voice, community |
| **Short** | 15–60 sec | 8–15% | Shorts feed, subscribers |

---

## Diversification Framework

### Phase 1: Establish Baseline (Videos 1–20)
- Publish one video per format per channel in first 4 weeks
- Record performance metrics via `node scripts/record-video-stats.js --manual`
- Target: identify top-2 formats per channel by Views + Retention composite

### Phase 2: Optimize Mix (Videos 21–100)
- Shift publishing to 50% top formats, 30% experimental, 20% testing
- Run A/B test: different thumbnails for same-script format variants
- Evaluate CTR and retention per format weekly via `node scripts/analytics-report.js`

### Phase 3: Scale (Videos 101–1000)
- Double down on proven formats
- Reserve 10% of output for new format experiments
- Quarterly format audit using `node scripts/record-video-stats.js --summary`

---

## Format Performance Tracker

Populate via `node scripts/record-video-stats.js --manual`:

| Format | PW Avg Views | PW Avg CTR | PW Avg Retention | GZ Avg Views | GZ Avg CTR | GZ Avg Retention |
|--------|-------------|------------|-----------------|-------------|------------|-----------------|
| Tutorial | | | | | | |
| Listicle | | | | | | |
| Reaction | | | | | | |
| Story | | | | | | |
| Short | | | | | | |

---

## Hypothesis Tracker

| # | Hypothesis | Test | PW Result | GZ Result | Confidence |
|---|-----------|------|-----------|-----------|-----------|
| H1 | Tutorials perform better on PW than GZ | Compare CTR/retention | — | — | — |
| H2 | Shorts drive subscriber growth on GZ | Track sub gain per Short | — | — | — |
| H3 | Listicles get best CTR on launch day | Day-of CTR comparison | — | — | — |
| H4 | Reaction format = highest watch time | Avg duration % comparison | — | — | — |
| H5 | Story format = most comments | Comment count per format | — | — | — |

---

## Recommended Posting Cadence

| Day | PW | GZ |
|-----|----|----|
| Monday | Tutorial | Game Short |
| Tuesday | | |
| Wednesday | Listicle | Reaction |
| Thursday | | |
| Friday | Short | Listicle |
| Saturday | Reaction | |
| Sunday | Story/Community | Story |

---

## Tracking Automation

```bash
# Record a video's performance
node scripts/record-video-stats.js --manual

# Generate format performance summary
node scripts/record-video-stats.js --summary

# Weekly analytics report (includes format breakdown)
node scripts/analytics-report.js
```

---

## Success Criteria

- [ ] Baseline format data collected for all 5 formats × 2 channels
- [ ] Top 2 formats identified per channel (Views + Retention)
- [ ] Format mix adjusted to 50/30/20 (proven/testing/experimental)
- [ ] Monthly format audit automated via scripts
- [ ] CTR variance between formats < 2% (indicates consistent quality)

---

*Tracking file: `logs/video-stats.json`*
*Format summary: `node scripts/record-video-stats.js --summary`*
