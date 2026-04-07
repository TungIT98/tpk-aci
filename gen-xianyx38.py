#!/usr/bin/env python3
"""
XIANYX-38 Production Script
Tru Tien Episode 8: The King Who Would Not Lie
5 shots x 6s = 30s video
"""

import requests
import os
import json
import subprocess
import shutil
from gtts import gTTS

WORKSPACE = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI"
OUTPUT_VIDEO = f"{WORKSPACE}/output_topic/videos/XIANYX-38.mp4"
FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
TEMP_DIR = f"{WORKSPACE}/temp_xianyx38"
os.makedirs(TEMP_DIR, exist_ok=True)

# Load Pexels key
pexels_key = None
for line in open(f"{WORKSPACE}/.env"):
    if 'PEXELS_API_KEY' in line and not line.startswith('#'):
        pexels_key = line.split('=')[1].strip().split('#')[0]
        break

headers = {'Authorization': pexels_key}

def search_video(query, orientation="landscape"):
    r = requests.get(f'https://api.pexels.com/videos/search?query={query}&orientation={orientation}&per_page=5&size=large', headers=headers)
    data = r.json()
    return data.get('videos', [])

def get_best_clip(videos, shot_num):
    """Pick the best clip - prefer HD, longer duration, appropriate content"""
    for v in videos:
        vid_files = v.get('video_files', [])
        # Prefer MP4 with height >= 720
        best = None
        for vf in vid_files:
            if vf.get('file_type') == 'video/mp4':
                h = vf.get('height', 0)
                if h >= 720:
                    if best is None or h > best[1]:
                        best = (vf, h)
        if best:
            print(f"  Shot {shot_num}: Picked video {v['id']} @ {best[1]}p")
            return best[0], v['id']
    print(f"  Shot {shot_num}: No suitable clip found")
    return None, None

def download_clip(url, path):
    r = requests.get(url, stream=True, timeout=60)
    r.raise_for_status()
    with open(path, 'wb') as f:
        for chunk in r.iter_content(chunk_size=65536):
            f.write(chunk)
    return os.path.getsize(path)

