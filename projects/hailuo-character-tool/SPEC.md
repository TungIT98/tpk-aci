# SPEC.md - Hailuo Character Consistency Tool

**Project:** TKP Character Video Generator
**Type:** CLI Tool + Library
**Company:** TKP ACI (fe90b604-364f-480d-be10-6a529971db57)
**Purpose:** Generate consistent character videos using Hailuo Max Web S2V-01

---

## 1. Concept & Vision

Tool để tạo video với **consistent character** (nhân vật giống nhau across all scenes) sử dụng Hailuo Max Web. Mỗi video series (story/campaign) sẽ có 1 main character được tái sử dụng xuyên suốt.

**Input:** Script + Character Reference Set (5 góc ảnh)
**Output:** Video files với consistent character

---

## 2. Core Features

### 2.1 Character Reference Generator
- Tạo **Standard Five Reference Set** từ 1 seed image:
  - Front portrait (0°)
  - Profile (90°)
  - Three-quarter view (45°)
  - Full-body shot
  - Lighting stress test (multiple lighting conditions)

- Sử dụng MiniMax Image API hoặc external image editing
- Output: JSON metadata + local image files

### 2.2 Character Library Manager
- Lưu trữ character profiles tại `characters/`
- Mỗi character có:
  ```
  characters/
  ├── {character_id}/
  │   ├── metadata.json      # Character ID, created date, description
  │   ├── seed_image.jpg     # Original seed image
  │   ├── references/
  │   │   ├── front.png
  │   │   ├── profile.png
  │   │   ├── three_quarter.png
  │   │   ├── full_body.png
  │   │   └── lighting.png
  │   └── variants/         # Alternative outfits/expressions
  ```

### 2.3 Video Generator (S2V-01 Integration)
- Gọi Hailuo S2V-01 API với subject reference
- Batch generate multiple scenes cho 1 story
- Queue management cho rate limits
- Retry logic cho failed generations

### 2.4 Script to Video Pipeline
```
scripts/pending/{id}.json (input script)
        ↓
Tool reads: theme, prompt_for_hailuo, character_id
        ↓
Load character references from library
        ↓
Generate video via Hailuo S2V-01
        ↓
QC check: verify character consistency
        ↓
Output: outputs/{id}/final.mp4
```

---

## 3. Technical Architecture

### 3.1 File Structure
```
TKP_ACI/
├── lib/
│   └── hailuo-character/
│       ├── index.js              # Main entry
│       ├── character-generator.js  # Reference set generator
│       ├── character-library.js   # Library manager
│       ├── video-generator.js     # S2V-01 API caller
│       ├── pipeline.js            # Script → Video pipeline
│       └── cli.js                # CLI interface
├── characters/                    # Character library
├── scripts/
│   └── pending/                 # Script inputs
└── outputs/                     # Generated videos
```

### 3.2 API Integration

**Hailuo S2V-01 Endpoint:**
```
POST https://api.minimax.io/v1/s2v
Headers:
  Authorization: Bearer {API_KEY}
  Content-Type: application/json

Body:
{
  "model": "s2v-01",
  "subject_reference": ["base64_image_1", "base64_image_2"...],
  "prompt": "video description",
  "duration": 6,
  "aspect_ratio": "9:16"
}
```

**Response:**
```json
{
  "task_id": "xxx",
  "status": "processing"
}
```

**Polling:**
```
GET https://api.minimax.io/v1/s2v/{task_id}
```

### 3.3 Rate Limiting
- Hailuo Max Web: ~3 videos/minute
- Queue system: max 2 concurrent
- Retry: 3 attempts with exponential backoff

---

## 4. Data Models

### 4.1 Character Metadata (`metadata.json`)
```json
{
  "id": "char_001",
  "name": "Business Woman Anna",
  "description": "Professional female, 30s, modern office attire",
  "created": "2026-03-31",
  "seed_image": "seed_image.jpg",
  "references": {
    "front": "references/front.png",
    "profile": "references/profile.png",
    "three_quarter": "references/three_quarter.png",
    "full_body": "references/full_body.png",
    "lighting": "references/lighting.png"
  },
  "variants": ["outfit_casual", "outfit_formal"],
  "active": true
}
```

