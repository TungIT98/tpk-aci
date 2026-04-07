# TKP Video Studio System

> Complete production studio documentation for TKP Content Agency.
> Created for TKP-50 (Build Complete Video Studio Production System).
> Supersedes individual pipeline docs — this is the authoritative source.

---

## System Overview

The TKP Studio System is a fully automated, zero-human video production pipeline targeting 1,000 videos across TikTok, YouTube Shorts, Instagram Reels, and LinkedIn.

**Pipeline flow:**

```
Script (AI-generated)
    │
    ▼
TTS Audio (ElevenLabs / MiniMax)     ← lib/tts.js
    │
    ▼
Hailuo Video (MiniMax film.03)       ← lib/hailuo.js
    │
    ▼
Image Pipeline (thumbnails + B-roll)  ← lib/image.js
    │
    ▼
Audio Pipeline (Whisper + mixing)    ← lib/audio.js
    │
    ▼
Video Assembly (FFmpeg)               ← lib/edit/video-editor.js
    │
    ▼
QC Gate                              ← content/qc-checklist.md
    │
    ▼
Platform Export (9:16 / 16:9)        ← lib/video-pipeline.js
    │
    ▼
Auto-Upload                          ← lib/upload/*.js
```

**Output specs:**
- Productivity channel: 16:9 (YouTube), 1080×1920 9:16 (TikTok/Shorts)
- Growth channel: 9:16 primary (TikTok/Reels), 16:9 for YouTube
- Codec: H.264, AAC 48kHz, CRF 18 (YouTube), CRF 20 (Shorts)
- Frame rate: 30fps (Productivity), 60fps (Growth)

---

## Directory Structure

```
TKP_ACI/
├── assets/
│   ├── logos/               ← tkp-watermark-prod.svg, tkp-watermark-growth.svg
│   ├── thumbnails/           ← Generated per video
│   │   ├── productivity/
│   │   └── growth/
│   ├── broll/               ← Pexels/Pexels-free B-roll clips
│   │   └── raw/
│   ├── music/               ← Royalty-free music library
│   │   ├── productivity/    ← 60–80 BPM instrumental
│   │   └── growth/          ← 100–130 BPM instrumental
│   ├── stock-images/        ← Pixabay/Pexels images for thumbnails
│   └── subtitles/           ← .ass subtitle files
├── lib/
│   ├── hailuo.js            ← Video generation (MiniMax film.03)
│   ├── tts.js               ← TTS (ElevenLabs + MiniMax)
│   ├── image.js             ← Image pipeline (thumbnails + B-roll)
│   ├── audio.js             ← Audio pipeline (Whisper + mixing)
│   ├── ffmpeg-pro.js        ← FFmpeg production utilities
│   ├── prompts.js           ← Prompt engineering templates
│   ├── edit/
│   │   ├── video-editor.js  ← FFmpeg video editing
│   │   └── index.js
│   ├── upload/
│   │   ├── tiktok.js
│   │   ├── youtube.js
│   │   ├── instagram.js
│   │   └── linkedin.js
│   ├── production/
│   │   └── queue-manager.js ← Production queue
│   └── video-pipeline.js    ← Full orchestrator
├── scripts/
│   ├── hailuo-test.js
│   ├── qc-check.js          ← Automated QC gate
│   ├── queue-add.js
│   ├── studio-automation.js ← Cron-based night rendering
│   └── publish.js
├── output/                   ← Rendered videos (per channel)
│   ├── productivity/
│   └── growth/
├── uploads/                  ← Final exports per platform
│   └── README.md
├── content/
│   ├── studio-system.md     ← THIS FILE
│   ├── video-editing-workflow.md
│   ├── qc-checklist.md
│   ├── thumbnail-design-system.md
│   └── brand-identity.md
└── logs/
    └── hailuo-costs.md
```

---

## 1. Image Processing Pipeline

**Owner:** `lib/image.js`

### 1.1 Thumbnail Generation

Uses Jimp (pure Node.js, no native deps) for thumbnail generation.

**Thumbnail specs per channel:**

| Element | Productivity | Growth |
|---------|-------------|--------|
| Resolution | 1280×720 (16:9) | 1080×1920 (9:16) |
| Background | `#F8F7F4` off-white | `#111827` deep black |
| Primary text | `#1A2744` navy | `#FFFFFF` white |
| Accent | `#C9A84C` gold | `#7C3AED` violet / `#FF6B6B` coral |
| Font | DM Sans Bold | Bebas Neue |
| Max text | 4 words | 4 words |

