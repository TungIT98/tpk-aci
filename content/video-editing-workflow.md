# Video Editing Workflow — TKP Content Agency

> Defined for TKP-25 (Video editing pipeline). Covers the full post-production editing workflow for both TKP Productivity and TKP Growth channels.
> **v3.0:** Resolution/aspect/fps selection, subtitle styling, watermark options, intro/outro templates. Pairs with `content/qc-checklist.md` (TKP-37 output) and `lib/edit/video-editor.js`.

---

## Workflow Overview

```
Raw Video Clips (Hailuo AI)
    │
    ▼
1. TRIM ────→ Remove dead frames, isolate segments
    │
    ▼
2. CONCAT ──→ Stitch clips with dissolve transitions
    │
    ▼
3. TTS SYNC ─→ Layer TTS audio (or generate subtitles from TTS timestamps)
    │
    ▼
4. MUSIC ───→ Add background music track at brand-compliant volume
    │
    ▼
5. SUBS ────→ Burn in subtitles from TTS cue timestamps
    │
    ▼
6. WATERMARK → Add TKP logo (bottom-left, 10% opacity)
    │
    ▼
7. EXPORT ──→ Platform-specific encode + metadata
    │
    ▼
8. QC ───────→ Review against content/qc-checklist.md
    │
    ▼
9. PUBLISH ──→ Upload via lib/upload/*.js
```

---

## Tool Requirements

| Tool | Purpose | Install |
|------|---------|---------|
| **FFmpeg** | All video/audio processing | `brew install ffmpeg` (macOS) / `apt install ffmpeg` (Linux) / ffmpeg.org (Windows) |
| **Node.js** | Run lib/edit/video-editor.js | `node --version` ≥ 18 |
| **ImageMagick** (optional) | Thumbnail generation from frames | `brew install imagemagick` |

> **FFmpeg is required.** All editing is done via FFmpeg command-line — no GUI editor needed. The pipeline is fully scriptable.

---

## Stage 1: Trim Clips

Raw clips from Hailuo AI may contain dead frames at start/end. Trim to precise in/out points.

```javascript
const { VideoEditor } = require('./lib/edit/video-editor');

const editor = new VideoEditor('productivity_worker'); // or 'gen_z_success'

// Trim clip from 0.5s to 5.2s
const trimmed = editor.trim('raw/pw01_clip1.mp4', 0.5, 5.2, 'pw01_trimmed.mp4');
```

**Channel-specific settings:**
- `productivity_worker`: 30fps, CRF 18, 192k AAC audio
- `gen_z_success`: 60fps, CRF 17, 192k AAC audio

---

## Stage 2: Concatenate with Transitions

Stitch multiple trimmed clips into a single sequence. Uses **dissolve** transitions between adjacent clips.

```javascript
const clips = [
  'output/productivity/pw01_trim1.mp4',
  'output/productivity/pw01_trim2.mp4',
  'output/productivity/pw01_trim3.mp4',
];

const concatenated = editor.concatWithTransitions(clips, 'pw01_full.mp4');
```

**Transition settings per channel:**

| Channel | Transition | Duration |
|---------|-----------|----------|
| TKP Productivity | Dissolve | 0.5s |
| TKP Growth | Fade | 0.3s |

> For Gen Z channel, cuts are intentionally shorter — Gen Z audiences prefer faster pacing.

---

## Stage 3: Add Background Music

Music is layered at **15% volume** (Productivity) or **12% volume** (Growth) to keep voice dominant. Music fades out over 3 seconds.

```javascript
const withMusic = editor.addMusic(
  'output/productivity/pw01_full.mp4',
  'assets/music/productivity_bg_01.mp3',  // royalty-free, see Music Library below
  3, // fade-out seconds
  'pw01_music.mp4'
);
```

**Music selection rules:**
- TKP Productivity: Lo-fi, ambient, calm instrumental. No lyrics. 60–80 BPM.
- TKP Growth: Upbeat, modern instrumental. Low/no lyrics acceptable. 100–130 BPM.
- No copyrighted music. Use Epidemic Sound, Artlist, or YouTube Audio Library.
- Music must be royalty-free for commercial use.

---

## Stage 4: Subtitle Generation & Burn-In

Subtitles are generated from TTS provider word-level timestamps, then burned into the video.