### 4.2 Script Input (`scripts/pending/{id}.json`)
```json
{
  "id": "SERIES-001-EP01",
  "status": "pending",
  "theme": "business_motivation",
  "series_id": "SERIES-001",
  "character_id": "char_001",
  "episode": 1,
  "prompt_for_hailuo": "A confident woman presenting at a boardroom meeting...",
  "specific_details": {
    "subject": "Business Woman Anna",
    "outfit": "Navy blazer, white blouse",
    "action": "Presenting slides confidently",
    "setting": "Modern corporate boardroom"
  },
  "duration": 60,
  "voiceover": "base64_audio_or_url"
}
```

### 4.3 Series Configuration (`series/{series_id}/config.json`)
```json
{
  "id": "SERIES-001",
  "title": "Rise to Success",
  "character_id": "char_001",
  "total_episodes": 10,
  "style": "motivational_business",
  "aspect_ratio": "9:16",
  "duration_per_episode": 60
}
```

---

## 5. CLI Commands

```bash
# Generate character reference set from seed image
node cli.js character create --seed ./photos/anna.jpg --name "Business Woman Anna"

# List all characters
node cli.js character list

# Generate video from script
node cli.js generate --script scripts/pending/SERIES-001-EP01.json

# Batch generate series
node cli.js generate --series SERIES-001 --from 1 --to 10

# Check generation status
node cli.js status --task-id xxx

# QC: Verify character consistency
node cli.js qc --video outputs/SERIES-001-EP01.mp4 --character char_001
```

---

## 6. Quality Gates

### 6.1 Before Video Generation
- [ ] Character reference set complete (all 5 angles exist)
- [ ] Script has valid `prompt_for_hailuo`
- [ ] Script has `character_id` referencing existing character
- [ ] Rate limit quota available

### 6.2 After Video Generation
- [ ] Video file exists and size > 1MB
- [ ] Duration matches script spec
- [ ] Character visually matches reference (QC check)
- [ ] Hash differs from previous videos (no duplicates)

### 6.3 Character Consistency QC
- Face matches reference images
- Outfit matches script spec
- Setting consistent with prompt
- No obvious morphing or artifacts

---

## 7. Integration Points

### 7.1 TKP ACI Pipeline Integration
```
Content Director → writes scripts with character_id
        ↓
Hailuo Character Tool → generates video
        ↓
Production Manager → QC + upload
        ↓
Published to YouTube/TikTok
```

### 7.2 Existing Files to Read
- `lib/hailuo.js` - existing Hailuo integration (study and extend)
- `lib/video-pipeline.js` - existing pipeline (integrate with)
- `lib/tts.js` - TTS for voiceover

---

## 8. Milestones

### M1: Character Library (2 hours)
- [ ] Character reference generator (Standard Five)
- [ ] Library storage structure
- [ ] CRUD operations for characters

### M2: S2V-01 Integration (3 hours)
- [ ] API client for S2V-01
- [ ] Polling and status checking
- [ ] Retry logic

### M3: Pipeline Integration (2 hours)
- [ ] Script → Video flow
- [ ] QC checks
- [ ] Integration with existing `lib/video-pipeline.js`

### M4: CLI + Batch (1 hour)
- [ ] CLI interface
- [ ] Series batch generation
- [ ] Status tracking

**Total Estimate:** 8 hours

---

## 9. Dependencies

| Package | Purpose |
|---------|---------|
| axios | HTTP requests |
| fs-extra | File operations |
| dotenv | Environment variables |
| sharp | Image processing |
| crypto | Hashing for QC |

---

## 10. Environment Variables

```env
HAILUO_API_KEY=your_api_key
HAILUO_API_HOST=https://api.minimax.io
MINIMAX_API_KEY=your_minimax_key
CHARACTER_LIBRARY_PATH=./characters
OUTPUT_PATH=./outputs
```

---

## 11. Acceptance Criteria

1. **Character Consistency:** Same character across all videos in a series
2. **Automated:** No manual intervention needed for standard workflow
3. **QC:** Failed generations detected and retried
4. **Traceability:** Every video linked to character_id and script
5. **Batch:** Can generate 10+ episode series unattended