See `content/thumbnail-design-system.md` for full design specs.

**Generating a thumbnail:**
```javascript
import { ThumbnailGenerator } from './lib/image.js';

const thumb = new ThumbnailGenerator('growth');

// Generate 16:9 YouTube thumbnail
const file = await thumb.generate({
  channel: 'growth',
  headline: 'I Made $10K in 30 Days',
  subtext: 'here\'s exactly how',
  background: '#111827',
  format: '16:9',
  outputPath: 'assets/thumbnails/growth/tkpg-001.png',
});

// Generate 9:16 TikTok thumbnail
const tiktokThumb = await thumb.generate({
  channel: 'growth',
  headline: 'SECRETS',
  subtext: 'they don\'t want you to know',
  format: '9:16',
  outputPath: 'assets/thumbnails/growth/tkpg-001-tiktok.png',
});
```

### 1.2 B-Roll / Stock Image Integration

Uses Pexels API for B-roll footage and stock images.

**Setup:** Add to `.env`:
```
PEXELS_API_KEY=your_pexels_api_key
PIXABAY_API_KEY=your_pixabay_api_key
```

**Searching for B-roll:**
```javascript
import { StockMedia } from './lib/image.js';

const stock = new StockMedia();

// Find B-roll for "office workspace productivity"
const clips = await stock.searchVideos('office workspace focus', {
  orientation: 'portrait', // for 9:16
  per_page: 5,
});

// Download best clip
const clipPath = await stock.downloadVideo(clips[0].id, 'assets/broll/raw/clip1.mp4');
```

**Searching for stock images (thumbnail backgrounds):**
```javascript
// Find background image for productivity thumbnail
const images = await stock.searchImages('minimal desk setup warm lighting', {
  orientation: 'landscape',
  per_page: 10,
});

const bgPath = await stock.downloadImage(images[0].id, 'assets/stock-images/desk_bg.jpg');
```

### 1.3 Image Processing (resize, crop, color grading)

```javascript
import { ImageProcessor } from './lib/image.js';

const processor = new ImageProcessor();

// Resize to exact dimensions
await processor.resize('assets/stock-images/desk_bg.jpg', 'output/thumb_bg.jpg', {
  width: 1280,
  height: 720,
  fit: 'cover',
});

// Crop to 9:16 from center
await processor.crop('output/thumb_bg.jpg', 'output/thumb_cropped.jpg', {
  aspectRatio: '9:16',
  position: 'center',
});

// Apply color grade preset
await processor.colorGrade('output/thumb_cropped.jpg', 'output/thumb_graded.jpg', {
  preset: 'productivity', // or 'growth'
  // productivity: warm, +10 brightness, slight contrast boost
  // growth: high contrast, slight desaturation, +15 vibrance
});
```

---

## 2. Audio Processing Pipeline

**Owner:** `lib/audio.js`

### 2.1 TTS Generation

See `lib/tts.js` for full documentation.

```javascript
import { TTSProvider } from './lib/tts.js';

const tts = new TTSProvider();

// Productivity channel — calm professional voice
const audioProd = await tts.speakForChannel('productivity', {
  text: scriptText,
  provider: 'elevenlabs', // or 'auto'
});

// Growth channel — energetic Gen Z voice
const audioGrowth = await tts.speakForChannel('growth', {
  text: scriptText,
  provider: 'auto',
});

// Save to file
import { writeFileSync } from 'fs';
writeFileSync('output/audio/tkpg-001-tts.mp3', audioProd);
```

### 2.2 Whisper Auto-Transcription

When TTS word-level timestamps are not available (e.g., from a video source), Whisper generates subtitle files automatically.

**Setup:** Add to `.env`:
```
OPENAI_API_KEY=sk-...   # For Whisper API
# OR use local Whisper:
WHISPER_MODEL_PATH=./models/whisper-small.bin
```

