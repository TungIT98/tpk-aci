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
- [ ] Duration: ~30 seconds (Xianxia format)
- [ ] Format: MP4, H.264 video, AAC audio

### Visual Verification
- [ ] Subject matches `prompt_for_hailuo` description?
- [ ] All scenes present in correct order?
- [ ] Outfit/appearance matches script details?
- [ ] Setting/background correct?
- [ ] Camera movements applied correctly?
- [ ] No visual artifacts or corruption?

### Content Uniqueness
- [ ] Hash differs from previous videos (no duplicate content)

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
