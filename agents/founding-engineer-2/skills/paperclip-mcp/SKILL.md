---
name: paperclip-mcp-integration
description: >
  Use when: Controlling Paperclip dashboard via MCP, querying agent status, managing goals,
  or automating Paperclip operations from Claude Code or other MCP clients.
  Do NOT use when: Creating videos, uploading content, or doing creative work.
triggers:
  - "How do I check agent status via API?"
  - "Query Paperclip for issues"
  - "Manage goals via MCP"
  - "Automate Paperclip from external tool"
---

# Paperclip MCP Integration Skill

## MCP Server Options

### Option 1: paperclip-mcp (creativerrr)
```bash
npm install -g paperclip-mcp
```

### Option 2: paperclip-mcp (darljed)
```bash
npm install -g @darljed/paperclip-mcp
```

## Environment Configuration

```bash
export PAPERTCLIP_API_KEY="your-board-api-key"
export PAPERCLIP_COMPANY_ID="fe90b604-364f-480d-be10-6a529971db57"
export PAPERCLIP_API_URL="http://localhost:3100/api"
```

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `paperclip_list_agents` | List all agents in company |
| `paperclip_get_agent` | Get specific agent details |
| `paperclip_list_goals` | List company goals |
| `paperclip_create_goal` | Create new goal |
| `paperclip_list_issues` | List issues/tasks |
| `paperclip_create_issue` | Create new issue |
| `paperclip_update_issue` | Update issue status |
| `paperclip_heartbeat` | Send heartbeat to agent |

## Paperclip API Endpoints (Direct HTTP)

### Agent Management
```bash
# Get agent info
GET /api/agents/me

# List all agents
GET /api/companies/{companyId}/agents

# Invoke agent heartbeat
POST /api/agents/{agentId}/heartbeat/invoke

# Resume agent
POST /api/agents/{agentId}/resume
```

### Goal Management
```bash
# List goals
GET /api/companies/{companyId}/goals?status=active

# Get goal details
GET /api/goals/{goalId}

# Create goal
POST /api/companies/{companyId}/goals
```

### Issue Management
```bash
# List issues
GET /api/companies/{companyId}/issues?assigneeAgentId={id}&status=todo,in_progress

# Checkout issue
POST /api/issues/{issueId}/checkout

# Update issue
PATCH /api/issues/{issueId}

# Add comment
POST /api/issues/{issueId}/comments
```

## Authentication

All API calls require:
```bash
Authorization: Bearer {PAPERCLIP_API_KEY}
X-Paperclip-Run-Id: {PAPERCLIP_RUN_ID}
```

## Use Cases

### 1. Query TKP ACI Status from External Tool
```javascript
// MCP tool example
{
  tool: "paperclip_list_agents",
  params: { companyId: "fe90b604-364f-480d-be10-6a529971db57" }
}
```

### 2. Create Issue via MCP
```javascript
{
  tool: "paperclip_create_issue",
  params: {
    title: "Create video S018",
    assigneeAgentId: "b59b05d6-5a79-46ef-ac96-868cbbdc5ebf",
    goalId: "928bc57d-583b-4a4e-af8a-b0b8ffd6c0a6"
  }
}
```

### 3. Monitor Pipeline Health
- Query `scripts/pending/xianxia/` for pending scripts
- Query Paperclip issues for in-progress tasks
- Check agent heartbeats for stale agents

## TKP ACI Specific

| Field | Value |
|-------|-------|
| Company ID | fe90b604-364f-480d-be10-6a529971db57 |
| API URL | http://localhost:3100/api |
| CEO Agent | b0e897a5-cda9-4f37-8e2f-e985cb21ec3d |
| Active Goal | GOAL-5 (Xianxia Content Factory) |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 401 Unauthorized | Check PAPERCLIP_API_KEY is set |
| Agent not found | Verify agentId is correct |
| MCP tools not working | Restart MCP server with correct env vars |