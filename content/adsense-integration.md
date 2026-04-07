# AdSense Integration Guide (TKP-43)

**VID-32 | Analytics Agent | 2026-03-25**

Set up Google AdSense account and link to YouTube channels. Configure ad formats, placement preferences, channel-level ad settings. Prepare for monetization once YPP is approved.

---

## Pre-Requisites

Before starting AdSense setup:
- [ ] YouTube channel has 1,000 subscribers
- [ ] YouTube channel has 4,000 watch hours (OR 10M Shorts views)
- [ ] Google account created for AdSense (use dedicated account, not personal)
- [ ] Channel meets AdSense program policies
- [ ] Channel has original content (no reused/reposted content)

---

## Step 1: Create AdSense Account

### Direct Setup
1. Go to [google.com/adsense](https://www.google.com/adsense)
2. Sign in with a dedicated Google account (NOT your personal Gmail)
3. Enter your website/blog URL (use `yourchannel.com` or a Blogger site)
4. For YouTube: use your channel URL as the site: `https://youtube.com/channel/UC...`
5. Complete identity verification (postal address, phone verification)
6. Enter payment threshold (minimum $100 for first payout)

### YouTube Monetization Link (Recommended)
1. Go to [youtube.com/channel_monetization](https://www.youtube.com/account_monetization)
2. Click "Enable" for your channel
3. Sign in to existing AdSense account OR create new one
4. Select or create AdSense account associated with this channel

---

## Step 2: Link AdSense to YouTube Channel

```bash
# After AdSense approval (can take 24–48 hours):
# In YouTube Studio → Monetization → Review and accept terms
```

### Channel Monetization Checklist

- [ ] Accept YouTube Partner Program terms
- [ ] Link AdSense account (YouTube Studio → Monetization → AdSense)
- [ ] Set primary country of residence
- [ ] Enable 2-Step Verification on Google account (required)

---

## Step 3: Ad Format Configuration

### Ad Formats in YouTube Studio

| Setting | Recommendation | Revenue Impact |
|---------|---------------|--------------|
| **Display ads** | On | Low-medium RPM |
| **Overlay ads** | On (mid-roll) | Medium RPM |
| **Skippable video ads** | On | High — main revenue driver |
| **Non-skippable video ads** | On (limited) | High but hurts retention |
| **Bumpers** | On (3 max) | Low-medium, viewer-friendly |
| **Shorts ads** | On | Growing RPM |

### Recommended Configuration

```
Recommended baseline settings:
- Skippable ads: ENABLED
- Non-skippable: 15 sec max
- Display/overlay: ENABLED
- Bumper ads: 3 per video max
- Mid-roll ads: Auto-placed (or manual at natural breaks)
```

### Mid-Roll Ad Placement

For videos > 8 minutes, manually place mid-roll breaks:

1. YouTube Studio → Videos → Click video
2. Monetization tab → Mid-roll placement
3. Place at natural break points (chapter markers recommended)
4. Place mid-rolls AFTER the 30% mark (preserves retention)

```
Mid-roll placement strategy:
- 10 min video: 1 mid-roll at ~4:00
- 15 min video: 2 mid-rolls at ~5:00 and ~10:00
- 20+ min video: mid-rolls every 5–7 minutes
```

---

## Step 4: Ad Sensitivity Settings

| Setting | Recommended | Notes |
|---------|------------|-------|
| **Ad load** | Standard | More ads = more revenue but worse UX |
| **Ad intensity** | Post-lroll 1 per break | Don't over-run with too many ads |
| **Sensitive ads** | Allow limited | Opens higher-CPM advertisers |
| **Category exclusion** | None (earn on all) | Unless you have specific concerns |

---

## Step 5: Payment Setup

### Payment Threshold

- **Minimum payout:** $100 USD
- **Payment method:** Wire transfer (recommended) or check
- **Wire transfer fee:** Google pays transfer fees for amounts > $300

### Payment Timeline

```
Revenue → Accumulates in AdSense
          ↓
Payment threshold ($100) reached
          ↓
Payment issued at end of month (around 21st)
          ↓
Wire transfer: 3–5 business days
```

### AdSense PIN Verification

After creating account, Google will:
1. Mail a physical PIN to your postal address (4–6 weeks)
2. Enter PIN in AdSense dashboard to verify address
3. Required before first payout

---

## Monetization Optimization

### RPM (Revenue Per Mille) Benchmarks

| Niche | Est. RPM (USD) | CPM (USD) |
|-------|---------------|----------|
| Finance | $15–$40 | $3–$8 |
| Tech/Gadgets | $8–$20 | $2–$5 |
| Gaming | $3–$10 | $1–$3 |
| How-to/Tutorial | $5–$15 | $1.5–$4 |
| Entertainment | $2–$8 | $0.5–$2 |

### Ways to Increase Revenue

1. **Longer videos** = more ad slots = more revenue per view
2. **Mid-roll placement** = highest CPM ad placements
3. **Upload frequency** = more videos = more inventory
4. **Niche targeting** = higher-CPM niches earn more
5. **Watch time focus** = longer watch time = more ads seen = higher RPM

---

## Ad Revenue Tracking

```bash
# After linking AdSense:
# Check estimated revenue: https://adsense.google.com
# YouTube Studio → Analytics → Revenue tab
```

### Revenue Log Template

| Month | Est. Revenue | Watch Hours | Subscribers | CPM | Notes |
|-------|------------|------------|------------|-----|-------|
| | | | | | |

---

## Post-YPP Action Checklist

When YPP is approved:

- [ ] Day 1: Link AdSense account in YouTube Studio
- [ ] Day 1: Set mid-roll ad placements for all existing videos
- [ ] Day 1: Enable all ad formats
- [ ] Day 7: Check AdSense PIN in mail
- [ ] Day 7: Enter PIN in AdSense dashboard
- [ ] Day 30: First payment threshold check ($100)
- [ ] Day 45: First payout (if threshold reached)
- [ ] Month 3: Review RPM and optimize ad settings

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| AdSense not approved | Wait 24–48h, check for policy violations |
| PIN not received | Request resend in AdSense dashboard |
| No ads showing | Check ad formats enabled + video length ≥ 8 min |
| Low RPM | Consider niche, increase watch time per video |
| Channel disabled | Review AdSense policy violations |

---

## Automation Note

Ad revenue tracking is currently **manual** — pull figures from:
- [AdSense Dashboard](https://adsense.google.com) → Reports
- YouTube Studio → Analytics → Revenue tab

No YouTube Data API access is required for AdSense (handled via web dashboard).

---

*This guide is preparation. Actual monetization activates upon YPP approval and AdSense account setup.*
