# 🎬 PROFESSIONAL VIDEO PRODUCTION PIPELINE
## OpenClaw Browser Tool - Full Workflow

---

## OVERVIEW

```
IDEA → SCRIPT → VISUAL → AUDIO → EDIT → EXPORT
  ↓        ↓        ↓        ↓       ↓       ↓
Story  Prompt   Scene   Voice  Timeline  Video
```

---

## 6 PROFESSIONAL PRODUCTION STEPS

### STEP 1: IDEA (5 min)
**Objective:** Define concept, mood, message

| Field | Example |
|-------|---------|
| **Hook** | "What makes viewers stop scrolling?" |
| **Story Arc** | Problem → Action → Result |
| **Emotion** | Joy, Surprise, Awe, Tension |
| **Duration** | 6s, 15s, 30s, 60s |
| **Platform** | TikTok, YouTube Short, Reels |

**Output:** Concept document with:
- Hook statement
- 3 key moments
- Call-to-action

---

### STEP 2: SCRIPT (10 min)
**Objective:** Write dialogue/narration + shot list

```json
{
  "id": "TECH-01",
  "category": "tech_ai",
  "concept": "AI replaces designers in 2025",
  "hook": "Your designer job will be gone by 2026. Here's why...",
  "duration_seconds": 6,
  
  "shots": [
    {
      "time": "0-1s",
      "visual": "Designer at desk, frustrated, looking at AI output",
      "camera": "[Push in] Close-up on frustrated face",
      "narration": "This designer just lost their job to AI."
    },
    {
      "time": "1-3s", 
      "visual": "AI generating designs rapidly",
      "camera": "[Tracking shot] Following AI cursor movement",
      "narration": "While AI creates 100 designs in seconds."
    },
    {
      "time": "3-5s",
      "visual": "Designer learning new AI tools",
      "camera": "[Pull out] Reveal training room",
      "narration": "But the smart ones are learning AI."
    },
    {
      "time": "5-6s",
      "visual": "Designer with new AI assistant",
      "camera": "[Static] Confident smile",
      "narration": "Adapt or become obsolete."
    }
  ],
  
  "narration": "This designer just lost their job to AI. While AI creates 100 designs in seconds. But the smart ones are learning AI. Adapt or become obsolete.",
  
  "sound_design": {
    "bg_music": "upbeat tech | emotional piano",
    "sfx": "keyboard typing | notification ping",
    "timing": "SFX on cut points"
  }
}
```

---

### STEP 3: VISUAL GENERATION (2-5 min/video)
**Tool:** Hailuo AI Video (Veo 3.1, Cheap, etc.)

**IMPORTANT:** Hailuo page uses Slate editor for prompt input, NOT textarea.

**Workflow:**
```javascript
// 1. Open Hailuo
browser(action="open", profile="user")
browser(action="navigate", url="https://hailuoai.video/create/text-to-video")

// 2. Wait for Slate editor to load
//    Selector: [data-slate-editor="true"]

// 3. Generate each shot
for (shot of shots) {
    // Click Slate editor to focus
    browser(action="act", kind="click", ref="[data-slate-editor=\"true\"]")

    // Select all and clear
    browser(action="act", kind="press", key="Control+a")
    browser(action="act", kind="press", key="Backspace")

    // Type prompt with camera movement
    browser(action="act", kind="type", text=shot.visual + " " + shot.camera)

    // Set duration (8s default) - click model selector first
    browser(action="act", kind="click", ref="text=Veo 3.1")
    browser(action="act", kind="click", ref="text=Cheap")  // or other model

    // Submit with Ctrl+Enter
    browser(action="act", kind="press", key="Control+Enter")

    // Wait for completion (5-10 min)
    wait_for_completion()
}

// NOTE: No "Create" button visible on page. Use Ctrl+Enter to submit.
// If "Continue with Google" modal appears, session has expired.
```

**Hailuo Selectors (verified 2026-03-29):**
| Element | Selector |
|---------|----------|
| Prompt input | `[data-slate-editor="true"]` |
| Model selector | `text=Veo 3.1` (click to expand) |
| Model options | `text=Cheap`, `text=4K`, `text=Audio` |
| Settings | `text=16:9`, `text=720p`, `text=8s` |
| Submit | `Control+Enter` keyboard shortcut |

**Camera Movements Reference:**
| Code | Effect |
|------|--------|
| `[Push in]` | Zoom toward subject |
| `[Pull out]` | Zoom away from subject |
| `[Pan left]` | Move camera left |
| `[Pan right]` | Move camera right |
| `[Tilt up]` | Tilt camera up |
| `[Tilt down]` | Tilt camera down |
| `[Tracking shot]` | Follow subject |
| `[Static]` | No movement |

---

### STEP 4: AUDIO PRODUCTION (3-5 min)
**Tool:** MiniMax TTS + Sound Effects

**Audio Components:**
1. **Narration** - Main voiceover (MiniMax TTS)
2. **Background Music** - Mood music (royalty-free)
3. **SFX** - Sound effects at cut points

```javascript
// TTS Generation
const ttsResponse = await fetch('https://api.minimax.io/v2/t2a_v2', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + MINIMAX_API_KEY,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        model: 'speech-02-hd',
        text: narration,
        voice_setting: {
            voice_id: 'male_qingse',
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

---

### STEP 5: EDITING (10-15 min)
**Tool:** FFmpeg + Manual timeline

**Timeline Structure:**
```
| 0s    | 1s    | 2s    | 3s    | 4s    | 5s    | 6s    |
|--------|--------|--------|--------|--------|--------|--------|
| SHOT1 | SHOT2 | SHOT3 | SHOT4 |       |       |       |
|--------|--------|--------|--------|--------|--------|--------|
|=====NARRATION WAVEFORM===============================|
|--------|--------|--------|--------|--------|--------|--------|
|  🎵   |   🎵   |   🎵   |   🎵   |       |       |       |
|--------|--------|--------|--------|--------|--------|--------|
|  SFX  |       |   SFX  |       |       |       |       |
```

**FFmpeg Commands:**
```bash
# 1. Concatenate shots (with correct order)
ffmpeg -y -f concat -safe 0 -i shots.txt \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libx264 -preset fast -crf 20 \
  video_only.mp4

