# Video Production Pipeline

## Pipeline Flow (GOAL-5)

```
Content Director → scripts/pending/xianxia/{id}.json
        ↓
CEO assigns task → Nova/Nova2/Nova3
        ↓
Hailuo AI → outputs/xianxia/{id}/
        ↓
Production Manager → n8n → TikTok
        ↓
YouTube (browser)
```

## Hailuo AI

- **Model:** MiniMax-Hailuo-2.3
- **Valid durations:** 6s or 10s only
- **Base URL:** https://api.minimax.io
- **Limit:** 3 videos/day FREE

## Video Specs

- **Format:** MP4 H.264
- **Resolution:** 1080x1920 (portrait 9:16)
- **Frame rate:** 30fps
- **Duration:** 30-60s (5 scenes × 6s)

## Output Directories

| Content Type | Path |
|--------------|------|
| Xianxia | `outputs/xianxia/{id}/final.mp4` |
| GZ series | `outputs/videos/` |
| PW series | `output_topic/videos/` |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/produce_video.py` | Video production |
| `gen-xianyx*.py` | Xianxia generation |
| `mux-xianyx*.cjs` | Concatenate + TTS |

## Quality Check

- [ ] 1080x1920 portrait
- [ ] AAC audio
- [ ] Duration 30-60s
- [ ] Burned subtitles
