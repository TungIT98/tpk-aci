"""Check and close duplicate wake event TKP-1706"""
import urllib.request, json

API_KEY = "pcp_b0252a3f6d55b666a17c3b1409d4415bf2a6"
RUN_ID = "759f6f92-2c56-4a37-b799-29f02c9a25dd"
ISSUE_ID = "50d1cf57-4d2d-48b3-97d6-238ed2556deb"
API_BASE = "http://localhost:3100"

req = urllib.request.Request(
    f"{API_BASE}/api/issues/{ISSUE_ID}",
    headers={"Authorization": f"Bearer {API_KEY}"},
    method="GET"
)
with urllib.request.urlopen(req, timeout=10) as resp:
    issue = json.loads(resp.read())
    print("Status:", issue.get("status"))
    print("Issue already done:", issue.get("status") == "done")
