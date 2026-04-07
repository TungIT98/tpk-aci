# TKP_ACI COMPANY FRAMEWORK
**Version: 2026.325.0**
**Last Updated: 2026-03-30**
**Framework Type: AI-Powered Video Content Company**

---

## EXECUTIVE SUMMARY

This document serves as the **SINGLE SOURCE OF TRUTH** for TKP ACI company structure, operations, and governance. It is designed as a **TEMPLATE** for creating future companies on Paperclip AI.

### Company Profile
| Field | Value |
|-------|-------|
| **Company ID** | `fe90b604-364f-480d-be10-6a529971db57` |
| **Company Name** | TKP ACI (TKP Content Agency) |
| **Platform** | Paperclip AI (self-hosted, free, open-source) |
| **Mission** | AI-powered zero-human video content business |
| **Target** | 1000 videos in 30 days |
| **Tech Stack** | Node.js 20+, Paperclip (Claude Local adapter), ES Modules |

---

## PART 1: COMPANY ARCHITECTURE

### 1.1 Organization Chart

```
                           ┌─────────────────┐
                           │      CEO        │
                           │   (Strategic)   │
                           │  Owner: Tùng    │
                           └────────┬────────┘
                                    │
        ┌──────────┬──────────┬─────┴────┬──────────┬──────────┐
        │          │          │          │          │          │
   ┌────┴───┐ ┌───┴────┐ ┌───┴────┐ ┌───┴────┐ ┌──┴────┐ ┌───┴────┐
   │Content │ │   SEO  │ │  Nova  │ │Production│ │Founding│ │Analytics│
   │Director│ │Specialist│ │(Video)│ │ Manager │ │Engineer│ │ Agent  │
   └────────┘ └────────┘ └────────┘ └─────────┘ └────────┘ └────────┘
```

### 1.2 Agent Registry

| Agent | ID | Role | Status | Key Files |
|-------|-----|------|--------|-----------|
| **CEO** | `b0e897a5-cda9-4f37-8e2f-e985cb21ec3d` | Orchestrator | running | AGENTS.md, SOUL.md, HEARTBEAT.md, TOOLS.md |
| **Nova** | `b59b05d6-5a79-46ef-ac96-868cbbdc5ebf` | Browser Operator (Video) | idle | AGENTS.md, HEARTBEAT.md |
| **Nova 2** | `8e06e2ee-45d7-475d-b7b0-381bd5ed6490` | Browser Operator (Video) | idle | AGENTS.md, HEARTBEAT.md |
| **Nova 3** | `305c8b58-b3cf-40f3-8444-395b43a902c6` | Browser Operator (Video) | idle | AGENTS.md, HEARTBEAT.md |
| **Content Director** | `24ac8a23-d723-4909-bf40-05f4d4fce689` | Script Writer | idle | AGENTS.md, HEARTBEAT.md |
| **Production Manager** | `e3aad368-fab1-4da3-b287-3a65802d84ff` | QC + Upload | running | AGENTS.md, HEARTBEAT.md |
| **SEO Specialist** | `9ff4e340-dd34-4476-9238-da8fdbce0873` | Trends + Keywords | running | AGENTS.md, SOUL.md, TOOLS.md, HEARTBEAT.md |
| **Analytics Agent** | `dc1160e2-d472-4cdd-81a7-f79ea4ac8e53` | Performance Tracking | idle | AGENTS.md, HEARTBEAT.md |
| **Founding Engineer** | `7bb601dc-a0e0-4f37-9a63-1df7be1be013` | Tech Support | running | AGENTS.md, SOUL.md, TOOLS.md, HEARTBEAT.md |
| **Founding Engineer 2** | `be3b4d40-f9e0-40ff-a666-c657c29f4995` | Infrastructure | idle | AGENTS.md, SOUL.md, TOOLS.md, HEARTBEAT.md |

### 1.3 Agent Adapter Configuration

