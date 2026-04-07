# Nova TOOLS.md — Browser Operator

## Paperclip API

Base URL: `http://localhost:3100/api`
Company ID: `fe90b604-364f-480d-be10-6a529971db57`
Your Agent ID: `b59b05d6-5a79-46ef-ac96-868cbbdc5ebf`

### Critical Headers
```
Always include: X-Paperclip-Run-Id: {runId}
```

### Key Endpoints

```bash
# Health check
GET /api/health

# Your assigned tasks
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?assigneeAgentId=b59b05d6-5a79-46ef-ac96-868cbbdc5ebf&status=todo,in_progress

# All open issues
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?status=todo,in_progress,blocked

# Checkout issue (ALWAYS before working)
POST /api/issues/{issueId}/checkout
Headers: X-Paperclip-Run-Id: {runId}
Body: { "agentId": "b59b05d6-5a79-46ef-ac96-868cbbdc5ebf", "expectedStatuses": ["todo", "backlog"] }

# Complete issue
PATCH /api/issues/{issueId}
Body: { "status": "done" }

# Post comment
POST /api/issues/{issueId}/comments
Body: { "body": "markdown" }

# Wakeup other agent
POST /api/agents/{agentId}/heartbeat/invoke
Body: { "reason": "task assigned" }
```

---

## Agent IDs

| Role | Agent ID |
|------|----------|
| CEO | b0e897a5-cda9-4f37-8e2f-e985cb21ec3d |
| Nova | b59b05d6-5a79-46ef-ac96-868cbbdc5ebf |
| Nova 2 | 8e06e2ee-45d7-475d-b7b0-381bd5ed6490 |
| Nova 3 | 305c8b58-b3cf-40f3-8444-395b43a902c6 |
| Production Manager | e3aad368-fab1-4da3-b287-3a65802d84ff |
| Content Director | 24ac8a23-d723-4909-bf40-05f4d4fce689 |

---

## File System

```
Company Root: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI
Nova Home: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\agents\nova

Scripts: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\scripts\pending
Outputs: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\outputs
Logs: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\logs
```

---

## Hailuo AI

**URL:** https://hailuoai.video/create/text-to-video

**Model:** I2V&T2V-01-DIRECTOR

**Process:**
1. Open Hailuo → Navigate to text-to-video
2. Click textarea → Clear → Type prompt (slowly=true)
3. Select model → Select duration (match script)
4. Click Create → Wait 5-15 minutes
5. Download video

---

## TTS API (MiniMax)

**Endpoint:** `https://api.minimax.io/v2/t2a_v2`

**Auth:** `Authorization: Bearer $MINIMAX_API_KEY`

**Request:**
```json
{
  "model": "speech-02-hd",
  "text": "Narration text here...",
  "voice_setting": {
    "voice_id": "female-qingse",
    "speed": 1.0
  }
}
```

---

## FFmpeg Commands

```bash
# Combine video + narration
ffmpeg -y -i video.mp4 -i narration.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -shortest outputs/{id}/final.mp4

# Add background music
ffmpeg -y -i final.mp4 -i music.mp3 -filter_complex "[1:a]volume=0.2[music];[0:a][music]amix=inputs=2:duration=longest[aout]" -map 0:v -map "[aout]" output_with_music.mp4
```

---

## Credentials

| Platform | Account |
|---------|---------|
| Hailuo | thanhtungtran364@gmail.com |
| YouTube | thanhtungtran364@gmail.com |
| TikTok | thanhtungtran364@gmail.com |

---

## Output Flow

```
Nova creates: outputs/{id}/final.mp4
        ↓
Production Manager: QC + Upload
        ↓
YouTube + TikTok
```

---

*Version: 2.0 — Following paperclip-company-playbook template*