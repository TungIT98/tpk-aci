# TKP Music Library

Royalty-free background music for video production. All tracks must have a **commercial use license**.

## Directory Structure

```
assets/music/
├── productivity/   ← 60–80 BPM instrumental, calm, focus-oriented
└── growth/        ← 100–130 BPM instrumental, energetic, high-tempo
```

## Track Naming Convention

```
{channel}_{mood}_{bpm}bpm.mp3
```

Examples:
- `productivity_calm_68bpm.mp3`
- `productivity_deep-work_72bpm.mp3`
- `growth_energy_118bpm.mp3`
- `growth_fire_128bpm.mp3`

## Volume Rules

| Channel    | Music Volume | Rationale                       |
|------------|-------------|---------------------------------|
| Productivity | 15%        | Speech dominant, background wash |
| Growth     | 12%         | Maximum energy, music as texture |

## Recommended Sources (Commercial License)

| Source | Plan | Notes |
|--------|------|-------|
| [Epidemic Sound](https://www.epidemicsound.com) | Subscription | Best quality, unlimited downloads |
| [Artlist](https://artlist.io) | Subscription | Great for creators, unlimited |
| [Uppbeat](https://uppbeat.io) | Free + Paid | Good free tier for creators |
| [YouTube Audio Library](https://youtube.com/audiolibrary) | Free | No attribution required for most |
| [Pixabay Music](https://pixabay.com/music/) | Free | Commercial use, no attribution |

## Minimum Requirements

- **10 tracks per channel** (20 total minimum)
- Format: MP3, 320kbps preferred
- Duration: 2–4 minutes each
- No vocals (instrumental only)
- BPM: 60–80 (productivity) / 100–130 (growth)

## Quick Start

1. Sign up for Epidemic Sound or Artlist (free trial available)
2. Filter by: instrumental, no vocals, appropriate BPM range
3. Download 10 productivity tracks → save to `assets/music/productivity/`
4. Download 10 growth tracks → save to `assets/music/growth/`
5. Keep license receipts in `assets/music/_licenses/`

## Pipeline Behavior

If no music files exist, `AudioMixer` falls back to **TTS-only output** (no background music).
The pipeline still produces valid, uploadable videos — just without background music.