**TTS cue format (from `lib/tts.js` output):**
```javascript
const ttsResult = await tts.generate(text, {
  voiceId: '21cho5f0l0d5MV3y',
  prompt: '...',
});

// ttsResult.wordTimings is an array of:
[
  { word: 'Hello', start: 0.0, end: 0.45 },
  { word: 'world', start: 0.48, end: 0.92 },
  ...
]
```

**Burn subtitles:**
```javascript
// Group words into sentences for readable subtitle cues
const sentenceCues = groupWordsIntoCues(ttsResult.wordTimings, maxWordsPerCue = 8);

const subtitled = editor.addSubtitles('pw01_music.mp4', sentenceCues, {}, 'pw01_subs.mp4');
```

**Subtitle styling per channel:**

| Channel | Font | Size | Color | Border |
|---------|------|------|-------|--------|
| TKP Productivity | Arial | 28px | White | Black |
| TKP Growth | Arial | 32px | White | Black |

> Subtitles are **hard-burned** (not soft subtitles) — required for TikTok/Reels where soft subs are not reliably displayed.

---

## Stage 5: Watermark

Add TKP logo watermark at bottom-left, 10% opacity, per brand guidelines.

```javascript
const watermarked = editor.addWatermark(
  'pw01_subs.mp4',
  'assets/logos/tkp_logo.png',
  'pw01_wm.mp4'
);
```

**Logo specs:**
- File: PNG with transparency
- Max height: 24px (Productivity) / 20px (Growth) in 1080p frame
- Position: bottom-left, 20px padding from edges
- Opacity: 10%

---

## Stage 6: Platform Export

Export a master file, then create platform-specific versions.

### YouTube (Primary)
```javascript
const youtubeExport = editor.exportForPlatform('pw01_wm.mp4', 'youtube', {
  title: 'How I Structure My Day to Get 2x More Done [TKP Productivity]',
  description: 'In this video I break down my exact 5-step system...\n\n#TKP #Productivity',
}, 'pw01_youtube.mp4');
```

**YouTube export settings:** H.264, CRF 18, 192k AAC, `+faststart` for web streaming, 16:9.

### TikTok / Instagram Reels
```javascript
// 9:16 crop is applied by the upload script (lib/upload/tiktok.js / instagram.js)
// Export is same as YouTube; platform-specific rescaling happens at upload
const tiktokExport = editor.exportForPlatform('gz01_wm.mp4', 'tiktok', {
  // TikTok/IG metadata not embedded — handled by upload API
}, 'gz01_tiktok.mp4');
```

**Shorts/Reels settings:** H.264, CRF 20, 128k AAC, max 90s, 9:16 aspect via upload script.

### LinkedIn
```javascript
const linkedinExport = editor.exportForPlatform('pw01_wm.mp4', 'linkedin', {
  title: 'My Proven System for Getting More Done',
  description: 'Here\'s the framework I use every morning...',
}, 'pw01_linkedin.mp4');
```

**LinkedIn settings:** H.264, CRF 18, 192k AAC, 16:9.

---

## Full Pipeline Example

```javascript
const { VideoEditor } = require('./lib/edit/video-editor');
const { TTSProvider } = require('./lib/tts');
const HailuoVideo = require('./lib/hailuo');

async function produceVideo({ channel, script, videoClips, musicTrack }) {
  const editor = new VideoEditor(channel);

  // Step 1: Trim each raw clip
  const trimmed = videoClips.map(clip => {
    return editor.trim(clip.path, clip.start, clip.end);
  });

  // Step 2: Concatenate with transitions
  const concat = editor.concatWithTransitions(trimmed);

  // Step 3: Generate TTS and get word timings
  const tts = new TTSProvider(channel === 'productivity_worker' ? 'elevenlabs' : 'minimax');
  const ttsResult = await tts.generate(script, {
    voiceId: channel === 'productivity_worker'
      ? '21cho5f0l0d5MV3y'  // Productivity voice
      : 'mBnDcF6bL6eJNAW8', // Growth voice
  });

  // Step 4: Add music (after TTS so music doesn't compete with voice)
  const withMusic = editor.addMusic(concat, musicTrack, 3);

  // Step 5: Burn subtitles from TTS timestamps
  const subtitled = editor.addSubtitles(withMusic, ttsResult.wordTimings);

  // Step 6: Watermark
  const watermarked = editor.addWatermark(subtitled, 'assets/logos/tkp_logo.png');

  // Step 7: Platform exports
  const exports = {
    youtube: editor.exportForPlatform(watermarked, 'youtube', {
      title: ttsResult.title,
      description: ttsResult.description,
    }),
    tiktok: editor.exportForPlatform(watermarked, 'tiktok'),
    linkedin: editor.exportForPlatform(watermarked, 'linkedin'),
  };

  return exports;
}
```

