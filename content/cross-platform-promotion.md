# Cross-Platform Promotion Strategy — TKP Content Agency

> Implementation for TKP-47 (VID-36). Content adaptation rules, repurposing workflows,
> posting cadence per platform, and content adaptation templates for both channels.
>
> Related: [Upload Schedule](./upload-schedule.md) · [CTA Strategy](./cta-strategy.md) · [Engagement Response Templates](./engagement-response-templates.md)

---

## Platform Role Definitions

| Platform | Role | Primary Format | Audience |
|----------|------|---------------|---------|
| **YouTube Long-Form** | Authority builder | 8–15 min | Deep learners, career-builders |
| **TikTok** | Discovery engine | 30–90s vertical | Mass reach, algorithm traction |
| **Instagram Reels** | Parallel discovery | 30–90s vertical | Lifestyle/visual audience |
| **YouTube Shorts** | YouTube discovery | 30–60s vertical | YouTube-native discovery |
| **LinkedIn** | Professional authority | Text posts + articles | Coworkers, recruiters, peers |

**Rule**: YouTube is always the "home base." All other platforms funnel back to YouTube.

---

## Content Adaptation Framework

### The 3-Tier Content Model

```
TIER 1 — LONG-FORM (YouTube, 8–15 min)
  ↓ cuts into
TIER 2 — SHORT-FORM (TikTok + Reels, 30–90s)
  ↓ pulls quotes from
TIER 3 — TEXT POSTS (LinkedIn + X, thread-style)
```

### Adaptation Direction

| Source | → TikTok | → IG Reels | → YouTube Shorts | → LinkedIn |
|--------|----------|-----------|-----------------|-----------|
| YouTube Long-Form | ✅ Best source | ✅ Best source | ✅ Best source | ✅ Quote/pull thread |
| TikTok (top performer) | — | ✅ Auto-repost | ✅ Repost | ❌ Rarely fits |
| Instagram Reels | ✅ Repost | — | ✅ Repost | ❌ Rarely fits |
| LinkedIn post | ✅ Tweet/thread | ❌ Rarely | ❌ Rarely | — |

**Repost rule**: Never repost the same video to the same platform type twice. If a TikTok performs >50K views, it goes to IG Reels. If it performs >200K, it goes to YouTube Shorts.

---

## YouTube Long-Form → TikTok / Reels / Shorts

### Extraction Strategy

From each YouTube video, extract **3 repurposable assets**:

1. **Hook clip** (30–45s): The single strongest hook in the video — usually within the first 90 seconds
2. **Value bomb** (45–90s): The most actionable step or framework in the middle of the video
3. **Micro-lesson** (30–60s): A complete standalone insight that requires no context

### Which Clips to Prioritize for TikTok/Shorts

| Signal | Action |
|--------|--------|
| Highest watch-time retention point in YouTube analytics | Extract as TikTok hook clip |
| Single actionable step (e.g., "here's the exact script") | Extract as value bomb |
| Strong visual moment (B-roll, screen recording) | Extract as-is with text overlay |
| Controversial/hot take | Extract for TikTok — high share potential |
| Evergreen topic | Extract up to 6 months after publish |

### TikTok Adaptation Rules

**Aspect ratio**: 9:16 vertical (1080×1920). All clips must be re-exported.

**Text overlay requirement**: TikTok native videos include text. Exported YouTube clips need text on-screen:
- Hook text: first 3 seconds must have bold, readable text
- Caption: burn in captions for all speech

**Removal rules**:
- YouTube-style talking-head format: acceptable on TikTok if energy is high
- Screen recordings without text overlay: must add text overlay before posting
- Long intros: trim to first strong hook — TikTok audience won't wait 30 seconds

**Optimal edit for TikTok**:
```
Original YouTube clip length: 3–8 min
↓
Keep: hook (0–20s), strongest example (20–60s), key call to action (last 10s)
↓
Target: 30–90s
↓
Add: bold text overlay on hook + key point, captions, background music
```

### Instagram Reels Adaptation Rules

**Aspect ratio**: 9:16 (same as TikTok) or 4:5 (1080×1350) for discovery

**Text overlay**: Strong text overlay required — IG Reels auto-plays without sound first
- Always include text on the first frame
- Include key takeaway text in last frame

**Caption style**: IG Reels captions can be longer (125–150 chars shown before "more")
- Hook: 1 line
- Value: 2–3 lines
- CTA: 1 line at end

**Hashtag rules**: 3–5 hashtags max. Mix broad + niche:
- Ch. 1: `#productivitytips #workhack #remotework #focus #deepwork`
- Ch. 2: `#sidehustle #careeradvice #moneymindset #growthmindset #genz`

### YouTube Shorts Adaptation Rules

