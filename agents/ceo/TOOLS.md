# CEO Tools

## Paperclip API

Base URL: `http://localhost:3100/api`
Company ID: `fe90b604-364f-480d-be10-6a529971db57`

### Critical Headers
```
Always include header: X-Paperclip-Run-Id: {runId}
```

### Key Endpoints

```bash
# Health check
GET /api/health

# Dashboard overview
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/dashboard

# List all agents
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/agents

# Issues by status
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?status=todo,in_progress,blocked

# Checkout issue (ALWAYS before working)
POST /api/issues/{issueId}/checkout
Headers: X-Paperclip-Run-Id: {runId}
Body: { "agentId": "b0e897a5-cda9-4f37-8e2f-e985cb21ec3d", "expectedStatuses": ["todo", "backlog"] }

# Complete issue
PATCH /api/issues/{issueId}
Body: { "status": "done" }

# Create task (subtask)
POST /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues
Body: { "title", "description", "assigneeAgentId", "parentId", "goalId", "projectId", "status": "todo" }

# Post comment
POST /api/issues/{issueId}/comments
Body: { "body": "markdown" }

# Agent heartbeat/wakeup
POST /api/agents/{agentId}/heartbeat/invoke
Body: { "reason": "pipeline task" }

# Resume agent
POST /api/agents/{agentId}/resume

# Pause agent
POST /api/agents/{agentId}/pause

# Company issues
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues
PATCH /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues/{issueId}
```

---

## Agent IDs

| Role | Agent ID |
|------|----------|
| CEO (you) | b0e897a5-cda9-4f37-8e2f-e985cb21ec3d |
| Nova | b59b05d6-5a79-46ef-ac96-868cbbdc5ebf |
| Nova 2 | 8e06e2ee-45d7-475d-b7b0-381bd5ed6490 |
| Nova 3 | 305c8b58-b3cf-40f3-8444-395b43a902c6 |
| Production Manager | e3aad368-fab1-4da3-b287-3a65802d84ff |
| Content Director | 24ac8a23-d723-4909-bf40-05f4d4fce689 |
| SEO Specialist | 9ff4e340-dd34-4476-9238-da8fdbce0873 |
| Analytics Agent | dc1160e2-d472-4cdd-81a7-f79ea4ac8e53 |
| Founding Engineer | 7bb601dc-a0e0-4f37-9a63-1df7be1be013 |
| Founding Engineer 2 | be3b4d40-f9e0-40ff-a666-c657c29f4995 |

---

## File System

```
Company Root: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI
CEO Home: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\agents\ceo
Scripts: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\scripts
Pending: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\scripts\pending
Outputs: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\outputs
Video Directory (canonical): C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\output_topic\videos
Legacy Video Directory: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\output\videos
Logs: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\logs
Memory: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\agents\ceo\memory
```

---

## Credentials

| Service | Account |
|---------|---------|
| Hailuo | thanhtungtran364@gmail.com |
| YouTube | thanhtungtran364@gmail.com |
| TikTok | thanhtungtran364@gmail.com |
| Telegram | Bot: 7791665957:AAHdNKwHYMecEK6WbmmIcWDVeF8XOUgNZBY |

---

## Communication Protocol

- CEO communicates with Founder via Paperclip board
- Worker agents report to CEO, never directly to Founder
- Do NOT use email — use Paperclip tasks and comments
- No OAuth — TikTok/YouTube via browser automation

---

## Skip Rules (Always Ignore)

- TikTok OAuth tasks → CANCEL
- Tasks waiting on external API approvals → Skip
- Old stuck tasks → Skip and move on
- Tasks without clear acceptance criteria → Do not create