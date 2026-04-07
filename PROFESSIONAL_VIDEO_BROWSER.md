# 🎬 PROFESSIONAL VIDEO PRODUCTION
## OpenClaw Browser Tool - Complete Workflow

---

## 🎯 3 COMPONENTS CHO VIDEO CHUYÊN NGHIỆP

```
┌─────────────────────────────────────────────────┐
│              VIDEO PRODUCTION                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  🖼️ IMAGE (Ảnh)     → Thumbnail, Background     │
│  🎬 VIDEO (Video)    → Hailuo AI               │
│  🔊 AUDIO (Âm thanh) → Narration + Music      │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 🖼️ BƯỚC 1: TẠO ẢNH (Thumbnail/Background)

### Tool: Leonardo AI hoặc DALL-E

```javascript
// Leonardo AI via browser
browser(action="open", profile="user")
browser(action="navigate", url="https://leonardo.ai")

// Hoặc DALL-E via browser
browser(action="navigate", url="https://chat.openai.com")
// Type prompt for thumbnail
```

### ẢNH PROMPT TEMPLATE:
```
Cinematic thumbnail for [TOPIC], dramatic lighting, 9:16 vertical, high contrast, vibrant colors, professional photography style, ultra detailed, 4K
```

### CHO YOUTUBE:
```
Thumbnail: [EMOTION] [SUBJECT] in [SETTING]
- Eye contact with camera
- Bright, high contrast
- Text overlay ready
- 16:9 horizontal
```

---

## 🎬 BƯỚC 2: TẠO VIDEO (Hailuo AI)

### Workflow:
```javascript
// 1. Open Hailuo
browser(action="open", profile="user")
browser(action="navigate", url="https://hailuoai.video/create/text-to-video")

// 2. Clear textarea (REQUIRED!)
browser(action="act", kind="click", ref="[contenteditable]")
browser(action="act", kind="press", key="Control+a")
browser(action="act", kind="press", key="Backspace")

// 3. Type prompt with CAMERA MOVEMENTS
browser(action="act", kind="type", 
       text="[Push in]Beautiful woman with flowing hair, red dress, walking through neon city at night. City lights bokeh. Cinematic. 9:16 portrait.",
       ref="[contenteditable]", 
       slowly=true)

// 4. Select model: I2V&T2V-01-DIRECTOR
browser(action="act", kind="click", ref="[model-selector]")
browser(action="act", kind="click", ref="[option:I2V&T2V-01-DIRECTOR]")

// 5. Select duration: 6s
browser(action="act", kind="click", ref="[duration:6s]")

// 6. Create
browser(action="act", kind="click", ref="[button:Create]")

// 7. Wait (5-15 min)
for (i = 0; i < 30; i++) {
    sleep(30000)
    browser(action="snapshot")
    if (hasDownloadButton()) break
}

// 8. Download
browser(action="act", kind="click", ref="[button:Download]")
```

---

## 🔊 BƯỚC 3: TẠO AUDIO

### 3A: NARRATION (MiniMax TTS)

```javascript
// MiniMax TTS API
const response = await fetch('https://api.minimax.io/v2/t2a_v2', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + MINIMAX_API_KEY,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        model: 'speech-02-hd',
        text: 'Your narration script here...',
        voice_setting: {
            voice_id: 'female-qingse',
            speed: 1.0,
            pitch: 0,
            volume: 0
        },
        audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: 'mp3'
        }
    })
})
```

### 3B: VOICE CLONE ( ElevenLabs )

```javascript
// ElevenLabs Voice Clone
const voiceResponse = await fetch('https://api.elevenlabs.io/v1/voice-clone', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + ELEVENLABS_API_KEY
    },
    body: FormData with audio sample
})
```

### 3C: BACKGROUND MUSIC

```javascript
// Search royalty-free music
browser(action="navigate", url="https://pixabay.com/music/")

