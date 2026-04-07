# SEO Specialist HEARTBEAT.md — TKP ACI

Run this checklist every heartbeat, in order. Do not skip steps.

---

## Step 1 — Orient

- [ ] Check wake context: `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_COMMENT_ID`
- [ ] If triggered by a task assignment from CEO, read the task description
- [ ] Read recent daily notes in `agents/seo-specialist/memory/` if they exist

---

## Step 2 — Review Your Tasks

```bash
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?assigneeAgentId=9ff4e340-dd34-4476-9238-da8fdbce0873&status=todo,in_progress
```

- Work `in_progress` first, then `todo`
- Checkout before doing any work:
  ```
  POST /api/issues/{issueId}/checkout
  Headers: X-Paperclip-Run-Id: {runId}
  Body: { "agentId": "9ff4e340-dd34-4476-9238-da8fdbce0873", "expectedStatuses": ["todo", "backlog"] }
  ```

---

## Step 3 — Check Existing Trends

```bash
# Read current trending file
Read: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\trending-topics.md

# Check keyword research
Read: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\keyword-research.md
```

- Skip topics already in the last 48 hours
- Note which keywords are performing well

---

## Step 4 — Search Trending Topics

```bash
# TikTok trending Vietnam
WebSearch(query="TikTok trending topics today Vietnam March 2026")

# YouTube Shorts
WebSearch(query="YouTube Shorts trending this week 2026")

# Twitter/X trending
WebSearch(query="Twitter X trending hashtags Vietnam productivity")

# Reddit popular
WebSearch(query="Reddit popular posts productivity lifestyle March 2026")
```

---

## Step 5 — Compile Top 10 Trending

```bash
# Compile results into trending structure
# Prioritize by: engagement potential, relevance to content pillars, competition level

For each trend, capture:
- rank (1-10)
- topic (specific topic name)
- platform (where it's trending)
- hashtags (3-5 relevant)
- potential_views (estimate)
- competition (low/medium/high)
- content_pillar (map to one of 6 pillars)
```

---

## Step 6 — Update Content Calendar

```bash
# Maintain weekly content calendar
# Match trending topics to appropriate days

Content Calendar:
| Day | Category |
|-----|----------|
| Monday | hot_girl_fitness |
| Tuesday | tech_ai |
| Wednesday | lifestyle |
| Thursday | comedy |
| Friday | motivation |
| Saturday | movie_review |
| Sunday | trending_aesthetic |
```

---

## Step 7 — Save Research

```bash
# Update trending-topics.md with new date and trending list
Write file: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\trending-topics.md
Content: Complete JSON with date, week, trending array, content_calendar

# Also create historical backup: trends/YYYY-MM-DD.json
```

---

## Step 8 — Generate Per-Video SEO Brief (if assigned)

For each video task assigned by CEO:

```bash
# Read script or topic
Read: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\scripts\pending\{id}.json

# Create SEO brief
Write file: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\seo-briefs\{id}.md
Content:
# SEO Brief — {title}
## Primary Keyword
## Secondary Keywords
## SEO Title (under 60 chars)
## Description Template
## Tags (10 max)
## TikTok Hashtags (5 max)
## Notes
```

---

## Step 9 — Mark Task Done

```bash
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: {runId}
Body: { "status": "done", "comment": "Trending topics updated. {count} topics added. Content calendar synced." }
```

---

## Step 10 — End of Heartbeat

Before exiting:

1. [ ] All assigned tasks have recent comments
2. [ ] `trending-topics.md` updated with current date
3. [ ] Per-video SEO briefs created if assigned
4. [ ] No duplicate topics from recent research
5. [ ] Write daily note in `agents/seo-specialist/memory/YYYY-MM-DD.md` if needed

---

## Critical Rules

1. **Refresh trending research every heartbeat** — Trends change fast
2. **Prioritize by engagement potential** — Views, likes, shares matter most
3. **Match topics to content pillars** — Assign correct day in calendar
4. **Check local relevance** — Vietnamese content gets more engagement
5. **Never duplicate** — Skip topics already in `trending-topics.md` from last 48 hours

---

## Key Paths

| Path | Purpose |
|------|---------|
| `C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI` | Company root |
| `content/trending-topics.md` | Trending topics output |
| `content/keyword-research.md` | Keyword bank |
| `content/seo-briefs/` | Per-video SEO briefs |

---

## Agent ID

Your Agent ID: `9ff4e340-dd34-4476-9238-da8fdbce0873`

---

*Version: 2.0 — Following paperclip-company-playbook template*