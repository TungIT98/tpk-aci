# PAPERCLIP AGENT GUIDE

## How to Work with Paperclip Agents

**Last Updated: 2026-03-28**

---

## 🚨 CRITICAL RULES

### 1. USE ENGLISH ONLY in ALL .md Files

**PROBLEM:** Vietnamese characters cause encoding issues with Paperclip
```
WRONG: "Viết script mới" → "S???n xu???p"
RIGHT: "Write new script" → Works perfectly
```

**SOLUTION:** Always write files in English only. Use:
- English comments
- English variable names
- English instructions
- English prompts

---

### 2. Agent Files Must Have These 5 Files

Every agent needs:
```
agents/{agent-name}/
├── AGENTS.md      # Main instructions
├── SOUL.md        # Identity
├── MEMORY.md      # Workspace context
├── HEARTBEAT.md   # Heartbeat behavior
└── TOOLS.md       # Tool usage (optional)
```

---

### 3. Scripts Must Be Extremely Detailed

**WRONG (generic):**
```json
{
  "prompt_for_hailuo": "Girl in gym lifting weights"
}
```

**CORRECT (detailed):**
```json
{
  "prompt_for_hailuo": "Beautiful Viet girl, 22yo, long black ponytail, red sports bra, black gym shorts, deadlifting 100kg barbell, grunting, guys staring shocked. Modern gym, red neon lights, dramatic atmosphere, cinematic, 9:16 portrait, 6 seconds.",
  "specific_details": {
    "subject": "Viet girl, 20-25yo, athletic build",
    "outfit": "Red sports bra, black gym shorts, white sneakers",
    "action": "Deadlift 100kg, grunting loudly",
    "setting": "Modern gym with red neon lights",
    "camera": "Wide shot → Close up → Pull out",
    "mood": "Confident, powerful, dramatic"
  },
  "negative_prompt": "Avoid: anime, cartoon, blurry, male"
}
```

---

## Agent Communication Flow

```
Content Director
    ↓ (writes detailed script)
CEO
    ↓ (creates task)
Nova
    ↓ (creates + verifies video)
Content Director
    ↓ (writes next script)
...loop
```

---

## Self-Check Loop (No Cron!)

Agents check themselves every heartbeat:
```
1. CEO checks: scripts/pending/ for new scripts
2. Nova checks: Paperclip API for new tasks
3. Content Director checks: previous video published?
```

---

## Verify Video Before Upload (MANDATORY)

Nova MUST verify every video:
```
□ Subject (person) matches?
□ Outfit matches?
□ Action matches?
□ Setting matches?
□ Camera movement matches?
□ Mood matches?

ANY MISMATCH → Regenerate
```

---

## API Quick Reference

### Get My Tasks
```
GET /api/issues?assigneeAgentId=me&status=todo
```

### Create Task
```
POST /api/companies/{companyId}/issues
{
  "title": "Task title",
  "description": "Task details",
  "status": "todo",
  "assigneeAgentId": "agent-id",
  "priority": "high"
}
```

### Update Task Status
```
PATCH /api/issues/{issueId}
{
  "status": "done"
}
```

### Wakeup Agent
```
POST /api/agents/{agentId}/wakeup
```

---

## Credentials

| Service | Account |
|---------|---------|
| Hailuo | thanhtungtran364@gmail.com |
| YouTube | thanhtungtran364@gmail.com |
| TikTok | thanhtungtran364@gmail.com |
| Company ID | fe90b604-364f-480d-be10-6a529971db57 |
| Gateway Token | 724b0662d7f8cb522ac2db5ab10723da95c42ff192657815 |

---

## Common Issues

### Issue: Agent not responding
**Solution:** 
1. Check agent status: `GET /api/agents/{id}`
2. Wakeup agent: `POST /api/agents/{id}/wakeup`
3. Check agent files exist

### Issue: Agent does wrong thing
**Solution:**
1. Update AGENTS.md with correct instructions
2. Wakeup agent to reload

### Issue: Encoding problems
**Solution:**
- Always use English only in .md files
- Avoid special characters

### Issue: Agent creates same video
**Solution:**
- Add detailed `specific_details` to script
- Add `negative_prompt` to avoid generic
- Nova must verify before upload

---

## Testing Agent Updates

1. Update agent's AGENTS.md
2. Wakeup agent: `POST /api/agents/{id}/wakeup`
3. Check agent heartbeat output
4. Verify agent follows new instructions

---

*This guide prevents common Paperclip agent issues.*
