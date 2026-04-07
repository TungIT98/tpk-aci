# Community Management System — TKP Content Agency

> Research output for TKP-44 (VID-33). Full system for both channels: response templates,
> moderation rules, sentiment monitoring, and escalation path.
>
> Related: [TKP-45 (Engagement Response Templates)](./engagement-response-templates.md)

---

## 1. Channel Identity & Community Voice

### Channel 1: TKP Productivity (Productivity Worker)

**Community personality**: Calm, reliable mentor. Responses are measured, specific, and
encouraging. Never condescending. Community members are "professionals solving real problems."

**Response timing SLA**:
- First reply within 2 hours (weekdays, business hours EST/EDT)
- Comments during evenings/weekends: reply by next business morning
- DM responses: within 4 hours on weekdays

### Channel 2: TKP Growth (Gen Z Success)

**Community personality**: Energetic older friend. Direct, honest, a little irreverent. Community
members are "ambitious people building their own path."

**Response timing SLA**:
- First reply within 1 hour (12pm–10pm EST daily, covers peak engagement windows)
- DMs: within 2 hours on weekdays
- Comments: can be shorter, punchier, emoji-OK

---

## 2. Moderation Rules

### Universal Rules (Both Channels)

| Rule | Action |
|------|--------|
| Spam / self-promotion (unsolicited) | Remove + 1 warning. Second offense: block. |
| Hate speech, slurs, discrimination | Immediate permanent ban. No warning. |
| Threats / doxxing | Immediate permanent ban. Report to platform. |
| Spam bots / OnlyFans / crypto spam | Mass-report + block. No engagement. |
| Medical / financial misinformation | Remove + post correction link. Escalate if repeated. |
| Content repurposed without credit | Comment: "Great catch! Credit to @[original]" |

### Channel-Specific Rules

**TKP Productivity**:
- No self-promotion disguised as genuine questions ("where can I learn X? check my bio!")
- No hustle-culture / "5am club" moralizing ("you just don't want it enough")
- No unsolicited coaching offers ("DM me for a $500 session")

**TKP Growth**:
- No gatekeeping ("you're too young to understand")
- No MLM/hustle-culture recruitment pitches
- No crypto/NFT shilling

### Moderation Stack

1. **YouTube Studio** → Keyword filter (first pass), manual review queue
2. **TikTok** → Comment filter keywords: `DM`, `check my bio`, `link in bio`, `whatsapp`, `telegram`, `crypto`, `NFT`, `onlyfans`, spam-bait phrases
3. **Instagram** → Restrict low-follower accounts from commenting on new posts (< 7 days old) until approved
4. **LinkedIn** → No keyword filters needed; manual first-pass on all comments

### Comment Approval Workflow (New Videos)

- First 24 hours after posting: **all comments manually reviewed** before visible
- Days 2–7: keyword-filter auto-approve for non-flagged comments
- Day 7+: standard filtering

---

## 3. Sentiment Monitoring

### Metrics to Track Daily

| Metric | Where | Alert Threshold |
|--------|-------|-----------------|
| Like/dislike ratio | YouTube Studio | < 90% positive → investigate |
| Comment volume spike | YouTube + TikTok | > 3x normal → read top comments |
| Negative keyword frequency | Manual scan | "misleading", "scam", "wrong" repeated → review content |
| Share/save ratio | TikTok analytics | Saves > shares indicates high-value content |
| DMs marked as spam | Instagram + TikTok | > 5 spam reports/week →可能被盯上 |

### Sentiment Scorecard (Weekly)

```
Week: ___
Channel: ___ (Productivity / Growth)

Positive comments: ___
Neutral comments: ___
Negative comments: ___
Spam removed: ___
Overall sentiment: [Positive / Neutral / Concerning]

Top positive theme: ____________
Top negative theme: ____________
Action taken: ____________
```

### Red Flag Responses

If sentiment turns negative around a specific video:
1. Read 10 most-recent negative comments → identify pattern
2. Post a pinned comment acknowledging if something was misleading
3. Do NOT delete negative comments unless they violate rules
4. Note in content debrief for future scripts

---

## 4. Escalation Path

### Tier 1 — Handle Without Escalation (Community Manager / Automated)

- Standard questions answered with existing templates
- Spam removed
- First-time rule violations → warning comment
- Basic thank-you and engagement replies

### Tier 2 — Involve Founding Engineer 2 (@Founding Engineer 2)

- Technical questions about tools shown in videos
- Partnership / brand deal inquiries
- Creator credit / content theft reports
- Platform algorithm changes or API issues

### Tier 3 — Involve CEO (@CEO)

- Legal threats or defamation claims
- Harassment campaigns against the channel or host
- Platform suspension or strikes
- Significant crisis (medical emergency cited, false news spreading)

### Escalation Contact Format

When escalating, include:
1. **What happened**: 2–3 sentence summary
2. **Why it matters**: business/reputational impact
3. **What you've tried**: steps already taken
4. **Decision needed**: specific ask

---

## 5. Community Health Rituals

### Daily (5 min)

- [ ] Scan new comments on latest 3 videos
- [ ] Reply to unanswered questions from previous session
- [ ] Remove spam / rule violations

### Weekly (20 min)

- [ ] Complete sentiment scorecard
- [ ] Identify 1–2 community members to highlight/reply-to prominently
- [ ] Review which video had highest engagement → note why

### Monthly (1 hour)

- [ ] Community highlight post (repost best comment / community win)
- [ ] Review top contributors → consider Discord role upgrade
- [ ] Moderation rule review — add any new patterns
- [ ] Escalation log review — were any Tier 2/3 escalations preventable?

---

## 6. Tools & Setup Checklist

### Platform Tools

- [ ] **YouTube Studio** → Notifications: all comments + community posts
- [ ] **TikTok Pro** → Creator dashboard: comment notifications on
- [ ] **Instagram Creator** → Notifications: all comments + DMs
- [ ] **LinkedIn** → Page notifications on

### Automation Setup

- [ ] **Notion** — Community tracking database (comments log, escalations, sentiment)
- [ ] **Buffer / Later** — Scheduled response templates (auto-post on keyword match)
- [ ] **Google Sheets** — Weekly sentiment scorecard (linked from Notion)

### Notification Settings

| Platform | Push | Email | Do Not Disturb Hours |
|----------|------|-------|----------------------|
| YouTube | All | Daily digest | 10pm–7am |
| TikTok | All | Off | 11pm–8am |
| Instagram | Mentions only | Off | 10pm–7am |
| LinkedIn | Off | Immediate (new leads only) | N/A |

---

## 7. Success Metrics

| Metric | Target | Review Cadence |
|--------|--------|---------------|
| Avg comment response time | < 2 hours | Weekly |
| Community member retention (return commenters) | > 40% | Monthly |
| Negative sentiment % | < 8% | Weekly |
| Escalation rate (Tier 2+) | < 2/week | Monthly |
| Community-sourced video ideas used | > 2/month | Monthly |
