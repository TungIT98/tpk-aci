---
name: video-qc
description: >
  Use when: Verifying a completed video matches its script, checking file quality,
  validating video metadata, or deciding whether to regenerate a video.
  Do NOT use when: Creating videos, uploading, or managing scripts.
---

# Video Quality Control Skill

## QC Checklist (MANDATORY before marking done)

### File Verification
- [ ] Video exists at `outputs/xianxia/{id}/final.mp4`
- [ ] File size > 1MB
- [ ] Duration matches script (Xianxia: ~30s)
- [ ] Format: MP4, H.264 video, AAC audio

### Visual Verification (Open and watch)
- [ ] Subject matches `prompt_for_hailuo` description?
- [ ] Scene 1-5 all present and in order?
- [ ] Outfit/appearance matches script details?
- [ ] Setting/background correct?
- [ ] Camera movements applied correctly?
- [ ] Mood/atmosphere matches script?
- [ ] No visual artifacts or corruption?

### Content Uniqueness
- [ ] Hash differs from previous videos (no duplicate content)
- [ ] Not a re-used scene from another episode

### Audio Verification
- [ ] TTS narration plays correctly
- [ ] Audio synced to video
- [ ] No audio glitches or cut-off

## QC Fail Actions

**If ANY check fails:**
1. Do NOT mark done
2. Identify specific failure reason
3. Regenerate affected scenes
4. Re-run FFmpeg assembly
5. Repeat QC

## Tools
- ffprobe (check metadata)
- md5sum (hash comparison)
- OpenClaw browser (visual QC)