---

## v3: Resolution, Aspect Ratio & Frame Rate

The `VideoEditor` constructor accepts optional encode overrides for per-video quality control:

```javascript
// Productivity video in 4K, cinematic 24fps, H.265 compression
const editor = new VideoEditor('productivity_worker', {
  resolution: '4k',
  fps: '24',
  codec: 'h265',
});

// Gen Z vertical video for TikTok — 9:16, 1080p, 60fps
const editor = new VideoEditor('gen_z_success', {
  resolution: '1080p',
  aspectRatio: '9:16',
  fps: '60',
});
```

Or use the fluent setter API:

```javascript
const editor = new VideoEditor('productivity_worker')
  .setResolution('4k')
  .setFrameRate('24')
  .setVideoCodec('h265')
  .setAspectRatio('9:16');
```

**Available options:**

| Parameter | Values | Notes |
|-----------|--------|-------|
| `resolution` | `720p`, `1080p`, `4k` | Scale via `scale=wxh:force_original_aspect_ratio=decrease` + pad |
| `aspectRatio` | `16:9`, `9:16`, `1:1`, `4:5` | Auto-crops to maintain content center |
| `fps` | `24`, `30`, `60` | Cinematic / standard / smooth |
| `codec` | `h264`, `h265` | H.265 ≈ 40% smaller files at same quality |
| `audioCodec` | `aac`, `mp3` | AAC recommended for quality; MP3 for legacy |
| `crf` | number (0–51) | Lower = higher quality (18–23 typical) |

The `encode()` method applies all active options to any video file:

```javascript
// Re-encode an existing video to 4K TikTok vertical
const highRes = editor
  .setResolution('4k')
  .setAspectRatio('9:16')
  .encode('existing_video.mp4', {}, '4k_vertical.mp4');
```

---

## v3: Subtitle Styling

Override subtitle appearance per-call or globally:

```javascript
// Global: large yellow subtitles for Gen Z channel
const editor = new VideoEditor('gen_z_success', {
  subtitleFontSize: 'large',
  subtitleColor: 'yellow',
  subtitlePosition: 'top',
  subtitleAnimation: 'fade',
});

// Per-call override
const subtitled = editor.addSubtitles(video, cues, {
  fontSize: 'small',
  color: 'white',
  position: 'bottom',
  animation: 'pop',
}, 'output.mp4');
```

**Subtitle options:**

| Option | Values | Default |
|--------|--------|---------|
| `fontSize` | `small` (22px), `medium` (28px), `large` (36px) | Channel default |
| `color` | `white`, `yellow`, `auto` | `white` |
| `position` | `bottom`, `top` | `bottom` |
| `animation` | `none`, `fade` (0.2s in / 0.3s out), `pop` (scale 0.8→1.0) | `none` |

---

## v3: Watermark & Brand Overlay

Supports both logo image overlay and text-only watermark:

```javascript
// Logo watermark: bottom-right, 15% frame height, 60% opacity
const watermarked = editor.addWatermark(video, {
  logoPath: 'assets/logos/tkp_logo.png',
  position: 'bottomright',
  size: 'medium',     // small=5%, medium=10%, large=15% of frame height
  opacity: 0.6,
}, 'wm_logo.mp4');

// Text watermark: semi-transparent brand text
const textWmed = editor.addWatermark(video, {
  watermarkText: 'TKP Content Agency',
  watermarkTextSize: 20,
  watermarkTextColor: 'white',
  position: 'topleft',
  opacity: 0.5,
}, 'wm_text.mp4');

// Combined logo + text (both applied in one pass)
const bothWmed = editor.addWatermark(video, {
  logoPath: 'assets/logos/tkp_logo.png',
  watermarkText: '@TKPProductivity',
  position: 'bottomleft',
  size: 'small',
  opacity: 0.5,
}, 'wm_both.mp4');
```

