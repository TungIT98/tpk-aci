import subprocess, json
from pathlib import Path
ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
FPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"
final = ROOT / "outputs/xianxia/XIANYX-02/XIANYX-02.mp4"
out = subprocess.run([FPROBE, "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", str(final)], capture_output=True, text=True)
data = json.loads(out.stdout)
fmt = data["format"]
dur = float(fmt["duration"])
sz = int(fmt["size"])
print(f"Duration: {dur:.1f}s")
print(f"Size: {sz//1024//1024}MB ({sz//1024}KB)")
for s in data["streams"]:
    if s["codec_type"] == "video":
        print(f"Video: {s['codec_name']} {s['width']}x{s['height']}")
    elif s["codec_type"] == "audio":
        print(f"Audio: {s['codec_name']} {s.get('sample_rate','?')}Hz")