**Generating subtitles from audio:**
```javascript
import { WhisperTranscriber } from './lib/audio.js';

const whisper = new WhisperTranscriber();

// Transcribe audio file → get word timings
const result = await whisper.transcribe('output/audio/tkpg-001-tts.mp3', {
  language: 'en',
  model: 'whisper-1', // or 'whisper-small' for local
});

// result.wordTimings = [{ word: 'Hello', start: 0.0, end: 0.45 }, ...]
// result.text = 'Hello world ...'

// Generate .ASS subtitle file
await whisper.toASS(result.wordTimings, 'assets/subtitles/tkpg-001.ass', {
  format: 'srt',    // or 'ass'
  maxWordsPerCue: 8, // max words per subtitle line
  style: {          // ASS style overrides
    fontSize: 28,
    primaryColour: '&H00FFFFFF', // white
    outlineColour: '&H00000000', // black outline
  },
});
```

### 2.3 Audio Mixing

Mixes TTS audio with background music at brand-compliant volumes.

```javascript
import { AudioMixer } from './lib/audio.js';

const mixer = new AudioMixer();

// Layer music under TTS at 15% volume (Productivity) or 12% (Growth)
const mixed = await mixer.mixVoiceAndMusic({
  voicePath: 'output/audio/tkpg-001-tts.mp3',
  musicPath: 'assets/music/growth/growth_energy_118bpm.mp3',
  musicVolume: 0.12,      // 12% for Growth channel
  fadeOutSeconds: 3,     // Music fades out at end
  outputPath: 'output/audio/tkpg-001-mixed.mp3',
});

// Audio levels check (LUFS measurement)
const levels = await mixer.measureLevels('output/audio/tkpg-001-mixed.mp3');
// levels.integratedLUFS = -14  (should be -16 to -10 for YouTube)
// levels.truePeak = -2.1       (should be < -1dB)
```

**Music volume rules:**
- Productivity: 15% music, speech dominant
- Growth: 12% music, maximum energy

---

## 3. Video Assembly Pipeline

**Owner:** `lib/edit/video-editor.js` + `lib/ffmpeg-pro.js`

### 3.1 FFmpeg Requirements

FFmpeg must be installed for all video processing. See `content/video-editing-workflow.md` for FFmpeg command reference.

**Installation:**
- macOS: `brew install ffmpeg`
- Linux: `apt install ffmpeg`
- Windows: Download from https://ffmpeg.org/download.html

**Verify installation:**
```bash
ffmpeg -version  # Should show libx264 support
```

### 3.2 Full Video Assembly

```javascript
import { VideoAssemblyLine } from './lib/ffmpeg-pro.js';

const assembly = new VideoAssemblyLine({
  channel: 'growth',
  outputDir: 'output/growth',
  tempDir: 'output/_temp',
});

// Run full assembly pipeline
const result = await assembly.assemble({
  videoClips: [
    { path: 'assets/broll/raw/scene1.mp4', start: 2, end: 8 },
    { path: 'assets/broll/raw/scene2.mp4', start: 1, end: 6 },
  ],
  audioPath: 'output/audio/tkpg-001-mixed.mp3',
  subtitlePath: 'assets/subtitles/tkpg-001.ass',
  musicPath: 'assets/music/growth/growth_energy_118bpm.mp3',
  transition: 'dissolve',  // 'dissolve' | 'fade' | 'cut'
  transitionDuration: 0.5, // seconds
  outputBasename: 'tkpg-001',
});

// result.masterFile  = 'output/growth/tkpg-001_master.mp4'
// result.youtubeFile = 'output/growth/tkpg-001_youtube.mp4'
// result.tiktokFile  = 'output/growth/tkpg-001_tiktok.mp4'
```

### 3.3 Subtitles

Subtitles are burned into the video as hard-coded captions (required for TikTok/Reels — soft subs are not reliably displayed).

**Subtitle styling:**

| Channel | Font | Size | Color | Border |
|---------|------|------|-------|--------|
| Productivity | Arial | 28px | White | Black |
| Growth | Arial | 32px | White | Black |

```javascript
// Burn subtitles using ASS file
await assembly.burnSubtitles({
  input: result.masterFile,
  subtitleFile: 'assets/subtitles/tkpg-001.ass',
  output: result.masterFile, // overwrites
  style: {
    fontSize: 32,        // Growth: 32, Productivity: 28
    fontColour: 'white',
    outlineColour: 'black',
    marginL: 40,
    marginR: 40,
    alignment: 2,         // bottom center
  },
});
```

### 3.4 Watermark

```javascript
await assembly.addWatermark({
  input: result.masterFile,
  logo: 'assets/logos/tkp-watermark-growth.svg',
  position: 'bottom-left',
  padding: 20,
  opacity: 0.10,
  output: result.masterFile,
});
```

