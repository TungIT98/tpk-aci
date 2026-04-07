# Upload Workflow

Automated multi-platform video distribution via TikTok, YouTube Shorts, Instagram Reels, and LinkedIn Shorts.

## Architecture

```
Pipeline Output (lib/video-pipeline.js)
  → scripts/queue-add.js        # Add video to upload queue
  → uploads/queue.json         # Pending upload jobs
  → scripts/publish.js          # Execute queue (invoked by PUBLISHER agent or cron)
      → lib/upload/index.js     # Dispatcher
          → lib/upload/tiktok.js    # TikTok Creator API
          → lib/upload/youtube.js    # YouTube Data API v3
          → lib/upload/instagram.js  # Instagram Graph API
          → lib/upload/linkedin.js   # LinkedIn UGC Posts API
  → uploads/upload.log.md       # Result log
```

## Queue Format (`uploads/queue.json`)

```json
[
  {
    "id": "vid-1742995200000",
    "videoPath": "C:/path/to/output/vid-001.mp4",
    "platforms": ["tiktok", "youtube"],
    "metadata": {
      "title": "How I 10x'd My Productivity",
      "description": "...",
      "tags": ["productivity", "focus"]
    },
    "status": "pending|in_progress|published|partial|failed",
    "createdAt": "2026-03-25T12:00:00Z",
    "startedAt": null,
    "completedAt": null,
    "results": []
  }
]
```

## Quick Start

```bash
# 1. Add a video to the queue
node scripts/queue-add.js output/vid-001.mp4 tiktok,youtube "My Title"

# 2. Execute the queue (dry run first)
node scripts/publish.js --dry-run
node scripts/publish.js

# 3. Check results
cat uploads/upload.log.md
```

## OAuth Setup (Required Before First Upload)

### TikTok

```bash
# Step 1: Generate authorization URL
node scripts/oauth-tiktok.js --url http://localhost:8080/callback

# Step 2: Visit URL → authorize → copy ?code= from redirect URL

# Step 3: Exchange code for tokens
node scripts/oauth-tiktok.js <auth_code> http://localhost:8080/callback

# Step 4: Tokens are saved to .env automatically
# To refresh expired token:
node scripts/oauth-tiktok.js --refresh
```

Required .env vars (TikTok app credentials already configured):
```
TIKTOK_CLIENT_KEY=awuea1xfp39xh4iz
TIKTOK_CLIENT_SECRET=...
TIKTOK_APP_ID=7620643939351169042
TIKTOK_ACCESS_TOKEN=<from OAuth flow>
TIKTOK_REFRESH_TOKEN=<from OAuth flow>
```

### YouTube

1. Create a YouTube Data API v3 project at console.cloud.google.com
2. Enable YouTube Data API v3
3. Create OAuth 2.0 credentials (Web application type)
4. Authorize using: `scripts/oauth-youtube.js --url`
5. Exchange code: `scripts/oauth-youtube.js <code>`

Required .env vars:
```
YOUTUBE_CLIENT_ID=<from Google Cloud Console>
YOUTUBE_CLIENT_SECRET=<from Google Cloud Console>
YOUTUBE_REFRESH_TOKEN=<from OAuth flow>
```

### Instagram

1. Create a Facebook Developer app with Instagram Basic Display product
2. Add Instagram Test User via Graph API Explorer
3. Get Long-Lived User Access Token (expires in 60 days, auto-refreshes if used within 24h of expiry)

Required .env vars:
```
IG_ACCESS_TOKEN=<from Facebook Graph API Explorer>
IG_USER_ID=<your Instagram User ID>
```

### LinkedIn

1. Create a LinkedIn Developer app
2. Request `r_liteprofile` and `w_member_social` permissions
3. Complete OAuth 2.0 authorization flow
4. Get UGC Post URN for your account

Required .env vars:
```
LINKEDIN_ACCESS_TOKEN=<from OAuth flow>
LINKEDIN_PERSON_URN=urn:li:person:<your-id>
```

## Scheduling

Run publish.js via cron or the PUBLISHER agent on your upload schedule.

Recommended: check queue every 15 minutes during posting windows.

```bash
# Example: run every 15 minutes
*/15 * * * * cd /path/to/TKP_ACI && node scripts/publish.js >> uploads/cron.log 2>&1
```

## Failure Handling

- `partial` status = some platforms succeeded, others failed
- `failed` status = all platforms failed
- Failed jobs remain in queue with error details in `results`
- Re-run publish.js to retry

## Rate Limits

| Platform | Limit | Notes |
|----------|-------|-------|
| TikTok | 20 uploads/day | Free tier |
| YouTube | 6 uploads/day (free), 200/day (partner) | Quota-based |
| Instagram | 50 posts/day | Graph API |
| LinkedIn | 25 posts/day | Developer tier |