// Search for mood
browser(action="act", kind="type", text="upbeat corporate tech", ref="[search-input]")
browser(action="act", kind="click", ref="[search-button]")

// Download
browser(action="act", kind="click", ref="[download-button]")
```

---

## 🎞️ BƯỚC 4: EDIT & COMBINE (FFmpeg)

### Commands:

```bash
# 1. Combine video + narration
ffmpeg -y -i video.mp4 -i narration.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -shortest output_av.mp4

# 2. Add background music (with ducking)
ffmpeg -y -i output_av.mp4 -i background_music.mp3 -filter_complex "[1:a]volume=0.2[music];[0:a][music]amix=inputs=2:duration=longest[aout]" -map 0:v -map "[aout]" final_with_audio.mp4

# 3. Add thumbnail as cover (for TikTok)
ffmpeg -y -loop 1 -i thumbnail.jpg -i final_with_audio.mp4 -map 1:v -map 0:a -c:v libx264 -preset fast -tune stillimage -shortest -c:a copy final_tiktok.mp4
```

---

## 📱 BƯỚC 5: UPLOAD

### YouTube:
```javascript
browser(action="open", profile="user")
browser(action="navigate", url="https://studio.youtube.com")

// Upload video
browser(action="act", kind="click", ref="[upload-button]")

// Fill metadata
browser(action="act", kind="type", text="TITLE", ref="[title-input]")
browser(action="act", kind="type", text="DESCRIPTION", ref="[desc-input]")

// Add thumbnail
browser(action="act", kind="click", ref="[thumbnail-upload]")
browser(action="act", kind="type", text="path/to/thumbnail.jpg")

// Publish
browser(action="act", kind="click", ref="[publish]")
```

### TikTok:
```javascript
browser(action="navigate", url="https://www.tiktok.com/upload")

// Wait for upload
sleep(10000)

// Add caption + hashtags
browser(action="act", kind="type", text="Check this out! #fyp #viral #trending", ref="[caption]")

// Post
browser(action="act", kind="click", ref="[post-button]")
```

---

## 🎯 COMPLETE PROMPT TEMPLATE

### FOR IMAGE:
```
Professional thumbnail: [SUBJECT] with [EMOTION], [SETTING], dramatic [LIGHTING], high contrast, 4K, ultra detailed, vertical 9:16
```

### FOR VIDEO (Hailuo):
```
[CAMERA] [SUBJECT] doing [ACTION] in [ENVIRONMENT]. [DETAIL 1]. [DETAIL 2]. [MOOD]. [STYLE]. 9:16 portrait. Realistic cinematic.
```

### CAMERA MOVEMENTS:
| Code | Effect |
|------|--------|
| `[Push in]` | Zoom forward |
| `[Pull out]` | Zoom backward |
| `[Pan left/right]` | Horizontal move |
| `[Tilt up/down]` | Vertical move |
| `[Tracking shot]` | Follow subject |
| `[Static]` | No movement |
| `[Shake]` | Camera shake |

### AUDIO:
```
Narration: Clear, professional voice, moderate pace
Music: [MOOD] - upbeat, emotional, tense, etc.
SFX: [TIMING] - notification, whoosh, impact
```

---

## 📋 PRODUCTION CHECKLIST

### Image:
- [ ] Thumbnail generated
- [ ] 9:16 or 16:9 depending on platform
- [ ] High quality (2K or 4K)

### Video:
- [ ] Prompt includes camera movement
- [ ] Duration: 6s (TikTok) or 15-30s (YouTube)
- [ ] Visual quality check
- [ ] Different from previous videos

### Audio:
- [ ] Narration generated
- [ ] Background music added
- [ ] Levels balanced
- [ ] Synced to video

### Export:
- [ ] File size < 50MB (TikTok)
- [ ] Resolution: 1080x1920 or 1920x1080
- [ ] Format: MP4 H.264

### Upload:
- [ ] YouTube: title, description, tags, thumbnail
- [ ] TikTok: caption, hashtags
- [ ] Both posted and confirmed