---

## 4. Prompt Engineering System

**Owner:** `lib/prompts.js`

### 4.1 Hailuo Video Prompts

See `lib/hailuo.js` `PROMPT_TEMPLATES` for existing templates.

Additional structured prompt builder:

```javascript
import { PromptBuilder } from './lib/prompts.js';

const pb = new PromptBuilder('growth');

// Build full video prompt from script
const prompt = pb.buildHailuoPrompt({
  script: scriptText,
  scene: 'intro',  // 'intro' | 'body' | 'hook' | 'cta' | 'broll'
  style: 'energetic',
  constraints: {
    aspectRatio: '9:16',
    duration: 6,  // seconds per clip
    includeText: false,
  },
});
// → 'Fast-paced cuts, phone screen, coffee shop...'
```

### 4.2 Thumbnail Prompt Engineering

```javascript
// Generate DALL-E or Stable Diffusion prompt from headline
const thumbPrompt = pb.buildThumbnailPrompt({
  channel: 'growth',
  headline: 'I Made $10K in 30 Days',
  subtext: 'here\'s exactly how',
  style: 'high-contrast',
});
// → 'Deep black background (#111827), bold white text overlay,
//    I Made $10K in 30 Days, electric violet accent bar,
//    high energy, zoomorphic, 4K, cinematic lighting'
```

### 4.3 Style Consistency Guide

**Productivity channel style rules:**
- Visual: Clean workspace, natural lighting, slow camera pushes
- Tone: Calm, professional, warm — no hype
- Colors: Navy `#1A2744`, gold `#C9A84C`, off-white `#F8F7F4`
- Pacing: 150 words/min — measured, confident

**Growth channel style rules:**
- Visual: Fast cuts, phone screens, high energy, close-up reactions
- Tone: Punchy, Gen Z-native, direct — no corporate speak
- Colors: Black `#111827`, violet `#7C3AED`, coral `#FF6B6B`
- Pacing: 180 words/min — energetic, fast

---

## 5. Workflow Automation

**Owner:** `scripts/studio-automation.js` + `lib/production/queue-manager.js`

### 5.1 Night Rendering Queue

For CPU-intensive renders that should run overnight:

```bash
# Add a video to the night queue
node scripts/queue-add.js \
  --channel growth \
  --script "output/scripts/tkpg-042.txt" \
  --priority high

# Run the night automation script (call via cron at 10pm)
node scripts/studio-automation.js --mode night-render
```

### 5.2 Full Auto-Production (Single Video)

```javascript
import { StudioAutomation } from './scripts/studio-automation.js';

const studio = new StudioAutomation({
  channel: 'growth',
  outputDir: 'output/growth',
  apiKeys: {
    pexels: process.env.PEXELS_API_KEY,
    elevenlabs: process.env.ELEVENLABS_API_KEY,
    minimax: process.env.ANTHROPIC_TOKEN_KEY,
  },
});

// Run one complete video
const result = await studio.produceVideo({
  topic: 'Why Your Morning Routine Is Killing Your Productivity',
  angle: 'actionable framework',
  preset: 'standard',  // 'fast' for preview, 'standard' for production
  autoUpload: false,    // set true to auto-upload after QC
});

console.log(result);
// {
//   status: 'ready_for_qc',
//   videoFile: 'output/growth/tkpg-042_tiktok.mp4',
//   thumbnail: 'assets/thumbnails/growth/tkpg-042.png',
//   qcReport: { ... }
// }
```

### 5.3 QC Gate (Automated)

Before any video is marked ready, automated QC runs:

```javascript
import { runAutoQC } from './scripts/qc-check.js';

const qc = await runAutoQC({
  videoFile: result.videoFile,
  audioFile: result.audioFile,
  metadata: {
    title: result.title,
    description: result.description,
    channel: 'growth',
  },
});

if (!qc.pass) {
  console.error('QC FAILED:', qc.failures);
  // Send notification — do not upload
} else {
  console.log('QC PASSED — ready to upload');
}
```

**Automated QC checks:**
- Video exists and is readable
- Duration within platform limits (TikTok: ≤287MB / 10min; YouTube: ≤256GB)
- Aspect ratio matches channel spec
- Audio present and > 5 seconds
- No encoding errors in FFmpeg output

