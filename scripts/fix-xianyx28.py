#!/usr/bin/env python3
import subprocess, os

FFMPEG  = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FFPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"
TEMP    = "C:/tmp/openclaw/uploads"
WORKSPACE = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI"

# Re-encode each shot to exactly 6s
for i in range(1, 6):
    src = f"{TEMP}/xianyx28_shot{i}_trim.mp4"
    out = f"{TEMP}/xianyx28_shot{i}_6s.mp4"
    subprocess.run([
        FFMPEG, "-y", "-ss", "0", "-i", src,
        "-t", "6", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", out
    ], capture_output=True)
    r = subprocess.run([FFPROBE, "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True)
    print(f"Shot {i}: {r.stdout.strip()}s -> {os.path.getsize(out)/1024:.0f}KB")

# Write concat list
concat_list = f"{TEMP}/xianyx28_concat2.txt"
with open(concat_list, "w") as f:
    for i in range(1, 6):
        f.write(f"file 'C:/tmp/openclaw/uploads/xianyx28_shot{i}_6s.mp4'\n")

# Concat with re-encode
concat2 = f"{TEMP}/xianyx28_concat2.mp4"
subprocess.run([
    FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_list,
    "-c:v", "libx264", "-preset", "fast", "-crf", "23", concat2
], capture_output=True)
r = subprocess.run([FFPROBE, "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", concat2], capture_output=True, text=True)
print(f"Concat2 duration: {r.stdout.strip()}s")

# Mux with TTS (gTTS)
import json
from gtts import gTTS

SCRIPT = f"{WORKSPACE}/scripts/pending/xianxia/XIANYX-28.json"
with open(SCRIPT) as f:
    script_data = json.load(f)
narration = script_data["audio"]["narration"]

tts_out = f"{TEMP}/xianyx28_tts.mp3"
tts = gTTS(text=narration, lang="en", slow=False)
tts.save(tts_out)
print(f"gTTS saved: {os.path.getsize(tts_out)/1024:.0f}KB")

def get_duration(path):
    r = subprocess.run([FFPROBE, "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except:
        return 30

tts_dur = get_duration(tts_out)
print(f"TTS duration: {tts_dur:.1f}s")

OUTPUT = f"{WORKSPACE}/output_topic/videos/XIANYX-28.mp4"
subprocess.run([
    FFMPEG, "-y",
    "-i", concat2,
    "-i", tts_out,
    "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-c:a", "aac", "-b:a", "128k",
    "-t", "30",
    OUTPUT
], capture_output=True)

sz = os.path.getsize(OUTPUT)/1024
print(f"Output: {sz:.0f}KB -> {OUTPUT}")

# Update script
script_data["status"] = "produced"
script_data["output_path"] = OUTPUT
script_data["produced_at"] = "2026-04-02T08:25:00Z"
with open(SCRIPT, "w") as f:
    json.dump(script_data, f, indent=2, ensure_ascii=False)
print("Script status: produced")
