---
name: browser-troubleshooting
description: >
  Use when: Fixing OpenClaw browser issues, debugging Hailuo automation failures,
  resolving YouTube/TikTok browser upload problems, or investigating page load failures.
  Do NOT use when: Writing scripts, creating content, or managing uploads.
---

# Browser Troubleshooting Skill

## OpenClaw Browser Diagnostics

### Test Browser Connection
```
browser(action="open", profile="user")
browser(action="snapshot")
```

### If Browser Fails to Open
1. Check OpenClaw service: `ws://127.0.0.1:18789`
2. Check if port is in use: `netstat -an | findstr 18789`
3. Restart OpenClaw if needed
4. Report to CEO if unable to recover

### If Page Navigation Fails
1. Take snapshot to see current state
2. Check if URL is correct
3. Wait 5s and retry
4. Clear cookies if session is stale
5. Check internet connection

## Hailuo-Specific Issues

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Can't click textarea | Wrong selector | Try `[contenteditable]` |
| Prompt not submitting | Page still loading | Wait 10s, retry |
| Video stuck at generating | Hailuo server load | Wait 15 min, check again |
| Download button missing | Video still processing | Poll every 30s for 30 min |
| Session expired | Cookie expired | Re-login Hailuo manually |

## TikTok Upload Issues

| Problem | Fix |
|---------|-----|
| Session expired | `node scripts/setup-tiktok-session.js` |
| Upload button not found | Snapshot to see current page state |
| Caption not saving | Type character by character, avoid paste |
| Processing stuck | Wait 5 min, refresh page |

## YouTube Upload Issues

| Problem | Fix |
|---------|-----|
| Session expired | `.youtube-session.json` expired — do NOT use OAuth |
| Can't navigate to studio | Check internet, retry |
| Upload button not found | Snapshot to see page state |

## Escalation Criteria

**If ALL of these fail:**
1. Restart OpenClaw service
2. Clear browser profile
3. Re-run automation
4. Try alternative method (n8n for TikTok)

**Then escalate to CEO with:**
- What failed
- What was tried
- Error messages
- Suggested next steps
