# Production Manager HEARTBEAT.md — TKP ACI

> **DEPRECATED**: Paperclip only reads `AGENTS.md` (instructionsEntryFile), NOT HEARTBEAT.md.
> All heartbeat protocol is now embedded directly in `AGENTS.md`.
> This file is kept for reference only and is NOT executed by Paperclip.

## Quick Reference (Embedded in AGENTS.md)

### Video Output Path (CORRECT)
- Canonical path: `outputs/{id}/final.mp4` (NOT `output_topic/videos/`)

### TikTok Upload
- Via n8n: place video at `content/videos/{id}/captioned.mp4`
- n8n auto-watches and uploads

### Quality Gate
- Check: `outputs/{id}/final.mp4` exists
- Check: file size > 1MB
- Check: duration 45-90 seconds
- Check: aspect ratio 9:16 vertical
- Check: hash differs from previous videos
