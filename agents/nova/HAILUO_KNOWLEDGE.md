# HAILUO AI VIDEO CREATION - NOVA KNOWLEDGE BASE
## For Browser-Based Video Generation via hailuoai.video

---

## 🎬 HAILUO MODELS & OPTIONS

### Available Models (via hailuoai.video website)

| Model | Description | Quality | Speed |
|-------|-------------|---------|-------|
| **Hailuo Max** | Highest quality, latest model, AUDIO support | ⭐⭐⭐⭐⭐ | Slow |
| **Hailuo 2.3 Standard** | Good quality, balanced | ⭐⭐⭐⭐ | Medium |
| **Hailuo 2.3 Fast** | Faster generation | ⭐⭐⭐ | Fast |

### Hailuo Max Features (PREMIUM)
- ✅ **Video Generation** - Text to video with AI
- ✅ **Audio/VOICE** - Add voiceover, background music
- ✅ **Image Generation** - Create images from text
- ✅ **Better Quality** - Latest model improvements

### API Models (for reference)
- `MiniMax-Hailuo-2.3` - 1080P, 6s or 10s
- `MiniMax-Hailuo-02` - Legacy model
- `T2V-01` / `T2V-01-Director` - Director mode

---

## 🎵 AUDIO FEATURES (Hailuo Max)

### Audio Options:
1. **Voice Over (VO)** - AI narrator voice
2. **Background Music** - AI-generated music tracks
3. **Sound Effects** - Ambient sounds

### Audio Workflow:
```
1. Generate video first
2. Add VO: Paste/transcribe script → Select voice → Generate audio
3. Add Music: Choose mood (happy, dramatic, calm) → AI generates
4. Sync: Align audio with video timing
5. Export final video with audio
```

### Voice Options:
- Multiple languages (English, Vietnamese, etc.)
- Different tones (professional, casual, dramatic)
- Male/Female voices

### Background Music Moods:
| Mood | Use For |
|------|---------|
| Epic | Dramatic moments, victories |
| Happy | Uplifting, success stories |
| Chill | Aesthetic, calm content |
| Dramatic | Tension, suspense |
| Motivational | Gym, hustle, success |
| Sad | Emotional, failure stories |

---

## 🖼️ IMAGE GENERATION (Hailuo Max)

### Image Features:
1. **Text to Image** - Create visuals from prompts
2. **Image to Video** - Animate static images
3. **Style Transfer** - Apply artistic styles

### Image Use Cases:
- **Thumbnails** - Create eye-catching thumbnails
- **Scenes** - Generate scene backgrounds
- **Characters** - Consistent character images
- **Products** - Showcase items

### Image Prompt Example:
```
Beautiful athletic girl flexing muscles in gym mirror, neon lights, dramatic pose, cinematic photography, 4K
```

---

## 🎬 MOVIE REVIEW CONTENT

### Movie Review Video Format

**Structure:**
1. **Hook** (0-3s) - "This movie broke me emotionally..."
2. **Context** (3-10s) - Movie name, genre, brief intro
3. **Spoiler-Free Review** (10-30s) - Why people should watch
4. **Spoilers** (30s+) - Plot points, twists
5. **Verdict** (10s) - Rating, recommendation

### Hailuo Video Prompts for Movie Reviews:

#### Scene 1: Emotional Reaction
```
Beautiful woman with shocked expression, sitting in dark movie theater, screen glowing behind her [Static shot]. Eyes widen, hand covers mouth [Push in on face]. Tears start forming [Close up on eyes]. Cinematic movie theater atmosphere, dramatic lighting.
```

#### Scene 2: Movie Scene Visualization
```
Epic battle scene from movie visualized, warrior fighting dragon, dramatic lighting, fire and smoke [Tracking shot following warrior]. Sword slashes through air [Push in on sword]. Dragon roars, flames engulf screen [Pull out to reveal massive battlefield]. Movie magic visualization, cinematic quality.
```

#### Scene 3: Rating/Reaction
```
Girl giving thumbs up or down, sitting at desk with laptop, Netflix open in background [Static shot]. Points to "10/10" on screen [Tracking shot following hand]. Celebrates with confetti animation [Zoom in on rating]. Cozy bedroom, fairy lights, relatable reaction video vibe.
```

### Movie Review Script Example (MOVIE-01):

```json
{
  "id": "MOVIE-01",
  "category": "movie_review",
  "channel": "TikTok_Viral",
  "title": "This movie made me cry in public 😢",
  "script": "Don't watch 'The Last of Us' in public. I repeat. DON'T. I watched it on a plane and had to pretend I had allergies. The father-daughter moment? Chef's kiss. The world building? Perfection. The mushroom zombie thing? Nightmare fuel but cool. Give it 5 years, this show wins everything.",
  "prompt_for_hailuo": "Beautiful woman sitting in airplane seat, watching tablet screen, eyes getting teary [Static shot]. Hand covers mouth, emotional [Push in on face]. Wipes tears discreetly [Close up on hand]. Airplane cabin dimly lit, tablet screen glowing, emotional moment [Pull out to show airplane cabin]. Cinematic airplane atmosphere, dramatic lighting, relatable emotional moment.",
  "duration_seconds": 6,
  "resolution": "1080P",
  "tags": ["movie", "review", "thelastofus", "crying", "emotional", "netflix", "tvshow"],
  "thumbnail_idea": "Girl crying in airplane, Netflix show on tablet, dramatic lighting",
  "status": "pending",
  "created_by": "Content Director",
  "created_at": "2026-03-28T19:00:00Z"
}
```

