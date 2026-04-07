# Upload Schedule — TKP Content Agency

> Strategy output for TKP-23. Optimal posting times, consistency rules, and cadence per channel.

---

## Channel 1: Productivity Worker

### Target Audience Time Zones
- Primary: **US Eastern / Pacific** (70% of audience)
- Secondary: **UK GMT, Western Europe CET** (20%)
- Tertiary: **Australia AEST, India IST** (10%)

### Optimal Posting Windows

| Day | Primary Post Time | Secondary Post Time | Rationale |
|-----|------------------|---------------------|-----------|
| Monday | 7:00–8:00 AM ET | 12:00–1:00 PM ET | Week-start planning mindset |
| Tuesday | 8:00 AM ET | 6:00 PM ET | High intent mid-morning |
| Wednesday | 7:00–8:00 AM ET | 12:00–1:00 PM ET | Mid-week productivity focus |
| Thursday | 8:00 AM ET | — | High engagement mid-week |
| Friday | 7:00 AM ET | 4:00–5:00 PM ET | Week-end wind-down |
| Saturday | None (optional) | 10:00 AM ET | Low competition, casual viewers |
| Sunday | None | 6:00–7:00 PM ET | Pre-week-prep mindset |

**Recommended primary slot**: **Tuesday, Wednesday, Thursday at 7–8 AM ET**

### Platform Priority

| Platform | Priority | Frequency | Best Post Time |
|----------|----------|-----------|----------------|
| YouTube | Primary | 1x/week (long-form) | Tuesday 8 AM ET |
| LinkedIn | Primary | 1–2x/week | Tuesday–Thursday 8–9 AM ET |
| TikTok | Secondary | 3x/week | Mon/Wed/Fri 7 AM ET |
| Instagram | Secondary | 2x/week | Tue/Thu 12 PM ET |

### Content Cadence

```
Week 1: [Mon] Short TikTok  [Tue] YouTube Long  [Wed] TikTok  [Thu] LinkedIn  [Fri] TikTok
Week 2: [Mon] LinkedIn      [Tue] YouTube Short  [Wed] TikTok  [Thu] —          [Fri] IG Reel
Week 3: [Mon] TikTok         [Tue] YouTube Long   [Wed] TikTok  [Thu] LinkedIn    [Fri] TikTok
Week 4: [Mon] IG Reel       [Tue] YouTube Short  [Wed] TikTok  [Thu] —           [Fri] TikTok + Monthly Deep Dive
```

---

## Channel 2: Gen Z Success

### Target Audience Time Zones
- Primary: **US EST/PST, India IST** (50% US, 20% India)
- Secondary: **UK GMT, Philippines PHT, Nigeria WAT** (20%)
- Tertiary: **Global — short form is timezone-agnostic** (10%)

### Optimal Posting Windows

| Day | Primary Post Time | Rationale |
|-----|------------------|-----------|
| Monday | 12:00 PM ET | Post-lunch scroll spike |
| Tuesday | 7:00 PM ET | Peak evening scroll |
| Wednesday | 12:00 PM ET | Midweek lunch break |
| Thursday | 7:00 PM ET | Peak evening scroll |
| Friday | 12:00 PM ET + 8:00 PM ET | Double post — weekend prep + Friday night |
| Saturday | 12:00 PM ET | Weekend leisure scroll |
| Sunday | 12:00 PM ET | Sunday reset/prep |

**Recommended primary slots**: **Tue + Thu 7 PM ET, Sat 12 PM ET**

### Platform Priority

| Platform | Priority | Frequency | Best Post Time |
|----------|----------|-----------|----------------|
| TikTok | Primary | Daily (6–7x/week) | Mon–Sat 12 PM + Tue/Thu 7 PM |
| Instagram Reels | Primary | 4–5x/week | Daily 12 PM |
| YouTube Shorts | Secondary | 3–4x/week | Daily 12 PM |
| LinkedIn | Optional | 1x/week | Tue 8 AM ET |

### Content Cadence

```
Daily: 1 TikTok (12 PM ET) — Main traction driver
Daily: 1 IG Reel (12 PM ET) — Parallel distribution
Mon:    Extra TikTok (7 PM ET) — Week-start hook
Tue:    YouTube Short (12 PM ET)
Wed:    Extra TikTok (7 PM ET)
Thu:    YouTube Short (12 PM ET) + TikTok (7 PM)
Fri:    Extra TikTok (7 PM ET) + IG Reel (8 PM ET) — Double
Sat:    TikTok only (12 PM ET) — Weekend audience
Sun:    Rest or test content (optional)
```

---

## Consistency Rules

### The Algorithm Contract
1. **Never miss a Monday** — Algorithm punishes missed days more than missed other days
2. **48-hour rule** — If you miss a scheduled post, do NOT post 24h late — skip and post next scheduled slot
3. **Batch filming** — Film 5 videos in one session, queue them. Never post on the same day you film.
4. **First 48 hours** — 80% of a video's lifetime views happen in the first 48 hours. Prime the upload for success (respond to comments, share to community) in this window.
5. **Format consistency > perfect timing** — Posting 3x/week at 8 AM consistently beats posting at 7 PM irregularly

---

## Timezone Tool Stack

| Tool | Use |
|------|-----|
| Buffer / Later | Schedule across all platforms, preview per-timezone |
| TikTok Creator Hub | Native best time analytics (use after 30 days of data) |
| YouTube Studio | Native audience > traffic > when your viewers are on YouTube |

---

## Upload Execution Checklist

- [ ] Queue videos in `uploads/queue.json` using `scripts/queue-add.js`
- [ ] Run `scripts/publish.js` to dispatch uploads
- [ ] Respond to first 10 comments within 2 hours of posting
- [ ] Cross-post TikTok to Instagram Reels within 1 hour of TikTok going live
- [ ] Update `content/content-calendar.md` after each post

---

## Pilot Phase Schedule (First 30 Days)

| Week | Channel 1 Posts | Channel 2 Posts |
|------|----------------|------------------|
| Week 1 | 2 TikTok, 1 YouTube, 1 LinkedIn | 5 TikTok, 4 IG Reels, 2 YT Shorts |
| Week 2 | 2 TikTok, 1 YouTube, 1 LinkedIn | 6 TikTok, 5 IG Reels, 2 YT Shorts |
| Week 3 | 2 TikTok, 1 YouTube, 1 LinkedIn | 6 TikTok, 5 IG Reels, 3 YT Shorts |
| Week 4 | 2 TikTok, 1 YouTube, 1 LinkedIn | 7 TikTok, 5 IG Reels, 3 YT Shorts |

**Total pilot**: ~62 pieces of short-form content + 8 long-form videos over 30 days