**Logo specs:**
- File: PNG with transparency
- Position options: `topleft`, `topright`, `bottomleft`, `bottomright`, `center`
- Size: small (5%), medium (10%), large (15%) of frame height
- Opacity: 0.0–1.0 (default 0.10)

---

## v3: Intro/Outro Templates

Prepend and/or append brand intro and outro clips:

```javascript
// Prepend intro only
const withIntro = editor.prependIntro(video, 'assets/intro.mp4', 'with_intro.mp4');

// Append outro only
const withOutro = editor.appendOutro(video, 'assets/outro.mp4', 'with_outro.mp4');

// Both intro and outro in one pass (avoids re-encoding twice)
const final = editor.addIntroOutro(
  video,
  'assets/intro.mp4',
  'assets/outro.mp4',
  'final_intro_outro.mp4'
);
```

**Intro/Outro specs:**
- Same resolution/codec/fps as main video (inherits editor settings)
- Recommend: 3–5s per clip, H.264 CRF 20, no audio required (silent OK)
- Store in `assets/intro/` and `assets/outro/` by channel

---

## FFmpeg Commands Reference

For direct CLI use:

```bash
# Trim
ffmpeg -y -ss 0.5 -i input.mp4 -t 4.7 -c:v libx264 -crf 18 -r 30 -c:a aac -b:a 192k -ar 48000 output.mp4

# Concat (dissolve transition)
ffmpeg -y -i clip1.mp4 -i clip2.mp4 \
  -filter_complex "acrossfade=d=0.5" \
  -c:v libx264 -crf 18 -c:a aac -b:a 192k output.mp4

# Add music (music at 15% volume)
ffmpeg -y -i video.mp4 -i music.mp3 \
  -filter_complex "[1:a]volume=0.15,afade=t=out:st=0:d=3[m];[0:a][m]amix=inputs=2:duration=first[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k output_music.mp4

# Burn subtitles (ASS)
ffmpeg -y -i video.mp4 -vf "ass=subs.ass" -c:v libx264 -crf 18 -c:a copy output_subs.mp4

# Add watermark
ffmpeg -y -i video.mp4 -i logo.png \
  -filter_complex "[1:v]format=rgba,colorchannelmixer=aa=0.1[logo];[0:v][logo]overlay=W-w-20:20" \
  -c:a copy output_wm.mp4

# YouTube export
ffmpeg -y -i input.mp4 -c:v libx264 -crf 18 -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -metadata title="Title" output_youtube.mp4
```

---

## Automation Opportunities

| Automation | Status | Notes |
|-----------|--------|-------|
| FFmpeg-based trimming | ✅ Built | `VideoEditor.trim()` |
| Clip concatenation | ✅ Built | `VideoEditor.concatWithTransitions()` |
| Subtitle generation from TTS | ✅ Built | Pass TTS wordTimings to `addSubtitles()` |
| Background music layering | ✅ Built | `VideoEditor.addMusic()` |
| Platform export | ✅ Built | `VideoEditor.exportForPlatform()` |
| Watermark overlay | ✅ Built | `VideoEditor.addWatermark()` |
| Resolution / aspect ratio selection | ✅ v3 Built | `editor.encode()` with `resolution`, `aspectRatio` options |
| Codec selection (H.264/H.265) | ✅ v3 Built | `editor.setVideoCodec()` or `codec` in options |
| Subtitle styling (font, color, position, animation) | ✅ v3 Built | `addSubtitles(video, cues, opts)` |
| Watermark / brand overlay (logo + text, position, size, opacity) | ✅ v3 Built | `addWatermark(video, opts)` |
| Intro / outro templates | ✅ v3 Built | `prependIntro()`, `appendOutro()`, `addIntroOutro()` |
| Auto-captioning (no TTS) | 🔜 Next | Use Whisper API for auto-subtitle generation |
| Thumbnail extraction | 🔜 Next | Extract key frame + add text via ImageMagick |
| Color grading presets | 🔜 Next | LUT-based color correction per channel |

## v4: ESM Pipeline — lib/ffmpeg-pro.js (TKP-90)

New ESM modules added 2026-03-26, tested on real 4K video (3840×2160). All tests pass.

### Module overview

