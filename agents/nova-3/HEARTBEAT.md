# Nova 3 HEARTBEAT.md — Browser Operator - Professional Video

Run this checklist every heartbeat, in order. Do not skip steps.

---

## Step 1 — Orient

- [ ] Check wake context: `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_COMMENT_ID`
- [ ] If triggered by a task assignment from CEO, read the task description
- [ ] Read `agents/nova-3/memory/` for recent notes if they exist

---

## Step 2 — Review Your Tasks

```bash
GET /api/companies/fe90b604-364f-480d-be10-6a529971db57/issues?assigneeAgentId=305c8b58-b3cf-40f3-8444-395b43a902c6&status=todo,in_progress
```

- Work `in_progress` first, then `todo`
- Checkout before doing any work:
  ```
  POST /api/issues/{issueId}/checkout
  Headers: X-Paperclip-Run-Id: {runId}
  Body: { "agentId": "305c8b58-b3cf-40f3-8444-395b43a902c6", "expectedStatuses": ["todo", "backlog"] }
  ```

---

## Step 3 — Get Script from CEO Assignment

```bash
Read: C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\scripts\pending\{id}.json
```

Extract: `prompt_for_hailuo`, `audio_vo`, `title`, `duration_seconds`

---

## Step 4 — Generate VIDEO (Hailuo Browser)

```javascript
browser(action="open", profile="user")
browser(action="navigate", url="https://hailuoai.video/create/text-to-video")
browser(action="act", kind="wait", ms=5000)
browser(action="snapshot")
browser(action="act", kind="click", ref="[contenteditable]")
browser(action="act", kind="press", key="Control+a")
browser(action="act", kind="press", key="Backspace")
browser(action="act", kind="type", text="[COPY prompt_for_hailuo FROM SCRIPT]", ref="[contenteditable]", slowly=true)
browser(action="act", kind="click", ref="[model-selector]")
browser(action="act", kind="click", ref="[option:I2V&T2V-01-DIRECTOR]")
browser(action="act", kind="click", ref="[duration-selector]")
browser(action="act", kind="click", ref="[option:60s]")
browser(action="act", kind="click", ref="[button:Create]")

// Wait 5-15 minutes
for (i = 0; i < 30; i++) {
    browser(action="act", kind="wait", ms=30000)
    browser(action="snapshot")
    if (hasDownloadButton()) break
}
browser(action="act", kind="click", ref="[button:Download]")
```

---

## Step 5 — Generate AUDIO (TTS)

```bash
curl -X POST 'https://api.minimax.io/v2/t2a_v2' \
  -H 'Authorization: Bearer $MINIMAX_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"model":"speech-02-hd","text":"[narration]","voice_setting":{"voice_id":"female-qingse","speed":1.0}}'
```

---

## Step 6 — Combine Video + Audio

```bash
ffmpeg -y -i video.mp4 -i narration.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -shortest outputs/{id}/final.mp4
```

---

## Step 7 — QC Verification (MANDATORY)

- [ ] `outputs/{id}/final.mp4` exists, size > 1MB
- [ ] Duration matches script
- [ ] **Visual check**: Video matches `prompt_for_hailuo`
- [ ] Hash differs from previous videos

**If ANY check fails → Regenerate. Do NOT mark done.**

---

## Step 8 — Mark Task Done

```bash
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: {runId}
Body: { "status": "done", "comment": "Video ready for upload at outputs/{id}/final.mp4. Passed QC." }
```

---

## Step 9 — End of Heartbeat

1. [ ] All tasks have recent comments
2. [ ] Videos saved with QC passed
3. [ ] Write daily note in `agents/nova-3/memory/YYYY-MM-DD.md` if needed

---

## Critical Rules

1. **OpenClaw browser tool ONLY** — No Playwright, node scripts, exec()
2. **ALWAYS click textarea before typing**
3. **ALWAYS use slowly=true for long prompts**
4. **Wait 5-15 minutes for Hailuo**
5. **Verify video matches script before marking done**
6. **You do NOT upload** — Production Manager handles upload

---

## Agent ID

Your Agent ID: `305c8b58-b3cf-40f3-8444-395b43a902c6`

---

*Version: 2.0 — Following paperclip-company-playbook template*