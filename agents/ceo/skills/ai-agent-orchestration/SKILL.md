---
name: ai-agent-orchestration
description: >
  Use when: Managing multi-agent workflows, coordinating between agents, understanding
  Paperclip heartbeat patterns, or designing agent team structures.
  Do NOT use when: Creating content, doing technical implementation, or uploading.
triggers:
  - "How do agents communicate in Paperclip?"
  - "What is the heartbeat pattern?"
  - "Design multi-agent workflow"
  - "Agent-to-agent handoff"
---

# AI Agent Orchestration Skill

## Core Concepts

### What is Paperclip?

Paperclip is an open-source orchestration platform for running teams of AI agents as structured companies. Think of it as the **operating system for zero-human companies**.

- OpenClaw = individual employee
- Paperclip = the company (orchestrates multiple agents)

### The Heartbeat Pattern

Agents in Paperclip are **NOT always online**. They wake up on a schedule (heartbeat), check for work, execute, report, then go dormant.

```
┌─────────────────────────────────────────┐
│  Heartbeat Wake                         │
│  1. GET /api/agents/me (identify)       │
│  2. Check inbox (get assigned tasks)    │
│  3. Checkout tasks                      │
│  4. Do the work                         │
│  5. Report completion                   │
│  6. Go dormant until next heartbeat     │
└─────────────────────────────────────────┘
```

### Why Heartbeat Over Persistent Agents?

| Approach | Pros | Cons |
|----------|------|------|
| Persistent (always on) | Immediate response | High API costs |
| Heartbeat (scheduled) | Cost efficient, stable | Latency between tasks |

Paperclip uses heartbeat because:
1. **Cost efficiency** — Agents only run when needed
2. **Stability** — No context drift or memory issues
3. **Simplicity** — No persistent state problems

## Agent Types in Paperclip

### Agent Capabilities

Each agent has:
- **Agent ID** — Unique identifier
- **Company ID** — Which company it belongs to
- **Role** — CEO, worker, specialist
- **Chain of Command** — Reports to whom

### TKP ACI Agent Hierarchy

```
Founder (external)
  └── CEO (b0e897a5-cda9-4f37-8e2f-e985cb21ec3d)
      ├── Content Director (24ac8a23-d723-4909-bf40-05f4d4fce689)
      ├── Nova (b59b05d6-5a79-46ef-ac96-868cbbdc5ebf)
      ├── Nova 2 (8e06e2ee-45d7-475d-b7b0-381bd5ed6490)
      ├── Nova 3 (305c8b58-b3cf-40f3-8444-395b43a902c6)
      ├── Production Manager (e3aad368-fab1-4da3-b287-3a65802d84ff)
      ├── SEO Specialist (9ff4e340-dd34-4476-9238-da8fdbce0873)
      ├── Analytics Agent (dc1160e2-d472-4cdd-81a7-f79ea4ac8e53)
      ├── Founding Engineer (7bb601dc-a0e0-4f37-9a63-1df7be1be013)
      └── Founding Engineer 2 (be3b4d40-f9e0-40ff-a666-c657c29f4995)
```

## Workflow Design

### GOAL-5: Xianxia Content Factory Pipeline

```
1. CEO identifies work (checks goals/inbox)
        ↓
2. CEO assigns to Content Director
        ↓
3. Content Director writes scripts → scripts/pending/xianxia/{id}.json
        ↓
4. CEO distributes to Nova (least busy)
        ↓
5. Nova creates video → outputs/xianxia/{id}/final.mp4
        ↓
6. Production Manager adds captions + QC
        ↓
7. n8n auto-uploads to TikTok
        ↓
8. Production Manager uploads to YouTube
        ↓
9. Analytics Agent tracks performance
```

### Handoff Protocols

#### Script Handoff (Content Director → Nova)
- Content Director writes: `scripts/pending/xianxia/{id}.json`
- Status: `pending`
- Nova reads script, starts production
- Nova updates status to `in_production`

#### Video Handoff (Nova → Production Manager)
- Nova creates: `outputs/xianxia/{id}/final.mp4`
- Nova updates JSON status to `ready_for_upload`
- Production Manager picks up, adds captions
- Production Manager uploads, updates status to `published`

## Issue/Task Management

### Paperclip Issues = Tasks

```
GET /api/companies/{companyId}/issues?assigneeAgentId={id}&status=todo,in_progress,blocked
```

### Issue Lifecycle

```
backlog → todo → in_progress → done
                ↓
             blocked (if something stops work)
```

### Checkout Protocol (CRITICAL)

Before working on any issue, agent MUST:
```
POST /api/issues/{issueId}/checkout
Body: { "agentId": "...", "expectedStatuses": ["todo", "backlog"] }
```

**409 Conflict** = Someone else already checked it out. Pick different task. NEVER retry a 409.

### Blocking Issues

An issue marked `blocked` should include:
- What is blocked
- Why it's blocked
- Who can unblock it

## Multi-Agent Coordination Patterns

### Pattern 1: Sequential Handoff
One agent completes, next agent picks up.

```
A → B → C → Done
```

### Pattern 2: Parallel Work
Multiple agents work on different tasks simultaneously.

```
A → Done
B → Done
C → Done
↓
CEO collects results
```

### Pattern 3: Fan-Out / Fan-In
CEO distributes to many, collects from many.

```
CEO → [Nova, Nova 2, Nova 3]
                ↓
CEO collects outputs
```

### TKP ACI Patterns Used

| Pattern | Use Case |
|---------|----------|
| Sequential | Script → Video → Upload |
| Parallel | 3 Novas creating videos simultaneously |
| Fan-out | CEO assigns to available Nova based on workload |

## Best Practices

| Practice | Why |
|----------|-----|
| Always checkout before work | Prevents double-work |
| Report progress frequently | CEO can track real-time |
| Mark blocked issues with reason | CEO can unblock quickly |
| Use status字段 consistently | Pipeline tracking works |
| Skip old goal tasks | Avoid wasted effort |

## Resources

| Resource | Link |
|----------|-----|
| Paperclip GitHub | https://github.com/paperclipai/paperclip |
| Heartbeat Pattern Guide | https://www.mindstudio.ai/blog/heartbeat-pattern-paperclip-ai-agents-24-7/ |
| Multi-Agent Setup Guide | https://www.mindstudio.ai/blog/how-to-build-multi-agent-company-paperclip-claude-code/ |