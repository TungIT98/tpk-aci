---
name: n8n-workflows
description: >
  Use when: Managing n8n automation workflows, checking TikTok auto-upload status,
  troubleshooting n8n, or configuring new automation pipelines.
  Do NOT use when: Creating videos, writing scripts, or doing quality control.
---

# n8n Workflow Skill

## n8n Basics

- **URL:** http://localhost:5678/
- **Start:** `npx n8n` or docker
- **Workflow File:** `scripts/n8n_tiktok_workflow.json`

## TikTok Upload Workflow

### How It Works
1. Production Manager places video at: `content/videos/xianxia/{id}/captioned.mp4`
2. n8n watches this folder (file system trigger)
3. n8n picks up video, adds caption, uploads to TikTok
4. n8n logs result and moves file to processed/

### Workflow Setup

**Import workflow:**
```bash
npx n8n import:workflow --input=scripts/n8n_tiktok_workflow.json
```

**Or via UI:**
1. Open n8n: http://localhost:5678/
2. Click "Import from JSON"
3. Paste workflow from `scripts/n8n_tiktok_workflow.json`

### TikTok Credentials in n8n
- Configure TikTok OAuth in n8n credentials node
- Credentials: thanhtungtran364@gmail.com
- Permission: upload, manage videos

## Checking Workflow Health

### Is n8n Running?
```
WebFetch(url="http://localhost:5678/", prompt="Is n8n accessible and showing the UI?")
```

### Are Workflows Active?
1. Open n8n UI
2. Check workflow "TikTok Auto-Upload" is ON (toggle green)
3. Check last execution timestamp

### Check Execution Logs
1. Open n8n → Workflows → TikTok Auto-Upload
2. Click "Executions" tab
3. Check for errors

## Troubleshooting

| Problem | Fix |
|---------|-----|
| n8n won't start | `npx n8n` — check port 5678 |
| Workflow not triggering | Check folder path matches `content/videos/xianxia/` |
| TikTok upload fails | Check credentials in n8n, re-authorize if needed |
| Video not moving | Check "processed" folder path |
| Duplicate uploads | Add hash check in workflow |

## n8n Workflow Nodes Reference

```
[File Trigger] → [Read File] → [TikTok Node] → [Move File]
     watches folder         caption + upload    processed/
```

### TikTok Node Config
- Operation: upload
- File Path: from trigger
- Caption: from filename pattern `{series} EP{episode} #xianxia`
- Privacy: Public

## Backup / Manual Fallback

If n8n fails completely:
1. Use browser automation directly: `lib/upload/tiktok-browser.js`
2. Or upload manually via TikTok Studio
3. Report n8n failure to Founding Engineer 2
