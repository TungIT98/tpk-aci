# YouTube Channel Setup Guide — TKP Content Agency

> Complete operator guide for creating and branding both YouTube channels.
> References: TKP-29 (VID-18), TKP-30 (VID-19), TKP-31 (VID-20), TKP-32 (VID-21).
> Brand specs: `content/brand-identity.md`, `content/channel-personas.md`.

---

## Channel Summary

| Property | Channel 1 | Channel 2 |
|----------|-----------|-----------|
| **Display Name** | TKP Productivity | TKP Growth |
| **Handle** | @TKPProductivity | @TKPGrowth |
| **Tagline** | Work less. Get more done. | Your next level starts here. |
| **Niche** | Evidence-based productivity for knowledge workers | Real results for Gen Z building income & career |
| **Primary Audience** | 25–40yo office workers, professionals | 18–28yo students and early-career |
| **Upload Schedule** | 1× long-form/week + 3× short-form/week | 1× long-form/biweekly + daily short-form |

---

## Step 1 — Create Both Channels

1. Go to [studio.youtube.com](https://studio.youtube.com)
2. Click your profile icon → **Create a channel**
3. For Channel 1: name = `TKP Productivity`, handle = `@TKPProductivity`
4. For Channel 2: name = `TKP Growth`, handle = `@TKPGrowth`

> **Operator action required.** Both channels must be created in YouTube Studio first.
> Founding Engineer 2 has OAuth infrastructure ready — YouTube upload credentials should be set up via `lib/upload/youtube.js` once channels exist.

---

## Step 2 — Profile Picture (PFP)

### TKP Productivity
- **Dimensions**: 800×800 px (displayed as circle)
- **Design**: "TKP" wordmark in navy (#1A2744) on warm white (#F8F7F4) background. Clean sans-serif font (DM Sans Bold). No gradients, no effects.
- **File**: `assets/tkp-productivity-pfp.png` (export at 800×800, 400×400, 160×160 for different contexts)
- **Minimum size**: 98×98 px

### TKP Growth
- **Dimensions**: 800×800 px (displayed as circle)
- **Design**: "TKP" wordmark in pure white (#FFFFFF) on electric violet (#7C3AED) background. Bold condensed style (Bebas Neue or equivalent). High energy.
- **File**: `assets/tkp-growth-pfp.png`
- **Minimum size**: 98×98 px

---

## Step 3 — Channel Banner

### TKP Productivity
- **Dimensions**: 2560×1440 px (safe area: 1546×423 px in center — text/logos outside this may be cropped on some devices)
- **Design**: Navy (#1A2744) background, "TKP PRODUCTIVITY" large wordmark in white/light, warm gold (#C9A84C) accent line or arrow element. Minimalist. Clean.
- **Overlaid tagline** (optional): "Work less. Get more done." in gold.
- **Left side**: Channel name + icon
- **Right side**: Upload schedule or pillar topic tags (e.g., "Time Systems | Tool Stack | Mental Models")

### TKP Growth
- **Dimensions**: 2560×1440 px (same safe area rules)
- **Design**: Deep black (#111827) background, "TKP GROWTH" in electric violet (#7C3AED) or white, hot coral (#FF6B6B) and neon yellow (#FACC15) accent shapes. Bold geometric shapes. Street/urban energy.
- **Overlaid tagline** (optional): "Your next level starts here." in neon yellow.
- **Left side**: Channel name + icon
- **Right side**: Content pillar tags (e.g., "Income Hacks | Career Strategy | Skill Stacking")

---

## Step 4 — About Section

### TKP Productivity — About Copy

```
WORK LESS. GET MORE DONE.

We build productivity systems that actually survive contact with real life.

No hustle culture. No 5am clubs. No "crush it" energy.

Just evidence-backed systems, smart tools, and realistic routines for knowledge workers who are tired of advice that doesn't work.

Videos every [Tuesday/Friday] — covering time management, tool setups, meeting culture, and mental models.

💡 Subscribe for systems, not motivation.

📅 Upload schedule: Tuesday + Friday
🎯 New? Start here → [Playlist: Getting Started]
```

**Channel keywords** (YouTube Studio → Settings → Channel → Advanced):
```
productivity, time management, work from home, office productivity, knowledge worker,
focus techniques, Notion setup, tool stack, meeting reduction, deep work,
professional productivity, evidence-based productivity, realistic routines
```

**Location**: Set to your target audience's primary region

### TKP Growth — About Copy

```
YOUR NEXT LEVEL STARTS HERE.

Real income. Real careers. Real skills.

No gatekeeping. No "pay your dues." No guru nonsense.

We show you exactly what works — income screenshots, salary negotiation recordings, and the actual systems behind results that aren't typical (but could be yours).

🎥 New videos [DAY] → [Subscribe or you'll regret it]

💰 Results shown are not typical. Your results will vary.

📅 Upload: [Day] + Daily short-form on TikTok
🔥 Start here → [Playlist: Where to Start]
```

**Channel keywords**:
```
side hustle, make money online, Gen Z career, income growth, freelance,
career advice young adults, skill stacking, financial literacy, first job,
negotiation, LinkedIn growth, career pivot, passive income, AI tools side project
```

---

## Step 5 — Channel Settings

### TKP Productivity
| Setting | Value |
|---------|-------|
| Default language | English (US) |
| Location | United States (or your primary audience geo) |
| Channel description | See About Copy above |
| Featured channels | TKP Growth (cross-promote after growth) |
| Channel type | Education or Howto & Style |
| Contact info | business@tkpagency.com (create inbox) |

### TKP Growth
| Setting | TKP Growth |
|---------|------------|
| Default language | English (US) |
| Location | United States |
| Channel type | Education or People & Blogs |
| Contact info | business@tkpagency.com |

---

## Step 6 — Branding Watermark (Video Watermark)

- **Appears**: Bottom-right corner of all uploaded videos (permanent)
- **Recommended design**: "TKP" wordmark in channel color (navy for Productivity, violet for Growth)
- **Size**: Custom — use YouTube Studio's built-in watermark upload tool
- **Display timing**: "During last 30 seconds of video"
- Upload path: YouTube Studio → Customization → Branding → Watermark

---

## Step 7 — Basic Channel Trailer (VID-22 prerequisite)

Both channels need a trailer video (VID-22: Trailer video — TKP-33). Before that is ready:

- **TKP Productivity**: Set channel trailer to a placeholder/highlight reel, OR leave as default "Start here" until trailer is produced.
- **TKP Growth**: Same — placeholder until VID-22 is done.

Once VID-22 is produced:
- YouTube Studio → Customization → Layout → Channel trailer → select trailer video

---

## Step 8 — Default Upload Settings

Apply to both channels in YouTube Studio → Settings → Upload defaults:

| Setting | Productivity | Growth |
|---------|-------------|--------|
| Category | Education | Education |
| Visibility | Private (until launch day) | Private (until launch day) |
| Title prefix | None (use clean titles) | None |
| Description prefix | Add channel link + playlist links | Add channel link |
| Tags | Per video — use channel keywords | Per video — use channel keywords |
| Language | English | English |
| Caption certification | "I don't want to certify this" | Same |
| Recording date | Set to actual recording date | Same |
| License | Standard YouTube License | Same |
| Category | Education | People & Blogs |

---

## Step 9 — Link Social Accounts

YouTube Studio → Customization → Basic Info → Links:

### TKP Productivity
| Platform | Handle/URL |
|----------|-----------|
| TikTok | @tkpproductivity |
| Instagram | @tkpproductivity |
| LinkedIn | TKP Productivity |
| Twitter/X | @tkpproductivity |
| Website | https://tkpagency.com (or placeholder) |

### TKP Growth
| Platform | Handle/URL |
|----------|-----------|
| TikTok | @tkpgrowth |
| Instagram | @tkpgrowth |
| LinkedIn | TKP Growth |
| Twitter/X | @tkpgrowth |
| Website | https://tkpagency.com (or placeholder) |

---

## Step 10 — Enable Key Features

In YouTube Studio → Settings → Channel → Advanced settings:

- [x] Allow embedding videos (yes — wider distribution)
- [x] Notify subscribers (yes — upload settings)
- [x] Custom thumbnail per video (yes — we control the brand)
- [x] Community tab moderation hold (set to OFF after launch — keep ON during launch week)
- [x] Featured sections on channel page (add playlists, videos, channels)

---

## Asset Checklist

| Asset | Channel | Status | File to produce |
|-------|---------|--------|----------------|
| Profile picture | Productivity | Pending | `assets/tkp-productivity-pfp.png` |
| Profile picture | Growth | Pending | `assets/tkp-growth-pfp.png` |
| Channel banner | Productivity | Pending | `assets/tkp-productivity-banner.png` |
| Channel banner | Growth | Pending | `assets/tkp-growth-banner.png` |
| Watermark | Both | Pending | `assets/tkp-watermark-prod.png`, `assets/tkp-watermark-growth.png` |
| Trailer video | Productivity | Pending (VID-22) | TKP-33 |
| Trailer video | Growth | Pending (VID-22) | TKP-33 |
| Playlists | Both | Pending (VID-20) | TKP-31 |
| Community posts | Both | Pending (VID-21) | TKP-32 |

---

## Launch Sequencing

> TKP-29 is the first step in the launch chain. Complete this before VID-19, VID-20, VID-21, VID-22, VID-23.

```
TKP-29 Channel creation & branding  ← YOU ARE HERE
       ↓
TKP-30 Channel art & icons          (depends on brand specs above)
       ↓
TKP-31 Playlists organization
       ↓
TKP-32 Community tab setup
       ↓
TKP-33 Trailer video
       ↓
TKP-34 Launch announcement
```

---

## Known Blockers

1. **YouTube OAuth**: Founding Engineer 2 has `lib/upload/youtube.js` ready. YouTube OAuth token + refresh token must be set up via `scripts/oauth-tiktok.js` equivalent or manually in `.env` as `YOUTUBE_ACCESS_TOKEN` and `YOUTUBE_REFRESH_TOKEN`.
2. **Actual channel creation**: This guide provides all the specs. The operator must go to studio.youtube.com to create the channels.
3. **Brand assets** (TKP-30): `content/thumbnail-design-system.md` has the design specs the DESIGNER agent needs to produce the actual image files.
