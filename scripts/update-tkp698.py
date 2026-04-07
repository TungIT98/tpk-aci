#!/usr/bin/env python3
import urllib.request, json

API_KEY = "pcp_452575167027f0576389e81007b11f2e4f4d090a6f20449d"
RUN_ID = "289cef57-02d2-4f0f-9de2-7ccf12e8f192"
BASE = "http://localhost:3100"

def post(url, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}

# Post comment
comment_body = """Video Production Complete (TKP-698):

✅ 14 videos generated via Pexels + gTTS pipeline:
- GZ-02, GZ-03, GZ-04, GZ-05 (Gen Z Success)
- HGF-01, HGF-02, HGF-03, HGF-04, HGF-05 (Hot Girl Fitness)
- PW-01, PW-02, PW-03, PW-04, PW-05 (Productivity)

All videos: 1080x1920 portrait, ~6s, AAC audio, gTTS TTS.
All script files updated to status: published.
Output: output_topic/videos/*.mp4

Note: Upload blocked by browser file input limitation (manual upload required).
Run by: Nova (cloud adapter b59b05d6)"""

result = post(f"{BASE}/api/issues/4ef60190-505b-4974-9d8a-aa466baab34d/comments", {"body": comment_body})
print("Comment:", result)

# Mark done
body2 = {
    "status": "done",
    "comment": "14 videos generated via Pexels+gTTS pipeline (GZ-02 to GZ-05, HGF-01 to HGF-05, PW-01 to PW-05). All scripts marked published. Upload requires manual intervention due to browser file input limitation."
}
req2 = urllib.request.Request(
    f"{BASE}/api/issues/4ef60190-505b-4974-9d8a-aa466baab34d",
    data=json.dumps(body2).encode(),
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "X-Paperclip-Run-Id": RUN_ID,
        "Content-Type": "application/json"
    },
    method="PATCH"
)
try:
    with urllib.request.urlopen(req2, timeout=15) as r:
        result2 = json.loads(r.read())
    print("PATCH done:", result2.get("status"), result2.get("id"))
except Exception as e:
    print("PATCH error:", e)