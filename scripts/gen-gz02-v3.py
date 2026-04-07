import requests
import json
import os
import subprocess
import shutil
import hashlib

FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FFPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"
WORKSPACE = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI"
OUTPUT_DIR = f"{WORKSPACE}/output_topic/videos"
TMP_DIR = "C:/tmp/openclaw/uploads/GZ-02"
UPLOAD_DIR = "C:/tmp/openclaw/uploads"

os.makedirs(OUTPUT_DIR, exist_ok=True)

script_id = "GZ-02"

def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result

def probe_duration(path):
    out = run([FFPROBE, "-v", "quiet", "-print_format", "json", "-show_format", path])
    try:
        return float(json.loads(out.stdout)['format']['duration'])
    except:
        return 0

# Use already-downloaded clips
scroll_raw = f"{TMP_DIR}/scroll.mp4"
prod_raw = f"{TMP_DIR}/productive.mp4"

print(f"Scroll duration: {probe_duration(scroll_raw):.2f}s")
print(f"Prod duration: {probe_duration(prod_raw):.2f}s")

# Step 1: Generate TTS narration
print("\n=== Step 1: Generate TTS ===")
from gtts import gTTS
narration_text = "Scrolling TikTok for 45 minutes before work isn't a morning routine. It's a slow drain on your potential."
audio_path = f"{TMP_DIR}/narration.mp3"
tts = gTTS(text=narration_text, lang="en", tld="com")
tts.save(audio_path)
audio_dur = probe_duration(audio_path)
print(f"  Audio: {audio_dur:.2f}s → {audio_path}")

# Step 2: Trim/process clips to 1080x1920 portrait
print("\n=== Step 2: Process clips ===")

# Clip 1: dark scroll - use first 3s
clip1 = f"{TMP_DIR}/clip1.mp4"
run([FFMPEG, "-y", "-ss", "0", "-t", "3", "-i", scroll_raw,
     "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,fps=30",
     "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", clip1])
print(f"  Clip1 (dark scroll 0-3s): {probe_duration(clip1):.2f}s")

# Clip 2: productive - use first 4s
clip2 = f"{TMP_DIR}/clip2.mp4"
run([FFMPEG, "-y", "-ss", "0", "-t", "4", "-i", prod_raw,
     "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,fps=30",
     "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", clip2])
print(f"  Clip2 (productive 0-4s): {probe_duration(clip2):.2f}s")

# Step 3: Concatenate
print("\n=== Step 3: Concatenate ===")
concat_txt = f"{TMP_DIR}/concat.txt"
with open(concat_txt, 'w') as f:
    f.write(f"file '{clip1}'\n")
    f.write(f"file '{clip2}'\n")

video_only = f"{TMP_DIR}/video_only.mp4"
run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_txt,
     "-c:v", "libx264", "-preset", "fast", "-crf", "23", video_only])
video_dur = probe_duration(video_only)
print(f"  Video duration: {video_dur:.2f}s")

# Step 4: Combine video + audio
print("\n=== Step 4: Combine video + audio ===")
target_dur = min(video_dur, audio_dur, 6.5)
final_path = f"{OUTPUT_DIR}/{script_id}.mp4"

run([FFMPEG, "-y",
     "-i", video_only,
     "-i", audio_path,
     "-c:v", "libx264", "-preset", "fast", "-crf", "23",
     "-c:a", "aac", "-b:a", "128k",
     "-t", str(target_dur),
     "-shortest",
     final_path])

# Verify
verify = run([FFPROBE, "-v", "quiet", "-print_format", "json", "-show_format", final_path])
vdata = json.loads(verify.stdout)
final_dur = float(vdata['format'].get('duration', 0))
final_size = int(vdata['format'].get('size', 0))

print(f"\n=== DONE ===")
print(f"Final: {final_path}")
print(f"Duration: {final_dur:.2f}s | Size: {final_size//1024}KB ({final_size//1024//1024}MB)")

# Copy to upload dir
upload_final = f"{UPLOAD_DIR}/{script_id}-FINAL.mp4"
shutil.copy(final_path, upload_final)
print(f"Upload: {upload_final}")

# Hash
with open(final_path, 'rb') as f:
    md5 = hashlib.md5(f.read()).hexdigest()
print(f"MD5: {md5}")

# Output for capture
print(f"\nVIDEO_PATH={final_path}")
