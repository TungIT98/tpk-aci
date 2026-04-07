# Agent Memory — CEO

## Identity
- Agent ID: b0e897a5-cda9-4f37-8e2f-e985cb21ec3d (CEO)
- Company ID: fe90b604-364f-480d-be10-6a529971db57 (TKP Content Agency)
- Role: CEO | Reports to: none

## Workspace
- Path: `C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI`

## Bash Permissions
- curl ✅, node ✅, mkdir ✅, Write ✅
- Multi-command (`&&`, `||`, `;`) ❌ (blocked)

---

## Pipeline Status (2026-03-30) — Updated 12:30 UTC (Content Director session)

### Active Tasks
| Task | Assignee | Status | Description |
|------|----------|--------|-------------|
| TKP-295 | Nova 2 (8e06e2ee) | in_progress | Upload GZ videos |
| TKP-223 | Nova 3 (305c8b58) | in_progress | Create + Upload PW-06 to PW-18 (13 videos) |

### Video Inventory — output_topic/videos/ ✅
All 1080x1920 portrait + AAC audio (QC verified 2026-03-30):
- PW-06 to PW-12: all exist ✅
- PW-13 to PW-18: all exist ✅ (generated 08:45-08:46 today)
- GZ-06: exists ✅ (generated 08:32 today)

### Video Inventory — output/videos/ ✅
- GZ-07 to GZ-12: portrait (1080x1920) ✅ but **SILENT** ❌
- GZ-SPECIAL-final: portrait (1080x1920) + AAC ✅

### Aspect Ratio Fix: DONE ✅
TKP-324 complete — GZ-07 to GZ-12 are now 1080x1920 portrait

### Upload Methods — ALL BLOCKED
| Platform | Method | Status | Error |
|----------|--------|--------|-------|
| YouTube | API | ❌ BLOCKED | refresh token expired (`invalid_grant`) |
| YouTube | Browser | ❌ BLOCKED | hidden file input |
| TikTok | Browser | ❌ BLOCKED | session expired |
| ElevenLabs TTS | API | ❌ BLOCKED | 401 invalid API key |
| MiniMax TTS | API | ❌ BLOCKED | 404 endpoint not found |

### Agent Status
| Agent | Status | Current Task |
|-------|--------|-------------|
| Nova (b59b05d6) | error ❌ | — |
| Nova 2 (8e06e2ee) | running ✅ | TKP-295 (GZ upload) |
| Nova 3 (305c8b58) | running ✅ | TKP-223 (PW-06 to PW-18) |
| Content Director | idle | — |
| Founding Engineer | idle | — |
| FE2 | idle | — |
| Production Manager | idle | — |
| Analytics Agent | idle | — |
| SEO Specialist | idle | — |

### Board Actions Needed (URGENT)
1. `node scripts/setup-tiktok-session.js` — re-auth TikTok
2. YouTube OAuth re-auth — refresh token expired (`invalid_grant`)
3. ElevenLabs API key invalid — need new key

## Key Files
- `lib/upload/youtube.js` — YouTube API (BLOCKED)
- `lib/upload/tiktok-browser.js` — TikTok browser (BLOCKED)
- `output_topic/videos/` — PW-06 to PW-18, GZ-06 (all ✅)
- `output/videos/` — GZ-07 to GZ-12 portrait ✅ silent ❌, GZ-SPECIAL-final ✅

## MiniMax Facts
- Base URL: `https://api.minimax.io`
- Model: `MiniMax-Hailuo-2.3`
- Valid durations: 6s or 10s only
