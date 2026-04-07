import requests
import json
import os
import subprocess
import hashlib
import random

FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FFPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
WORKSPACE = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI"
OUTPUT_DIR = f"{WORKSPACE}/output_topic/videos"
UPLOAD_DIR = "C:/tmp/openclaw/uploads/GZ-02"
TMP_DIR = "C:/tmp/openclaw/uploads/GZ-02"

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

headers = {"Authorization": PEXELS_KEY}

script_id = "GZ-02"

# The GZ-02 concept: phone scrolling in dark vs productive morning
# Structure: 2s scroll scene + 4s productive scene = 6s total
# Hook narration: "Scrolling TikTok for 45 minutes before work isn't a morning routine. It's a slow drain on your potential."

print("=== Step 1: Search Pexels for footage ===")

queries = [
    ("dark_scroll", "person phone glowing face dark bedroom scrolling", "portrait"),
    ("productive", "young person morning sunrise running outdoors energetic", "portrait"),
]

clips = {}
for label, q, orient in queries:
    r = requests.get("https://api.pexels.com/videos/search",
                     headers=headers,
                     params={"query": q, "per_page": 10, "orientation": orient, "size": "small"})
    data = r.json()
    print(f"  [{label}] Query: {q} → {data.get('total_results', 0)} results")
    if data.get('videos'):
        # Pick a good one
        for v in data['videos'][:3]:
            files = v['video_files']
            portrait = [f for f in files if f.get('width', 1080) < f.get('height', 1920)]
            best = portrait[0] if portrait else files[0]
            dur = best.get('duration', 0)
            link = best.get('link', '')
            if dur >= 3:  # Need at least 3s
                print(f"    Selected: id={v['id']}, {best.get('width')}x{best.get('height')}, {dur}s")
                # Download
                out = f"{TMP_DIR}/{label}_raw.mp4"
                dl = requests.get(link, headers=headers, timeout=30)
                with open(out, 'wb') as f:
                    f.write(dl.content)
                clips[label] = {"path": out, "duration": dur, "id": v['id']}
                break

print(f"\nClips: {list(clips.keys())}")

# Step 2: Generate TTS narration using gTTS
print("\n=== Step 2: Generate TTS audio ===")
try:
    from gtts import gTTS
    # Hook line for 6s short
    narration_text = "Scrolling TikTok for 45 minutes before work isn't a morning routine. It's a slow drain on your potential. The 45-minute fix that changed my life."
    audio_path = f"{TMP_DIR}/narration.mp3"
    tts = gTTS(text=narration_text, lang="en", tld="com")
    tts.save(audio_path)
    print(f"  gTTS saved: {audio_path}")
except Exception as e:
    print(f"  gTTS failed: {e}")
    # Try with powershell System.Speech as fallback
    import subprocess
    narration_text = "Scrolling TikTok for 45 minutes before work isn't a morning routine. It's a slow drain on your potential."
    ps_script = f'''
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 0
$synth.SetOutputToWaveFile("{TMP_DIR}/narration.wav")
$synth.Speak("{narration_text}")
'''
    ps_result = subprocess.run(["powershell", "-Command", ps_script], capture_output=True, text=True)
    print(f"  PowerShell TTS: {ps_result.returncode}")
    audio_path = f"{TMP_DIR}/narration.wav"

# Check audio duration
probe_out = subprocess.run([FFPROBE, "-v", "quiet", "-print_format", "json", "-show_format", audio_path],
                           capture_output=True, text=True)
import json as JSON
probe_data = JSON.loads(probe_out.stdout)
audio_dur = float(probe_data['format'].get('duration', 6))
print(f"  Audio duration: {audio_dur:.2f}s")

# Target video duration
target_dur = 6.0
if audio_dur > target_dur:
    print(f"  Will trim audio to {target_dur}s")

# Step 3: Trim clips to target duration
print("\n=== Step 3: Prepare video clips ===")
if "dark_scroll" in clips and "productive" in clips:
    scroll_path = clips["dark_scroll"]["path"]
    prod_path = clips["productive"]["path"]
    
    # Clip 1: 0-2s from scroll
    clip1_path = f"{TMP_DIR}/clip1.mp4"
    subprocess.run([FFMPEG, "-y", "-ss", "0", "-t", "2", "-i", scroll_path,
                    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
                    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                    "-an", clip1_path], capture_output=True)
    print(f"  Clip1 (scroll, 0-2s): done")
    
    # Clip 2: 0-4s from productive
    clip2_path = f"{TMP_DIR}/clip2.mp4"
    subprocess.run([FFMPEG, "-y", "-ss", "0", "-t", "4", "-i", prod_path,
                    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
                    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                    "-an", clip2_path], capture_output=True)
    print(f"  Clip2 (productive, 0-4s): done")
    
    # Step 4: Concatenate clips
    concat_list = f"{TMP_DIR}/concat.txt"
    with open(concat_list, 'w') as f:
        f.write(f"file '{clip1_path}'\n")
        f.write(f"file '{clip2_path}'\n")
    
    video_only = f"{TMP_DIR}/video_only.mp4"
    subprocess.run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_list,
                    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                    video_only], capture_output=True)
    print(f"  Concatenated video: {video_only}")
    
    # Step 5: Combine video + audio (trim audio to video length)
    final_path = f"{OUTPUT_DIR}/{script_id}.mp4"
    subprocess.run([FFMPEG, "-y",
                    "-i", video_only,
                    "-i", audio_path,
                    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                    "-c:a", "aac", "-b:a", "128k",
                    "-t", str(target_dur),
                    "-shortest",
                    final_path], capture_output=True)
    print(f"\n=== FINAL OUTPUT: {final_path} ===")
    
    # Verify
    verify = subprocess.run([FFPROBE, "-v", "quiet", "-print_format", "json", "-show_format", final_path],
                           capture_output=True, text=True)
    vdata = JSON.loads(verify.stdout)
    print(f"  Duration: {vdata['format'].get('duration', 'N/A')}s")
    print(f"  Size: {int(vdata['format'].get('size', 0)) // 1024 // 1024}MB")
    
    # Copy to uploads for browser
    upload_path = f"C:/tmp/openclaw/uploads/{script_id}-FINAL.mp4"
    import shutil
    shutil.copy(final_path, upload_path)
    print(f"  Copied to upload dir: {upload_path}")
    
    print(f"\nVIDEO_PATH={final_path}")
else:
    print("ERROR: Missing clips")
    print(clips)
