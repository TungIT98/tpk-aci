import requests
h = {"Authorization": "Bearer pcp_b0252a3f6d55b666a17c3b1409d4415bf2a6"}
r = requests.get("http://localhost:3100/api/issues/e0e65b15-7bfd-45e2-b435-05f04282aac3/comments", headers=h)
for c in r.json():
    print(c["createdAt"], "|", c["body"][:300])
