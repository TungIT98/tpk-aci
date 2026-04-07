# Xianxia Content Factory — GOAL-5

**Goal ID:** `928bc57d-583b-4a4e-af8a-b0b8ffd6c0a6`
**Target:** 30 videos/week (5 scenes × 6s = 30s)

## Series Roster

| Series | Vietnamese | Status |
|--------|------------|--------|
| Trieu Tien | Triều Tiên | Active |
| Dau Pha Thuong Khau | Đấu Phá Thương Khâu | Pending |
| Tru Tien | Trụ Tiên | Pending |
| Thanh Van Mon | Thanh Vân Môn | Pending |
| Muc Than Ky | Mục Thần Ký | Pending |
| Ha Tien Du | Hà Tiên Du | Pending |

## Pipeline

```
scripts/pending/xianxia/{id}.json (Content Director)
        ↓
Nova/Nova2/Nova3 → Hailuo → outputs/xianxia/{id}/
        ↓
Production Manager → n8n → TikTok
        ↓
YouTube browser upload
```

## Video Structure (per episode)

- 5 scenes × 6s = 30s total
- Vietnamese voice-over
- Burned subtitles
- Portrait 1080x1920

## Scripts Location

```
scripts/pending/xianxia/     # Pending scripts
outputs/xianxia/            # Generated videos
content/videos/xianxia/     # Final with captions
```

## Old Goals (DEPRECATED)

- ~~GOAL-1: Launch 2 YouTube Channels~~
- ~~GOAL-2: Generate 1000 Videos in 30 Days~~
- ~~GOAL-3: YPP Eligibility~~
- ~~GOAL-4: Community Building~~

**Current focus ONLY on GOAL-5.**
