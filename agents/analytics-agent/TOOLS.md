# Analytics Agent TOOLS.md — TKP ACI

## Paperclip API

Base URL: `http://localhost:3100/api`
Company ID: `fe90b604-364f-480d-be10-6a529971db57`
Your Agent ID: `dc1160e2-d472-4cdd-81a7-f79ea4ac8e53`

### Critical Headers
```
Always include: X-Paperclip-Run-Id: {runId}
```

### Key Endpoints

```bash
# Health check
GET /api/health

# Your assigned tasks
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?assigneeAgentId=dc1160e2-d472-4cdd-81a7-f79ea4ac8e53&status=todo,in_progress

# All open issues
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?status=todo,in_progress,blocked

# Checkout issue (ALWAYS before working)
POST /api/issues/{issueId}/checkout
Headers: X-Paperclip-Run-Id: {runId}
Body: { "agentId": "dc1160e2-d472-4cdd-81a7-f79ea4ac8e53", "expectedStatuses": ["todo", "backlog"] }

# Complete issue
PATCH /api/issues/{issueId}
Body: { "status": "done" }

# Post comment
POST /api/issues/{issueId}/comments
Body: { "body": "markdown" }

# Wakeup CEO (for YPP milestone)
POST /api/agents/b0e897a5-cda9-4f37-8e2f-e985cb21ec3d/heartbeat/invoke
Body: { "reason": "YPP milestone reached" }
```

---

## Agent IDs

| Role | Agent ID |
|------|----------|
| CEO | b0e897a5-cda9-4f37-8e2f-e985cb21ec3d |
| Analytics Agent (you) | dc1160e2-d472-4cdd-81a7-f79ea4ac8e53 |

---

## File System

```
Company Root: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI
Analytics Home: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\agents\analytics-agent

Content: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content
Dashboards: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\dashboards
Reports: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\reports
Logs: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\logs
```

---

## Research Tools

### WebFetch (for platform analytics)
```bash
WebFetch(url="https://studio.youtube.com", prompt="Extract channel metrics")
WebFetch(url="https://www.tiktok.com/business/en/analytics", prompt="Extract analytics data")
```

### WebSearch (for benchmarking)
```bash
WebSearch(query="YouTube Shorts performance benchmarks 2026")
WebSearch(query="TikTok viral content metrics 2026")
```

---

## Key Data Sources

| Source | What to Track |
|--------|---------------|
| YouTube Studio | Views, watch time, subscribers, revenue, CTR |
| TikTok Analytics | Views, likes, comments, shares, followers |
| Social Blade | Third-party benchmarking |
| Google AdSense | Revenue and CPM data |

---

## Output Files

| File | Purpose |
|------|---------|
| `content/dashboards/channel-performance.md` | Live channel metrics (update weekly) |
| `content/reports/weekly/WEEKLY-{YYYY-MM-DD}.md` | Weekly performance report |
| `content/reports/monthly/MONTHLY-{YYYY-MM}.md` | Monthly deep-dive |
| `content/ypp-status.md` | YPP eligibility tracker |

---

## YPP Requirements (YouTube Partner Program)

| Requirement | Threshold |
|-------------|-----------|
| Subscribers | 1,000 |
| Watch hours | 4,000 hours in 12 months |
| Followers | (TikTok not applicable) |

Update `content/ypp-status.md` whenever milestones are crossed.

---

## Weekly Report Template

```markdown
# Weekly Performance Report — {YYYY-MM-DD}

## Period: {start date} to {end date}

## Videos Published
| Video ID | Title | Platform | Views | Likes | Comments |
|----------|-------|----------|-------|-------|----------|

## Channel Growth
- Subscribers/Followers: {delta}
- Total Views: {delta}
- Watch Time: {hours} hours

## Top Performer
{Video Title} — {views} views

## Insights
1. {insight 1}
2. {insight 2}
3. {insight 3}

## Recommendations
- {recommendation 1}
- {recommendation 2}

## YPP Progress
- Subscribers: {current} / 1,000
- Watch Hours: {current} / 4,000
```

---

*Version: 2.0 — Following paperclip-company-playbook template*