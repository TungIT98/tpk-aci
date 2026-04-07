# CEO HEARTBEAT.md — DEPRECATED

> **DEPRECATED**: Paperclip only reads `AGENTS.md` (instructionsEntryFile), NOT HEARTBEAT.md.
> All heartbeat protocol is now embedded directly in `AGENTS.md`.
> This file is kept for reference only and is NOT executed by Paperclip.

### Critical Fix Applied (v3.0)
- Full heartbeat protocol (Steps 0-6) is now in AGENTS.md
- `blocked` status is now included in issue queries
- `GET /api/agents/me` is now Step 0
- `GET /api/issues/{id}` + comments is now Step 4
