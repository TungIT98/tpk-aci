# BROWSER OPERATIONS GUIDE - YouTube & TikTok Upload
## For Nova - Browser Operator

---

## 🎬 HAILUO AI VIDEO CREATION

### URL
```
https://hailuoai.video/
```

### Steps
1. Navigate to `https://hailuoai.video/`
2. Click "Create Video" or "New Video"
3. Select **Hailuo Max** (recommended) or "Hailuo 2.3"
4. Enter prompt from script
5. Set duration: **6 seconds** (optimal for TikTok/Shorts)
6. Set resolution: **1080P**
7. Click "Generate"
8. Wait 3-10 minutes
9. Click "Download" when ready
10. Save to `outputs/{script_id}.mp4`

---

## 📤 YOUTUBE UPLOAD VIA BROWSER

### URL
```
https://studio.youtube.com/
```

### Steps
1. Navigate to `https://studio.youtube.com/`
2. Click "Create" → "Upload videos"
3. Select video file from `outputs/{script_id}.mp4`
4. Fill in details:
   - **Title:** From script `title` field
   - **Description:** From script `script` field
   - **Tags:** From script `tags` array (comma separated)
5. Set visibility: **Public** or **Unlisted**
6. For YouTube Shorts (vertical video):
   - Select "Shorts" tab if uploading vertical video
7. Click "Publish"
8. Copy YouTube URL from confirmation page
9. Update script JSON:
   - `status = "uploaded"`
   - `youtube_url = "https://youtube.com/watch?v=..."`
   - `uploaded_at = timestamp`

---

## 📱 TIKTOK UPLOAD VIA BROWSER

### URL
```
https://www.tiktok.com/upload
```

### Steps
1. Navigate to `https://www.tiktok.com/upload`
2. Click "Upload" button
3. Select video file from `outputs/{script_id}.mp4`
4. Fill in details:
   - **Caption:** From script `title` + hashtags from `tags`
   - Example: `"The 2-Minute Rule That Changes Everything #productivity #tips #ai"`
5. Set visibility: **Public**
6. Add cover/thumbnail if prompted
7. Click "Post"
8. Copy TikTok URL from confirmation page
9. Update script JSON:
   - `status = "published"`
   - `tiktok_url = "https://tiktok.com/@user/video/..."`
   - `uploaded_at = timestamp`

---

## 📋 COMPLETE WORKFLOW - Nova Does All

```
┌─────────────────────────────────────────────────────────────────┐
│                    NOVA'S COMPLETE WORKFLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. READ SCRIPT                                                 │
│     └─▶ scripts/pending/{id}.json                              │
│                                                                  │
│  2. CREATE VIDEO ON HAILUO                                      │
│     ├─▶ https://hailuoai.video/                                │
│     ├─▶ Paste prompt, generate video                           │
│     └─▶ Download to outputs/{id}.mp4                           │
│                                                                  │
│  3. UPLOAD TO YOUTUBE                                           │
│     ├─▶ https://studio.youtube.com/                            │
│     ├─▶ Upload video, set title/desc/tags                     │
│     └─▶ Publish, copy URL                                      │
│                                                                  │
│  4. UPLOAD TO TIKTOK                                            │
│     ├─▶ https://www.tiktok.com/upload                          │
│     ├─▶ Upload video, set caption + hashtags                   │
│     └─▶ Post, copy URL                                         │
│                                                                  │
│  5. UPDATE SCRIPT STATUS                                        │
│     └─▶ status = "published"                                   │
│         youtube_url = "..."                                    │
│         tiktok_url = "..."                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 CREDENTIALS

| Platform | URL | Account |
|----------|-----|---------|
| Hailuo | https://hailuoai.video/ | thanhtungtran364@gmail.com |
| YouTube | https://studio.youtube.com/ | thanhtungtran364@gmail.com |
| TikTok | https://www.tiktok.com/upload | thanhtungtran364@gmail.com |

**Note:** All accounts use the same email. Browser session should be logged in.

---

## ⚠️ TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| YouTube Studio redirect | Accept cookies, verify account |
| TikTok upload fails | Check video format (MP4), max 10 min |
| Session expired | Re-login to TikTok/YouTube in browser |
| Video not vertical | TikTok accepts both, but vertical performs better |

---

## 📊 SCRIPT STATUS VALUES

| Status | Meaning |
|--------|---------|
| `pending` | Script created, waiting for video |
| `video_created` | Video downloaded to outputs/ |
| `youtube_uploaded` | Uploaded to YouTube |
| `tiktok_uploaded` | Uploaded to TikTok |
| `published` | Uploaded to ALL platforms |

---

## 📁 OUTPUT DIRECTORY

```
C:\Users\PC\.paperprint\instances\default\workspaces\TKP_ACI\outputs\
```

Filename: `{script_id}.mp4` (e.g., `VID-001.mp4`)

---

## 🎯 QUICK REFERENCE

### Hailuo
- URL: https://hailuoai.video/
- Model: Hailuo Max (best quality)
- Duration: 6s (TikTok optimal)
- Resolution: 1080P

### YouTube
- URL: https://studio.youtube.com/
- Shorts: Use "Shorts" upload option for vertical video

### TikTok
- URL: https://www.tiktok.com/upload
- Caption: Title + hashtags
- Format: MP4, max 10 minutes

---

*Last Updated: 2026-03-27*
*Version: 1.0*
