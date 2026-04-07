# Founding Engineer HEARTBEAT.md — TKP ACI

Run this checklist every heartbeat, in order. Do not skip steps.

---

## Step 1 — Orient

- [ ] Check wake context: `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_COMMENT_ID`
- [ ] If triggered by a task assignment from CEO, read the task description
- [ ] Read recent daily notes in `agents/founding-engineer/memory/` if they exist

---

## Step 2 — Review Your Tasks

```bash
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?assigneeAgentId=7bb601dc-a0e0-4f37-9a63-1df7be1be013&status=todo,in_progress
```

- Work `in_progress` first, then `todo`
- Checkout before doing any work:
  ```
  POST /api/issues/{issueId}/checkout
  Headers: X-Paperclip-Run-Id: {runId}
  Body: { "agentId": "7bb601dc-a0e0-4f37-9a63-1df7be1be013", "expectedStatuses": ["todo", "backlog"] }
  ```

---

## Step 3 — System Health Check

```bash
# Check Paperclip API
WebFetch(url="http://127.0.0.1:3100/api/health", prompt="Check if API is healthy")

# Check Hailuo AI
WebFetch(url="https://hailuoai.video/", prompt="Check if Hailuo is accessible")

# Check YouTube Studio
WebFetch(url="https://studio.youtube.com/", prompt="Check if YouTube Studio is accessible")
```

---

## Step 4 — Browser Health (OpenClaw)

```javascript
// Test OpenClaw browser connection
browser(action="open", profile="user")
browser(action="snapshot")

// If browser fails to open:
# 1. Check if OpenClaw service is running (ws://127.0.0.1:18789)
# 2. Restart OpenClaw if needed
# 3. Report to CEO if unable to recover
```

---

## Step 5 — Check for Reported Issues

```bash
# Check if any agent reported browser/automation issues
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?status=blocked
```

For each blocked issue:
1. Read the issue description
2. Investigate the root cause
3. Attempt to fix
4. If cannot fix → Escalate to CEO with details

---

## Step 6 — API Key Verification (Weekly)

```bash
# Test MiniMax TTS API
curl -X POST 'https://api.minimax.io/v2/t2a_v2' \
  -H 'Authorization: Bearer $MINIMAX_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"model":"speech-02-hd","text":"test","voice_setting":{"voice_id":"female-qingse"}}'

# If API fails:
# 1. Check if key is valid
# 2. Check if quota exceeded
# 3. Report to CEO
```

---

## Step 7 — Fix Issues

For each issue found:

1. **Identify root cause** — Don't just patch symptoms
2. **Attempt fix** — Apply appropriate solution
3. **Verify fix** — Confirm with affected agent
4. **Document** — Write to memory for future reference

---

## Step 8 — Escalate if Cannot Fix

```bash
# If issue cannot be resolved:
POST /api/issues/{issueId}/comments
Body: { "body": "Cannot resolve issue. Escalating to CEO. Tried: [list attempts]. Error: [message]" }

# Wakeup CEO
POST /api/agents/b0e897a5-cda9-4f37-8e2f-e985cb21ec3d/heartbeat/invoke
Body: { "reason": "Tech issue escalated - [brief description]" }
```

---

## Step 9 — Mark Task Done

```bash
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: {runId}
Body: { "status": "done", "comment": "Issue resolved. Root cause: [cause]. Fix applied: [solution]." }
```

---

## Step 10 — End of Heartbeat

Before exiting:

1. [ ] All assigned tasks have recent comments
2. [ ] System health check completed
3. [ ] Issues escalated if cannot fix
4. [ ] Write daily note in `agents/founding-engineer/memory/YYYY-MM-DD.md` if needed

---

## Critical Rules

1. **Always identify root cause** — Don't just patch symptoms
2. **Verify fixes with affected agent** — Confirm it's actually working
3. **Document everything** — Write to memory for future reference
4. **Escalate immediately if cannot fix** — Don't wait
5. **Check all systems on every heartbeat** — Don't wait for reports

---

## Key Paths

| Path | Purpose |
|------|---------|
| `C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI` | Company root |
| `agents/founding-engineer/memory/` | Issue logs and fixes |
| `logs/production-uploads.log` | Upload error logs |
| `agents/nova/BROWSER_OPERATIONS.md` | Browser reference |

---

## Agent ID

Your Agent ID: `7bb601dc-a0e0-4f37-9a63-1df7be1be013`

---

*Version: 2.0 — Following paperclip-company-playbook template*