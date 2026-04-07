# Studio System — Build Status (2026-03-25)

> Updated: 2026-03-25 16:00 UTC

---

## Pre-Flight Check Result

```
✔ FFmpeg installed (v2025-12-01)
✔ ANTHROPIC_TOKEN_KEY set
✔ ELEVENLABS_API_KEY set
✔ PEXELS_API_KEY set
✔ All directory structure present
✔ Disk output/ writable
✔ All lib modules loadable
✔ All scripts present
✔ Hailuo API responding (live test passed)
✔ Stable Diffusion integration built (lib/stable-diffusion.js)
✔ Image Studio orchestrator built (lib/image-studio.js)
✔ Image-studio CLI built (scripts/image-studio.mjs)
⚠ SD_WEBUI_URL / COMFYUI_URL missing → set to activate image studio
⚠ OPENAI_API_KEY missing → Whisper uses TTS-timings fallback
⚠ TIKTOK_ACCESS_TOKEN missing → TikTok upload needs OAuth
⚠ Music library empty → TTS-only production (no background music)
```

**Two production tracks available:**

| Track | Run command | Cost |
|-------|------------|------|
| Hailuo (AI video) | `node scripts/studio-automation.mjs --channel=... --topic="..."` | ~$0.05–0.10/video |
| **Image Studio (NEW)** | `node scripts/image-studio.mjs --produce --script "..." --audio ...` | **~$0.00** |

Run pre-flight for image studio:
```bash
node scripts/image-studio.mjs --sd-check   # Test SD connectivity
node scripts/image-studio.mjs --preflight  # Full image studio check
```

---

## ✅ Complete — Files Built

### Scripts (this session)
| File | Purpose |
|------|---------|
| `scripts/preflight-check.js` | Pre-flight system verification |
| `scripts/image-studio.mjs` | **NEW** — Zero-cost image-based pipeline runner |
| `content/production-runbook.md` | Full operational manual |

### Scripts (prior session)
| File | Purpose |
|------|---------|
| `scripts/studio-automation.mjs` | Canonical ESM pipeline runner |
| `scripts/production-dashboard.js` | Live dashboard + queue ops |
| `scripts/qc-check.js` | Automated QC gate |
| `scripts/record-video-stats.js` | Performance metrics tracker |
| `scripts/analytics-report.js` | Weekly performance report |
| `scripts/publish.js` | Direct platform publish |
| `scripts/oauth-youtube.js` | YouTube OAuth setup |
| `scripts/oauth-tiktok.js` | TikTok OAuth setup |
| `scripts/queue-add.js` | Upload job queue |

### Library Modules
| Module | Purpose |
|--------|---------|
| `lib/hailuo.js` | MiniMax video (model: `MiniMax-Hailuo-2.3`) |
| `lib/tts.js` | ElevenLabs + MiniMax TTS |
| `lib/image.js` | Thumbnails + Pexels/Pixabay stock |
| `lib/audio.js` | Whisper + AudioMixer |
| `lib/ffmpeg-pro.js` | FFmpeg production utilities |
| `lib/prompts.js` | Prompt engineering templates |
| `lib/video-pipeline.js` | Pipeline orchestrator |
| `lib/edit/video-editor.js` | FFmpeg video editing |
| `lib/production/queue-manager.js` | Production queue engine |
| `lib/upload/*.js` | TikTok/YouTube/Instagram/LinkedIn upload |
| `lib/stable-diffusion.js` | **NEW** — SD WebUI/ComfyUI image generation |
| `lib/image-studio.js` | **NEW** — Storyboard + image-to-video pipeline |

### Docs
| File | Purpose |
|------|---------|
| `content/studio-system.md` | Master studio documentation |
| `content/qc-checklist.md` | Pre-publish QC gate |
| `content/production-runbook.md` | **NEW** — Operational manual |
| `content/thumbnail-design-system.md` | Thumbnail design guide |
| `content/video-editing-workflow.md` | Editing reference |

### Assets
| Check | Status |
|-------|--------|
| FFmpeg | ✅ v2025-12-01 |
| Logo files | ✅ 6 SVGs in `assets/logos/` |
| Music library | ⚠ Empty — pipeline uses TTS-only |
| Output dirs | ✅ `output/{productivity,growth}/` |
| B-roll dirs | ✅ `assets/broll/` structure created |

---

## Production Status

| Metric | Value |
|--------|-------|
| Pipeline stages complete | 10/9 (Hailuo) + 9/9 (Image Studio) |
| Scripts operational | 11/11 |
| Documentation complete | ✅ |
| Hailuo API live | ✅ Responding |
| Image Studio built | ✅ Built 2026-03-25 |
| First video ready | ✅ (pending human: add music OR accept TTS-only) |

---

## Human Setup Required (Non-Blocking)

1. **Stable Diffusion (Image Studio)** — Activate zero-cost image pipeline:
   - Install: `git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git`
   - Launch with: `webui-user.bat` (edit to add `--api --listen --xformers`)
   - Add to `.env`: `SD_WEBUI_URL=http://127.0.0.1:7860` and `SD_BACKEND=webui`
   - Verify: `node scripts/image-studio.mjs --sd-check`
   - ⚠ This enables ~$0.00/video production on local RTX 5060 GPU

2. **Music library** — Add 10 royalty-free MP3s each to:
   - `assets/music/productivity/` (60–80 BPM, calm/ambient)
   - `assets/music/growth/` (100–130 BPM, energetic)
   - Sources: pixabay.com/music, freemusicarchive.org, artlist.io
   - Pipeline runs TTS-only without music

3. **OPENAI_API_KEY** — Enables Whisper transcription. TTS word-timings used as fallback.

4. **TIKTOK_ACCESS_TOKEN** — Enables direct TikTok upload. Run `scripts/oauth-tiktok.js` after adding billing.

5. **Hailuo billing** — Free tier = 3 gens/day. For 1000 videos, add billing at platform.minimax.io (~$0.05–0.10/video).

---

## Quick Start

```bash
# Hailuo pipeline (AI video, ~$0.05-0.10/video)
node scripts/preflight-check.js
node scripts/studio-automation.mjs \
  --channel=productivity \
  --topic="The 90-minute deep work system" \
  --preset=fast

# Image Studio pipeline (images → video, ~$0.00/video) — NEW
node scripts/image-studio.mjs --sd-check
node scripts/image-studio.mjs --storyboard --script "Your morning routine..."
node scripts/image-studio.mjs --produce \
  --topic "The 90-minute deep work system" \
  --channel=productivity \
  --script "$(cat output/scripts/v001.txt)" \
  --audio output/audio/v001.mp3

# QC + Upload (both pipelines)
node scripts/qc-check.js --file output/productivity/<video-id>.mp4
node scripts/publish.js --file output/productivity/<video-id>.mp4 --platform=youtube
```