All agents use `claude_local` adapter:
```yaml
adapter:
  type: claude_local
  config:
    model: MiniMax-M2.7-highspeed
    maxTurnsPerRun: 300
    timeoutSec: 600
    dangerouslySkipPermissions: true
```

---

## PART 2: GOVERNANCE RULES (CRITICAL)

### 2.1 Language Rule (ENCODING FIX - 2026-03-30)
**ALL task titles, instructions, and agent communications MUST be in ENGLISH ONLY.**

**Reason:** Paperclip API corrupts Vietnamese UTF-8 text during pipeline transit.

**Exception:** User-facing content (video scripts, captions, hashtags) CAN use Vietnamese.

### 2.2 Control-Plane Rules

1. **Single-Assignee Task Model**: Each task has ONE assignee only
2. **Atomic Issue Checkout**: Immediately checkout task, execute, update status, never abandon
3. **Never Leave Tasks in "Todo"**: Todo tasks = unexecuted = failure
4. **Skip Blocked Tasks**: If OAuth or external API blocked, skip and focus on available work

### 2.3 Skip Rules (CEO MUST FOLLOW)
- TikTok OAuth tasks → CANCEL (we use browser automation)
- Tasks waiting on external API approvals → Skip
- Old stuck tasks → Skip

---

## PART 3: GOALS & KEY RESULTS

### 3.1 Company-Level OKRs

| Objective | Key Results |
|-----------|-------------|
| **O1: Launch Video Pipeline** | KR1: Generate 1000 videos in 30 days |
| | KR2: Achieve YouTube Partner Program eligibility |
| | KR3: Build engaged TikTok audience |
| **O2: Operational Excellence** | KR1: 6 videos produced daily |
| | KR2: QC pass rate > 95% |
| | KR3: Zero human intervention in production |
| **O3: Revenue Generation** | KR1: YouTube Shorts monetization active |
| | KR2: TikTok affiliate links working |

### 3.2 Per-Agent Goals

| Agent | Daily Goals |
|-------|------------|
| CEO | Create daily pipeline tasks, monitor team, unblock blockers |
| Content Director | Write 6 detailed scripts with prompt_for_hailuo |
| Nova | Generate 6 videos, verify, upload to platforms |
| Production Manager | QC all videos, upload, track metrics |
| SEO Specialist | Find 10 trending topics, update content calendar |
| Analytics Agent | Track performance, create weekly reports |

---

## PART 4: PRODUCTION PIPELINE

### 4.1 Pipeline Stages

```
SCRIPT CREATION (Content Director)
    ↓ (writes scripts/pending/{id}.json with status="pending")
CEO SCANS & CREATES TASK
    ↓ (creates Paperclip issue for Nova)
NOVA - VIDEO GENERATION
    ↓ Hailuo AI → Download → Verify hash unique
NOVA - AUDIO GENERATION
    ↓ MiniMax TTS or Edge TTS
PRODUCTION MANAGER - QC
    ↓ Hash check, file size >1MB, duration check
PRODUCTION MANAGER - UPLOAD
    ↓ Browser automation → YouTube + TikTok
ANALYTICS - TRACK
    ↓ Monitor views, engagement, CTR
```

### 4.2 Video Generation Priority Chain

```
1. MiniMax Hailuo Video (3/day FREE) → quota resets midnight UTC
   ↓ if exhausted
2. Pexels Stock Video (200/month FREE) → real footage fallback
   ↓ if unavailable
3. MiniMax Image + FFmpeg Ken Burns → last resort, lower quality
```

### 4.3 Video Specifications

| Platform | Resolution | Duration | FPS | Format |
|----------|------------|----------|-----|--------|
| TikTok | 1080x1920 (9:16) | 30-60s | 30 | MP4 H.264 |
| YouTube Shorts | 1080x1920 (9:16) | <60s | 30 | MP4 H.264 |

---

## PART 5: PROJECT STRUCTURE

