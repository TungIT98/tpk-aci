# Trailer Video Production Brief — TKP Content Agency

> TKP-33 (VID-22: Trailer video). Full production brief for both channels.
> Max 60 seconds each. Feeds into `lib/video-pipeline.js` → `lib/hailuo.js` → publish.
> Reference: `content/channel-personas.md`, `content/brand-identity.md`, `content/channel-setup-guide.md`.

---

## Overview

**What**: A 45–60 second trailer video for each channel.
**Goal**: Hook the right viewer, communicate value proposition, set expectations, drive subscription.
**Max duration**: 60 seconds (YouTube auto-truncates longer trailers anyway)
**Format**: 16:9 (YouTube default) + 9:16 (TikTok/reel clip variant)
**Pipeline**: `lib/video-pipeline.js` with `lib/hailuo.js` (MiniMax-Hailuo-2.3 model)

> **Pipeline blocker**: MiniMax free tier exhausted (error 2056). Needs billing activation at platform.minimax.io.
> Pipeline code is complete and ready. Execution unblocks when billing is added.

---

## Trailer 1: TKP Productivity

### Script (Voiceover — 52 seconds)

```
[0:00–0:04] VISUAL: Close-up of chaotic desk — papers, open tabs, phone buzzing.
VO: "Every morning, you sit down to work..."

[0:04–0:08] VISUAL: Same person, overwhelmed, scrolling phone.
VO: "...and before 9am, your focus is already gone."

[0:08–0:14] VISUAL: Fast cut — calendar full of meetings, email notification flood.
VO: "Meetings pile up. Inboxes overflow. Your priorities get buried."

[0:14–0:20] VISUAL: Person puts phone face-down. Closes laptop. Takes a breath.
VO: "But what if you had a system? One that actually survives real life?"

[0:20–0:28] VISUAL: Clean desk. Coffee. Calm person. Notion board visible. Headphones on.
VO: "TKP Productivity. Evidence-based systems for knowledge workers who are tired of advice that doesn't work."

[0:28–0:36] VISUAL: Quick montage — tool screens, calendar with focus blocks, clean inbox, evening routine.
VO: "Time systems. Smart tools. Routines that don't fall apart by Wednesday."

[0:36–0:44] VISUAL: Text overlay: "No hustle culture. No 5am club. Just systems."
VO: "No hustle culture. No 5am club. Just systems that work."

[0:44–0:52] VISUAL: Channel name + logo reveal on clean navy background.
VO: "Subscribe to TKP Productivity. New videos every Tuesday and Friday."

[0:52–0:56] VISUAL: Bold last line.
VO: "Work less. Get more done."

[0:56–0:60] VISUAL: TKP logo + "Work less. Get more done." tagline. Subscribe button animation.
VO: [music fades]
```

### Visual Direction

