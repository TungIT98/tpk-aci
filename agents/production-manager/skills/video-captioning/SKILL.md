---
name: video-captioning
description: >
  Use when: Adding captions/subtitles to videos for TikTok/YouTube, burning in text overlays,
  or creating captioned versions for upload to social platforms.
  Do NOT use when: Creating videos from scratch, doing quality control, or writing scripts.
triggers:
  - "Add caption to video"
  - "Burn in subtitles"
  - "Create captioned version for upload"
  - "Add text overlay to video"
---

# Video Captioning Skill

## Captioning Pipeline

### Purpose
Add Vietnamese captions and text overlays to Xianxia videos before uploading to TikTok/YouTube.

### TKP ACI Standard Format

**Caption Style:**
- Font: Bold, sans-serif
- Color: White with black outline (for visibility)
- Size: Large (readable on mobile)
- Position: Bottom third (standard social media placement)

### Tools

| Tool | Use Case |
|------|----------|
| FFmpeg | Burn in captions from SRT |
| ffmpeg drawtext | Simple text overlay |
| Python moviepy | Complex animated captions |

## FFmpeg Caption Methods

### Method 1: Simple Text Overlay

```bash
ffmpeg -y \
  -i inputs/xianxia/{id}/final.mp4 \
  -vf "drawtext=text='Trieu Tien EP1':fontsize=48:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=h-100" \
  -c:a copy \
  outputs/xianxia/{id}/captioned.mp4
```

### Method 2: SRT Subtitles (Burned In)

```bash
# First create SRT file
echo '1
00:00:00,000 --> 00:00:03,000
Trieu Tien - Phần 1

2
00:00:03,000 --> 00:00:06,000
Thiếu nữ mang kiếm trời sinh
' > outputs/xianxia/{id}/caption.srt

# Burn into video
ffmpeg -y \
  -i inputs/xianxia/{id}/final.mp4 \
  -vf "subtitles=outputs/xianxia/{id}/caption.srt:force_style='FontSize=36,PrimaryColour=&HFFFFFF,BorderStyle=1'" \
  -c:a copy \
  outputs/xianxia/{id}/captioned.mp4
```

### Method 3: Dynamic Captions (Python)

For animated captions with entry animations:

```python
from moviepy.editor import *
import numpy as np

def add_captions(video_path, caption_text, output_path):
    video = VideoFileClip(video_path)

    # Create caption with animation
    txt_clip = TextClip(
        caption_text,
        fontsize=36,
        color='white',
        font='Arial-Bold',
        stroke_color='black',
        stroke_width=2
    )

    # Animate in (fade + slide up)
    txt_clip = txt_clip.set_position('center').set_duration(video.duration)
    txt_clip = txt_clip.crossfadein(0.3).crossfadeout(0.3)

    # Composite
    result = CompositeVideoClip([video, txt_clip])
    result.write_videofile(output_path, codec='libx264')
```

## Caption Templates for Xianxia

### Episode Title Cards
```text
Format: "{Series Name} - Tập {N}"
Style: Centered, large, fade in/out
Duration: 2s at start
```

### Scene Captions
```text
Format: "{Vietnamese narration excerpt}"
Style: Bottom third, left-aligned for dialogue
Duration: Match audio timing
```

### Cliffhanger Captions
```text
Format: "Tập tiếp theo..."
Style: Centered, suspenseful
Duration: 3s at end
```

### Hashtag Overlays
```text
Format: "#xianxia #phantich #drama"
Style: Small, bottom-right corner
Duration: Full video or last 10s
```

## Caption Workflow for TKP ACI

### Standard Pipeline

```
1. Nova creates: outputs/xianxia/{id}/final.mp4
        ↓
2. Production Manager adds captions
        ↓
3. Captioned video: content/videos/xianxia/{id}/captioned.mp4
        ↓
4. n8n detects and auto-uploads to TikTok
        ↓
5. Production Manager manually uploads to YouTube
```

### Caption File Naming

```
content/videos/xianxia/{id}/
├── final.mp4           # Nova's output (no captions)
├── captioned.mp4       # Production Manager's output (with captions)
└── caption.srt         # Subtitle file (if used)
```

## TikTok vs YouTube Caption Standards

| Platform | Max Caption Duration | Recommended Style |
|----------|----------------------|-------------------|
| TikTok | Full video or 10s outro | Bold, simple, mobile-readable |
| YouTube Shorts | Full video | Similar to TikTok |

## TTS Integration

MiniMax TTS narration is already added during video assembly (FFmpeg combine with narration.mp3).

Captions should match the TTS narration text for accessibility.

## Error Handling

| Problem | Solution |
|---------|----------|
| Caption not visible | Increase font size or add background box |
| Timing off | Adjust SRT timestamps |
| Encoding issues | Use UTF-8 for all text files |
| Video corruption | Re-encode from original |

## Resources

| Resource | Link |
|----------|-----|
| FFmpeg drawtext docs | https://ffmpeg.org/ffmpeg-filters.html#drawtext |
| MoviePy documentation | https://zulko.github.io/moviepy/ |
| SRT format guide | https://www.w3.org/Submission/2011/02-SUBM-SRT/ |