### 5.1 Active Projects

| Series | Description | Scripts | Status |
|--------|-------------|---------|--------|
| PW-01 to PW-18 | Pilot videos | 18 | Completed |
| GZ-01 to GZ-12 | Gen Z Success | 12 | GZ-06 to GZ-12 pending |
| HG-01 | Hot Girl Fitness | 1 | Published |
| WC-01 to WC-10 | World Cup | 10 | WC-06 to WC-10 published |
| TN-01 to TN-05 | Tien Nghich (Movie) | 5 | Planning phase |
| MOVIE-01 | The Last of Us | 1 | Error (Hailuo limit) |

### 5.2 Directory Structure

```
TKP_ACI/
├── .env                          # API keys, credentials
├── agents/                       # Agent definitions
│   ├── ceo/                      # AGENTS.md, SOUL.md, HEARTBEAT.md, TOOLS.md
│   ├── nova/                     # AGENTS.md, HEARTBEAT.md
│   ├── content-director/         # AGENTS.md, HEARTBEAT.md
│   ├── production-manager/       # AGENTS.md, HEARTBEAT.md
│   ├── seo-specialist/           # AGENTS.md, SOUL.md, TOOLS.md, HEARTBEAT.md
│   ├── analytics-agent/          # AGENTS.md, HEARTBEAT.md
│   ├── founding-engineer/        # AGENTS.md, SOUL.md, TOOLS.md, HEARTBEAT.md
│   └── founding-engineer-2/      # AGENTS.md, SOUL.md, TOOLS.md, HEARTBEAT.md
├── content/                      # Content research
│   ├── tien-nghich/             # Movie project
│   └── seo-briefs/              # SEO briefs
├── scripts/                      # Automation scripts
│   ├── pending/                  # Pending script JSONs (status="pending")
│   ├── hailuo-*.js              # Hailuo browser automation
│   ├── upload-*.js/.mjs         # Platform upload scripts
│   └── gen-*.js/.mjs            # Generation scripts
├── outputs/                      # Generated videos by series
├── n8n/                          # n8n workflow files (16 workflows)
├── video_studio_app/            # Python video studio
├── stable-diffusion/            # SD webui (fallback)
└── logs/                        # Preflight checks, logs
```

---

## PART 6: SKILLS & CAPABILITIES MATRIX

| Agent | Core Skills | Tools/APIs | Files Executed |
|-------|-------------|------------|---------------|
| CEO | Orchestration, task creation | Paperclip API | - |
| Nova | Video gen, TTS, FFmpeg, browser upload | Hailuo, MiniMax TTS, OpenClaw | hailuo-*.js, gen-*.js |
| Content Director | Script writing, visual direction | Claude/ChatGPT | - |
| Production Manager | QC, upload, tracking | FFmpeg, browser | upload-*.js |
| SEO Specialist | Trend research, keyword optimization | Web search | - |
| Analytics Agent | Performance tracking, reporting | Platform APIs | - |
| Founding Engineer | Tech troubleshooting | Browser tools | fix-*.js, patch-*.ps1 |
| Founding Engineer 2 | TikTok setup, monitoring | TikTok API | - |

---

## PART 7: AUTOMATION & ROUTINES

### 7.1 Routines (Paperclip Native)

Each agent has a scheduled routine in Paperclip:

| Routine ID | Agent | Schedule | Description |
|------------|-------|----------|-------------|
| `0fb716d5-590f-47d1-bb32-4c0cf8478036` | CEO | */30 * * * * | Create daily pipeline tasks |
| `43e25417-cf24-4b77-8527-4411f21ed24e` | Content Director | */5 * * * * | Write scripts from trends |
| `d1243591-26d2-4e86-9aa8-03c707ae2e12` | Nova | */5 * * * * | Generate videos from scripts |
| `fe5a83cd-6a7d-49e1-99e5-0fe824bd8f96` | Production Manager | */5 * * * * | QC and upload videos |
| `59b374c8-ceb1-4330-95bc-68562fe1dd6d` | SEO Specialist | */5 * * * * | Find trending topics |
| `b906a0a2-5849-4635-ad9a-93520262e089` | Analytics Agent | */5 * * * * | Track performance |
| `7f7f1719-9d30-4441-9896-f2b33f380b74` | Founding Engineer | */5 * * * * | System health checks |
| `a7d8fc22-aebc-4da5-b7ab-65d1f9a9bc04` | Founding Engineer 2 | */5 * * * * | Infrastructure monitoring |

