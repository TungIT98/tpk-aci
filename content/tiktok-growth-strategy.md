# TikTok Growth Strategy — TKP ACI

> Target: **10,000 followers** to unlock TikTok Creator Fund, brand sponsorships, and affiliate monetization.

---

## Account Status

| Item | Status |
|---|---|
| TikTok App (Creator API) | Registered — App ID: 7620643939351169042 |
| Client Key / Secret | Configured in `.env` |
| OAuth Script | ✅ `scripts/oauth-tiktok.js` ready |
| Access Token | ❌ **Requires human authorization** |
| Videos to Post | ❌ Pipeline blocked (TKP-35: `node` execution) |

### OAuth Setup (Required — Human Action)

The TikTok Creator API requires a human account owner to authorize the app. Steps:

```bash
# 1. Generate the authorization URL
node scripts/oauth-tiktok.js --url

# 2. Visit the URL in browser → authorize TKP app
# 3. Copy the ?code=XXX from the redirect URL

# 4. Exchange the code for tokens (saves to .env)
node scripts/oauth-tiktok.js <code>
```

After this, `TIKTOK_ACCESS_TOKEN` and `TIKTOK_REFRESH_TOKEN` will be in `.env` and the pipeline can post.

---

## Two-Channel Content Strategy

### Channel 1: Productivity Worker (@tkpproductivity)
**Niche:** Peak performance, deep work, productivity systems for 9-to-5 professionals
**Target follower:** Working professionals aged 25-45

### Channel 2: Gen Z Success (@tkpgenzsuccess)
**Niche:** Side-hustles, financial independence, creator economy for Gen Z (18-28)
**Target follower:** Ambitious young adults

---

## Growth Tactics (Priority Order)

### 1. Posting Cadence
- **Phase 1 (0–1K followers):** 1 video/day across both channels
- **Phase 2 (1K–5K):** 2 videos/day on best-performing channel
- **Phase 3 (5K–10K):** 3 videos/day split by platform analytics
- Optimal posting times: 7-9 AM and 7-10 PM local timezone

### 2. Hook Strategy (from `content/viral-hooks.md`)
- Open with a pattern interrupt or curiosity gap in the first 0.3s
- Lead with value: "The 3-email rule that saved me 2 hours/day"
- Anti-patterns: never start with "Hey guys" or generic greetings
- Use second-person ("you") in every hook

### 3. Hashtag Strategy
**Productivity channel:** `#productivity #deepwork #timemanagement #workfromhome #focus #habits`
**Gen Z channel:** `#sidehustle #genz #financialfreedom #motivation #entrepreneur #morningroutine`

**Algorithm hashtags (rotate weekly):**
`#fyp #foryou #viral #trending #learnontiktok`

### 4. Engagement Tactics
- Reply to all comments in first 2 hours (algorithm boost)
- Use TikTok's stitch/react feature on trending productivity content
- Duet competitor videos with counter-points or additions
- Go LIVE during follower Q&A sessions (triggers algorithm)

### 5. Cross-Posting
- YouTube Shorts: same video, different title/description
- Instagram Reels: native upload (no watermarks — use `lib/upload/instagram.js`)
- LinkedIn: long-form adaptation for B2B audience

### 6. Trending Format Exploitation
Monitor weekly for:
- New "corecore" / aesthetic productivity trends
- Audio trends (use `lib/script-generator.js` to match captions to trending sounds)
- Seasonal hooks (Q1: "new year new me", back-to-school, etc.)

---

## Milestone Roadmap

| Followers | Goal | Tactics |
|---|---|---|
| 0 → 100 | Validation | Post 3 videos, pick best-performing niche |
| 100 → 500 | Momentum | Double posting frequency, engage 2h on all comments |
| 500 → 1,000 | Community | Start Duet/Stitch campaigns, follow-for-follow pods |
| 1,000 → 3,000 | Algorithm | Consistent 1/day, optimize posting time, go LIVE |
| 3,000 → 5,000 | Scaled | 2/day, cross-post to YT Shorts + IG Reels |
| 5,000 → 10,000 | Monetization prep | Reach out to niche brands for sponsorships |

---

## Monetization Unlocks at 10K

At 10,000 followers, TikTok unlocks:
1. **TikTok Creator Fund** — revenue share on views
2. **LIVE gifts** — monetized LIVE sessions
3. **Brand partnerships** — direct sponsorships (estimated $100–500/post at 10K)
4. **Affiliate links** — TikTok's affiliate marketplace

---

## Content Calendar (30 Days)

See `content/content-calendar.md` for the full 30-day posting schedule.

---

*Last updated: 2026-03-25 by Founding Engineer 2*
