# SEO Specialist TOOLS.md — TKP ACI

## Paperclip API

Base URL: `http://localhost:3100/api`
Company ID: `fe90b604-364f-480d-be10-6a529971db57`
Your Agent ID: `9ff4e340-dd34-4476-9238-da8fdbce0873`

### Critical Headers
```
Always include: X-Paperclip-Run-Id: {runId}
```

### Key Endpoints

```bash
# Health check
GET /api/health

# Your assigned tasks
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?assigneeAgentId=9ff4e340-dd34-4476-9238-da8fdbce0873&status=todo,in_progress

# All open issues
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?status=todo,in_progress,blocked

# Checkout issue (ALWAYS before working)
POST /api/issues/{issueId}/checkout
Headers: X-Paperclip-Run-Id: {runId}
Body: { "agentId": "9ff4e340-dd34-4476-9238-da8fdbce0873", "expectedStatuses": ["todo", "backlog"] }

# Complete issue
PATCH /api/issues/{issueId}
Body: { "status": "done" }

# Post comment
POST /api/issues/{issueId}/comments
Body: { "body": "markdown" }
```

---

## Agent IDs

| Role | Agent ID |
|------|----------|
| CEO | b0e897a5-cda9-4f37-8e2f-e985cb21ec3d |
| SEO Specialist (you) | 9ff4e340-dd34-4476-9238-da8fdbce0873 |
| Content Director | 24ac8a23-d723-4909-bf40-05f4d4fce689 |

---

## File System

```
Company Root: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI
SEO Home: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\agents\seo-specialist

Content: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content
SEO Briefs: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\seo-briefs
```

---

## Research Tools

### WebSearch
```bash
WebSearch(query="TikTok trending topics Vietnam March 2026")
WebSearch(query="YouTube Shorts trending this week")
WebSearch(query="Twitter X trending hashtags productivity")
WebSearch(query="Reddit popular posts today")
```

### WebFetch
```bash
WebFetch(url="https://trends.google.com/trends/trendingsearches/vi/day", prompt="Extract trending topics in Vietnam")
WebFetch(url="https://www.tiktok.com/discover", prompt="Extract trending hashtags and topics")
```

---

## Output Files

| File | Purpose |
|------|---------|
| `content/trending-topics.md` | Weekly trending report (update every heartbeat) |
| `content/keyword-research.md` | Master keyword bank with SEO titles |
| `content/seo-briefs/{id}.md` | Per-video SEO brief |
| `content/upload-seo-checklist.md` | Upload reference checklist |

---

## Trending Topics Format

```json
{
  "date": "2026-03-30",
  "week": "2026-W13",
  "trending": [
    {
      "rank": 1,
      "topic": "Topic name",
      "platform": "TikTok",
      "hashtags": ["#tag1", "#tag2"],
      "potential_views": "10M+",
      "competition": "medium",
      "content_pillar": "motivation"
    }
  ],
  "content_calendar": {
    "Monday": "hot_girl_fitness",
    "Tuesday": "tech_ai",
    "Wednesday": "lifestyle",
    "Thursday": "comedy",
    "Friday": "motivation",
    "Saturday": "movie_review",
    "Sunday": "trending_aesthetic"
  }
}
```

---

## Per-Video SEO Brief Template

```markdown
# SEO Brief — {Video Title}

## Primary Keyword

## Secondary Keywords
- keyword 2
- keyword 3

## SEO Title (under 60 chars)

## Description Template

## Tags (10 max)

## TikTok Hashtags (5 max)

## Notes
```

---

## Content Calendar (6 Pillars)

| Day | Category |
|-----|----------|
| Monday | hot_girl_fitness |
| Tuesday | tech_ai |
| Wednesday | lifestyle |
| Thursday | comedy |
| Friday | motivation |
| Saturday | movie_review |
| Sunday | trending_aesthetic |

---

## Target Keywords (Priority Niches)

- Productivity: "productivity tips", "time management", "focus", "deep work"
- Gen Z: "study hack", "side hustle", "manifesting", "girlboss"
- Fitness: "gym transformation", "workout routine", "fitness motivation"
- Tech: "AI tools", "ChatGPT", "productivity apps", "tech shortcuts"
- Lifestyle: "morning routine", "self-improvement", "work life balance"

---

*Version: 2.0 — Following paperclip-company-playbook template*