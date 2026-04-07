---
name: upload-automation
description: >
  Use when: Uploading videos to TikTok or YouTube, setting video metadata (title, description, tags),
  or managing upload sessions.
  Do NOT use when: Creating videos, writing scripts, or doing quality control.
---

# Upload Automation Skill

## Upload Pipeline

### TikTok (via n8n)
1. Place captioned video: `content/videos/xianxia/{id}/captioned.mp4`
2. n8n auto-detects and uploads
3. n8n workflow: `scripts/n8n_tiktok_workflow.json`

### YouTube (Browser Automation)
1. Open YouTube Studio: https://studio.youtube.com
2. Use session: `.youtube-session.json`
3. Fill title, description, tags, thumbnail
4. Set as "Not made for kids"
5. Publish

## Session Management

| Platform | Session File | Status |
|----------|-------------|--------|
| TikTok | `.tiktok-session.json` | 60 cookies, active |
| YouTube | `.youtube-session.json` | EXPIRED — do not use |

## If Session Expired
```
# TikTok
node scripts/setup-tiktok-session.js

# YouTube (do NOT use — OAuth broken)
# Use browser session only, no OAuth
```

## Post-Upload
- Add YouTube URL and TikTok URL to script JSON
- Set status = "published"
- Comment on Paperclip issue with URLs
