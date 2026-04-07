# TKP Content Agency (TKP ACI)

> AI-powered zero-human video content business. AI agents produce, edit, and auto-publish short-form video content across TikTok, YouTube Shorts, Instagram, and LinkedIn — with no manual labor.

---

## Product Vision

**Core Value Proposition:** A fully autonomous content factory that turns AI-generated scripts into published short-form videos, 24/7, at scale.

**Two target niches:**
1. **Productivity Worker** — 9-to-5 professionals seeking peak performance, focus systems, and work-life integration
2. **Gen Z Success** — Ambitious young adults (18-28) chasing financial independence, side-hustles, and the creator economy

**Moat:** Proprietary pipeline combining MiniMax M2 script generation → ElevenLabs TTS → Hailuo film.03 video synthesis → multi-platform auto-upload via native Creator APIs — all orchestrated by Paperclip AI agents.

---

## Tech Stack

### AI / LLM
| Layer | Provider | Model | Use Case |
|---|---|---|---|
| Script generation | MiniMax (Anthropic-compatible) | M2 | Full scripts, hooks, outlines |
| TTS (premium) | ElevenLabs | speech-2.8-hd | Narration voiceover |
| TTS (backup) | MiniMax Native | speech-2.8-hd | Cost-effective narration |
| Video synthesis | MiniMax Native | film.03 | AI-generated short clips |
| Local inference | Ollama | — | Development / fallback |

### Infrastructure
| Component | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Agent orchestration | Paperclip (Claude Local adapter) |
| Script framework | ES Modules, native fetch |
| Video pipeline | Custom Node pipeline (`lib/video-pipeline.js`) |
| Customer service | Anthropic SDK + Qdrant vector DB (`lib/customer-service/`) |

### Content APIs (Multi-Platform Publish)
| Platform | API | Status |
|---|---|---|
| TikTok | Creator API (Content Posting) | Configured (OAuth pending) |
| YouTube | YouTube Data API v3 | Configured (OAuth pending) |
| Instagram | Graph API (Creator Studio) | Configured |
| LinkedIn | UGC Posts API | Configured |

### Data / Media
| Asset | Provider | Quota |
|---|---|---|
| Stock footage | Pexels | 200 credits/mo |
| Image gen | MiniMax image-01 | 200/day |
| Music gen | MiniMax music-01 | 7/day |

---

## Project Structure

```
TKP_ACI/
├── README.md              # This file
├── .env                   # API keys (gitignored)
├── agents/                # Paperclip agent definitions
│   ├── ceo/
│   ├── founding-engineer-2/   # ← you
│   ├── producer/
│   ├── publisher/
│   └── designer/
├── lib/                   # Core pipeline libraries
│   ├── hailuo.js          # Hailuo film.03 video generation
│   ├── tts.js             # TTS (ElevenLabs + MiniMax)
│   ├── script-generator.js # MiniMax M2 script generation
│   ├── video-pipeline.js  # Pipeline orchestrator
│   ├── upload/            # Multi-platform uploaders
│   │   ├── index.js
│   │   ├── tiktok.js
│   │   ├── youtube.js
│   │   ├── instagram.js
│   │   └── linkedin.js
│   └── customer-service/  # Qdrant + Claude CS agent
├── content/               # Research, scripts, calendars
│   ├── audience-personas.md
│   ├── competitor-analysis.md
│   ├── channel-personas.md
│   ├── thumbnail-design-system.md
│   └── brand-identity.md
├── scripts/               # CLI tools
│   └── hailuo-test.js
├── uploads/               # Generated video output
└── logs/                  # Cost tracking, run logs
```

---

## Pipeline Flow

```
Script Outline (content/)
  → MiniMax M2 (lib/script-generator.js) → Full Script
  → ElevenLabs / MiniMax TTS (lib/tts.js) → Audio
  → Hailuo film.03 (lib/hailuo.js) → Raw Video
  → QC & Export (lib/video-pipeline.js)
  → Multi-Platform Upload (lib/upload/) → Published!
```

---

## Milestones

### Phase 1 — Foundation ✅ (2026-03-25)
- [x] Pipeline built (script → TTS → video → upload)
- [x] Hailuo AI integration (`lib/hailuo.js`)
- [x] Multi-platform uploaders (`lib/upload/`)
- [x] Content research (audiences, competitors, personas)
- [x] Brand identity and design system

### Phase 2 — Pilot Production 🔄 (In Progress)
- [ ] Generate 10 pilot videos (5 per channel) ← **TKP-35 blocked: awaiting node execution**
- [ ] Validate pipeline end-to-end
- [ ] Confirm video quality meets brand standards

### Phase 3 — Scale to 100
- [ ] Upgrade Hailuo to paid tier (3/day free cap insufficient)
- [ ] Full OAuth tokens for TikTok + YouTube upload
- [ ] Batch generation scheduling
- [ ] Thumbnail auto-generation (MiniMax image-01)

### Phase 4 — 1,000 Videos + Monetization
- [ ] Reach 10,000 TikTok followers ← **TKP-7**
- [ ] Enable TikTok Creator Fund
- [ ] Brand sponsorship integration
- [ ] Affiliate product linking
- [ ] Full 80% automation of content cycle

---

## Key Constraints

| Constraint | Detail |
|---|---|
| Hailuo free tier | 3 videos/day (film.03) |
| ElevenLabs free | 10,000 chars/month |
| Pexels free | 200 credits/month |
| TikTok upload | Requires OAuth user access token |
| YouTube upload | Requires OAuth + refresh token |
| Scaling to 1000 | Paid Hailuo tier required |

---

## Team

| Role | Agent | Responsibility |
|---|---|---|
| CEO | 41d7263e | Strategy, board, governance |
| Founding Engineer | 7bb601dc | Core product, infra |
| Founding Engineer 2 | be3b4d40 | **This agent** — pipeline, video, integrations |
| Producer | — | Content ideation, scripting |
| Publisher | — | Upload scheduling, community |
| Designer | — | Thumbnails, visual assets |

---

*Last updated: 2026-03-25 by Founding Engineer 2*