### 5.4 Auto-Publishing Schedule

Videos are uploaded via `lib/upload/*.js` on schedule:

| Channel | Platform | Cadence | Best Time (ET) |
|---------|----------|---------|----------------|
| TKP Productivity | YouTube | Daily | 9:00 AM |
| TKP Productivity | TikTok | 3×/week | 12:00 PM |
| TKP Growth | TikTok | Daily | 7:00 PM |
| TKP Growth | Instagram | 3×/week | 7:30 PM |
| TKP Growth | LinkedIn | 2×/week | 8:00 AM |

---

## 6. Asset Library

### 6.1 Music Library

```
assets/music/
├── productivity/
│   ├── productivity_calm_65bpm.mp3
│   ├── productivity_focus_72bpm.mp3
│   ├── productivity_deep_68bpm.mp3
│   └── ... (10+ tracks)
└── growth/
    ├── growth_energy_115bpm.mp3
    ├── growth_buzz_120bpm.mp3
    ├── growth_fire_128bpm.mp3
    └── ... (10+ tracks)
```

**Naming convention:** `{channel}_{mood}_{bpm}bpm.mp3`
**Sources:** Epidemic Sound, Artlist, Uppbeat, YouTube Audio Library (royalty-free)
**License:** Commercial use permitted — keep license documentation in `assets/music/_licenses/`

### 6.2 B-Roll Library

```
assets/broll/
├── raw/           ← Downloaded from Pexels/Pixabay
├── processed/     ← Trimmed and color-graded
└── categories/
    ├── workspace/
    ├── lifestyle/
    ├── tech/
    └── abstract/
```

**Search and download:**
```javascript
import { StockMedia } from './lib/image.js';
const stock = new StockMedia();

// Batch download category
await stock.batchDownload('workspace focus concentration', {
  orientation: 'portrait',
  count: 10,
  outputDir: 'assets/broll/categories/workspace/',
});
```

### 6.3 Logo Assets

```
assets/logos/
├── tkp-productivity-pfp.svg   ← Profile picture
├── tkp-productivity-banner.svg
├── tkp-watermark-prod.svg    ← Watermark overlay (low opacity)
├── tkp-growth-pfp.svg
├── tkp-growth-banner.svg
└── tkp-watermark-growth.svg
```

---

## 7. Setup Checklist

Complete this checklist before first production run:

### APIs Required

- [ ] **MiniMax/Hailuo** — Set `ANTHROPIC_TOKEN_KEY` in `.env` (video generation)
- [ ] **ElevenLabs** — Set `ELEVENLABS_API_KEY` in `.env` (TTS, Vietnamese voice)
- [ ] **OpenAI** — Set `OPENAI_API_KEY` in `.env` (Whisper transcription)
- [ ] **Pexels** — Set `PEXELS_API_KEY` in `.env` (B-roll and stock images)
- [ ] **Pixabay** — Set `PIXABAY_API_KEY` in `.env` (backup stock media)

### Software Required

- [ ] **FFmpeg** — Installed and on PATH (`ffmpeg -version`)
- [ ] **Node.js** — ≥ 18 (`node --version`)
- [ ] **ImageMagick** — Optional, for advanced thumbnail text rendering

### Asset Preparation

- [ ] **Music library** — 10+ royalty-free tracks per channel in `assets/music/`
- [ ] **Logo files** — All 6 logo assets in `assets/logos/`
- [ ] **B-roll library** — Initial batch of 20+ clips in `assets/broll/`
- [ ] **Watermark SVG** — Positioned and sized correctly per channel

### Directory Setup

- [ ] `output/productivity/` and `output/growth/` directories created
- [ ] `assets/thumbnails/productivity/` and `assets/thumbnails/growth/` created
- [ ] `assets/subtitles/` created

### First Video Test

- [ ] Run `node scripts/hailuo-test.js` to verify Hailuo API connectivity
- [ ] Generate one test video end-to-end with `StudioAutomation`
- [ ] Run QC checklist (`scripts/qc-check.js`)
- [ ] Manually review test video against `content/qc-checklist.md`
- [ ] Upload to TikTok/YouTube test accounts to verify playback

---

## 8. Troubleshooting

### Hailuo video generation fails
- Check `ANTHROPIC_TOKEN_KEY` is set in `.env`
- Free tier limit: 3 films/day. Use `film.03-fast` preset if quota exhausted.
- Check `logs/hailuo-costs.md` for cost tracking

