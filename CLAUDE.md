# CLAUDE.md — TKP ACI

This file provides guidance for Claude Code working with this workspace.

## Project Overview

**TKP ACI** — AI-powered video production company
- **Company ID:** `fe90b604-364f-480d-be10-6a529971db57`
- **Workspace:** `C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI`
- **Mission:** Zero-human video production pipeline (GOAL-5: Xianxia Content Factory)

## Memory Architecture (4-Layer)

```
memory/
├── MEMORY.md              # Layer 1: Index (READ THIS FIRST)
├── topics/                # Layer 2: On-demand
│   ├── production.md      # Pipeline, Hailuo specs
│   ├── xianxia.md        # GOAL-5 series context
│   ├── api-status.md     # Service health
│   ├── agents.md         # Agent registry
│   └── uploads.md         # TikTok/YouTube status
└── snapshots/            # Layer 4: Backups
```

## ⚠️ VERIFICATION RULE (CRITICAL)

**Memory is a HINT, not truth.**

Before acting:
```bash
# Verify API
curl http://localhost:3100/health

# Verify video exists
ls outputs/xianxia/{id}/

# Verify task status
curl "http://localhost:3100/api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?status=todo"
```

## Video Production Pipeline

```
Content Director → scripts/pending/xianxia/
        ↓
Nova/Nova2/Nova3 → Hailuo AI
        ↓
outputs/xianxia/{id}/final.mp4
        ↓
Production Manager → n8n → TikTok
        ↓
YouTube (browser)
```

## Key Directories

| Path | Purpose |
|------|---------|
| `outputs/xianxia/` | Xianxia video output |
| `output_topic/videos/` | PW series |
| `output/videos/` | GZ series |
| `scripts/pending/xianxia/` | Pending scripts |
| `agents/*/memory/` | Agent personal memory |

## Agent Status

| Agent | Status |
|-------|--------|
| Production Manager | **running** |
| Nova/Nova2/Nova3 | ERROR (need restart) |
| Others | idle |

## GOAL-5: Xianxia Content Factory

- **Target:** 30 videos/week
- **Format:** 5 scenes × 6s = 30s
- **Series:** Trieu Tien, Dau Pha Thuong Khau, Tru Tien, etc.
