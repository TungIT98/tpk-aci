# Video QC Checklist — TKP Content Agency

> Quality control checklist for all videos. Covers both channels (TKP Productivity + TKP Growth).
> Created for TKP-28. Pairs with TKP-37 (QC process doc).

---

## QC Gates

Every video must pass all **BLOCKING** checks before publishing. Non-blocking items are flagged for review but do not hold publication.

---

## Stage 1: Pre-Production Script Review

### Script Accuracy — BLOCKING

- [ ] **Topic alignment**: Script delivered matches the requested topic/angle exactly
- [ ] **Claim verification**: All specific claims (numbers, statistics, tools, frameworks) are fact-checked or labeled as anecdotal
- [ ] **No prohibited content**: Script does not contain defamation, copyright material, or platform-prohibited topics
- [ ] **Disclosure present**: Any sponsored content, affiliate links, or financial results include required disclosures ("Results shown are not typical. Your results will vary.")
- [ ] **Hook quality**: First 3 seconds have a clear pattern interrupt or value promise
- [ ] **CTA included**: At least one clear CTA (subscribe, follow, save, or watch next)

### Script Voice — BLOCKING (per channel)

**TKP Productivity** (`productivity_worker`):
- [ ] Tone is calm, professional, warm — no hype, no condescension
- [ ] Language is declarative and direct — no corporate speak, no hedging ("maybe", "kind of")
- [ ] No "hustle culture" framing — systems over willpower is the message
- [ ] Tool mentions are specific and real — no fake tool names or generic "app"

**TKP Growth** (`gen_z_success`):
- [ ] Tone is energetic, direct, Gen Z-native — no LinkedIn speak
- [ ] Sentence rhythm is punchy and short — no long explanations
- [ ] Claims are backed by real specifics (amounts, timelines, names) — no vague promises
- [ ] No gatekeeping language — "actually, you don't need to do it that way" energy
- [ ] Humor is self-aware and ironic — no boomer-approved jokes

---

## Stage 2: Asset Generation QC

### TTS Audio — BLOCKING

- [ ] Audio file generated successfully (no truncation, no silence gaps)
- [ ] Voice matches channel persona:
  - TKP Productivity → voice profile `productivity_worker` (ElevenLabs `21cho5f0l0d5MV3y` or MiniMax equivalent)
  - TKP Growth → voice profile `gen_z_success` (ElevenLabs `mBnDcF6bL6eJNAW8` or MiniMax equivalent)
- [ ] No audio clipping — peak levels below -1dB
- [ ] No background noise or static
- [ ] Pacing matches content type: ~150 words/min for long-form, ~180 words/min for Shorts
- [ ] Pronunciations are correct for any technical terms or proper nouns

### Hailuo Video Generation — BLOCKING

- [ ] Video generated successfully — `video_url` returned, no API error
- [ ] Aspect ratio matches channel spec:
  - TKP Productivity → `16:9` (YouTube standard)
  - TKP Growth → `9:16` (TikTok/Reels Shorts) OR `16:9` for YouTube long-form
- [ ] Duration within acceptable range:
  - Shorts: 30–90 seconds
  - Standard: 3–10 minutes
- [ ] Visual style matches channel:
  - TKP Productivity: Clean workspace, natural lighting, slow purposeful cuts, professional casual presenter
  - TKP Growth: Fast cuts, phone screens, high energy, close-up reactions
- [ ] No visual glitches, corrupted frames, or rendering artifacts
- [ ] B-roll is relevant to script — not generic stock footage filler

---

## Stage 3: Video Assembly QC

### Technical Specs — BLOCKING

- [ ] Resolution: 1080p minimum (1280×720 for YouTube, 1080×1920 for Shorts)
- [ ] Frame rate: 30fps minimum, 60fps preferred for Gen Z channel
- [ ] Aspect ratio correct for platform:
  - YouTube standard: 16:9
  - TikTok/Reels/Shorts: 9:16 (1080×1920)
  - LinkedIn: 16:9 or 1:1