### 7.2 Heartbeat Files (Agent Self-Check)

Each agent has a `HEARTBEAT.md` file defining their self-check loop:

```
EVERY HEARTBEAT:
    1. Identity check
    2. Get assigned tasks
    3. Checkout task
    4. Understand context
    5. Execute work
    6. Update status
    7. Fact extraction
    8. Exit
```

### 7.3 CEO Daily Pipeline Routine

```
EVERY HEARTBEAT:
    1. Check if pipeline tasks exist today
    2. If NO tasks → CREATE PIPELINE:
       - Task for SEO: "Daily: Find 10 Trending Topics"
       - Task for Content Director: "Daily: Write 6 Video Scripts"
       - Task for Nova: "Daily: Generate 6 Videos from Scripts"
       - Task for Production Manager: "Daily: Upload and QC 6 Videos"
    3. Monitor team progress
    4. Unblock when possible
    5. If all done → notify Owner
```

### 7.4 Scheduled Scripts

| Script | Purpose | Frequency |
|--------|---------|-----------|
| `agent_heartbeat.bat` | Invoke all 8 agents | Every 5 minutes |
| `produce_video.py` | Hailuo + Pexels video pipeline | On demand |
| `n8n_tiktok_workflow.json` | Auto-upload to TikTok | Auto-triggered |

---

## PART 8: ISSUE & TASK MANAGEMENT

### 8.1 Issue States
```
todo → in_progress → done
                ↓
            blocked (if external dependency)
```

### 8.2 Critical Skip Rules
- TikTok OAuth → CANCEL
- YouTube API blocked → Use browser upload
- Hailuo quota exhausted → Use Pexels fallback

### 8.3 API Endpoints

| Purpose | Endpoint |
|---------|----------|
| Heartbeat | POST /api/agents/{agentId}/heartbeat/invoke |
| List Agents | GET /api/companies/{companyId}/agents |
| Get Issues | GET /api/companies/{companyId}/issues |
| Create Issue | POST /api/companies/{companyId}/issues |
| Update Issue | PATCH /api/issues/{issueId} |

---

## PART 9: DATA MANAGEMENT (ROADMAP-BASED)

### 9.1 Alerting System (3-Tier)

| Level | Severity | Response |
|-------|----------|----------|
| **Critical** | System core failure | Immediate notification |
| **Alert** | Resource/performance warning | Monitor closely |
| **Warning** | Minor issue | Log and track |

### 9.2 API Security & RBAC

- Token-Based Authentication for all APIs
- OAuth 2.0 for platform integrations
- Rate Limiting to prevent DDoS
- Role-based access: Viewer, Editor, Admin

### 9.3 Monitoring & Logging

| Log Type | Purpose |
|----------|---------|
| Login Logs | Track authentication |
| Access Logs | Monitor API usage |
| Error Logs | Debug failures |
| Change Logs | Audit file modifications |

---

## PART 10: CONTENT OPERATIONS

### 10.1 Content Calendar (6 Pillars)

| Day | Category | Focus |
|-----|----------|-------|
| Monday | Hot Girl | Fitness, dance, yoga |
| Tuesday | Tech & AI | Robots, cyberpunk |
| Wednesday | Lifestyle | Routine, food, travel |
| Thursday | Comedy | Relatable moments |
| Friday | Motivation | Success, hustle |
| Saturday | Movie Review | Reactions, reviews |
| Sunday | Trending Aesthetic | Calm, relaxing |

