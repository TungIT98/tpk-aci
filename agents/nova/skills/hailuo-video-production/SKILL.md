---
name: hailuo-video-production
description: >
  Use when: Generating AI videos via Hailuo browser, creating visual content from prompts,
  or assembling video scenes into final episodes.
  Do NOT use when: Uploading videos, writing scripts, or doing quality control.
---

# Hailuo Video Production Skill

## Hailuo Browser Workflow

### Step 1 — Open Hailuo
```
browser(action="open", profile="user")
browser(action="navigate", url="https://hailuoai.video/create/text-to-video")
```

### Step 2 — Page Preparation
- Wait for page load (5s)
- Take snapshot to verify page loaded
- **CLICK textarea first** (required by Hailuo)
- **CLEAR old text** with Ctrl+A, Backspace before typing

### Step 3 — Enter Prompt
- Type with `slowly=true` for long prompts
- Include camera movements: [Push in], [Pull out], [Pan], [Tracking shot]
- Select model: I2V&T2V-01-DIRECTOR
- Select duration: match script duration (30s for Xianxia, 60s default)

### Step 4 — Generate
- Click CREATE button
- Wait 5-15 minutes (poll every 30s, max 30 polls)
- Download video when ready

### Step 5 — Save
- Save to: `outputs/xianxia/{id}/raw_{scene}.mp4`
- Log generation time and model used

## TTS Audio Generation

```bash
curl -X POST 'https://api.minimax.io/v2/t2a_v2' \
  -H 'Authorization: Bearer $MINIMAX_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "speech-02-hd",
    "text": "Narration script here",
    "voice_setting": { "voice_id": "female-qingse", "speed": 1.0 }
  }'
```

Save to: `outputs/xianxia/{id}/narration.mp3`

## FFmpeg Assembly

```bash
# Xianxia format: 5 scenes × 6s = 30s
ffmpeg -y \
  -i outputs/xianxia/{id}/raw_scene1.mp4 \
  -i outputs/xianxia/{id}/raw_scene2.mp4 \
  -i outputs/xianxia/{id}/raw_scene3.mp4 \
  -i outputs/xianxia/{id}/raw_scene4.mp4 \
  -i outputs/xianxia/{id}/raw_scene5.mp4 \
  -i outputs/xianxia/{id}/narration.mp3 \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v]concat=n=5:v=1:a=0[outv]" \
  -map "[outv]" -map 5:a \
  -c:v libx264 -c:a aac -shortest \
  outputs/xianxia/{id}/final.mp4
```

## Camera Movement Reference

| Code | Effect |
|------|--------|
| [Push in] | Zoom forward, close-up |
| [Pull out] | Zoom out, wide shot |
| [Pan left/right] | Horizontal camera move |
| [Tracking shot] | Follows subject |
| [Static] | No movement |
| [Shake] | Camera shake effect |

## Credentials
- Hailuo: thanhtungtran364@gmail.com
- MiniMax API: $MINIMAX_API_KEY env var
