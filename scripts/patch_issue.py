"""PATCH issue TKP-1706 as done"""
import urllib.request, json

API_KEY = "pcp_b0252a3f6d55b666a17c3b1409d4415bf2a6"
RUN_ID = "c9633d23-8409-4e9b-ab00-79d270af3524"
ISSUE_ID = "50d1cf57-4d2d-48b3-97d6-238ed2556deb"
API_BASE = "http://localhost:3100"

# POST comment
comment_body = "TKP-1706 wake event (2026-04-01 20:58 GMT+7): Verified all scripts and videos. All 95 scripts status=produced, 111 videos in output_topic/videos/. 3 Gen Z scripts (GZ-02, GZ-04, GZ-05) verified present: GZ-02=2983KB, GZ-04=3404KB, GZ-05=2002KB. NO_OP — nothing to produce."

req = urllib.request.Request(
    f"{API_BASE}/api/issues/{ISSUE_ID}/comments",
    data=json.dumps({"body": comment_body}).encode(),
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "X-Paperclip-Run-Id": RUN_ID
    },
    method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read())
        print("Comment posted:", result.get("id", ""))
except Exception as e:
    print("Comment error:", e)

# PATCH status=done
patch_body = {
    "status": "done",
    "comment": "NO_OP: All 95 scripts verified produced, 111 videos present. 3 Gen Z scripts (GZ-02=2983KB, GZ-04=3404KB, GZ-05=2002KB) confirmed intact."
}
req2 = urllib.request.Request(
    f"{API_BASE}/api/issues/{ISSUE_ID}",
    data=json.dumps(patch_body).encode(),
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "X-Paperclip-Run-Id": RUN_ID
    },
    method="PATCH"
)
try:
    with urllib.request.urlopen(req2, timeout=10) as resp:
        result = json.loads(resp.read())
        print("PATCH done:", result.get("status"), result.get("id"))
except Exception as e:
    print("PATCH error:", e)
