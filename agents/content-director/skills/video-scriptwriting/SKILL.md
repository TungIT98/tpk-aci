---
name: video-scriptwriting
description: >
  Use when: Writing video scripts for AI generation, creating scene breakdowns,
  describing visual prompts for Hailuo, or drafting narration scripts.
  Do NOT use when: Creating actual videos, uploading content, or analyzing performance.
---

# Video Scriptwriting Skill

## Script Quality Gate (MANDATORY)

Every script MUST have ALL fields before saving:

- [ ] `id` — Unique format `{SERIES}-{NN}` (e.g., `XIANYX-01`)
- [ ] `category` — Content type (xianxia_episode, hot_girl_fitness, etc.)
- [ ] `status` — MUST be `"pending"` (CEO scans for pending)
- [ ] `prompt_for_hailuo` — 200+ characters, detailed visual description
- [ ] `specific_details` — subject, outfit, action, setting, camera, mood
- [ ] `visual_scene` — Full scene description object
- [ ] `negative_prompt` — At least 5 things to avoid
- [ ] `duration_seconds` — Xianxia: 30s, other: 45-90s
- [ ] `title` — Viral-worthy title
- [ ] `description` — YouTube description with keywords

## Visual Prompt Engineering

### Good Prompt Structure
```
[Camera] [Subject] in [Setting], wearing [Outfit], doing [Action].
[Additional detail]. [Mood/Atmosphere]. [Camera movement].
```

### Xianxia Prompt Example
```
[Push in] A beautiful young woman in flowing crimson Hanfu, elaborate gold hairpin,
standing in an ancient misty mountain temple. She holds a gleaming sword.
Tiled roof above, stone pillars, cherry blossoms falling. Heroic yet melancholic.
[Pan right] as she turns to face the approaching enemy army.
```

### Scene Breakdown (5 scenes × 6s = 30s)
```
Scene 1: Introduction — character reveal, establishing shot
Scene 2: Action setup — conflict introduction
Scene 3: Peak moment — battle or dramatic moment
Scene 4: Turning point — plot twist or climax
Scene 5: Cliffhanger — ending that compels view to watch next
```

## Negative Prompt Examples
```
anime, cartoon, blurry, low quality, text on screen,
wrong ethnicity, modern clothing, modern technology,
watermark, logo, deformed hands, extra fingers
```

## Script JSON Format

```json
{
  "id": "XIANYX-01",
  "category": "xianxia_episode",
  "series": "Trieu Tien",
  "episode": 1,
  "title": "The Sword Saint's Daughter",
  "prompt_for_hailuo": "[Push in] Beautiful young woman...",
  "visual_scene": {
    "subject": "Young woman in crimson Hanfu",
    "outfit": "Red Hanfu with gold embroidery, sword at waist",
    "action": "Stands defiant before enemy army",
    "setting": "Ancient mountain temple, misty, cherry blossoms",
    "camera": "[Push in] → [Pan right]",
    "mood": "Heroic, melancholic, epic"
  },
  "specific_details": {
    "hair": "Long black hair with gold hairpin",
    "outfit_exact": "Crimson red Hanfu, gold belt, white inner robe",
    "face_expression": "Determined → Surprised → Fierce",
    "body_movement": "Standing tall, sword drawn, defensive stance"
  },
  "scenes": [
    { "n": 1, "prompt": "...", "duration": 6 },
    { "n": 2, "prompt": "...", "duration": 6 },
    { "n": 3, "prompt": "...", "duration": 6 },
    { "n": 4, "prompt": "...", "duration": 6 },
    { "n": 5, "prompt": "...", "duration": 6 }
  ],
  "negative_prompt": "anime, cartoon, blurry, low quality, text on screen, wrong ethnicity, modern clothing",
  "duration_seconds": 30,
  "resolution": "1080x1920",
  "fps": 24,
  "tags": ["xianxia", "truyencotich", "phimcoso", "vietnam"],
  "audio_vo": "Full narration script...",
  "audio_music": "Epic orchestral, Chinese instruments, dramatic",
  "status": "pending",
  "created_by": "Content Director",
  "created_at": "2026-04-01T12:00:00Z"
}
```

## Save Location
```
scripts/pending/xianxia/{id}.json
```

## Content Pillars (fallback, not Xianxia)

| Day | Category |
|-----|----------|
| Mon | hot_girl_fitness |
| Tue | tech_ai |
| Wed | lifestyle |
| Thu | comedy |
| Fri | motivation |
| Sat | movie_review |
| Sun | trending_aesthetic |