- [ ] Video codec: H.264 (MP4) — compatible with all platforms
- [ ] Audio codec: AAC, 48kHz, stereo
- [ ] File size under platform limits (YouTube: 256GB; TikTok: 287MB for <10min)
- [ ] No interlacing

### Audio Mix — BLOCKING

- [ ] Speech is clear and intelligible — no muddiness
- [ ] Music (if any) is at least 20dB below speech level
- [ ] No audio-video sync drift
- [ ] Consistent volume throughout — no sudden jumps
- [ ] Audio levels:
  - Speech: -16 to -10 LUFS (YouTube standard)
  - True peak: below -1dB
  - Dynamic range: no clipping

### Visual Quality — BLOCKING

- [ ] Thumbnail generated per design system (see Stage 4)
- [ ] No burned-in watermarks from stock footage (unless licensed)
- [ ] Subtitles/CC: Present and time-synced if applicable
- [ ] End screen elements (if applicable): Correct aspect ratio, readable text

---

## Stage 4: Thumbnail QC

### Channel 1 (TKP Productivity) — BLOCKING

- [ ] Background: Warm off-white `#F8F7F4` — no dark backgrounds
- [ ] Primary text: Deep navy `#1A2744`
- [ ] Accent color: Warm gold `#C9A84C` used sparingly
- [ ] Typography: DM Sans Bold — no decorative or condensed fonts
- [ ] Text: 1–4 words maximum in headline, readable at 120px wide
- [ ] Layout: Single strong visual in left 60%, bold claim text in bottom-right
- [ ] Face (if present): Right side, looking toward center, calm/confident expression
- [ ] No clutter, neon effects, gamer aesthetics, or ALL CAPS (except TKP brand name)
- [ ] TKP logo/watermark: Bottom-left, 10% opacity

### Channel 2 (TKP Growth) — BLOCKING

- [ ] Background: Deep black `#111827` — light backgrounds not permitted
- [ ] Primary text: Pure white `#FFFFFF` — ALL CAPS for main claim
- [ ] Accent colors: Electric violet `#7C3AED`, hot coral `#FF6B6B`, neon yellow `#FACC15` — use 1–2 max
- [ ] Typography: Bebas Neue (display), Inter (body)
- [ ] Text: 2–4 words in main headline, readable at 90px wide
- [ ] Layout: Color accent bar top 15%, face or dynamic visual center, bold claim bottom
- [ ] Face (if present): Center/center-right, excited/surprised/confident expression — big energy
- [ ] No pastels, muted colors, corporate backgrounds, serious expressions
- [ ] TKP logo/watermark: Bottom-left, 10% opacity

### Cross-Channel Thumbnail Rules

- [ ] Resolution: 1280×720 (16:9) for YouTube
- [ ] Resolution: 1080×1920 (9:16) for TikTok/Reels/Shorts
- [ ] File format: PNG (preferred) or JPG
- [ ] Color space: sRGB
- [ ] File size: Under 2MB
- [ ] A/B variants: 2–3 variants created per video

---

## Stage 5: Metadata QC

### Title — BLOCKING

- [ ] Title accurately reflects video content (no clickbait mismatches)
- [ ] Length: Under 60 characters (YouTube cuts off at ~55 in search)
- [ ] TKP Productivity: Clear, benefit-driven, professional tone
- [ ] TKP Growth: Bold, specific, energetic — includes numbers when applicable
- [ ] No ALL CAPS for TKP Productivity; acceptable (sparingly) for TKP Growth

### Description — BLOCKING

- [ ] First 2 lines contain the most important hook/info — visible in pre-roll preview
- [ ] First link is to most relevant resource (not generic homepage)
- [ ] CTAs present: "Subscribe" (YouTube) or "Follow" (TikTok/IG), plus "Watch next" link
- [ ] Hashtags: Maximum 15 (YouTube) or 3–5 relevant tags (TikTok)
- [ ] No broken links
- [ ] TKP Productivity description tone: Warm, professional, saves-worthy
- [ ] TKP Growth description tone: Direct, specific, no corporate speak

### Tags (YouTube) — NON-BLOCKING

- [ ] 5–10 relevant tags covering: topic, channel name, format, related terms
- [ ] No irrelevant tags used to game search

