# TKP ACI - VIDEO PRODUCTION WORKFLOW
## Browser-Based Video Creation using Hailuo AI

---

## 🎯 OVERVIEW

This document defines the new browser-based video production workflow for TKP ACI.
**Key Change:** Videos are created via Hailuo AI website (browser) instead of API.

---

## 📊 VIDEO PRODUCTION PIPELINE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VIDEO PRODUCTION PIPELINE                          │
│                              (SIMPLIFIED - NOVA ONLY)                        │
└─────────────────────────────────────────────────────────────────────────────┘

  CONTENT DIRECTOR                        NOVA (BROWSER)
  ─────────────────                       ──────────────
        
  1. Write Script                        4. Read Script
     ↓                                      ↓
  2. Save to                           5. Create Video on Hailuo
     scripts/pending/                      ↓
     {id}.json                         6. Download to outputs/
     ↓                                    ↓
  3. Create Task                        7. Upload to YouTube
     for Nova                              ↓
                                         8. Upload to TikTok
                                            ↓
                                         9. Update script status
                                            = "published"
```

---

## 👥 AGENT ROLES

| Agent | Role | Responsibilities |
|-------|------|-----------------|
| **CEO** | Orchestrator | Create tasks, monitor pipeline |
| **Content Director** | Script Writer | Write video scripts with Hailuo-compatible prompts |
| **Nova** | Browser Operator | **DOES EVERYTHING**: Create videos on Hailuo, upload to YouTube & TikTok |

---

## 📁 FILE STRUCTURE

```
TKP_ACI/
├── agents/
│   ├── nova/
│   │   ├── AGENTS.md              ← Nova's instructions (CREATE + UPLOAD)
│   │   ├── HAILUO_KNOWLEDGE.md    ← Hailuo usage guide
│   │   └── BROWSER_OPERATIONS.md  ← YouTube/TikTok upload guide
│   ├── ceo/
│   │   └── AGENTS.md
│   └── content-director/
│       └── AGENTS.md
├── scripts/
│   └── pending/                  ← Scripts waiting for video
│       └── {script_id}.json
├── outputs/                      ← Generated videos
│   └── {script_id}.mp4
└── WORKFLOW.md                   ← This file
```

---

## 📝 SCRIPT JSON FORMAT

```json
{
  "id": "VID-001",
  "channel": "Productivity Worker",
  "title": "The 2-Minute Rule",
  "script": "Full script text...",
  "prompt_for_hailuo": "Young professional looks at to-do list [Static shot]. Writes first task [Tracking shot]. Completes it quickly, smiles [Push in on face]. Motivational, office setting, bright lighting.",
  "duration_seconds": 6,
  "resolution": "1080P",
  "tags": ["productivity", "tips"],
  "thumbnail_idea": "Person with checklist",
  "status": "pending",
  "created_by": "Content Director",
  "created_at": "2026-03-27T09:00:00Z",
  "video_path": null,
  "generated_at": null,
  "uploaded_at": null,
  "youtube_url": null,
  "tiktok_url": null
}
```

---

## 🔄 TASK CREATION FLOW

### Step 1: CEO Creates Task
```json
{
  "title": "Nova: Create Video VID-001",
  "description": "Create video from script VID-001.\n\nScript ID: VID-001\nOutput: outputs/VID-001.mp4\n\nFollow instructions in agents/nova/AGENTS.md",
  "assigneeAgentId": "nova-agent-id"
}
```

### Step 2: Nova Executes (Full Pipeline)
1. Read script from `scripts/pending/VID-001.json`
2. Open Hailuo via browser
3. Create video with prompt
4. Download to `outputs/VID-001.mp4`
5. Upload to YouTube Studio
6. Upload to TikTok
7. Update script status = "published"

---

## 🎬 HAILUO VIDEO SETTINGS

### Recommended Settings
| Setting | Value | Reason |
|---------|-------|--------|
| Model | Hailuo Max | Highest quality |
| Duration | 6 seconds | TikTok optimal |
| Resolution | 1080P | Best quality |
| FPS | 24 | Standard |

### Prompt Tips
- Include camera movements: `[Push in]`, `[Tracking shot]`, etc.
- Be specific about subjects, actions, settings
- Add mood/style descriptors
- Max 2000 characters

---

## ⚠️ BLOCKED TASKS TO CANCEL

The following tasks are blocked due to API issues and should be cancelled:

| Task ID | Title | Reason |
|---------|-------|--------|
| TKP-105 | Setup All Services Credentials | API approach abandoned |
| TKP-107 | Upload Video to YouTube | No video to upload yet |
| TKP-33 | VID-22: Trailer video | Will recreate with new workflow |

---

## ✅ NEW TASKS TO CREATE

### Phase 1: Setup & Test
- [ ] TASK: Verify Hailuo + YouTube + TikTok Login (Nova)
- [ ] TASK: Nova - Create Test Video (TKP-108 - currently in progress)
  - Nova will create video, upload to YouTube AND TikTok

### Phase 2: Production (Nova Does All)
- [ ] TASK: Content Director - Write 10 video scripts
- [ ] TASK: Nova - Create + Upload 10 videos (1 task per video)

---

## 📊 STATUS TRACKING

| Status | Meaning |
|--------|---------|
| `pending` | Script created, waiting for video |
| `video_created` | Video downloaded to outputs/ |
| `uploaded` | Video uploaded to platform |
| `published` | Video live on YouTube/TikTok |

---

## 🔑 KEY CONTACTS

| Service | Account | Status |
|---------|---------|--------|
| Hailuo AI | thanhtungtran364@gmail.com | Logged in |
| YouTube | UCpNiXZ7Zz3MjMlUpLIvpWmg | API ready |
| TikTok | @genzagentai | Setup needed |

---

## 📞 ESCALATION

If Nova encounters issues:
1. Check Hailuo login status
2. Verify browser is running
3. Check outputs/ directory permissions
4. Report to CEO with error details

---

*Last Updated: 2026-03-27*
*Version: 2.0 (Browser-Based)*
