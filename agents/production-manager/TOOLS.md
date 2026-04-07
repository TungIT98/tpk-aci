# Production Manager TOOLS.md — TKP ACI

## Paperclip API

Base URL: `http://localhost:3100/api`
Company ID: `fe90b604-364f-480d-be10-6a529971db57`
Your Agent ID: `e3aad368-fab1-4da3-b287-3a65802d84ff`

### Critical Headers
```
Always include: X-Paperclip-Run-Id: {runId}
```

### Key Endpoints

```bash
# Health check
GET /api/health

# Your assigned tasks
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?assigneeAgentId=e3aad368-fab1-4da3-b287-3a65802d84ff&status=todo,in_progress

# All open issues
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?status=todo,in_progress,blocked

# Checkout issue (ALWAYS before working)
POST /api/issues/{issueId}/checkout
Headers: X-Paperclip-Run-Id: {runId}
Body: { "agentId": "e3aad368-fab1-4da3-b287-3a65802d84ff", "expectedStatuses": ["todo", "backlog"] }

# Complete issue
PATCH /api/issues/{issueId}
Body: { "status": "done" }

# Post comment
POST /api/issues/{issueId}/comments
Body: { "body": "markdown" }

# Wakeup agent (for delegating back to Nova)
POST /api/agents/{agentId}/heartbeat/invoke
Body: { "reason": "fix required" }
```

---

## Agent IDs

| Role | Agent ID |
|------|----------|
| CEO | b0e897a5-cda9-4f37-8e2f-e985cb21ec3d |
| Nova | b59b05d6-5a79-46ef-ac96-868cbbdc5ebf |
| Nova 2 | 8e06e2ee-45d7-475d-b7b0-381bd5ed6490 |
| Nova 3 | 305c8b58-b3cf-40f3-8444-395b43a902c6 |

---

## File System

```
Company Root: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI
PM Home: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\agents\production-manager

Pending Scripts: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\scripts\pending
Video Outputs: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\outputs
TikTok Upload: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\content\videos
Logs: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\logs
```

---

## Upload Scripts

```bash
# Main upload automation
node scripts/production-upload-automation.mjs

# YouTube session setup (if expired)
node scripts/setup-youtube-session.js

# TikTok session setup (if expired)
node scripts/setup-tiktok-session.js

# Specific video upload
node scripts/production-upload-automation.mjs --video=WC-01 --platform=youtube

# Dry run (show what would upload)
node scripts/production-upload-automation.mjs --dryrun
```

---

## Credentials

| Service | Account |
|---------|---------|
| Hailuo | thanhtungtran364@gmail.com |
| YouTube | thanhtungtran364@gmail.com |
| TikTok | thanhtungtran364@gmail.com |

---

## Upload Status Flow

```
scripts/pending/{id}.json status field:
    pending → in_production → ready_for_upload → published

After upload:
    Update youtube_url field
    Update tiktok_url field
    Set publishedAt timestamp
```

---

## QC Checklist (Before Upload)

- [ ] Video exists: `outputs/{id}/final.mp4`
- [ ] File size > 1MB
- [ ] Duration: 45-90 seconds
- [ ] Aspect ratio: 9:16 (vertical)
- [ ] Hash differs from previous videos
- [ ] Visual content matches script prompt

---

## Platform Upload Methods

### YouTube
- Browser automation (primary) — `.youtube-session.json`
- Session setup: `node scripts/setup-youtube-session.js`

### TikTok
- n8n workflow watches `content/videos/*/captioned.mp4` and auto-uploads
- Copy video to trigger: `cp outputs/{id}/final.mp4 content/videos/{id}/captioned.mp4`

---

*Version: 2.0 — Following paperclip-company-playbook template*