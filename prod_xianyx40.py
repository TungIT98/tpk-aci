#!/usr/bin/env python3
"""Produce XIANYX-40 Muc Than Ky Episode 8 - Simple concat pipeline"""
import requests
import os
import subprocess

WORKSPACE = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI'
OUTPUT = f'{WORKSPACE}/output_topic/videos'
TEMP = f'{WORKSPACE}/temp_xianyx40'
FFMPEG = r'C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe'

os.makedirs(TEMP, exist_ok=True)
os.makedirs(OUTPUT, exist_ok=True)

PEXELS_KEY = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa'

# Portrait Pexels videos for each shot
SHOTS = [
    {'id': '10084620', 'start': 0, 'duration': 6, 'file': f'{TEMP}/s1.mp4'},
    {'id': '4046253', 'start': 0, 'duration': 6, 'file': f'{TEMP}/s2.mp4'},
    {'id': '855789', 'start': 0, 'duration': 6, 'file': f'{TEMP}/s3.mp4'},
    {'id': '8724306', 'start': 5, 'duration': 6, 'file': f'{TEMP}/s4.mp4'},
    {'id': '28467480', 'start': 0, 'duration': 6, 'file': f'{TEMP}/s5.mp4'},
]

def get_video_url(vid):
    url = f'https://api.pexels.com/videos/videos/{vid}'
    r = requests.get(url, headers={'Authorization': PEXELS_KEY})
    data = r.json()
    best = None
    for vf in data.get('video_files', []):
        link = vf['link']
        if 'pexels.com' in link and vf.get('height', 0) >= 480:
            h = vf['height']
            if best is None or h > best[1]:
                best = (link, h)
    return best[0] if best else None

def download_and_trim(shot):
    video_url = get_video_url(shot['id'])
    if not video_url:
        print(f'  FAIL: no URL for {shot["id"]}')
        return False
    
    out_raw = shot['file'].replace('.mp4', '_raw.mp4')
    print(f'  Downloading {video_url}')
    r = requests.get(video_url, stream=True, timeout=120)
    with open(out_raw, 'wb') as f:
        for chunk in r.iter_content(chunk_size=65536):
            f.write(chunk)
    
    cmd = [
        FFMPEG, '-y', '-i', out_raw,
        '-ss', str(shot['start']), '-t', str(shot['duration']),
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-an',
        shot['file']
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    os.remove(out_raw)
    if result.returncode != 0:
        print(f'  FFmpeg error: {result.stderr[-300:]}')
        return False
    sz = os.path.getsize(shot['file'])
    print(f'  OK: {sz/1024/1024:.1f}MB')
    return True

# Step 1: Download all clips
print('=== Downloading clips ===')
for i, shot in enumerate(SHOTS):
    print(f'Shot {i+1} (ID={shot["id"]}):')
    ok = download_and_trim(shot)
    if not ok:
        print('FATAL: Download failed')
        exit(1)

# Step 2: Concat demuxer (stream copy is safe since each clip is pre-trimmed to exact duration)
print('\n=== Concatenating ===')
concat_list = f'{TEMP}/concat.txt'
with open(concat_list, 'w') as f:
    for shot in SHOTS:
        f.write(f"file '{shot['file']}'\n")

video_only = f'{TEMP}/video.mp4'
cmd = [
    FFMPEG, '-y', '-f', 'concat', '-safe', '0',
    '-i', concat_list,
    '-c', 'copy',
    video_only
]
result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode != 0:
    print(f'Concat error: {result.stderr[-500:]}')
    exit(1)
print(f'Concat OK: {os.path.getsize(video_only)/1024/1024:.1f}MB')

# Step 3: TTS narration
print('\n=== TTS ===')
from gtts import gTTS
narration = """He followed her story through the forest — to a clearing at twilight. And the golden seer eye — read what no one had ever written: she had died three years ago — saving a village from a flood — by redirecting the water with her own body. The village was saved. And forgotten. And she had been walking the forest ever since — unable to leave — because no one had written her ending. He stepped from the shadows — and told her what she already knew. You died — three years ago — saving a village. She did not scream. Did not vanish. She simply sighed — a sigh of three years of waiting. I know. She said. I have been waiting for someone to write my ending. No one should end like this — he said. Not forgotten. Not unfinished. The golden seer eye blazed brighter than it had ever blazed — and he understood. The Grave Watcher's final gift was not reading death. It was writing — completing the stories that death interrupted. He raised his hand — golden light gathering at his fingertips — and he BEGAN to write. Linh. He spoke her name — the name no one had given her — and she wept. You remembered my name. She was gone — faded into the story he had written. And where she had stood — golden flowers bloomed. And the grave-keeper who learned to read death — finally learned to write life."""

tts = gTTS(text=narration, lang='en', slow=False)
tts.save(f'{TEMP}/narration.mp3')
print(f'TTS OK: {os.path.getsize(f"{TEMP}/narration.mp3")/1024:.0f}KB')

# Step 4: Mux
print('\n=== Muxing ===')
final_output = f'{OUTPUT}/XIANYX-40.mp4'
cmd = [
    FFMPEG, '-y',
    '-i', video_only,
    '-i', f'{TEMP}/narration.mp3',
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '128k',
    '-t', '30', '-shortest',
    final_output
]
result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode != 0:
    print(f'Mux error: {result.stderr[-500:]}')
    exit(1)

size = os.path.getsize(final_output)
print(f'\n=== DONE: {final_output} ({size/1024/1024:.1f}MB) ===')

# Cleanup
for shot in SHOTS:
    for f in [shot['file'], shot['file'].replace('.mp4', '_raw.mp4')]:
        if os.path.exists(f): os.remove(f)
for f in [video_only, f'{TEMP}/narration.mp3', concat_list]:
    if os.path.exists(f): os.remove(f)
print('Temp cleanup done.')
