---
name: quality-control
description: >
  Use when: Checking a video before upload, verifying file integrity, or validating
  that a video is ready for publishing.
  Do NOT use when: Creating videos, writing scripts, or managing content strategy.
---

# Quality Control Skill (Production Manager)

## Pre-Upload QC Checklist

### File Existence
- [ ] `outputs/xianxia/{id}/final.mp4` exists
- [ ] `content/videos/xianxia/{id}/captioned.mp4` exists (for TikTok)

### File Properties
- [ ] File size > 1MB
- [ ] Duration: 25-35 seconds (Xianxia target: 30s)
- [ ] Aspect ratio: 9:16 (vertical, 1080x1920)
- [ ] Format: MP4

```bash
# Check with ffprobe
ffprobe -v error -show_entries stream=width,height,duration -of json outputs/xianxia/{id}/final.mp4
```

### Visual Check
- [ ] Open video file, watch full playback
- [ ] All 5 scenes present in correct order
- [ ] Subject and setting match script
- [ ] Camera movements applied
- [ ] TTS audio present and synced
- [ ] No visual corruption or freeze frames

### Content Hash
- [ ] MD5 hash differs from any previously uploaded video
- [ ] No duplicate content

## QC Fail Protocol

**If ANY check fails:**
1. Do NOT upload
2. Comment on task: describe failure with specifics
3. Reassign to Nova with fix instructions
4. Continue to next video

## Upload Metadata Reference

### TikTok Caption Format
```
[Xianxia Episode Title]
Part [N] of the Trieu Tien saga...
#xianxia #chinesedrama #truetien #fantasy #viral
```

### YouTube Title Format
```
Xianxia: [Episode Title] | Trieu Tien Saga EP[N]
```

### YouTube Description Template
```
Join us for the epic Xianxia saga!

Episode [N]: [Title]
Series: Trieu Tien
Platform: TikTok | YouTube

#xianxia #chinesedrama #fantasy
```
