#!/usr/bin/env python3
"""Produce XIANYX-36 Trieu Tien Episode 8: The Phoenix That Does Not Burn"""

import os
import json
import subprocess
import requests
import time

WORKSPACE = r'C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI'
SCRIPT_PATH = os.path.join(WORKSPACE, 'scripts', 'pending', 'xianxia', 'XIANYX-36.json')
OUTPUT_PATH = os.path.join(WORKSPACE, 'output_topic', 'videos', 'XIANYX-36.mp4')
TMP = r'C:\tmp\openclaw\uploads'
PEXELS_KEY = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa'

# Shot queries matching the xianxia theme
SHOT_QUERIES = [
    "ancient chinese temple courtyard morning light disciples",
    "army soldiers marching valley battlefield dawn",
    "beautiful woman crimson dress standing alone valley",
    "magical golden light illumination fantasy warrior",
    "soldiers kneeling surrender dawn epic landscape"
]

os.makedirs(TMP, exist_ok=True)
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

# Load script
with open(SCRIPT_PATH, 'r', encoding='utf-8') as f:
    script = json.load(f)

print(f"Producing {script['id']}: {script['title']}")

clip_paths = []
pexels_session = requests.Session()
pexels_session.headers.update({'Authorization': PEXELS_KEY})

for i, query in enumerate(SHOT_QUERIES, 1):
    clip_path = os.path.join(TMP, f'XIANYX-36_clip{i}.mp4')
    
    # Search Pexels
    print(f"Shot {i}: Searching Pexels: {query[:60]}")
    try:
        r = pexels_session.get(
            'https://api.pexels.com/videos/search',
            params={'query': query, 'per_page': 5, 'orientation': 'portrait'},
            timeout=15
        )
        data = r.json()
        video_url = None
        if data.get('videos'):
            for v in data['videos']:
                if v['duration'] >= 6:
                    for f in v.get('video_files', []):
                        w = f.get('width', 0)
                        if f.get('quality') == 'hd' and w >= 1080:
                            video_url = f['link']
                            break
                        elif w >= 720 and not video_url:
                            video_url = f['link']
                    if video_url:
                        break
        
        if video_url:
            print(f"  Downloading video from Pexels...")
            r2 = requests.get(video_url, timeout=30, stream=True)
            r2.raise_for_status()
            with open(clip_path, 'wb') as f:
                for chunk in r2.iter_content(chunk_size=65536):
                    f.write(chunk)
            size = os.path.getsize(clip_path)
            print(f"  Downloaded: {size//1024}KB")
            clip_paths.append(clip_path)
            continue
    except Exception as e:
        print(f"  Pexels error: {e}")
    
    # Fallback: create placeholder
    print(f"Shot {i}: Creating placeholder (Pexels failed)")
    result = subprocess.run([
        'ffmpeg', '-y',
        '-f', 'lavfi', '-i', f'color=c=blue:s=1080x1920:d=6',
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-t', '6', '-shortest',
        '-c:v', 'libx264', '-preset', 'ultrafast',
        clip_path
    ], capture_output=True, text=True)
    clip_paths.append(clip_path)
    print(f"  Placeholder created")

# Concatenate clips using filter_complex (avoids -t ignore bug with concat demuxer)
print("Concatenating clips...")
concat_path = os.path.join(TMP, 'XIANYX-36_concat.mp4')

if len(clip_paths) == 5:
    vf = '[0:v]trim=start=0:duration=6,setpts=PTS-STARTPTS,scale=1080:1920[v0];'
    vf += '[1:v]trim=start=0:duration=6,setpts=PTS-STARTPTS,scale=1080:1920[v1];'
    vf += '[2:v]trim=start=0:duration=6,setpts=PTS-STARTPTS,scale=1080:1920[v2];'
    vf += '[3:v]trim=start=0:duration=6,setpts=PTS-STARTPTS,scale=1080:1920[v3];'
    vf += '[4:v]trim=start=0:duration=6,setpts=PTS-STARTPTS,scale=1080:1920[v4];'
    vf += '[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[outv]'
    
    result = subprocess.run([
        'ffmpeg', '-y',
        '-i', clip_paths[0], '-i', clip_paths[1], '-i', clip_paths[2],
        '-i', clip_paths[3], '-i', clip_paths[4],
        '-filter_complex', vf,
        '-map', '[outv]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-t', '30',
        concat_path
    ], capture_output=True, text=True)
    print(f"  Concat return: {result.returncode}")
    if result.returncode != 0:
        print(f"  Concat error: {result.stderr[-500:]}")
else:
    # Fallback concat
    concat_list = os.path.join(TMP, 'XIANYX-36_concat.txt')
    with open(concat_list, 'w') as f:
        for p in clip_paths:
            f.write(f"file '{p}'\n")
    subprocess.run(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', concat_list,
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-t', '30', concat_path])

print(f"  Concat done: {os.path.getsize(concat_path)//1024}KB")

# Generate TTS
print("Generating TTS narration...")
tts_path = os.path.join(TMP, 'XIANYX-36_tts.mp3')
try:
    from gtts import gTTS
    narration = script['audio']['narration']
    tts = gTTS(text=narration, lang='en', slow=False)
    tts.save(tts_path)
    print(f"  TTS saved: {os.path.getsize(tts_path)//1024}KB")
except Exception as e:
    print(f"  TTS error: {e} — creating silent audio")
    subprocess.run(['ffmpeg', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
                    '-t', '30', tts_path], capture_output=True)

# Final mux
print("Muxing final video...")
result = subprocess.run([
    'ffmpeg', '-y',
    '-i', concat_path,
    '-i', tts_path,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    OUTPUT_PATH
], capture_output=True, text=True)

if os.path.exists(OUTPUT_PATH):
    print(f"SUCCESS: {OUTPUT_PATH} — {os.path.getsize(OUTPUT_PATH)//1024}KB")
else:
    print(f"FAILED: {result.stderr[-500:]}")
