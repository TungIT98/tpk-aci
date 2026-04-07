import requests
import json
import os
import subprocess
import shutil

FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FFPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
WORKSPACE = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI"
OUTPUT_DIR = f"{WORKSPACE}/output_topic/videos"
TMP_DIR = "C:/tmp/openclaw/uploads/GZ-02"
UPLOAD_DIR = "C:/tmp/openclaw/uploads"

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TMP_DIR, exist_ok=True)

headers = {"Authorization": PEXELS_KEY}

script_id = "GZ-02"

def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  WARN: {result.stderr[-200:]}")
    return result

def probe_duration(path):
    out = run([FFPROBE, "-v", "quiet", "-print_format", "json", "-show_format", path])
    try:
        return float(json.loads(out.stdout)['format']['duration'])
    except:
        return 0

print("=== Step 1: Download Pexels footage (portrait, no duration filter) ===")

# Known good video IDs from Pexels that match our concept
# dark_scroll: phone scrolling in dark room  
# productive: morning energy / running
downloads = {}

queries = [
    ("dark_scroll", "https://videos.pexels.com/video-files/7986737/7986737-hd_1080_1920_24fps.mp4"),
    ("productive", "https://videos.pexels.com/video-files/7505760/7505760-hd_720_1280_25fps.mp4"),
]

for label, url in queries:
    path = f"{TMP_DIR}/{label}_raw.mp4"
    if not os.path.exists(path):
        dl = requests.get(url, headers=headers, timeout=60)
        with open(path, 'wb') as f:
            f.write(dl.content)
        print(f"  Downloaded {label}: {len(dl.content)//1024}KB")
    else:
        print(f"  Already exists {label}")
    dur = probe_duration(path)
    print(f"  Duration: {dur:.2f}s")
    downloads[label] = {"path": path, "duration": dur}

print(f"\nDownloads: {[k for k in downloads.keys()]}")

# Step 2: Generate TTS narration
print("\n=== Step 2: Generate TTS audio ===")
from gtts import gTTS

# Hook + brief pitch for ~6s short
narration_text = "Scrolling TikTok for 45 minutes before work isn't a morning routine. It's a slow drain on your potential."
audio_path = f"{TMP_DIR}/narration.mp3"
tts = gTTS(text=narration_text, lang="en", tld="com")
tts.save(audio_path)
print(f"  gTTS saved: {audio_path}")

audio_dur = probe_duration(audio_path)
print(f"  Audio duration: {audio_dur:.2f}s")

# Step 3: Process video clips
print("\n=== Step 3: Process clips to 1080x1920 portrait ===")

# Clip 1: dark_scroll, use first 3s
clip1_path = f"{TMP_DIR}/clip1.mp4"
run([FFMPEG, "-y", "-ss", "0", "-t", "3", "-i", downloads["dark_scroll"]["path"],
     "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,fps=30",
     "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", clip1_path])
c1_dur = probe_duration(clip1_path)
print(f"  Clip1 (dark scroll 0-3s): {c1_dur:.2f}s")

# Clip 2: productive, use first 4s
clip2_path = f"{TMP_DIR}/clip2.mp4"
run([FFMPEG, "-y", "-ss", "0", "-t", "4", "-i", downloads["productive"]["path"],
     "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,fps=30",
     "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", clip2_path])
c2_dur = probe_duration(clip2_path)
print(f"  Clip2 (productive 0-4s): {c2_dur:.2f}s")

# Step 4: Concatenate
print("\n=== Step 4: Concatenate clips ===")
concat_txt = f"{TMP_DIR}/concat.txt"
with open(concat_txt, 'w') as f:
    f.write(f"file '{clip1_path}'\n")
    f.write(f"file '{clip2_path}'\n")

video_only = f"{TMP_DIR}/video_only.mp4"
run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_txt,
     "-c:v", "libx264", "-preset", "fast", "-crf", "23", video_only])
video_dur = probe_duration(video_only)
print(f"  Concatenated video: {video_dur:.2f}s")

# Step 5: Combine video + audio (trim both to target ~6s)
print("\n=== Step 5: Combine video + audio ===")
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
print(f"\n=== FINAL OUTPUT: {final_path} ===")
print(f"  Duration: {final_dur:.2f}s")
print(f"  Size: {final_size//1024}KB ({final_size//1024//1024}MB)")

# Copy to uploads
upload_final = f"{UPLOAD_DIR}/{script_id}-FINAL.mp4"
shutil.copy(final_path, upload_final)
print(f"  Copied to: {upload_final}")

# Compute hash
import hashlib
with open(final_path, 'rb') as f:
    md5 = hashlib.md5(f.read()).hexdigest()
print(f"  MD5: {md5}")
print(f"\nVIDEO_PATH={final_path}")
print(f"UPLOAD_PATH={upload_final}")
print(f"MD5={md5}")