### Captions/Subtitles — NON-BLOCKING

- [ ] Captions present (auto-generated acceptable, reviewed for accuracy)
- [ ] No obvious mistranslations or placeholder text
- [ ] Keywords included in caption text for searchability

---

## Stage 6: Brand Compliance QC

### Logo Usage — BLOCKING

- [ ] TKP logo used at minimum size (24px height for Productivity, 20px for Growth)
- [ ] Clear space: 1× logo height on all sides (Productivity), 0.5× (Growth)
- [ ] Logo not rotated, stretched, recolored, or had effects applied
- [ ] No unauthorized third-party logos or trademarks without permission

### Color Compliance — BLOCKING

**TKP Productivity**:
- [ ] Primary: Navy `#1A2744` — used for headers, logo, primary text
- [ ] Accent: Warm gold `#C9A84C` — used for highlights, CTAs, not overused
- [ ] Background: Off-white `#F8F7F4` — clean, not busy
- [ ] No electric violet, hot coral, neon yellow, or neon effects

**TKP Growth**:
- [ ] Primary: Electric violet `#7C3AED` and hot coral `#FF6B6B`
- [ ] Accent: Neon yellow `#FACC15` — used for energy/highlight
- [ ] Background: Deep black `#111827` — never pastel or light
- [ ] No navy, warm gold, or muted pastels

### Voice/Tone Compliance — BLOCKING

**TKP Productivity** — reject if:
- [ ] Sounds like corporate training video
- [ ] Uses "hustle harder", "5am club", or similar hustle-culture framing
- [ ] Condescending or lecturing tone
- [ ] Generic stock-photo energy

**TKP Growth** — reject if:
- [ ] Sounds like LinkedIn influencer post
- [ ] Gatekeeping ("when I was your age")
- [ ] Makes guaranteed income claims without disclaimers
- [ ] Too corporate, too soft, or too serious

### Platform-Specific Compliance — BLOCKING

**TikTok**:
- [ ] No content violating TikTok community guidelines (hate speech, dangerous acts, misinformation)
- [ ] Hashtag usage appropriate — no banned hashtags
- [ ] For financial/income content: includes "#ad" or "#sponsored" if applicable

**YouTube**:
- [ ] No content violating YouTube community guidelines
- [ ] For monetized content: sponsor disclosures present in description and/or video
- [ ] Copyright: No copyrighted music, footage, or material without license

**Instagram**:
- [ ] No content violating Instagram community guidelines
- [ ] Tagged products (if applicable): correct and transparent

**LinkedIn**:
- [ ] Professional tone maintained — no memes or casual Gen Z content on TKP Productivity cross-post
- [ ] Article/post credits where relevant

---

## Stage 7: Human Review (Spot-Check)

### Mandatory Human Review Items

These items require a human to review — no automated pass.

- [ ] **Full watch-through**: Someone watches the complete video start to finish
- [ ] **Hook effectiveness**: Does the first 3 seconds stop the scroll?
- [ ] **Value delivery**: Does the content deliver on the promise made in the hook?
- [ ] **Pacing**: Any dead moments or spots where the viewer would drop off?
- [ ] **Accuracy spot-check**: Random fact or claim verification
- [ ] **Thumbnail readability**: Human confirms text is legible at thumbnail size
- [ ] **Final brand impression**: Does the video feel like it belongs to the channel?

### Pass/Fail Criteria

| Severity | Definition | Action on Fail |
|----------|-----------|----------------|
| BLOCKING | Content cannot be published | Fix before proceeding |
| NON-BLOCKING | Content can publish but should note | Fix in next cycle |

### Sign-Off

- [ ] QC Reviewer name: `________`
- [ ] Date: `________`
- [ ] Pass / Fail / Conditional Pass (notes): `________`
- [ ] Issues found (if any): `________`

---

## QC Automation Notes

### Automated Checks (in video-pipeline.js)

These checks are automated in `lib/video-pipeline.js`:

```javascript
// Automated QC checks in pipeline
const automatedChecks = {
  ttsAudioExists:    ttsResult.audioUrl || ttsResult.localPath,
  videoUrlExists:    videoResult.video_url || videoResult.video?.url,
  aspectRatioCorrect: videoResult.aspect_ratio === CHANNELS[channel].aspectRatio,
  durationInRange:   videoResult.duration >= 30 && videoResult.duration <= 600,
  noApiErrors:       !result.error,
};
```

---

### Automated QC Gates (Stage 3 — video_studio_app/qc_gate.py)

Implemented in `video_studio_app/qc_gate.py` — runs automatically via:
- SaaS UI: "Run Quality Gates" button in AssemblyPanel
- API: `POST /qc/gate` or `GET /qc/gate/{video_path}`

All gates must PASS before video is handed off to Publisher.

| Check | Threshold | Blocking | Tool |
|-------|-----------|----------|------|
| **Resolution** | ≥720p min, ≥1080p preferred | ✅ Yes | FFprobe |
| **Frame rate** | ≥30fps | ✅ Yes | FFprobe |
| **File size** | ≤2GB (YouTube), ≤287MB (TikTok <10min) | ✅ Yes | os.path.getsize |
| **Codec** | H.264 video + AAC audio | ✅ Yes | FFprobe |
| **Audio sync** | ≤200ms A/V drift | ✅ Yes | FFprobe start_time |
| **Duration** | 5–600 seconds | ✅ Yes | FFprobe |
| **Visual quality** | Bitrate ≥2Mbps (1080p), ≥1Mbps (720p) | ❌ No | FFprobe bitrate |
| **Loudness** | ~-16 to -10 LUFS, peak < -1dB | ❌ No | FFmpeg volumedetect |

**API response example:**

```json
{
  "video_path": "output/final.mp4",
  "all_passed": false,
  "summary": "1 blocking failure(s): resolution",
  "blocking_failures": [
    {
      "name": "resolution",
      "status": "fail",
      "value": "720x1280",
      "threshold": "720p min, 1080p preferred",
      "message": "Below minimum: 720x1280 (need >=1280x720)",
      "blocking": true
    }
  ],
  "warnings": [
    {
      "name": "visual_quality",
      "status": "warn",
      "value": "800kbps",
      "message": "Bitrate 800kbps is low (expected >=2000kbps) — may appear blurry"
    }
  ],
  "checks": [...],
  "ffmpeg_available": true
}
```

### Manual Checks (require human review)

All Stage 1, 4, 5, 6, and 7 items are manual.

---

### Color Grading Presets (video_studio_app/color_grader.py)

Implemented in `video_studio_app/color_grader.py` — available in:
- SaaS UI: "Color Grade" dropdown in AssemblyPanel
- API: `POST /color-grading/apply`

| Preset | Label | Best For |
|--------|-------|---------|
| `cinematic` | Teal-Orange Cinematic | Film look, drama, high-contrast content |
| `natural` | Balanced Natural | Clean professional look, productivity |
| `vibrant` | Punchy Vibrant | High energy, Gen Z content, growth channel |
| `moody` | Dark & Moody | Dramatic, suspense, premium feel |
| `warm` | Golden Hour Warm | Lifestyle, golden tones, human interest |
| `cool` | Blue Professional | Tech, productivity, clean corporate |

### Scene Transitions (video_studio_app/video_assembler.py)

Available in SaaS UI "Scene Transition" dropdown and `VideoConcatinator.concatenate()`:

| Transition | Description | Hailuo-Style |
|------------|-------------|-------------|
| `none` | Hard cut | ✗ |
| `dissolve` | Opacity crossfade (default) | ✓ |
| `fade` | Fade to/from black | ✓ |
| `crossfade` | Gaussian blend smooth | ✓✓ |
| `match_cut` | Instant cut (visual similarity) | ✓✓ |
| `j_cut` | Audio leads video | ✓ |
| `l_cut` | Audio trails video | ✓ |
| `whip_pan` | Fast zoom+translate (Hailuo signature) | ✓✓✓ |
| `zoom_blur` | Radial zoom transition | ✓ |
| `slide` | Directional wipe | ✓ |
