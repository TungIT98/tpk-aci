# TKP ACI Memory Index (Layer 1)

**Last Updated:** 2026-04-06 11:22 UTC
**Workspace:** `C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI`

## Quick Status

| System | Status | Notes |
|--------|--------|-------|
| Paperclip API | ⚠️ BLOCKED | All POST/PATCH returning 500 since ~10:45 UTC — CANNOT create tasks or invoke agents |
| Content Director | ✅ Complete | GOAL-8 scripts 60/60 done |
| Production Manager | ✅ Ready | Waiting for GOAL-8 videos |
| Nova | 🔄 IN PROGRESS | TKP-2950 in_progress at 11:07 UTC — running gen-goal8-batch.py |
| Nova 2 | ⚠️ NO TASK | No todo task (POST blocked — needs manual task creation) |
| Nova 3 | ⚠️ NO TASK | No todo task (POST blocked — needs manual task creation) |
| YouTube API | ❌ BLOCKED | OAuth token invalid |
| TikTok | ✅ Ready | Browser session exists |

## Agent Registry (10 agents)

| Agent | ID | Status | Last Heartbeat |
|-------|-----|--------|----------------|
| CEO | b0e897a5 | running | 10:45 |
| Content Director | 24ac8a23 | running | 10:28 | GOAL-8 scripts 60/60 ✅ |
| Nova | b59b05d6 | waking | — | GOAL-8 production pending |
| Nova 2 | 8e06e2ee | waking | — | GOAL-8 production pending |
| Nova 3 | 305c8b58 | waking | — | GOAL-8 production pending |
| Production Manager | e3aad368 | idle | — | Waiting for GOAL-8 videos |
| SEO Specialist | 9ff4e340 | idle | — | |
| Analytics Agent | dc1160e2 | idle | — | |
| Founding Engineer | 7bb601dc | idle | — | |
| Founding Engineer 2 | be3b4d40 | idle | — | |

## GOAL-5: Xianxia Content Factory

**Goal ID:** `928bc57d-583b-4a4e-af8a-b0b8ffd6c0a6`
**Target:** 30 videos/week
**Series:** Trieu Tien, Dau Pha Thuong Khau, Tru Tien, Thanh Van Mon, Muc Than Ky, Ha Tien Du

## GOAL-7: Xianxia Batch 3 (ACTIVE — 2026-04-05)

**Goal ID:** `cbf2f18c-d126-4a1f-9971-f3fbd637d7f4`
**Parent:** GOAL-5
**Target:** 60 XiAnyX scripts (all COMPLETE ✅ as of 15:00 UTC)

**Script Status (60/60 ✅):**
| Range | Series | Episodes | Scripts | Status |
|-------|--------|----------|---------|--------|
| 51-60 | Ha Tien Du | E1-10 | XIANYX-51-60 | ✅ |
| 61-70 | Trieu Tien | E11-20 | XIANYX-61-70 | ✅ |
| 71-80 | Dau Pha Thuong Khau | E11-20 | XIANYX-71-80 | ✅ CEO wrote |
| 81-90 | Tru Tien | E11-20 | XIANYX-81-90 | ✅ CEO wrote |
| 91-101 | Thanh Van Mon | E11-20 | XIANYX-91-101 | ✅ |
| 102-110 | Muc Than Ky | E11-19 | XIANYX-102-110 | ✅ |

**Production Status (2026-04-06 01:25 UTC): ALL 60/60 QC-PASS ✅**
- XiAnyX-51 through XiAnyX-110: all final.mp4 verified >1MB, 1080x1920, audio present
- **Critical bug fixed (2026-04-06):** gen-goal6-batch.py FFmpeg filter `crop=in_h*9/16:in_h` was invalid → produced 0-byte portrait clips → corrupt 100-400KB final videos. Fixed to `scale=1080:-2`.
- **MiniMax TTS fix:** Added minimum audio size check — gTTS now correctly falls back when MiniMax returns corrupt <1KB responses.

**Upload Status (2026-04-06 02:50 UTC): ALL 60/60 PUBLISHED ✅**
- Batch 1 (TKP-2930): 25/26 uploaded (XIANYX-51 skipped, already published) — completed 01:55 UTC
- Batch 2 (TKP-2938): 18/18 uploaded ✅ (XIANYX-68,71-84,86,88,89) — completed 02:25 UTC
- Batch 3 (TKP-2939): 16/16 uploaded ✅ (XIANYX-92-95,97-101,103-109) — completed 02:46 UTC
- Note: scripts/pending/xianxia/ file naming is `XIANYX-{N}.json` (no zero-padding for 1-99, padStart(3) for 100+)
- TikTok @fai20128 now at ~#435 posts (was ~#401 before Batch 2)
- YouTube: BLOCKED — OAuth token invalid (TKP-485, TKP-477 pending Board)

## GOAL-8: Xianxia Batch 4 (ACTIVE — 2026-04-06)

**Goal ID:** `f8a8a33b-9b46-415e-a815-7bf1ec98658d`
**Parent:** GOAL-5
**Target:** 60 XiAnyX scripts (E21-30 × 6 series)

**Script Status (60/60 ✅ — COMPLETE as of 10:43 UTC):**
| Range | Series | Episodes | Scripts | Status |
|-------|--------|----------|---------|--------|
| 111-120 | Ha Tien Du | E21-30 | XIANYX-111-120 | ✅ |
| 121-130 | Trieu Tien | E21-30 | XIANYX-121-130 | ✅ |
| 131-140 | Dau Pha Thuong Khau | E21-30 | XIANYX-131-140 | ✅ |
| 141-150 | Tru Tien | E21-30 | XIANYX-141-150 | ✅ |
| 151-160 | Thanh Van Mon | E21-30 | XIANYX-151-160 | ✅ |
| 161-170 | Muc Than Ky | E21-30 | XIANYX-161-170 | ✅ |

**Production:** IN PROGRESS — Nova (b59b05d6) has TKP-2950 in todo, will self-start on next heartbeat. Nova 2 and Nova 3 have no tasks (POST blocked).
**Upload:** Pending — will split into 3 batches like GOAL-7
**API Alert:** All POST/PATCH returning 500 since ~10:45 UTC. Cannot create tasks for Nova 2/3. Monitor Nova for self-start.

## Topic Pointers (Layer 2)

| Topic | File | Summary |
|-------|------|---------|
| Production Pipeline | `topics/production.md` | Hailuo → concat → TTS → upload |
| Xianxia Series | `topics/xianxia.md` | GOAL-5 context, series roster |
| API Status | `topics/api-status.md` | Service health, blocked endpoints |
| Upload Methods | `topics/uploads.md` | TikTok/YouTube upload status |
| Agent Registry | `topics/agents.md` | Full agent capabilities & IDs |

## Snapshot Archive (Layer 4)

- `snapshots/2026-04-05/` - Latest snapshot
- CEO logs: `agents/ceo/memory/2026-03-*.md`

## Verification Rule (CRITICAL)

**Memory is a HINT, not truth.**

Before acting:
```bash
# Verify API
curl http://localhost:3100/health

# Verify video exists
ls outputs/xianxia/{id}/

# Verify task status
curl "http://localhost:3100/api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?status=todo"
```