| Module | Class | Purpose |
|--------|-------|---------|
| **VideoCutter** | `detectScenes()`, `cutScene()`, `mergeVideos()`, `autoCut()` | Cut, merge, auto-detect scene boundaries |
| **VideoEffects** | `adjust()`, `changeSpeed()`, `blur()`, `fade()` | Brightness, contrast, saturation, speed, blur, fade |
| **TextOverlay** | `addText()`, `addTextSegments()` | Standalone text overlay (bold, timed, shadow) |
| **VideoAssemblyLine** | `trim()`, `concatWithTransitions()`, `mixAudio()`, `burnSubtitles()`, `addWatermark()`, `exportForPlatform()`, `assemble()` | Full assembly pipeline |
| **videoEditingPipeline()** | — | High-level orchestrator wrapping all modules |

> All 8 pipeline tests passed on 2026-03-26 with a real 4K video (3840×2160, H.264, 5s test clip).

### Usage (ESM)

```javascript
import { VideoCutter, VideoEffects, TextOverlay, VideoAssemblyLine, videoEditingPipeline } from './lib/ffmpeg-pro.js';

// Auto-detect scenes
const cutter = new VideoCutter({ tempDir: 'output/_temp' });
const scenes = await cutter.detectScenes('raw/clip.mp4', { threshold: 0.3 });
scenes.forEach(s => console.log(`Scene ${s.index}: ${s.start}s–${s.end}s`));

// Brightness/speed effects
const fx = new VideoEffects();
const bright = await fx.adjust('video.mp4', { brightness: 0.1, contrast: 1.1 }, 'output/bright.mp4');
const fast  = await fx.changeSpeed('video.mp4', 2.0, 'output/fast.mp4');  // 2x speed
const faded = await fx.fade('video.mp4', { fadeIn: 0.5, fadeOut: 0.5 }, 'output/fade.mp4');

// Text overlay
const textOv = new TextOverlay();
await textOv.addText('video.mp4', 'Chapter 1', 'output/ch1.mp4', {
  fontSize: 64, fontColor: 'yellow', startTime: 5, duration: 10,
  y: '(h-text_h)/2', bold: true,
});

// Full orchestrator
const result = await videoEditingPipeline({
  inputVideo: 'raw/source.mp4',
  script: { audioPath: 'tts.mp3', wordTimings: wordTimings, textOverlays: [...] },
  effects: { brightness: 0.05, speed: 1.0 },
  musicPath: 'assets/music/productivity/calm_72bpm.mp3',
  channel: 'productivity',
  outputBasename: 'pw-001',
});
// result.masterFile → output/productivity/pw-001_master.mp4
```

### FFmpeg Requirements

FFmpeg essentials/fulldownload from gyan.dev with:
- `libx264` — H.264 encoding ✅
- `libx265` — H.265/HEVC encoding (optional) ✅
- `libass` — ASS subtitle burn-in ✅
- `libmp3lame` — MP3 encoding (ElevenLabs fallback audio) ✅
- `libfreetype` — drawtext font rendering ✅

> **Note:** FFmpeg essentials build does NOT include SVG/librsvg. Use PNG watermarks (`.png`) not SVG. Run `python -c "import cairosvg; cairosvg.svg2png(...)"` or Pillow to convert SVG logos to PNG.


---

## Music Library (Required Setup)

Before production begins, curator must assemble:

```
assets/
  music/
    productivity/    ← 10+ royalty-free tracks, 60-80 BPM, instrumental
    growth/          ← 10+ royalty-free tracks, 100-130 BPM, instrumental
```

**Recommended sources:** Epidemic Sound, Artlist, Uppbeat, Free Music Archive (commercial license).

**Track naming convention:** `{channel}_{mood}_{bpm}.mp3`
Example: `productivity_calm_72bpm.mp3`, `growth_energy_118bpm.mp3`

---

## Integration with video-pipeline.js

`lib/video-pipeline.js` orchestrates the full pipeline. Video editing is called at the **post-generation stage**:

```
HailuoVideo.generate()  →  VideoEditor.trim()  →  VideoEditor.addSubtitles()
    →  VideoEditor.addMusic()  →  VideoEditor.addWatermark()
    →  VideoEditor.exportForPlatform()  →  QC check  →  upload
```

See `lib/video-pipeline.js` for the full orchestrator that wraps this editing workflow.