| Scene | Visual | Mood |
|-------|--------|------|
| Opening chaos | Cluttered desk, open browser tabs, phone buzzing — relatable | Overwhelmed |
| Transition | Phone face-down, breath, calm | Turning point |
| Solution montage | Clean desk, Notion board, headphones, focus mode | Calm, in control |
| Brand reveal | Navy (#1A2744) background, gold (#C9A84C) accent, white TKP wordmark | Professional, premium |
| Closing | Channel name + tagline + subscribe animation | Inviting |

### Tone
- Voice: Antoni (calm authority)
- Stability: 0.50, Similarity: 0.75
- Pace: Natural (1.0x)
- Music: Ambient, calm — no beat drop (not a Gen Z channel)

---

## Trailer 2: TKP Growth

### Script (Voiceover — 50 seconds)

```
[0:00–0:05] VISUAL: Dark background. Bold text flashes: "$3,200."
VO: "Someone made $3,200 last month doing something you could start this weekend."

[0:05–0:10] VISUAL: Phone screen — income screenshot. Then: person in coffee shop, laptop open.
VO: "Not a fluke. Not a one-off. A system."

[0:10–0:16] VISUAL: City street, person walking with purpose. Coffee shop, laptop glow.
VO: "TKP Growth. Real income. Real careers. Real skills. No guru BS."

[0:16–0:24] VISUAL: Fast cuts — income screenshot, skill stack, job offer notification, side hustle setup.
VO: "Every week: income breakdowns, career moves that work, and skills that compound."

[0:24–0:32] VISUAL: Bold text overlays — "$X in Y months." Career wins. Skill acquisitions.
VO: "This is not motivation. This is a playbook."

[0:32–0:40] VISUAL: Electric violet (#7C3AED) background. Bold white text: "Your next level starts here."
VO: "Your next level starts here."

[0:40–0:50] VISUAL: Channel name reveal — bold, energetic. TikTok clips, YouTube thumbnails.
VO: "Follow TKP Growth. New content every day. This is just getting started."

[0:50–0:56] VISUAL: Fire/lightning motif. Hot coral (#FF6B6B) accent. Energy high.
VO: "Your next level. Let's go."

[0:56–0:60] VISUAL: TKP Growth logo. Neon yellow (#FACC15) CTA: "Subscribe." Music drops.
VO: [music drop — energetic beat]
```

### Visual Direction

| Scene | Visual | Mood |
|-------|--------|------|
| Opening hook | Bold income text, dark background | Exciting, aspirational |
| Credibility | Income screenshot, real person, real environment | Proof-driven |
| Brand intro | Dark/black background, violet + white, bold | Energetic, Gen Z |
| Proof montage | Fast cuts of wins — income, skills, career | Exciting |
| Closing | Max energy — music drop, neon colors | High energy |

### Tone
- Voice: Josh (energetic Gen Z)
- Stability: 0.35, Similarity: 0.85
- Pace: 1.1x
- Music: Upbeat, energetic beat drop at end (Gen Z–native)

---

## Execution Steps (For Production Manager / Pipeline)

### Step 1 — Generate Scripts
```js
// Run via lib/script-generator.js or use scripts above directly
const script = await generateScript({ channel: 'productivity', type: 'trailer' });
```

### Step 2 — Generate Voiceover
```js
const { audio, qc } = await tts.generateAudio({
  channel: 'productivity', // or 'growth'
  text: '...', // script above
});
```

### Step 3 — Generate Visuals (Hailuo)
```js
// Productivity scenes — calm, clean, professional
const scenes = [
  { prompt: 'Clean minimalist desk, warm natural light, laptop open, Notion board visible, calm person wearing headphones, coffee cup, navy and gold tones' },
  { prompt: 'Close-up of organized calendar with color-coded focus blocks, calm desk setup, morning light' },
  { prompt: 'Person in professional casual taking a deep breath, phone face-down nearby, clean workspace, productive atmosphere' },
];

// Growth scenes — energetic, dark, bold
const scenes = [
  { prompt: 'Dark moody background, bold neon text appearing, $3200 in bright colors, energy and motion' },
  { prompt: 'Young person in coffee shop, laptop glowing, street view through window, urban energetic vibe, phone showing income screenshot' },
  { prompt: 'Electric violet background, fast cuts of career wins, job offer notification, skill completion badges, energetic motion graphics' },
];
```

### Step 4 — Assemble Video
```js
const video = await assembleTrailer({
  channel: 'productivity', // or 'growth'
  audio, // from step 2
  scenes, // from step 3
  duration: 60, // max 60 seconds
  music: 'auto', // or specify track
});
```

### Step 5 — Export Variants
- 16:9 for YouTube (trailer format)
- 9:16 for TikTok/Reels (cropped to key moments)
- Thumbnail: Frame grab from strongest moment + text overlay

---

## Key Notes

1. **Trailer ≠ pilot video**: Trailer sells the channel. Pilot videos sell individual topics.
2. **No face required**: Both trailers can be fully animated/illustrated. Real face in Growth trailer increases authenticity (Gen Z channels with face get 30–50% higher CTR).
3. **Hook strength**: First 3 seconds are everything. Productivity opens with chaos. Growth opens with money. Both are high-hook patterns.
4. **Music**: Rights-cleared music only. YouTube has a built-in Audio Library accessible in YouTube Studio.
5. **CTA placement**: Subscribe CTA must appear in final 5 seconds (YouTube counts it in algorithm if viewer subscribes within that window).

---

## When Executing (Pipeline Unblocked)

1. Run `lib/video-pipeline.js` with `--trailer` flag
2. Pipeline generates audio + visuals + assembles
3. Output: `uploads/trailer-productivity.mp4` and `uploads/trailer-growth.mp4`
4. Upload to YouTube: `lib/upload/youtube.js`
5. Set as channel trailer in YouTube Studio → Customization → Layout
6. Post to TikTok: `lib/upload/tiktok.js` (clip variant)
