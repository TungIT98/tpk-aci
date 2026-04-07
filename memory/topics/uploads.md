# Upload Methods Status

## TikTok

### n8n Workflow (RECOMMENDED) ✅
```
content/videos/*/captioned.mp4 → n8n watches → auto-upload
```
- **Status:** Ready, auto-watches folder
- **OAuth:** Handled by n8n TikTok node

### Browser Method ❌ BLOCKED
- **Script:** `lib/upload/tiktok-browser.js`
- **Session:** `.tiktok-session.json` (59 cookies)
- **Issue:** Session expired
- **Fix:** Run `node scripts/setup-tiktok-session.js`

## YouTube

### Browser Method ❌ BLOCKED
- **Script:** `lib/upload/youtube.js`
- **Issue:** Hidden file input
- **Session:** `.youtube-session.json`

### API Method ❌ BLOCKED
- **Issue:** `invalid_grant` - refresh token expired
- **Fix:** Re-authenticate OAuth

## Upload Directories

| Platform | Watch Folder |
|----------|--------------|
| TikTok (n8n) | `content/videos/` |
| YouTube | Manual |

## Log Files

- `content/logs/n8n_upload_queue.json`
- `content/logs/tiktok_upload_log.json`