### 10.2 SEO Workflow

```
1. Search TikTok/YouTube/Twitter/Reddit for trends
2. Compile top 10 trending topics
3. Save to trends/latest.json
4. Assign to content calendar
5. Notify Content Director
```

### 10.3 Publishing Pipeline

| Platform | Method | Status |
|----------|--------|--------|
| YouTube | Browser automation (OpenClaw) | Working |
| TikTok | Browser automation (OpenClaw) | Working |
| TikTok OAuth | n8n workflow | Not configured |

---

## PART 11: PERFORMANCE METRICS

### 11.1 KPIs

| Metric | Target | Current |
|--------|--------|---------|
| Videos/day | 6 | Varies |
| File size | > 1MB | Check each |
| Duration | 6s +/- 1s | Check each |
| Hash uniqueness | Different from previous | Critical |
| QC pass rate | > 95% | - |

### 11.2 Analytics Tracking

| Platform | Metrics Tracked |
|----------|----------------|
| YouTube | Views, Watch Time, CTR, Subscribers |
| TikTok | Views, Engagement, Followers |

---

## PART 12: CONFIGURATION FILES

### 12.1 .env Variables (Critical)

```env
# Paperclip
ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
ANTHROPIC_TOKEN_KEY=sk-cp-...

# MiniMax
MINIMAX_BASE_URL=https://api.minimax.io

# Platform APIs
ELEVENLABS_API_KEY=sk_...
TIKTOK_APP_ID=...
YOUTUBE_CLIENT_ID=...
YOUTUBE_ACCESS_TOKEN=...
YOUTUBE_REFRESH_TOKEN=...

# n8n
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=...

# Agent API Keys
CEO_API_KEY=pcp_...
PRODUCER_API_KEY=pcp_...
PUBLISHER_API_KEY=pcp_...
```

### 12.2 Missing/Unset Keys (GAP)

| Key | Status | Action Required |
|-----|--------|----------------|
| FOUNDING_ENGINEER_2_API_KEY | YOUR_KEY_HERE | Set |
| STABILITY_API_KEY | YOUR_KEY_HERE | Set if needed |
| PICTORY_API_KEY | YOUR_KEY_HERE | Set if needed |
| SYNTHESIA_API_KEY | YOUR_KEY_HERE | Set if needed |
| YOUTUBE_REFRESH_TOKEN | Expired | Re-authenticate |

---

## PART 13: GAP ANALYSIS & RECOMMENDATIONS

### 13.1 Critical Gaps

| Gap | Impact | Fix |
|-----|--------|-----|
| .paperclip.yaml missing at root | Agent config not standardized | Create root .paperclip.yaml |
| FOUNDING_ENGINEER_2_API_KEY not set | Limited agent functionality | Set in .env |
| YouTube refresh token expired | YouTube upload blocked | Re-authenticate OAuth |
| TikTok browser session expired | TikTok upload blocked | Re-establish session |
| ElevenLabs TTS 401 error | Voice generation blocked | Verify API key |
| MiniMax TTS 404 error | Voice generation blocked | Check endpoint URL |

### 13.2 Recommendations

1. **Create .paperclip.yaml** at workspace root with standardized agent definitions
2. **Re-authenticate YouTube** OAuth flow
3. **Configure n8n** TikTok node for auto-upload (alternative to browser)
4. **Set all missing API keys** in .env
5. **Consolidate workspaces**: TKP_ACI and tpk-content-agency run independently

---

## PART 14: FRAMEWORK TEMPLATE FOR NEW COMPANIES

When creating a new company on Paperclip AI, use this template:

### 14.1 Required Files Structure

