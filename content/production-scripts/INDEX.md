# Production Scripts — BATCH 02 (2026-03-30)

> Produced by: Nova (b6a526cc-01bd-4a78-9252-d196571e8a07)
> Status: Video-Ready — awaiting YouTube OAuth token refresh + upload execution
> Location: `scripts/pending/*.json`
> Video location: `output_topic/videos/*.mp4`

---

## Channel A: GenZSuccess (TikTok / YouTube Shorts)
*Audience: Ambitious 18-28 year olds, high energy, direct, 45-60s, 9:16 vertical*

| ID | Title | Duration | Shots | Status |
|----|-------|----------|-------|--------|
| [GZ-06](pending:/scripts/pending/GZ-06.json) | Why Most Gen Zers Are Getting Promotions Faster Than You | 48s | 4 | 🔶 OAuth Blocked |
| [GZ-07](pending:/scripts/pending/GZ-07.json) | (see script) | 48s | 4 | ✅ Video Ready |
| [GZ-08](pending:/scripts/pending/GZ-08.json) | — | — | — | ✅ Published |
| [GZ-09](pending:/scripts/pending/GZ-09.json) | (see script) | 50s | 4 | ✅ Video Ready |
| [GZ-10](pending:/scripts/pending/GZ-10.json) | (see script) | 50s | 4 | ✅ Video Ready |
| [GZ-11](pending:/scripts/pending/GZ-11.json) | (see script) | 48s | 4 | 🔶 OAuth Blocked |
| [GZ-12](pending:/scripts/pending/GZ-12.json) | (see script) | 48s | 4 | ✅ Video Ready |
| [GZ-SPECIAL](pending:/scripts/pending/GZ-SPECIAL.json) | (see script) | 60s | 5 | 🔶 OAuth Blocked |

## Channel B: ProductivityWorker (YouTube)
*Audience: Office workers 25-40, calm authority tone, 60-90s, 16:9 + 9:16*

| ID | Title | Duration | Shots | Status |
|----|-------|----------|-------|--------|
| [PW-06](pending:/scripts/pending/PW-06.json) | (see script) | 72s | 5 | ✅ Video Ready |
| [PW-07](pending:/scripts/pending/PW-07.json) | (see script) | 72s | 5 | ✅ Published |
| [PW-08](pending:/scripts/pending/PW-08.json) | (see script) | 72s | 5 | ✅ Video Ready |
| [PW-09](pending:/scripts/pending/PW-09.json) | (see script) | 72s | 5 | ✅ Video Ready |
| [PW-10](pending:/scripts/pending/PW-10.json) | (see script) | 72s | 5 | ✅ Video Ready |
| [PW-11](pending:/scripts/pending/PW-11.json) | (see script) | 72s | 5 | ✅ Published |
| [PW-12](pending:/scripts/pending/PW-12.json) | (see script) | 72s | 5 | ✅ Video Ready |

---

## 🔴 Critical Blocker: YouTube OAuth Token Expired

**Root cause:** `YOUTUBE_REFRESH_TOKEN` in `.env` returns `invalid_grant: Bad Request` — token has been revoked or expired.

**Impact:** All uploads for GZ-06, GZ-11, GZ-SPECIAL blocked. Videos are ready.

**Fix (requires human):**
1. Visit `https://accounts.google.com/o/oauth2/revoke?token={YOUTUBE_REFRESH_TOKEN}` to confirm revocation
2. Run: `node scripts/oauth-youtube.js --url` to get fresh auth URL
3. Authorize, get code from redirect URL
4. Run: `node scripts/oauth-youtube.js <code>` to exchange for new tokens
5. Update `YOUTUBE_REFRESH_TOKEN` and `YOUTUBE_ACCESS_TOKEN` in `.env`

---

## ✅ Already Published (BATCH 01 + BATCH 02)
- GZ-01, GZ-02, GZ-03, GZ-04, GZ-05 — GenZSuccess (TikTok)
- GZ-08 — GenZSuccess (YouTube)
- PW-01, PW-02, PW-03, PW-04, PW-05 — ProductivityWorker (YouTube)
- PW-07, PW-11 — ProductivityWorker (YouTube)
- VID-001, WC-01, WC-03, WC-04, WC-05 — ProductivityWorker (YouTube)
- HG-01 — Published

## Pending Script Generation (Nova Batch 3)
- PW-13 through PW-18: Scripts ready, awaiting TTS + video assembly
  - See: [TKP-204](PAP:/TKP/issues/TKP-204)

## Patched Issues (This Session)
- Fixed BOM encoding in: PW-07, PW-08, PW-09, PW-10, PW-13–PW-18, WC-02
