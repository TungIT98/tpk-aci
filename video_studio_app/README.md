# TKP Video Studio

Modular, API-ready automated video production pipeline for TikTok, YouTube Shorts, Instagram, and LinkedIn.

## Architecture

```
video_studio_app/
├── config.py              # All settings (env vars + defaults)
├── minimax_client.py      # MiniMax API plugin (mock until live)
├── main.py                # Orchestrator (full pipeline runner)
│
├── storyboard_generator.py  # TKP-53 → Content Director
├── image_generator.py       # TKP-54 → Founding Engineer
├── footage_fetcher.py       # TKP-55 → Founding Engineer 2
├── video_assembler.py       # TKP-56 → Production Manager
├── upload_tracker.py        # TKP-57 → Analytics Agent
├── seo_optimizer.py         # TKP-58 → SEO Specialist
│
├── assets/      # Images, audio, footage cache
├── output/      # Final videos + metadata
└── temp/        # Intermediate files
```

## Pipeline Stages

| # | Stage | Module | Status |
|---|-------|--------|--------|
| 1 | Storyboard from script | storyboard_generator.py | TKP-53 |
| 2 | Image generation | image_generator.py | TKP-54 |
| 3 | Stock footage fetch | footage_fetcher.py | TKP-55 |
| 4 | Text-to-speech | minimax_client.py | placeholder |
| 5 | Video assembly | video_assembler.py | TKP-56 |
| 6 | Subtitles / captions | video_assembler.py | TKP-56 |
| 7 | SEO metadata | seo_optimizer.py | TKP-58 |
| 8 | Multi-platform upload | upload_tracker.py | TKP-57 |
| 9 | Performance tracking | upload_tracker.py | TKP-57 |

## Setup

```bash
# Clone / navigate
cd video_studio_app

# Install dependencies
pip install requests python-dotenv ffmpeg-python

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run pipeline
python -m video_studio_app.main --script ../content/script.txt
```

## Minimax API Integration

The `minimax_client.py` is a **plugin interface**. When MiniMax billing is activated:

1. Set `MINIMAX_API_KEY` and `MINIMAX_GROUP_ID` in `.env`
2. Replace `raise NotImplementedError` stubs with real API calls
3. All other modules work without modification

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MINIMAX_API_KEY` | MiniMax API key | "" |
| `MINIMAX_GROUP_ID` | MiniMax group ID | "" |
| `IMAGE_PROVIDER` | `minimax` \| `stable_diffusion` \| `mock` | `minimax` |
| `TTS_PROVIDER` | `minimax` \| `elevenlabs` \| `sapi` | `minimax` |
| `PEXELS_API_KEY` | Pexels API key | "" |
| `PIXABAY_API_KEY` | Pixabay API key | "" |
| `MOCK_MODE` | Force mock mode | `false` |
| `LOG_LEVEL` | `DEBUG` \| `INFO` \| `WARNING` | `INFO` |

## Testing

Each module is independently testable:

```bash
python -c "from storyboard_generator import StoryboardGenerator; ..."
python -c "from image_generator import ImageGenerator; ..."
python -c "from minimax_client import MiniMaxClient; ..."
```

## Parent Task

- [TKP-52](https://app.paperclip.ai/TKP/issues/TKP-52) — Build Professional Video Studio Tool
