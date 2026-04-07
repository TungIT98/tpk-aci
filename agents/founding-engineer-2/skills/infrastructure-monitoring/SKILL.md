---
name: infrastructure-monitoring
description: >
  Use when: Monitoring disk space, tracking storage usage, checking file organization,
  or identifying infrastructure bottlenecks.
  Do NOT use when: Creating content, troubleshooting browser issues, or managing uploads.
---

# Infrastructure Monitoring Skill

## Storage Checks

### Disk Space
```bash
Get-PSDrive C | Select-Object Name, @{N='FreeGB';E={[math]::Round($_.Free/1GB,2)}}, @{N='UsedGB';E={[math]::Round($_.Used/1GB,2)}}
```

### Alert Thresholds
| Free Space | Status | Action |
|------------|--------|--------|
| > 50GB | ✅ OK | None |
| 20-50GB | ⚠️ Warning | Monitor |
| 10-20GB | ⚠️ Warning | Alert CEO |
| < 10GB | 🔴 Critical | Alert CEO + clear temp files |

### Outputs Folder Size
```bash
Get-ChildItem C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\outputs -Recurse -File | Measure-Object -Property Length -Sum
```
Alert if > 50GB total.

## File Organization

### Check Stale Scripts (>7 days old)
```bash
Get-ChildItem scripts/pending/xianxia/*.json | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) }
```

### Check Stuck Videos (>3 days no update)
```bash
Get-ChildItem outputs/xianxia/*/final.mp4 -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-3) }
```

### Organization Standards
```
TKP_ACI/
├── agents/              # Agent configs
├── content/
│   ├── trending-topics.md
│   ├── keyword-research.md
│   ├── dashboards/
│   └── reports/
├── scripts/
│   ├── pending/xianxia/ # Pending scripts
│   └── n8n_tiktok_workflow.json
├── outputs/xianxia/    # Video outputs per episode
│   └── XIANYX-01/
│       ├── raw_scene1.mp4
│       ├── ...
│       └── final.mp4
└── logs/
```

## Cleanup Actions

### Safe to Delete
- `outputs/xianxia/*/raw_*.mp4` (after final assembled) — Can be regenerated
- Old FFmpeg temp files
- Failed generation attempts

### NEVER Delete
- `outputs/xianxia/*/final.mp4` (published content)
- `scripts/pending/*.json` (unless explicitly done)
- `.tiktok-session.json` or `.youtube-session.json`

## Monitoring Report

Save to: `agents/founding-engineer-2/memory/YYYY-MM-DD.md`

```markdown
# Infrastructure Report — 2026-04-01

## Disk Space
- Free: 45GB
- Used: 210GB
- Status: ⚠️ Monitor

## Outputs Folder
- Total size: 32GB
- Video count: 120
- Status: ✅ OK

## Stale Scripts
- Count: 2 (scripts/xianxia/XIANYX-old1, XIANYX-old2)
- Status: ⚠️ Flag for CEO

## Stuck Videos
- Count: 0
- Status: ✅ OK
```
