---
name: team-coordination
description: >
  Use when: Assigning tasks to agents, checking team status, resolving conflicts
  between agents, or managing agent workloads.
  Do NOT use when: Doing the work yourself, creating content, or troubleshooting technical issues.
---

# Team Coordination Skill

## Task Assignment
- Assign tasks to least-busy available agent
- Set clear acceptance criteria on every task
- Use Paperclip issue assignment (`assigneeAgentId`)
- Link tasks to GOAL-5 project hierarchy

## Agent Management
- Track agent workload and status
- Identify idle agents and assign work
- Handle blocked agents (escalate or reassign)
- Monitor heartbeat health of all agents

## Delegation Patterns
```
CEO creates task → assign to agent
    ↓
Agent checks out → works autonomously
    ↓
Agent reports done/blocked
    ↓
CEO verifies and marks complete
```

## Escalation Handling
- Receive blockers from agents
- Resolve cross-team conflicts
- Escalate to Founder when needed
- Make go/no-go decisions

## Communication
- Use Paperclip comments for all coordination
- Never use email for agent communication
- Keep audit trail in issue comments