# 2. Add narration (aligned to timeline)
ffmpeg -y -i video_only.mp4 -i narration.mp3 \
  -map 0:v -map 1:a \
  -c:v copy -c:a aac -shortest \
  video_with_audio.mp4

# 3. Add background music (ducking)
ffmpeg -y -i video_with_audio.mp4 -i bg_music.mp3 \
  -filter_complex "[1:a]volume=0.3[music];[0:a][music]amix=inputs=2:duration=longest[aout]" \
  -map 0:v -map "[aout]" \
  final_video.mp4

# 4. Add SFX at specific timestamps
ffmpeg -y -i final_video.mp4 -i sfx_notification.mp3 \
  -filter_complex "[1:a]adelay=2000|2000[sync]" \
  -map 0:v -map 0:a -map "[sync]" \
  -c:v copy -c:a aac \
  output_final.mp4
```

---

### STEP 6: EXPORT & UPLOAD (5 min)

**YouTube Upload:**
```javascript
browser(action="open", profile="user")
browser(action="navigate", url="https://studio.youtube.com")

// Fill metadata
browser(action="act", kind="click", ref="[file-input]")  
// Upload video file

browser(action="act", kind="type", text="TITLE", ref="[title-input]")
browser(action="act", kind="type", text="DESCRIPTION", ref="[desc-input]")
browser(action="act", kind="type", text="ai, technology, future", ref="[tags-input]")

// Set visibility
browser(action="act", kind="click", ref="[visibility-select]")
browser(action="act", kind="click", ref="[option:Public]")

// Publish
browser(action="act", kind="click", ref="[button:Publish]")
```

**TikTok Upload:**
```javascript
browser(action="navigate", url="https://www.tiktok.com/upload")
browser(action="act", kind="click", ref="[upload-button]")

// Wait for processing
sleep(30000)

// Add caption
browser(action="act", kind="type", text="#fyp #ai #tech #2025", ref="[caption-input]")

// Post
browser(action="act", kind="click", ref="[button:Post]")
```

---

## 📊 PRODUCTION TIMELINE

| Step | Time | Tool |
|------|------|------|
| 1. Idea | 5 min | Brain |
| 2. Script | 10 min | ChatGPT/Claude |
| 3. Visual | 2-5 min x 4 shots | Hailuo AI |
| 4. Audio | 3-5 min | MiniMax TTS |
| 5. Edit | 10-15 min | FFmpeg |
| 6. Export | 5 min | Browser |
| **Total** | **40-60 min** | **1 video** |

---

## 🎯 QUALITY CHECKLIST

- [ ] Video plays smoothly (no lag)
- [ ] Shots match narration timing
- [ ] Audio levels balanced (voice > music > SFX)
- [ ] Camera movements smooth
- [ ] No abrupt cuts
- [ ] Hook grabs attention in 1st second
- [ ] CTA at end
- [ ] File size optimized (<50MB for TikTok)
- [ ] Aspect ratio correct (9:16 for TikTok/Reels)

---

## 🔧 AUTOMATION LEVELS

### Level 1: Manual Everything
- Human does all steps
- OpenClaw only for uploads

### Level 2: Semi-Automated
- OpenClaw generates visuals via Hailuo
- Human edits/timeline
- OpenClaw uploads

### Level 3: Mostly Automated
- OpenClaw generates visuals + audio
- Human reviews timeline
- OpenClaw exports/uploads

### Level 4: Fully Automated (Target)
- OpenClaw does everything end-to-end
- Human only approves final

---

## 📁 OUTPUT STRUCTURE

```
project/
├── concept.json          # Step 1 output
├── script.json          # Step 2 output
├── shots/
│   ├── shot_001.mp4    # Generated visuals
│   ├── shot_002.mp4
│   ├── shot_003.mp4
│   └── shot_004.mp4
├── audio/
│   ├── narration.mp3    # TTS
│   ├── bg_music.mp3    # Background music
│   └── sfx/           # Sound effects
├── timeline/
│   └── timeline.json   # Edit decision list
└── exports/
    ├── draft_v1.mp4    # Review version
    └── final.mp4       # Final upload
```

---

## 🚀 NEXT: SCRIPT TEMPLATE

Each video script should follow this format:

```json
{
  "id": "VIDEO-01",
  "category": "trending_aesthetic",
  
  "concept": {
    "hook": "One-sentence hook",
    "story_arc": "Problem → Action → Result",
    "emotion": "Joy | Surprise | Awe | Tension",
    "duration": 6,
    "platform": "TikTok"
  },
  
  "shots": [
    {
      "time_start": 0,
      "time_end": 1.5,
      "prompt": "Visual description + Camera movement",
      "camera": "[CODE]",
      "narration": "Narration text for this shot"
    }
  ],
  
  "audio": {
    "narration": "Full narration script",
    "bg_music": "music description or URL",
    "sfx": ["sfx at 2s", "sfx at 4s"]
  },
  
  "metadata": {
    "title": "YouTube title",
    "description": "YouTube description",
    "tags": ["tag1", "tag2", "tag3"],
    "caption": "TikTok caption with hashtags"
  }
}
```