### FFmpeg errors
- Ensure FFmpeg has `libx264` and `libass` codecs: `ffmpeg -formats | grep264`
- On Windows, ensure FFmpeg is on PATH

### TTS audio is truncated or silent
- ElevenLabs: Check API key has credits
- MiniMax: Verify `MINIMAX_BASE_URL` is correct
- Check audio buffer size: should be > 5KB for a 10-second clip

### Thumbnails look wrong
- Verify channel identity colors in `lib/image.js`
- Run thumbnail generator with `debug: true` to see intermediate steps

### Upload fails
- TikTok: OAuth token may have expired — run `node scripts/oauth-tiktok.js`
- YouTube: OAuth token may have expired — run `node scripts/oauth-youtube.js`

---

---

## 9. Image-Based Video Studio (Zero-Cost Alternative)

> **Owner:** `lib/image-studio.js` + `lib/stable-diffusion.js`
> **Cost:** ~$0 per video (local RTX 5060 GPU, no API fees)
> **When to use:** When AI video generation API costs are too high, or as a parallel production track

The image-based pipeline replaces Hailuo/MiniMax video generation with local Stable Diffusion image generation + FFmpeg Ken Burns motion. It runs entirely on the local RTX 5060 GPU with no per-video API cost.

### System Overview

```
Script (AI-generated)
    │
    ▼
TTS Audio (ElevenLabs / MiniMax)     ← lib/tts.js
    │
    ▼
Script Break → Storyboard (scenes)    ← lib/image-studio.js
    │
    ▼
Stable Diffusion Images (RTX 5060)     ← lib/stable-diffusion.js
    │                                  SD WebUI (A1111) or ComfyUI
    ▼
Image → Video Clips (Ken Burns)        ← lib/image-studio.js
    │                                  FFmpeg zoompan filter
    ▼
Video Assembly (FFmpeg)                ← lib/ffmpeg-pro.js
    │                                  dissolve transitions, audio mix
    ▼
QC Gate                               ← content/qc-checklist.md
    │
    ▼
Platform Export + Upload               ← lib/video-pipeline.js + lib/upload/

Cost per video: ~$0.00 (GPU electricity only)
vs. Hailuo pipeline: ~$0.05–0.10/video
```

### Two Pipeline Tracks

| | **Hailuo Pipeline** | **Image Studio Pipeline** |
|--|--|--|
| Video source | AI-generated moving video | Generated images + motion |
| Cost | ~$0.05–0.10/video (API) | ~$0.00 (local GPU) |
| Visual quality | Cinematic film footage | AI-generated still images |
| Setup | API key only | SD WebUI + RTX GPU |
| Best for | High-production-value content | High-volume content |
| Can run together | Yes | Yes |

### Prerequisites

1. **Stable Diffusion WebUI** (recommended: AUTOMATIC1111)
   ```
   git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
   cd stable-diffusion-webui
   # Edit webui-user.bat:
   #   set COMMANDLINE_ARGS=--api --listen --xformers
   webui-user.bat
   ```
   Or **ComfyUI** (more control, better for batch workflows):
   ```
   git clone https://github.com/comfyanonymous/ComfyUI.git
   pip install -r requirements.txt
   python main.py --listen --port 8188
   ```

2. **Add to `.env`:**
   ```
   SD_WEBUI_URL=http://127.0.0.1:7860
   SD_BACKEND=webui
   # OR for ComfyUI:
   # COMFYUI_URL=http://127.0.0.1:8188
   # SD_BACKEND=comfyui
   ```

3. **FFmpeg** (already installed for Hailuo pipeline)

### Quick Start

```bash
# 1. Verify SD connectivity
node scripts/image-studio.mjs --sd-check

# 2. Preview storyboard from a script
node scripts/image-studio.mjs --storyboard --script "Your morning routine is killing your productivity..."

# 3. Generate scene images only
node scripts/image-studio.mjs --generate-images --script "..." --channel growth

# 4. Full pipeline
node scripts/image-studio.mjs --produce \
  --topic "Why Your Morning Routine Is Killing You" \
  --channel growth \
  --script "In this video..." \
  --audio output/audio/track.mp3 \
  --music assets/music/growth/track.mp3

# 5. System pre-flight check
node scripts/image-studio.mjs --preflight
```

### Storyboard & Scene Breakdown

