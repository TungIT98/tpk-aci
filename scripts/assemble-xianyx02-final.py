#!/usr/bin/env python3
"""Assemble XIANYX-02 clips into final video."""
import subprocess, json
from pathlib import Path

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
OUTPUT_DIR = ROOT / "outputs" / "xianxia" / "XIANYX-02"
FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"

clips = [
    OUTPUT_DIR / "raw_shot_1.mp4",
    OUTPUT_DIR / "raw_shot_2.mp4",
    OUTPUT_DIR / "raw_shot_3.mp4",
    OUTPUT_DIR / "raw_shot_4.mp4",
    OUTPUT_DIR / "raw_shot_5.mp4",
]

for c in clips:
    if not c.exists():
        print(f"ERROR: Missing clip: {c}")
        exit(1)
    sz = c.stat().st_size
    print(f"  {c.name}: {sz//1024}KB")

# Create concat list
concat_list = OUTPUT_DIR / "concat.txt"
with open(concat_list, "w") as f:
    for c in clips:
        f.write(f"file '{c.resolve()}'\n")
print("Concat list written.")

concat_video = OUTPUT_DIR / "concat_raw.mp4"
print("Concatenating 5 clips...")
r = subprocess.run(
    [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list), "-c", "copy", str(concat_video)],
    capture_output=True, timeout=120
)
if r.returncode != 0:
    print(f"Concat error: {r.stderr.decode('utf-8', errors='replace')[-500:]}")
    exit(1)
print(f"Concatenated: {concat_video.stat().st_size//1024}KB")

# Trim to exactly 30s
final = OUTPUT_DIR / "XIANYX-02.mp4"
r2 = subprocess.run(
    [FFMPEG, "-y", "-i", str(concat_video), "-t", "30", "-c:v", "copy", "-c:a", "aac", "-shortest", str(final)],
    capture_output=True, timeout=120
)
if r2.returncode != 0:
    print(f"Trim error: {r2.stderr.decode('utf-8', errors='replace')[-500:]}")
    exit(1)

print(f"Final: {final.stat().st_size//1024}KB - DONE!")
print(f"Output: {final}")
