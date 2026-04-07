---
name: skills-management
description: >
  Use when: Installing new skills for agents, managing skill repositories, understanding
  SKILL.md structure, or configuring agent capabilities.
  Do NOT use when: Creating content, uploading videos, or doing operational work.
triggers:
  - "How do I add a new skill to an agent?"
  - "What is SKILL.md format?"
  - "Install skill from skills.sh"
  - "Configure agent capabilities"
---

# Skills Management Skill

## What Are Skills?

Skills are modular capability packages that agents can discover and use to perform specific tasks more effectively. They follow the SKILL.md specification — an open standard used across Paperclip, Claude Code, and other AI agent platforms.

## SKILL.md Structure

Every skill must have a `SKILL.md` file in its root:

```markdown
---
name: skill-name
description: >
  Use when: [specific trigger scenarios]
  Do NOT use when: [inappropriate use cases]
triggers:
  - "Example trigger phrase 1"
  - "Example trigger phrase 2"
---

# Skill Name

## Overview
[What this skill does]

## Usage
[How to use it]

## Examples
[Code/command examples]
```

## Skill Discovery & Loading

### How Paperclip Loads Skills

1. Agent workspace has `skills/` directory
2. Each subfolder = one skill (e.g., `skills/hailuo-video-production/`)
3. Contains `SKILL.md` — Paperclip reads this when agent starts
4. Skills are symlinked into agent's context at runtime

### Skills Directory Structure

```
TKP_ACI/
└── agents/
    └── nova/
        ├── AGENTS.md          # Main instructions (instructionsEntryFile)
        ├── SOUL.md             # Identity & behavior
        └── skills/
            ├── hailuo-video-production/
            │   └── SKILL.md    # Video generation instructions
            ├── browser-automation/
            │   └── SKILL.md    # Browser control
            ├── video-qc/
            │   └── SKILL.md    # Quality control
            └── [new-skill]/
                └── SKILL.md
```

## Installing Skills from skills.sh

Skills.sh is a community repository of agent skills.

### Installation Steps

```bash
# 1. Find skill on skills.sh or LobeHub marketplace
# https://skills.sh
# https://lobehub.com/skills

# 2. Download skill folder
# e.g., for "browser-automation"
git clone https://github.com/skills-sh/browser-automation.git

# 3. Place in agent's skills directory
cp -r browser-automation TKP_ACI/agents/nova/skills/

# 4. Verify
ls TKP_ACI/agents/nova/skills/browser-automation/SKILL.md
```

## Creating Custom Skills

### Step 1 — Identify the Skill Need

Ask:
- Is this a recurring task?
- Does the agent need specific instructions for it?
- Can it be reused across multiple agents?

### Step 2 — Create Skill Structure

```bash
mkdir -p TKP_ACI/agents/{agent}/skills/{skill-name}
```

### Step 3 — Write SKILL.md

```markdown
---
name: custom-skill
description: >
  Use when: [trigger description]
  Do NOT use when: [inappropriate uses]
triggers:
  - "trigger phrase"
---

# Custom Skill

## What This Skill Does
[Clear description]

## Step-by-Step Process
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Examples
[Real examples]

## Error Handling
[What to do when things go wrong]
```

### Step 4 — Test the Skill

1. Trigger the agent with a scenario that should activate the skill
2. Check if the agent correctly uses the skill
3. Refine if needed

## Skill Override Behavior

**Important:** You can override any built-in skill by creating a skill with the same name in the agent's workspace. The local version takes priority.

```text
Agent workspace skill > Built-in skill
```

This allows customizing standard behaviors without forking libraries.

## Skills for TKP ACI Agents

### CEO Skills (already installed)
- strategic-leadership
- team-coordination
- quality-assurance

### Nova Skills (already installed)
- hailuo-video-production
- browser-automation
- video-qc

### Production Manager Skills (already installed)
- upload-automation
- quality-control

### Content Director Skills (already installed)
- video-scriptwriting
- xianxia-content

### SEO Specialist Skills (already installed)
- keyword-research
- trending-analysis

### Analytics Agent Skills (already installed)
- analytics-tracking
- performance-reporting

### Founding Engineer Skills (already installed)
- browser-troubleshooting
- system-health

### Founding Engineer 2 Skills (already installed)
- infrastructure-monitoring
- n8n-workflows
- paperclip-mcp [NEW]

## Best Practices

| Practice | Why |
|----------|-----|
| One skill = one capability | Easier to maintain and reuse |
| Use triggers section | Helps Paperclip match context |
| Include examples | Agents understand better |
| Document error handling | Reduces failures |
| Keep skills focused | Don't bundle multiple unrelated tasks |

## Security Considerations

- Skills from unverified third parties may contain malicious code
- Always review SKILL.md before installing
- The Paperclip team warns: "unverified third-party skills come without security guarantees"
- Use skills.sh or LobeHub verified marketplace for community skills
- For TKP ACI: Only install skills from trusted sources

## Resources

| Resource | URL |
|----------|-----|
| Skills.sh (community) | https://skills.sh |
| LobeHub Skills Marketplace | https://lobehub.com/skills |
| Paperclip SPEC (V1) | https://github.com/paperclipai/paperclip/blob/master/doc/SPEC-implementation.md |
| Skills for AI Agents Guide | https://hub.baai.ac.cn/view/52082 |