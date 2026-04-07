#!/usr/bin/env python3
"""
XIANYX-43 Production Script
Tru Tien Episode 9: The Mirror and the Flame
5 shots x 6s = 30s video
"""

import requests
import os
import json
import subprocess
import shutil
from gtts import gTTS

WORKSPACE = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI"
OUTPUT_VIDEO = f"{WORKSPACE}/output_topic/videos/XIANYX-43.mp4"
FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
TEMP_DIR = f"{WORKSPACE}/temp_xianyx43"
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
    for v in videos:
        vid_files = v.get('video_files', [])
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

# 5 shots for XIANYX-43: The Mirror and the Flame
# Shot 1 (0-6s): Throne room packed, mirror realm tearing open
# Shot 2 (6-12s): Mirror truth - prince torn into three
# Shot 3 (12-18s): Mirror fragments converging in silver spiral
# Shot 4 (18-24s): Full body blazing with complete crimson fire
# Shot 5 (24-30s): Throne blazing crimson, kingdom kneeling
shot_queries = [
    (1, "palace throne room grand hall packed crowd", "landscape"),
    (2, "magic mirror silver glowing ancient supernatural", "landscape"),
    (3, "fire flame red glowing hot ember particles", "landscape"),
    (4, "man face close-up powerful tears emotional", "portrait"),
    (5, "throne room golden majestic king seated crown", "landscape"),
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
        print(f"    Downloaded: {size/1024/1024:.1f}MB")
        clip_paths.append((shot_num, out_path))
    except Exception as e:
        print(f"    ERROR: {e}")

print(f"\n\nScaling clips to portrait 1080x1920...")
scaled_paths = []
for shot_num, raw_path in clip_paths:
    out_path = f"{TEMP_DIR}/clip_{shot_num}_scaled.mp4"
    print(f"  Scaling shot {shot_num}...")
    ok = scale_to_portrait(raw_path, out_path, 6)
    if ok:
        scaled_paths.append(out_path)
    else:
        print(f"    FAILED shot {shot_num}")

# Concat using filter_complex (avoids concat demuxer -t bug)
print(f"\n\nConcatenating {len(scaled_paths)} clips...")
if len(scaled_paths) >= 2:
    vf_parts = []
    for i in range(len(scaled_paths)):
        vf_parts.append(f"[{i}:v]trim=0:6,setpts=PTS-STARTPTS,scale=1080:1920[v{i}]")
    n = len(scaled_paths)
    concat_str = ";".join([f"v{i}" for i in range(n)])
    vf_parts.append(f"{concat_str}concat=n={n}:v=1:a=0[outv]")
    filter_str = ";".join(vf_parts)
    
    cmd = [FFMPEG, "-y"]
    for cp in scaled_paths:
        cmd += ["-i", cp]
    cmd += ["-filter_complex", filter_str, "-map", "[outv]", f"{TEMP_DIR}/video_only.mp4"]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Filter concat error: {result.stderr[-1000:]}")
        # Fallback
        concat_file = f"{TEMP_DIR}/concat_list.txt"
        with open(concat_file, 'w') as f:
            for cp in scaled_paths:
                f.write(f"file '{cp}'\n")
        cmd2 = [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_file,
                "-c:v", "libx264", "-preset", "fast", "-crf", "23", f"{TEMP_DIR}/video_only.mp4"]
        result2 = subprocess.run(cmd2, capture_output=True, text=True)
        print(f"Fallback concat: {'OK' if result2.returncode == 0 else 'FAIL'}")
elif len(scaled_paths) == 1:
    shutil.copy(scaled_paths[0], f"{TEMP_DIR}/video_only.mp4")
    print("Single clip used as-is")
else:
    print("ERROR: No clips available!")
    shutil.rmtree(TEMP_DIR, ignore_errors=True)
    exit(1)

# Generate TTS narration
print("\n\nGenerating TTS narration...")
narration = (
    "The entire kingdom assembled in the throne room for the coronation. Three centuries of honesty - "
    "and the kingdom had chosen their king: the orphan who would not lie. He stood before the empty throne "
    "in simple unmarked robes - when the mirror realm TEARED OPEN above him - showing everyone present "
    "the truth they had never been told. Three centuries ago, there had been one prince. Not three. "
    "And he was that prince - whole. Three centuries ago, the old king made an impossible choice: "
    "split the prince into three, or the fire would consume the kingdom. And so three brothers were "
    "created from one soul - each carrying a fragment of the crimson flame - each believing they were "
    "different, rival, separate. Three centuries of mirrors - shattering simultaneously - not into "
    "destruction, but into COMPLETION. Every fragment that had ever divided him flowing back - "
    "the part of him that was Prince One, the part that was Prince Two, the part that was Prince Three - "
    "returning to the whole they had always been. Three centuries of separation - ending in one breath. "
    "Three hundred years of power held in three separate vessels - and now blazing from one body."
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
    print(f"Re-encode mux: {'OK' if result2.returncode == 0 else 'FAIL'}")
else:
    print("Mux succeeded")

if os.path.exists(OUTPUT_VIDEO):
    size = os.path.getsize(OUTPUT_VIDEO)
    print(f"\nOUTPUT: {OUTPUT_VIDEO} ({size/1024/1024:.1f}MB)")
else:
    print("\nERROR: Output not created!")
    exit(1)

shutil.rmtree(TEMP_DIR, ignore_errors=True)
print("Done!")