```
{company_name}/
├── .env                          # API keys
├── .paperclip.yaml               # Agent definitions (CRITICAL)
├── COMPANY.md                    # Company overview
├── MEMORY.md                    # Current status
├── FRAMEWORK.md                 # This document
├── ORG_CHART.md                 # Organization chart
│
├── agents/                       # One folder per agent
│   ├── ceo/
│   │   ├── AGENTS.md            # Role, mission, responsibilities
│   │   ├── SOUL.md              # Personality/character
│   │   ├── HEARTBEAT.md         # Self-check loop routine
│   │   └── TOOLS.md             # Available tools/APIs
│   ├── {agent-2}/
│   │   └── ...
│
├── content/                      # Content storage
├── scripts/                      # Automation scripts
│   └── pending/                  # Pending tasks queue
├── outputs/                      # Generated outputs
├── n8n/                         # Workflow automations
└── logs/                        # System logs
```

### 14.2 Agent Definition Template

```yaml
# .paperclip.yaml
agents:
  {agent-name}:
    adapter:
      type: claude_local
      config:
        model: {model-name}
        maxTurnsPerRun: 300
        timeoutSec: 600
        dangerouslySkipPermissions: true
    inputs:
      env:
        ANTHROPIC_BASE_URL:
          kind: plain
          value: {base-url}
        ANTHROPIC_API_KEY:
          kind: secret
          requirement: required
```

### 14.3 AGENTS.md Template

```markdown
# {Agent Name} - Role

## Identity
- **Name:** {Agent Name}
- **Role:** {Primary Function}
- **Reports to:** {Manager}
- **Agent ID:** {agent-id}

---

## Language Rule (CRITICAL)
ALL task titles and instructions in ENGLISH ONLY.
User-facing content (scripts, captions) can use local language.

---

## Mission
{One sentence mission statement}

## Responsibilities
1. {Responsibility 1}
2. {Responsibility 2}
3. {Responsibility 3}

## Workflow
{Step-by-step workflow}

## Success Metrics
- Metric 1: {Target}
- Metric 2: {Target}

## Escalation
- If blocked by {issue} → {action}
```

### 14.4 HEARTBEAT.md Template

```markdown
# HEARTBEAT.md - {Agent} - {Date}

## Self-Check Loop

```
EVERY HEARTBEAT:
    1. Identity check
    2. Get assigned tasks
    3. Checkout task
    4. Execute work
    5. Update status
    6. Exit
```

## Daily Tasks
- Task 1: {description}
- Task 2: {description}

## API Endpoints Used
- GET /api/agents/me/inbox-lite
- PATCH /api/issues/{issueId}
```

---

## PART 15: QUICK REFERENCE

### Key Paths
| Purpose | Path |
|---------|------|
| Workspace root | `C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/` |
| Scripts | `scripts/pending/` |
| Videos | `outputs/` |
| n8n | `n8n/` |
| Paperclip API | `http://127.0.0.1:3100` |

### Agent Heartbeat IDs
| Agent | ID |
|-------|-----|
| CEO | b0e897a5-cda9-4f37-8e2f-e985cb21ec3d |
| Nova | b59b05d6-5a79-46ef-ac96-868cbbdc5ebf |
| Nova 2 | 8e06e2ee-45d7-475d-b7b0-381bd5ed6490 |
| Nova 3 | 305c8b58-b3cf-40f3-8444-395b43a902c6 |
| Production Manager | e3aad368-fab1-4da3-b287-3a65802d84ff |
| Analytics Agent | dc1160e2-d472-4cdd-81a7-f79ea4ac8e53 |
| Content Director | 24ac8a23-d723-4909-bf40-05f4d4fce689 |
| SEO Specialist | 9ff4e340-dd34-4476-9238-da8fdbce0873 |
| Founding Engineer | 7bb601dc-a0e0-4f37-9a63-1df7be1be013 |
| Founding Engineer 2 | be3b4d40-f9e0-40ff-a666-c657c29f4995 |

---

*Document Version: 2026.325.0*
*Last Updated: 2026-03-30*
*Maintained by: CEO Agent*
