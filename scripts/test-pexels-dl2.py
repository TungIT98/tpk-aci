import subprocess, shutil, os
from pathlib import Path

# Test download using curl (which works)
url = "https://videos.pexels.com/video-files/7989870/7989870-hd_1080_1920_25fps.mp4"
out = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output/_temp_gtts/test_dl.mp4")
out.parent.mkdir(parents=True, exist_ok=True)

key = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"

result = subprocess.run(
    ["curl", "-s", "-L", "-o", str(out), "-w", "%{http_code}", url,
     "-H", f"Authorization: {key}"],
    capture_output=True, text=True, timeout=30
)
print(f"HTTP: {result.stdout}, size: {out.stat().st_size if out.exists() else 0}")
