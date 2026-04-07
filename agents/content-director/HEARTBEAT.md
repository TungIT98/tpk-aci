# Content Director HEARTBEAT.md — TKP ACI

Run this checklist every heartbeat, in order. Do not skip steps.

---

## Step 1 — Orient

- [ ] Check wake context: `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_COMMENT_ID`
- [ ] If triggered by a task assignment from CEO, read the task description
- [ ] Read `agents/content-director/memory/` for recent notes if they exist

---

## Step 2 — Review Your Tasks

```bash
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?assigneeAgentId=24ac8a23-d723-4909-bf40-05f4d4fce689&status=todo,in_progress
```

- Work `in_progress` first, then `todo`
- Checkout before doing any work:
  ```
  POST /api/issues/{issueId}/checkout
  Headers: X-Paperclip-Run-Id: {runId}
  Body: { "agentId": "24ac8a23-d723-4909-bf40-05f4d4fce689", "expectedStatuses": ["todo", "backlog"] }
  ```

---

## Step 3 — Check Trending Topics

```bash
# Read trending topics file
Read: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\trending-topics.md

# Read latest SEO research
Read: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\keyword-research.md
```

Use these to inform today's script topics.

---

## Step 4 — Check Previous Scripts

```bash
# Check what was recently published to avoid duplication
# Read scripts/pending/*.json with status "published" in recent logs
```

- If a similar script was published recently → choose a different angle/topic
- Check `PROJECT-INVENTORY.md` if it exists for duplicate prevention

---

## Step 5 — Write Script (Quality Gate Check)

Before saving ANY script, verify ALL of these fields exist and are complete:

- [ ] `id` — Unique format `{SERIES}-{NN}` (e.g., `GZ-13`)
- [ ] `category` — Must be one of: hot_girl_fitness, tech_ai, lifestyle, comedy, motivation, movie_review, trending_aesthetic
- [ ] `status` — MUST be `"pending"`
- [ ] `prompt_for_hailuo` — Minimum 200 characters, include: subject description, outfit colors, action details, setting, camera movements
- [ ] `specific_details` — All subfields: hair, skin_tone, outfit_exact, setting_details, face_expression, body_movement
- [ ] `visual_scene` — Contains: subject, outfit, action, setting, camera, mood, duration
- [ ] `negative_prompt` — At least 5 things to avoid
- [ ] `duration_seconds` — Between 45 and 90
- [ ] `title` — Viral-worthy, under 100 characters
- [ ] `description` — YouTube description with keywords and hashtags

**If ANY check fails → Do NOT save. Rewrite until all fields pass.**

---

## Step 6 — Save Script

```bash
# Write to scripts/pending/{id}.json
Write file: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\scripts\pending\{id}.json
Content: Complete JSON with all Quality Gate fields
```

---

## Step 7 — Update Task

```bash
# Mark task as done
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: {runId}
Body: { "status": "done", "comment": "Script {id} saved to scripts/pending/{id}.json with status=pending. Ready for Nova." }
```

---

## Step 8 — Notify CEO

```bash
# If not assigned a specific task but new scripts are needed:
# Post comment on CEO's task or create a note

# The CEO will scan scripts/pending/ on their next heartbeat
```

---

## Step 9 — End of Heartbeat

Before exiting:

1. [ ] All assigned tasks have recent comments
2. [ ] Scripts saved have passed Quality Gate
3. [ ] No duplicate topics from recent publications
4. [ ] Write daily note if significant work done

---

## Critical Rules

1. **Always run Quality Gate** before saving any script
2. **Never save incomplete scripts** — If `prompt_for_hailuo` is vague, the video will be bad
3. **Never duplicate recent topics** — Check what was published first
4. **Duration must be 45-90 seconds** — Too short = no engagement, too long = drop-off
5. **Write for the camera** — `prompt_for_hailuo` must describe VISUAL moments, not abstract concepts

---

## Content Calendar Reference

| Day | Category | Focus |
|-----|----------|-------|
| Mon | hot_girl_fitness | Gym, dance, yoga, athletic |
| Tue | tech_ai | Robots, AI, cyberpunk, tech |
| Wed | lifestyle | Routine, food, travel, daily life |
| Thu | comedy | Relatable, funny situations |
| Fri | motivation | Success, hustle, transformation |
| Sat | movie_review | Reactions, cinematic moments |
| Sun | trending_aesthetic | Calm, aesthetic, visual beauty |

---

## Key Paths

| Path | Purpose |
|------|---------|
| `C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI` | Company root |
| `scripts\pending\{id}.json` | Script output location |
| `content\trending-topics.md` | Trending research |
| `content\keyword-research.md` | SEO keywords |

---

*Version: 2.0 — Following paperclip-company-playbook template*