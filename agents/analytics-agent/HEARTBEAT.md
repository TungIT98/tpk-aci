# Analytics Agent HEARTBEAT.md — TKP ACI

Run this checklist every heartbeat, in order. Do not skip steps.

---

## Step 1 — Orient

- [ ] Check wake context: `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_COMMENT_ID`
- [ ] If triggered by a task assignment from CEO, read the task description
- [ ] Read recent daily notes in `agents/analytics-agent/memory/` if they exist

---

## Step 2 — Review Your Tasks

```bash
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?assigneeAgentId=dc1160e2-d472-4cdd-81a7-f79ea4ac8e53&status=todo,in_progress
```

- Work `in_progress` first, then `todo`
- Checkout before doing any work:
  ```
  POST /api/issues/{issueId}/checkout
  Headers: X-Paperclip-Run-Id: {runId}
  Body: { "agentId": "dc1160e2-d472-4cdd-81a7-f79ea4ac8e53", "expectedStatuses": ["todo", "backlog"] }
  ```

---

## Step 3 — Check Published Videos

```bash
# Read production-registry.json to see all published videos
Read: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\logs\production-registry.json

# Read video-stats.json for latest metrics
Read: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\logs\video-stats.json
```

---

## Step 4 — Check Platform Analytics

```bash
# YouTube Studio - check for new metrics
WebFetch(url="https://studio.youtube.com", prompt="Extract channel metrics: views, subscribers, watch time")

# TikTok Analytics
WebFetch(url="https://www.tiktok.com/business/en/analytics", prompt="Extract follower count and video views")
```

---

## Step 5 — Compile Weekly Report (Every Monday)

```bash
# Compile performance data for the week:
# - Videos published
# - Views, likes, comments, shares per video
# - Subscriber/follower growth
# - Top performing content
# - CTR performance

Write file: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\reports\weekly\WEEKLY-{YYYY-MM-DD}.md
Content: Weekly performance summary with metrics and insights
```

---

## Step 6 — Update YPP Status (if milestones reached)

```bash
# Check content/ypp-status.md for current YPP progress
Read: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\ypp-status.md

# If any threshold crossed:
# - Update ypp-status.md with new milestone
# - Comment on CEO's task to flag the achievement
```

---

## Step 7 — Update Channel Dashboard

```bash
# Update live channel metrics
Write file: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\dashboards\channel-performance.md
Content:
# Channel Performance Dashboard
## Last Updated: {timestamp}
## Videos Published: {count}
## Total Views: {number}
## Subscribers: {number}
## Top Performer: {video title} ({views} views)
## YPP Status: {status}
```

---

## Step 8 — Mark Task Done

```bash
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: {runId}
Body: { "status": "done", "comment": "Analytics complete. Channel dashboard updated. [key metric]" }
```

---

## Step 9 — End of Heartbeat

Before exiting:

1. [ ] All assigned tasks have recent comments
2. [ ] Reports saved with date ranges clearly labeled
3. [ ] YPP milestones flagged if reached
4. [ ] Write daily note in `agents/analytics-agent/memory/YYYY-MM-DD.md` if needed

---

## Critical Rules

1. **Always include date ranges** — No date-less metrics
2. **Always identify data source** — YouTube Studio, TikTok Analytics, etc.
3. **Highlight top 3 insights** — Make them actionable
4. **Flag YPP milestones immediately** — Comment on CEO's task
5. **Never report estimates as facts** — Label as "estimated" if uncertain

---

## Key Paths

| Path | Purpose |
|------|---------|
| `C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI` | Company root |
| `content/dashboards/channel-performance.md` | Live metrics |
| `content/reports/weekly/` | Weekly reports |
| `content/reports/monthly/` | Monthly reports |
| `content/ypp-status.md` | YPP tracker |
| `logs/production-registry.json` | Published videos |
| `logs/video-stats.json` | Video metrics |

---

## Agent ID

Your Agent ID: `dc1160e2-d472-4cdd-81a7-f79ea4ac8e53`

---

*Version: 2.0 — Following paperclip-company-playbook template*