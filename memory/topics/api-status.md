# API & Service Status (2026-04-05)

## MiniMax API ✅

| Service | Model | Status |
|---------|-------|--------|
| LLM | MiniMax-M2.7 | ✅ Working |
| Image | image-01 | ✅ Working |
| Video (Hailuo) | MiniMax-Hailuo-2.3 | ⚠️ 3/day limit |
| TTS | Edge TTS (vi-VN-HoaiMyNeural) | ✅ Working |

## Upload Methods — ALL BLOCKED ❌

| Platform | Method | Status | Error |
|----------|--------|--------|-------|
| YouTube | API | ❌ BLOCKED | `invalid_grant` - refresh token expired |
| YouTube | Browser | ❌ BLOCKED | hidden file input |
| TikTok | Browser | ❌ BLOCKED | session expired |
| ElevenLabs | API | ❌ BLOCKED | 401 invalid API key |

## n8n Workflow ✅

- Auto-watches `content/videos/*/captioned.mp4`
- TikTok node handles OAuth
- **Status:** Ready

## Solutions Needed

1. **YouTube OAuth:** Re-authenticate refresh token
2. **TikTok:** Run `node scripts/setup-tiktok-session.js`
3. **TTS:** Use Edge TTS (working) instead of ElevenLabs

## Paperclip

- **API:** http://localhost:3100
- **Company ID:** fe90b604-364f-480d-be10-6a529971db57