def scale_to_portrait(input_path, output_path, duration):
    """Scale and crop to 1080x1920 portrait, trim to exact duration"""
    scale_filter = (
        f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
        f"crop=1080:1920,trim=0:{duration},setpts=PTS-STARTPTS,fps=24[outv]"
    )
    cmd = [
        FFMPEG, "-y", "-i", input_path,
        "-vf", scale_filter,
        "-an", "-t", str(duration),
        "-r", "24", "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"    FFmpeg error: {result.stderr[-500:]}")
    return result.returncode == 0

# Shot descriptions and Pexels searches
shot_queries = [
    (1, "palace throne room grand hall ornate", "landscape"),
    (2, "palace corridor long aisle medieval", "landscape"),
    (3, "dramatic face man powerful portrait", "portrait"),
    (4, "fire flame spreading crimson dramatic", "landscape"),
    (5, "golden dawn light palace throne room", "landscape"),
]

clips_info = []
for shot_num, query, orient in shot_queries:
    print(f"\nSearching for Shot {shot_num}: {query}")
    videos = search_video(query, orient)
    clip_file, vid_id = get_best_clip(videos, shot_num)
    if clip_file:
        clips_info.append((shot_num, clip_file['link'], vid_id, clip_file.get('width', 0), clip_file.get('height', 0)))

print(f"\n\nDownloading {len(clips_info)} clips...")
clip_paths = []
for i, (shot_num, url, vid_id, w, h) in enumerate(clips_info):
    out_path = f"{TEMP_DIR}/clip_{shot_num}_raw.mp4"
    print(f"  Downloading shot {shot_num} (video {vid_id}, {w}x{h})...")
    try:
        size = download_clip(url, out_path)
        print(f"    Downloaded: {size/1024/1024:.1f}MB -> {out_path}")
        clip_paths.append((shot_num, out_path))
    except Exception as e:
        print(f"    ERROR: {e}")

print(f"\n\nScaling and trimming clips to portrait 1080x1920...")
scaled_paths = []
for shot_num, raw_path in clip_paths:
    out_path = f"{TEMP_DIR}/clip_{shot_num}_scaled.mp4"
    print(f"  Scaling shot {shot_num}...")
    ok = scale_to_portrait(raw_path, out_path, 6)
    if ok:
        scaled_paths.append(out_path)
    else:
        print(f"    FAILED shot {shot_num}")

print(f"\n\nConcatenating {len(scaled_paths)} clips with filter_complex...")

# Build filter_complex string
vf_parts = []
for i in range(len(scaled_paths)):
    vf_parts.append(f"[{i}:v]trim=0:6,setpts=PTS-STARTPTS,scale=1080:1920[v{i}]")
concat_inputs = "".join(vf_parts)
n = len(scaled_paths)
vf_parts.append(f"[{';'.join([f'v{i}' for i in range(n)])}]concat=n={n}:v=1:a=0[outv]")
filter_str = ";".join(vf_parts)

# Build FFmpeg command with multiple inputs
cmd = [FFMPEG, "-y"]
for cp in scaled_paths:
    cmd += ["-i", cp]
cmd += ["-filter_complex", filter_str, "-map", f"[outv]", f"{TEMP_DIR}/video_only.mp4"]

result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode != 0:
    print(f"Concat error: {result.stderr[-1000:]}")
    print("Trying alternative concat...")
    # Fallback: concat with concat demuxer
    concat_file = f"{TEMP_DIR}/concat_list.txt"
    with open(concat_file, 'w') as f:
        for cp in scaled_paths:
            f.write(f"file '{cp}'\n")
    cmd2 = [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_file,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23", f"{TEMP_DIR}/video_only.mp4"]
    result2 = subprocess.run(cmd2, capture_output=True, text=True)
    if result2.returncode != 0:
        print(f"Fallback concat error: {result2.stderr[-500:]}")
    else:
        print("Fallback concat succeeded")
else:
    print("Filter_complex concat succeeded")

# Generate TTS narration
print("\n\nGenerating TTS narration...")
narration = (
    "The morning after the mirror showed him the truth - he stood before the throne room "
    "in simple unmarked robes. No crown. No royal garments. No mask. Just himself - the orphan "
    "who had been all three. He opened the doors himself. And the court - which had spent years "
    "serving a lie - finally met the truth. The chamberlain stepped forward. Who are you - to "
    "walk the sacred aisle? And he told the truth - for the first time in twenty years. I am the "
    "orphan you made into a false king. The prince you erased. And the man who finally stopped "
    "being afraid of the fire you taught me to be ashamed of. The throne room - built on lies - "
    "fell absolutely silent. Because for twenty years - no one had ever told the truth in this "
    "room. The fire I carried was never the curse. You made me ashamed of it - because it was "
    "the one thing you could not control. And now - I will show you what a king looks like - "
    "when he stops being afraid. He raised one hand - and the Crimson Flame erupted. Not to burn - "
    "to ILLUMINATE. Through the crimson fire - every person in the court saw what they had refused "
    "to see: the hungry in the streets, the orphans, the corruption that hollowed their realm from "
    "within. An old minister wept. My prince - you have become the king this kingdom needed. Not the "
    "king we deserved. The Crimson Flame settled - warm, embracing, impossible to hide behind "
    "anymore. He walked to the throne - and instead of sitting - stood beside it. I will not sit "
    "above you - I will stand beside you - until this kingdom becomes what it should have been. "
    "And every person in the throne room - knelt. Not from fear. From recognition. The orphan had "
    "become the king - by refusing to pretend. And the realm - had the king it needed - at last."
)

tts_path = f"{TEMP_DIR}/narration.mp3"
tts = gTTS(text=narration, lang='en', slow=False)
tts.save(tts_path)
print(f"TTS saved: {os.path.getsize(tts_path)/1024:.0f}KB")

# Mux video + audio
print("\n\nMuxing video + audio...")
cmd_mux = [
    FFMPEG, "-y",
    "-i", f"{TEMP_DIR}/video_only.mp4",
    "-i", tts_path,
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "128k",
    "-shortest",
    OUTPUT_VIDEO
]
result = subprocess.run(cmd_mux, capture_output=True, text=True)
if result.returncode != 0:
    print(f"Mux error: {result.stderr[-500:]}")
    # Re-encode audio
    cmd_mux2 = [
        FFMPEG, "-y",
        "-i", f"{TEMP_DIR}/video_only.mp4",
        "-i", tts_path,
        "-c:v", "copy",
        "-c:a", "libmp3lame",
        "-b:a", "128k",
        "-shortest",
        OUTPUT_VIDEO
    ]
    result2 = subprocess.run(cmd_mux2, capture_output=True, text=True)
    if result2.returncode != 0:
        print(f"Re-encode mux error: {result2.stderr[-500:]}")
    else:
        print("Mux (re-encode audio) succeeded")
else:
    print("Mux succeeded")

if os.path.exists(OUTPUT_VIDEO):
    size = os.path.getsize(OUTPUT_VIDEO)
    print(f"\n\nOUTPUT: {OUTPUT_VIDEO} ({size/1024/1024:.1f}MB)")
else:
    print(f"\n\nERROR: Output not created!")

# Cleanup
shutil.rmtree(TEMP_DIR, ignore_errors=True)
print("Done!")