### Movie Review Categories:

| Type | Example |
|------|---------|
| **Reaction** | "I watched it so you don't have to" |
| **Review** | Analysis, ratings, breakdowns |
| **Theory** | Fan theories, Easter eggs |
| **Comparison** | "Book vs Movie" |
| **Ranking** | "Top 10 movies of 2024" |
| **Recommendation** | "If you liked X, watch Y" |

---

## 📐 VIDEO SPECIFICATIONS

| Resolution | Duration Options | FPS |
|------------|------------------|-----|
| 1080P | 6s or 10s | 24 fps |
| 768P | 6s or 10s | 24 fps |
| 720P | 6s (legacy) | 24 fps |

**Recommended for TikTok/YouTube Shorts:** 1080P, 6s or 768P, 10s

---

## 🎥 CAMERA MOVEMENT COMMANDS

### 15 Supported Camera Commands

| Type | Commands | Description |
|------|----------|-------------|
| **Truck** | `[Truck left]`, `[Truck right]` | Camera moves horizontally |
| **Pan** | `[Pan left]`, `[Pan right]` | Camera rotates horizontally |
| **Push** | `[Push in]`, `[Pull out]` | Camera moves forward/backward |
| **Pedestal** | `[Pedestal up]`, `[Pedestal down]` | Camera moves up/down |
| **Tilt** | `[Tilt up]`, `[Tilt down]` | Camera rotates vertically |
| **Zoom** | `[Zoom in]`, `[Zoom out]` | Lens zoom only |
| **Shake** | `[Shake]` | Camera shake effect |
| **Follow** | `[Tracking shot]` | Camera follows subject |
| **Static** | `[Static shot]` | No camera movement |

---

## 🚀 WORKFLOW FOR NOVA - BROWSER VIDEO CREATION

### Step-by-Step Process

```
STEP 1: READ SCRIPT
    ↓
STEP 2: LOGIN TO HAILUO (hailuoai.video)
    ↓
STEP 3: CREATE VIDEO
    - Select Model: "Hailuo Max" (has audio!)
    - Paste prompt
    - Set duration/resolution
    ↓
STEP 4: ADD AUDIO (if Hailuo Max)
    - Add VO: Paste script text
    - Add Background Music
    ↓
STEP 5: WAIT FOR GENERATION
    ↓
STEP 6: DOWNLOAD VIDEO
    ↓
STEP 7: UPLOAD YOUTUBE/TIKTOK
    ↓
STEP 8: UPDATE STATUS
```

---

## 💡 PRO TIPS

### For Movie Reviews:
1. Use **Hailuo Max** for audio voice-over
2. Generate **movie scenes** as visuals
3. Create **reaction shots** separately
4. Combine in FFmpeg for final video
5. Add subtitles for engagement

### For Audio:
1. Use voice VO for narration
2. Match music mood to content
3. Keep VO under 30 seconds for Shorts

### For Thumbnails:
1. Generate with Hailuo Image
2. Add text overlay with FFmpeg
3. Use bright, emotional expressions

---

## 🎯 CONTENT ROTATION

| Day | Category | Examples |
|-----|----------|----------|
| Mon | 🔥 Hot Girl Fitness | Gym, dance, yoga |
| Tue | 🤖 Tech & AI | Robots, futuristic |
| Wed | 💅 Lifestyle | Routines, food, travel |
| Thu | 😂 Comedy | Relatable moments |
| Fri | 💪 Motivation | Success, hustle |
| Sat | 🎬 Movie Review | Reactions, reviews |
| Sun | 🌅 Aesthetic | Calm, relaxing vibes |

---

## 📝 EXAMPLE SCRIPTS

### Script Format (pending/{id}.json)
```json
{
  "id": "MOVIE-01",
  "category": "movie_review",
  "channel": "TikTok_Viral",
  "title": "This movie made me cry in public",
  "script": "Don't watch 'The Last of Us' in public...",
  "prompt_for_hailuo": "Beautiful woman in airplane, emotional reaction...",
  "duration_seconds": 6,
  "resolution": "1080P",
  "tags": ["movie", "review", "crying"],
  "audio_vo": "Paste narration script here",
  "audio_music": "chill",
  "status": "pending"
}
```

---

*Last Updated: 2026-03-28*
*Version: 2.0*
*Owner: Nova (Browser Operator - Hailuo AI)*
