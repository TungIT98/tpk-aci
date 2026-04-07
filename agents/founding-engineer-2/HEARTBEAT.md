# Founding Engineer 2 HEARTBEAT.md — TKP ACI

Run this checklist every heartbeat, in order. Do not skip steps.

---

## Step 1 — Orient

- [ ] Check wake context: `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_COMMENT_ID`
- [ ] If triggered by a task assignment from CEO, read the task description
- [ ] Read recent daily notes in `agents/founding-engineer-2/memory/` if they exist

---

## Step 2 — Review Your Tasks

```bash
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?assigneeAgentId=be3b4d40-f9e0-40ff-a666-c657c29f4995&status=todo,in_progress
```

- Work `in_progress` first, then `todo`
- Checkout before doing any work:
  ```
  POST /api/issues/{issueId}/checkout
  Headers: X-Paperclip-Run-Id: {runId}
  Body: { "agentId": "be3b4d40-f9e0-40ff-a666-c657c29f4995", "expectedStatuses": ["todo", "backlog"] }
  ```

---

## Step 3 — Infrastructure Checks

### Storage Check

```bash
# Check disk space
Get-PSDrive C | Select-Object Name, @{N='FreeGB';E={[math]::Round($_.Free/1GB,2)}}, @{N='UsedGB';E={[math]::Round($_.Used/1GB,2)}}

# Alert if free < 10GB
```

### Output Folder Size

```bash
# Check total size of outputs/
Get-ChildItem C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\outputs -Recurse -File | Measure-Object -Property Length -Sum

# Alert if > 50GB
```

---

## Step 4 — Pipeline Health Check

### Stale Scripts Check (>7 days)

```bash
Get-ChildItem C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\scripts\pending\*.json | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-7)
}
```

If stale scripts found → Flag for CEO in comment

### Stuck Videos Check (>3 days no update)

```bash
Get-ChildItem C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\outputs\*\final.mp4 -ErrorAction SilentlyContinue | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-3)
}
```

If stuck videos found → Flag for CEO in comment

---

## Step 5 — n8n Workflow Check

```bash
# Check if n8n is running
WebFetch(url="http://localhost:5678/", prompt="Is n8n accessible and running?")

# Verify TikTok workflow is active
Read: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\scripts\n8n_tiktok_workflow.json
```

---

## Step 6 — Report Issues to CEO

```bash
# If infrastructure issues found:
POST /api/issues/{issueId}/comments
Body: { "body": "Infrastructure issue: [description]. Action taken: [fix] or needs CEO attention." }

# If cannot fix:
POST /api/agents/b0e897a5-cda9-4f37-8e2f-e985cb21ec3d/heartbeat/invoke
Body: { "reason": "Infrastructure issue - [brief description]" }
```

---

## Step 7 — Mark Task Done

```bash
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: {runId}
Body: { "status": "done", "comment": "Infrastructure check complete. [summary of findings]" }
```

---

## Step 8 — End of Heartbeat

Before exiting:

1. [ ] All assigned tasks have recent comments
2. [ ] Infrastructure checks completed
3. [ ] Issues escalated if cannot fix
4. [ ] Write daily note in `agents/founding-engineer-2/memory/YYYY-MM-DD.md` if needed

---

## Critical Rules

1. **Alert on low disk space** — < 10GB free is critical
2. **Flag stale scripts** — > 7 days old, CEO needs to know
3. **Flag stuck videos** — > 3 days no update, pipeline bottleneck
4. **Check n8n weekly** — Ensure TikTok automation is running
5. **Document everything** — Write to memory for future reference

---

## Key Paths

| Path | Purpose |
|------|---------|
| `C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI` | Company root |
| `scripts/pending/` | Video scripts (check for staleness) |
| `outputs/` | Video outputs (check for stuck videos) |
| `scripts/n8n_tiktok_workflow.json` | TikTok automation |
| `agents/founding-engineer-2/memory/` | Issue logs |

---

## Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Disk Free Space | < 20GB | < 10GB |
| Outputs Folder Size | > 30GB | > 50GB |
| Script Age (pending) | > 5 days | > 7 days |
| Video No Update | > 2 days | > 3 days |

---

## Agent ID

Your Agent ID: `be3b4d40-f9e0-40ff-a666-c657c29f4995`

---

*Version: 2.0 — Following paperclip-company-playbook template*