# TKP ACI - Organization Chart
*Generated: 2026-03-27*

## 🏛️ Company Overview

| Metric | Value |
|--------|-------|
| **Company ID** | fe90b604-364f-480d-be10-6a529971db57 |
| **Platform** | Paperclip |
| **Mission** | Video production automation via Hailuo AI |
| **Target** | 1000 videos in 30 days |

---

## 📊 Org Chart

```
                          ┌─────────────┐
                          │     CEO     │
                          │   (Tùng)    │
                          └──────┬──────┘
                                 │
        ┌────────┬────────┬─────┴─────┬────────┬────────┐
        │        │        │           │        │        │
   ┌────┴───┐┌──┴───┐┌───┴───┐   ┌───┴───┐┌───┴───┐┌───┴────┐
   │Founding││Founding││Content│   │  SEO  ││Nova   ││Production│
   │Engineer││Eng. 2  ││Director│   │Special ││(Browser)││ Manager │
   │   👨‍💻   ││  👨‍💻   ││  🎬   │   │ist 🕵️ ││  🌐    ││   📋    │
   │running ││ idle  ││ idle  │   │running││ idle  ││ running │
   └────────┘└───────┘└───────┘   └───────┘└────────┘└─────────┘
                                                  │
                                           ┌─────┴─────┐
                                           │Analytics  │
                                           │  Agent 📊 │
                                           │   idle    │
                                           └───────────┘
```

---

## 👥 Agent Details

### Level 1 - Executive

| Agent | Role | Status | Responsibilities |
|-------|------|--------|------------------|
| **CEO** | Chief Executive | ⏳ idle | Overall direction, task assignment |

### Level 2 - Reports to CEO

| Agent | Role | Status | Responsibilities |
|-------|------|--------|------------------|
| **Founding Engineer** | Engineer | 🟢 running | Tech support, browser troubleshooting |
| **Founding Engineer 2** | Engineer | ⏳ idle | TikTok setup, tech support |
| **Content Director** | Researcher | ⏳ idle | Script writing, video prompts |
| **SEO Specialist** | Researcher | 🟢 running | Keywords, trending topics |
| **Nova** | Browser Operator | ⏳ idle | Video creation, YouTube/TikTok upload |
| **Production Manager** | General | 🟢 running | QC, production tracking |

### Level 3 - Reports to Production Manager

| Agent | Role | Status | Responsibilities |
|-------|------|--------|------------------|
| **Analytics Agent** | Researcher | ⏳ idle | Performance tracking, reporting |

---

## 🎯 Workflow Chain

```
CEO ──▶ Content Director ──▶ (writes script) ──▶ scripts/pending/
                │
                │ assigns
                ▼
           Nova ──▶ Hailuo AI ──▶ Create Video
                │
                ├─▶ YouTube Studio ──▶ Upload
                │
                └─▶ TikTok ──▶ Upload
```

---

## 📋 Agent Skills Matrix

| Agent | Hailuo | YouTube | TikTok | Browser | Scripts | Analytics |
|-------|--------|---------|--------|---------|---------|-----------|
| CEO | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Founding Engineer | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Founding Engineer 2 | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Content Director | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| SEO Specialist | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Nova** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Production Manager | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Analytics Agent | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🔑 Key Agents

### Nova (Browser Operator)
- **ID:** 8c85bfb8-95eb-49f8-aae3-311b51ce5274
- **Role:** ALL video operations
- **Capabilities:**
  - Create videos on Hailuo AI
  - Upload to YouTube
  - Upload to TikTok
  - Browser automation

### Content Director
- **ID:** 24ac8a23-d723-4909-bf40-05f4d4fce689
- **Role:** Script writing
- **Capabilities:**
  - Write Hailuo-compatible prompts
  - Content strategy
  - Trending topics

---

## 📁 Reference Files

| File | Location |
|------|----------|
| Workflow | `$TKP_ACI/WORKFLOW.md` |
| Hailuo Guide | `$TKP_ACI/agents/nova/HAILUO_KNOWLEDGE.md` |
| Browser Ops | `$TKP_ACI/agents/nova/BROWSER_OPERATIONS.md` |
| Scripts | `$TKP_ACI/scripts/pending/` |
| Outputs | `$TKP_ACI/outputs/` |

---

*Last Updated: 2026-03-27*
*Version: 1.0*