```javascript
import { ImageStudio, breakIntoScenes } from './lib/image-studio.js';

const studio = new ImageStudio({ channel: 'growth' });

// Preview scene breakdown without generating anything
const storyboard = await studio.createStoryboard(script);
// → [{ sceneId: 'scene_000', scriptSegment: '...', visualNote: '...', type: 'hook' }]
```

**Scene types:** `hook` (first 15% of script), `body` (middle), `cta` (last 10%)

### Stable Diffusion Configuration

```javascript
import { StableDiffusionGenerator, buildSDPrompt, SD_CHANNEL_PRESETS } from './lib/stable-diffusion.js';

const sd = new StableDiffusionGenerator(); // reads .env

// Check connectivity
const health = await sd.healthCheck();
if (!health.ok) throw new Error('SD not reachable');

// Generate one image
const path = await sd.txt2img({
  prompt:        'minimal desk setup, warm lighting, 4k',
  negativePrompt: 'text, watermark, blurry, cartoon',
  width:         1080,
  height:        1920,
  steps:         25,
  cfgScale:      7.0,
  sampler:       'DPM++ 2M Karras',
  outputPath:    'assets/sd-images/scene_001.png',
});

// Batch generate a full storyboard
const scenePrompts = [
  { prompt: 'hero shot, clean workspace', aspectRatio: '9:16' },
  { prompt: 'phone screen closeup', aspectRatio: '9:16' },
];
const paths = await sd.batchGenerateScenes(scenePrompts, { channel: 'growth', concurrency: 2 });
```

**Channel presets:**

| Setting | Productivity | Growth |
|---------|-------------|--------|
| Style | Clean, warm, film grain | Cinematic, high contrast |
| Steps | 25 | 30 |
| CFG Scale | 7.0 | 8.5 |
| Sampler | DPM++ 2M Karras | DPM++ SDE Karras |
| Portrait | 1080×1920 | 1080×1920 |

### Ken Burns Motion

Generated images are converted to video clips using FFmpeg zoompan — no extra AI needed.

```javascript
// Each scene image → video clip with cinematic motion
const clipPath = await studio.imageToClip(imagePath, durationSec, {
  motion: 'zoom-in',  // 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static'
});
```

Motions are automatically varied across scenes for visual interest.

### Full Production Example

```javascript
import { ImageStudio } from './lib/image-studio.js';

const studio = new ImageStudio({ channel: 'growth' });

const result = await studio.produceVideo({
  script:       'Your morning routine is killing your productivity...',
  wordTimings,  // from TTSProvider.speakForChannel()
  audioPath:    'output/audio/track.mp3',
  musicPath:    'assets/music/growth/track.mp3',
  topic:        'Why Your Morning Routine Is Killing You',
  aspectRatio:  '9:16',
});

console.log(result.masterFile);   // full-quality master
console.log(result.tiktokFile);  // TikTok-optimized export
console.log(result.youtubeFile);  // YouTube Shorts export
console.log(result.qcPassed);    // true if file exists
```

### Troubleshooting

**SD WebUI not responding:**
- Ensure WebUI launched with `--api` flag
- Check `SD_WEBUI_URL` in `.env` matches the port WebUI is running on
- Common ports: 7860 (WebUI), 8188 (ComfyUI), 7861 (Forge)

**Out of memory (OOM):**
- Reduce `concurrency` in `batchGenerateScenes()` from 2 to 1
- Use lower resolution drafts first, then full-res in final assembly
- RTX 5060 8GB: generate at 512×512 for drafts, 1080×1920 for final

**ComfyUI timeout:**
- Increase `SD_TIMEOUT_MS` in `.env` (default: 300000 = 5 min)
- Some SDXL models take 2-3 min per image

---

## Quick Reference

| Script | Purpose |
|--------|---------|
| `scripts/hailuo-test.js` | Test Hailuo API connectivity |
| `scripts/qc-check.js` | Run automated QC on a video |
| `scripts/queue-add.js` | Add video to night render queue |
| `scripts/studio-automation.js` | Run full auto-production pipeline (Hailuo) |
| `scripts/image-studio.mjs` | **NEW** — Image-based pipeline (zero-cost) |
| `scripts/publish.js` | Upload to all configured platforms |
| `scripts/production-dashboard.js` | Print production stats |
| `scripts/record-video-stats.js` | Log video metrics after upload |
