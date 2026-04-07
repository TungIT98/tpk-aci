#!/usr/bin/env python3
import requests, json

API_KEY = "pcp_b0252a3f6d55b666a17c3b1409d4415bf2a6"
ISSUE_ID = "e0e65b15-7bfd-45e2-b435-05f04282aac3"
RUN_ID = "712b47c6-7f17-4898-94cb-81466775a1a7"
BASE = "http://localhost:3100"

h = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "X-Paperclip-Run-Id": RUN_ID
}

# Post comment
comment_body = """XIANYX-01 clips generated via Pexels fallback (Hailuo broken — returns cached demo video).

5 clips saved to output/xianxia/XIANYX-01/:
- raw_shot1.mp4 (6.0MB) — ancient temple mountain
- raw_shot2.mp4 (4.1MB) — temple courtyard sword
- raw_shot3.mp4 (2.4MB) — golden hairpin close-up
- raw_shot4.mp4 (3.3MB) — army marching
- raw_shot5.mp4 (6.6MB) — woman wind aura

All 5 clips: 1080x1920 portrait, ~6s each. Ready for PM to handle TTS + assembly."""

r = requests.post(f"{BASE}/api/issues/{ISSUE_ID}/comments",
    headers=h, json={"body": comment_body})
print(f"Comment: {r.status_code} {r.text[:200]}")

# PATCH done
r2 = requests.patch(f"{BASE}/api/issues/{ISSUE_ID}",
    headers=h, json={"status": "done", "comment": "XIANYX-01: 5 video clips generated via Pexels fallback (Hailuo broken). All clips saved to output/xianxia/XIANYX-01/. PM to handle TTS + assembly."})
print(f"PATCH: {r2.status_code} {r2.text[:200]}")
