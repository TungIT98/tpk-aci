---
name: system-health
description: >
  Use when: Checking system health, monitoring API services, verifying automation pipeline,
  or diagnosing infrastructure problems.
  Do NOT use when: Creating content, writing scripts, or managing uploads.
---

# System Health Skill

## Health Check List

### Paperclip API
```
WebFetch(url="http://127.0.0.1:3100/api/health", prompt="Is API healthy?")
```
Expected: `{ status: "ok" }`

### OpenClaw Browser
```
browser(action="open", profile="user")
browser(action="snapshot")
```
Expected: Browser opens, snapshot shows page

### Hailuo AI
```
WebFetch(url="https://hailuoai.video/", prompt="Is Hailuo accessible?")
```
Expected: Page loads successfully

### YouTube Studio
```
WebFetch(url="https://studio.youtube.com/", prompt="Is YouTube Studio accessible?")
```
Expected: Page loads (may need login)

### TikTok Upload
```
WebFetch(url="https://www.tiktok.com/upload", prompt="Is TikTok upload page accessible?")
```
Expected: Page loads (may need login)

### n8n Automation
```
WebFetch(url="http://localhost:5678/", prompt="Is n8n running?")
```
Expected: n8n UI accessible

## API Key Verification

### MiniMax TTS API
```bash
curl -X POST 'https://api.minimax.io/v2/t2a_v2' \
  -H 'Authorization: Bearer $MINIMAX_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"model":"speech-02-hd","text":"test","voice_setting":{"voice_id":"female-qingse"}}'
```
Expected: 200 response with audio data

## Weekly Checks
- [ ] MiniMax TTS API quota check
- [ ] Hailuo account status
- [ ] n8n workflow health
- [ ] Disk space check

## Alert Thresholds

| System | Warning | Critical |
|--------|---------|----------|
| Paperclip API | Response > 2s | No response |
| OpenClaw | Won't open | Crash loop |
| Hailuo | 5xx errors | Complete failure |
| Disk Space | < 20GB | < 10GB |
| n8n | Not responding | Down |

## Health Report Format

Save to: `agents/founding-engineer/memory/health-report-YYYY-MM-DD.md`

```markdown
# System Health Report — 2026-04-01

## All Systems
| System | Status | Notes |
|--------|--------|-------|
| Paperclip API | ✅ OK | Response: 150ms |
| OpenClaw | ✅ OK | Browser stable |
| Hailuo | ✅ OK | Accessible |
| TikTok | ✅ OK | Session valid |
| n8n | ⚠️ Slow | 2s response time |

## Issues Found
None.

## Actions Taken
None.
```
