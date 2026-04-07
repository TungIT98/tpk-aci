---
name: video-production
description: >
  Use when: Creating videos using Hailuo AI, combining video + audio,
  or verifying video quality.
  Do NOT use when: Writing scripts or uploading content.
---

# Video Production Skill

## Pipeline
1. Read script from `scripts/pending/{id}.json`
2. Generate video on Hailuo AI
3. Generate TTS narration
4. Combine video + audio with FFmpeg
5. QC: Verify video matches script
6. Mark status = "ready_for_upload"

## Quality Gate
- Video exists at `outputs/{id}/final.mp4`
- File size > 1MB
- Duration 45-90 seconds
- Visual matches script description
- Hash differs from previous videos

## Hailuo Settings
- Model: film.03
- Aspect: 9:16 (vertical)
- Duration: 45-90 seconds