**Aspect ratio**: 9:16 (YouTube Shorts is vertically identical to TikTok)
**Maximum length**: 60 seconds (vs TikTok's 10 min)

**Strategy**: Use Shorts specifically for videos that work as standalone micro-lessons
- Extract only the 30–60s most self-contained clip
- If a TikTok clip already exists, do not post the same clip to Shorts — post a different clip from the same video instead
- Shorts is YouTube's discovery layer — its audience skews toward YouTube-search intent

**Algorithm note**: YouTube Shorts shows videos to non-subscribers first. Use Shorts to grow channel subs; TikTok to grow brand identity.

---

## TikTok → YouTube Shorts Adaptation

When a TikTok hits 50K+ views, repurpose to YouTube Shorts:

1. Download TikTok without watermark using `scripts/download-tiktok-clean.js`
2. Re-export as clean file (no TikTok username watermark)
3. Add YouTube Shorts-specific intro card: "Full video on my channel — link in bio"
4. Post within 24 hours of TikTok going viral (capitalize on momentum)
5. Do not post the same TikTok to Shorts more than once

---

## YouTube Long-Form → LinkedIn Text Posts

### Adaptation Method: Quote Pull Thread

From a single YouTube video, create a text post:

```
FORMAT:
Hook line (line 1): A contrarian or surprising claim from the video
Body (3–5 lines): The framework or key insight
Proof point (1–2 lines): A specific example or data point from the video
Soft CTA (1 line): "I break this down fully in the video [link]"
```

**Example — Channel 1 (Productivity)**:
```
The 2-hour work block is more productive than 8 one-hour sessions.

Your brain needs at least 90 minutes to reach deep focus.
Short tasks with gaps in between create a "attention tax" —
you're paying the setup cost every time you switch.

I tested this over 6 weeks with my own calendar.
The result: 40% more deep work, same total hours.

Full breakdown with the exact template I used → [link in comments]
#Productivity #DeepWork #WorkDesign
```

**Example — Channel 2 (Growth)**:
```
Why "follow your passion" is the worst career advice.

The people I know who are thriving in their 20s didn't follow passion.
They followed: specific skill + market demand + consistency.

Passion shows up AFTER competence, not before.

I interviewed 12 people who made major career pivots.
The pattern was identical every time.

What they did instead → full video in bio.
#CareerAdvice #CareerPivot #GenZ #SideHustle
```

### LinkedIn Posting Cadence

| Day | Format | Source |
|-----|--------|--------|
| Tuesday | Text post (quote pull) | Monday/this week's YouTube |
| Thursday | Text post (quote pull) | This week's YouTube |
| Saturday | Optional article (deep dive) | Monthly deep-dive video |

---

## Platform-Specific Adaptation Rules

### TikTok — Channel 1 (Productivity)

**What to adapt**:
- System setup videos → "1 thing I changed in [tool]" (micro-version)
- Hot takes → standalone controversial opinion clips
- Framework explanations → "here's the system in 60 seconds"

**What NOT to adapt**:
- Deep-dive book reviews (too niche for TikTok)
- Anything requiring a screen recording without adding text

**Voice on TikTok**: Still measured, calm — but punchier and more direct than YouTube
- Average sentence length: 8–12 words (vs 15–20 on YouTube)
- No "in this video" framing — TikTok stands alone

### TikTok — Channel 2 (Growth)

**What to adapt**:
- Everything — TikTok is home base
- $X income stories → individual TikToks
- Career truths → standalone hot takes
- Tool talks → 30-second demo clips

**What NOT to adapt**:
- Anything that requires a long setup — hook immediately
- Financial advice that could be misunderstood out of context (add disclaimer text)

### Instagram Reels — Both Channels

**Difference from TikTok**:
- Slightly more polished aesthetic (better lighting, cleaner cuts)
- Captions are required (TikTok auto-generates; IG does not always)
- CTA differs: IG favors saves and shares; TikTok favors follows
- Post same content as TikTok but 1–2 hours later (do NOT post simultaneously)

### YouTube Shorts — Both Channels

**Difference from TikTok**:
- Must feel native to YouTube (cleaner, less "internet-y" energy)
- No trending sounds that feel too "TikTok"
- Standard YouTube end screen applies (shortened)
- Can use YouTube Shorts link to drive to full YouTube video

### LinkedIn — Channel 1 Only

**What to adapt**:
- System/framework content from YouTube
- Work-culture takes (meeting culture, email culture)
- Professional productivity tools

**What NOT to adapt**:
- Anything too casual or Gen Z–coded
- Income claims or financial specifics
- Anything that requires strong visual demonstration

---

## Repurposing Workflow

### Pipeline (Per YouTube Video)

```
Day 0 — YouTube Publish
  ↓
Day 0 — Extract 3 clips in DaVinci Resolve / CapCut
  (Hook clip, value bomb, micro-lesson)
  ↓
Day 1 — Post Hook clip to TikTok + IG Reels
  (Different text overlays, same video file)
  ↓
Day 3 — Post Value bomb to TikTok
  ↓
Day 7 — Post Micro-lesson to YouTube Shorts
  ↓
Day 7 — Post LinkedIn text post (quote pull)
  ↓
Day 14 — Check analytics
  (If TikTok >50K → post clean version to YouTube Shorts)
  (If IG Reels >20K → boost with $5 promotion)
```

### Automated Repost Rules

| Source Performance | Action |
|--------------------|--------|
| TikTok >50K views | Repost to IG Reels (within 24h) |
| TikTok >200K views | Repost to YouTube Shorts (clean, no watermark) |
| IG Reels >30K views | Repost to TikTok (different thumbnail/caption) |
| YouTube Short >100K views | Expand into full YouTube video on same topic |
| LinkedIn post >1K impressions | Expand into newsletter or YouTube deep dive |

---

## Caption Adaptation Templates

### Hook Line Templates

**Channel 1 (Productivity)**:
```
// Framework hook
"Here's the [X] system I spent [time] building — and why it actually works."

// Hot take hook
"You're not bad at [topic]. Your [system/tool] is."

// Step-by-step hook
"The exact [X] I use every [timeframe] — step by step."
```

**Channel 2 (Gen Z)**:
```
// Income hook
"I made $[X] in [timeframe] doing THIS. Here's the system."

// Counterintuitive hook
"The career advice I got at [age] that I wish I ignored instead."

// Relatable hook
"POV: you're about to make your first $[X] doing [hustle]."
```

### Caption Templates Per Platform

**TikTok — Ch. 1**:
```
[Hook line — 1 sentence]
[Key insight — 2 sentences]
Follow for [specific content type].
#productivity #remotework #deepwork #[niche-tag]
```

**TikTok — Ch. 2**:
```
[Hook — punchy, 1 sentence]
[Proof or example — 1–2 lines]
Follow. No BS. 🫡
#[niche] #[topic] #[result-tag]
```

**IG Reels — Both Channels**:
```
[Strong hook — 1 line, make it count]
[What they'll learn or why it matters — 2–3 lines]
Save this. Share it with someone who needs it. 🔖
#[hashtag] #[hashtag] #[hashtag]
```

**YouTube Shorts — Both Channels**:
```
[Hook — immediate, stops scroll in 1 second]
[Micro-lesson — 30–45 seconds of value]
Full video → link in bio 🔗
#Shorts #[niche]
```

**LinkedIn — Ch. 1**:
```
[A contrarian or specific claim — line 1]
[The framework or key insight — 3–5 lines, numbered or short paragraphs]
Full breakdown → [YouTube link]
#[Relevant hashtags]
```

---

## Posting Cadence (Cross-Platform Summary)

### Channel 1 — Productivity

| Platform | Frequency | Day/Time (ET) | Source |
|----------|-----------|---------------|--------|
| YouTube Long | 1×/week | Tuesday 8 AM | Original |
| YouTube Shorts | 1×/week | Thursday 12 PM | From YouTube long |
| TikTok | 3×/week | Mon/Wed/Fri 7 AM | From YouTube long |
| IG Reels | 2×/week | Tue/Thu 12 PM | From TikTok or YouTube |
| LinkedIn | 2×/week | Tue/Thu 8 AM | Quote pull from YouTube |

### Channel 2 — Growth

| Platform | Frequency | Day/Time (ET) | Source |
|----------|-----------|---------------|--------|
| TikTok | 6–7×/week | Daily 12 PM + Tue/Thu 7 PM | Original first |
| IG Reels | 5×/week | Daily 12 PM | Parallel to TikTok |
| YouTube Shorts | 3×/week | Mon/Wed/Fri 12 PM | From TikTok or original |
| YouTube Long | 1×/2 weeks | Saturday 12 PM | Original |
| LinkedIn | 1×/week | Tuesday 8 AM | From YouTube or career content |

---

## Cross-Posting Execution Checklist

- [ ] YouTube publish → extract 3 clips within 24 hours
- [ ] Edit clips in CapCut → add text overlay, captions, music
- [ ] Post TikTok first (highest urgency algorithm)
- [ ] Wait 1–2 hours → post IG Reels (same video, different caption)
- [ ] Wait 24–48 hours → post YouTube Shorts (different clip from same video)
- [ ] Post LinkedIn text post same day as YouTube Shorts
- [ ] Monitor TikTok analytics at 24h → if >50K, fast-track to YouTube Shorts
- [ ] Log all cross-posts in `content/content-calendar.md`

---

## Analytics Cross-Reference

| Platform Metric | Signal | Cross-Post Action |
|----------------|--------|-------------------|
| TikTok <5K views on repost | Content doesn't travel | Reduce repurposing frequency |
| IG Reels <10K views on repost | Audience mismatch | Pause IG Reels for this content type |
| YouTube Shorts <1K views | Thumbnail/hook issue | Test different clip, not same clip |
| LinkedIn impressions <500 | Wrong audience/topic | Adjust hook for professional framing |
| TikTok >200K | Viral signal | Sprint to YouTube Shorts + consider long-form |
| IG Reels >100K | Strong discovery | Boost with $5/day for 3 days |

---

*Last updated: 2026-03-25*
