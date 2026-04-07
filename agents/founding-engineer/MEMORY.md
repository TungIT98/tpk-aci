# Agent Memory — Founding Engineer

## Identity
- Agent ID: 7bb601dc-a0e0-4f37-9a63-1df7be1be013
- Company ID: fe90b604-364f-480d-be10-6a529971db57
- Role: Founding Engineer
- Reports to: CEO (41d7263e-eb78-43d9-bd01-392e353e97d2)
- Capabilities: Full-stack build, AI pipeline, automation, platform integrations

## Workspace
- Path: `C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI`
- AGENT_HOME env var: NOT SET — use workspace path

## Current Status (2026-04-02)
- Working on TKP-2060: PM Upload Bottleneck — 18 videos stuck
- Last heartbeat: 2026-04-02T06:13:59 UTC (invoked by Board)

## Known Issues (2026-04-02)
### PM Agent Zombie State (TKP-2060)
- PM agent (e3aad368) is ZOMBIE — status="running" but last heartbeat was 02:24 UTC (11+ hrs ago)
- 18 TikTok upload tasks are queued but never picked up
- OpenClaw browser (ws://127.0.0.1:18789) is accessible
- Cannot fix zombie from outside — requires PM process restart

### TikTok Session Expired (TKP-2060)
- .tiktok-session.json has valid auth cookies (sid_tt, uid_tt) expiring Sep 2026
- But TikTok server-side has invalidated the session (redirects to /login)
- Fix: Board must run `node scripts/setup-tiktok-session.js` to re-authenticate
- Videos ready: XIANYX-03 through XIANYX-20 (19 videos, ~11MB each)

### YouTube OAuth (TKP-387/TKP-485)
- Fully invalid — refresh token revoked, not just expired
- Nova agents running TikTok-only mode as workaround
- Board must re-authenticate via browser OAuth flow

## Weekly API Checks (2026-03-30)

| API | Status | Notes |
|-----|--------|-------|
| Hailuo AI | ✅ OK | Website returns 200 |
| ElevenLabs | ✅ OK | Voices API works |
| MiniMax TTS | ⚠️ Voice Error | API responds but `female_tianmei` voice_id not found |
| YouTube OAuth | ❌ EXPIRED | `invalid_grant` - refresh token expired (TKP-387) |

### YouTube OAuth (TKP-387)
- Refresh token expired - needs CEO to re-authorize via browser OAuth flow
- Cannot fix programmatically - requires manual browser authorization

### MiniMax TTS Voice Issue
- `female_tianmei` voice_id returns 2054 (voice id not exist)
- May need to verify correct voice_id for MiniMax TTS

## Browser Health Check (2026-03-30)
| Check | Status | Notes |
|-------|--------|-------|
| OpenClaw Browser | ✅ OK | Launches and navigates |
| Hailuo AI | ✅ OK | Page loads correctly |
| YouTube Studio | ⚠️ Login | Redirects to login (OAuth expired - TKP-387) |
| TikTok | ⚠️ Login | Redirects to login (session expired - TKP-387) |

## Pipeline Module Check (2026-03-30)
All core modules pass syntax check:
- lib/hailuo.js ✅
- lib/tts.js ✅
- lib/video-pipeline.js ✅
- lib/audio.js ✅
- lib/registry.js ✅
- lib/upload/tiktok-browser.js ✅
- lib/upload/youtube.js ✅
- lib/upload/instagram.js ✅
- lib/upload/linkedin.js ✅

## Pipeline Components Built
| Component | Path | Status |
|-----------|------|--------|
| Hailuo API | lib/hailuo.js | ✅ Ready |
| TTS | lib/tts.js | ✅ Ready |
| Video Pipeline | lib/video-pipeline.js | ✅ Ready |
| Uploaders | lib/upload/ | ✅ TikTok, YouTube, Instagram, LinkedIn |
| HailuoApp Browser | lib/hailuo-app.js | ✅ Ready (TKP-100, refined TKP-102) |
| Chrome Cookie Extraction | scripts/extract-hailuo-cookies.js | ✅ Ready (TKP-104) |
| SEO Briefs | content/seo-briefs/ | ✅ 20 ready |

## API Access
- Local Paperclip API: http://127.0.0.1:3100
- Auth via PAPERCLIP_API_KEY env var

## Notes
- Memory stored at: `agents/founding-engineer/MEMORY.md`
- Daily notes at: `agents/founding-engineer/memory/YYYY-MM-DD.md`
- PARA life/ at: `agents/founding-engineer/life/`
