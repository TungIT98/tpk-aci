import requests
import os
import json

PEXELS_KEY = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOZfhgJtKiT04fWsaEa'
WORKSPACE = r'C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI'
OUTPUT = os.path.join(WORKSPACE, 'output_topic', 'videos', 'XIANYX-46.mp4')
CLIPS_DIR = os.path.join(WORKSPACE, 'output_topic', 'clips')
os.makedirs(CLIPS_DIR, exist_ok=True)

FFMPEG = r'C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe'

queries = [
    ('ancient chinese mountain temple monks', 'shot1'),
    ('warrior standing mountain valley sword battle', 'shot2'),
    ('face closeup tears emotion dramatic cinematic', 'shot3'),
    ('warrior kneeling sword ground defeated', 'shot4'),
    ('ancient temple gate disciples walking monastery', 'shot5'),
]

results = {}

for q, shot_id in queries:
    print(f'\n=== Searching: {shot_id}: {q}')
    resp = requests.get('https://api.pexels.com/videos/search',
        headers={'Authorization': PEXELS_KEY},
        params={'query': q, 'per_page': 10, 'orientation': 'portrait'})
    data = resp.json()
    videos = data.get('videos', [])
    if not videos:
        print('  No results')
        continue
    
    # Pick the best one: portrait, duration >= 6s, prefer 1920x1080 or similar
    best = None
    for v in videos:
        w, h = v['width'], v['height']
        dur = v['duration']
        # prefer portrait (h > w) and dur >= 6
        if h >= w and dur >= 6:  # portrait
            if best is None or (abs(h-1080) < abs(best['height']-1080)):
                best = v
    if best is None:
        best = videos[0]  # fallback to first
    
    print(f'  Selected: ID={best["id"]} dur={best["duration"]}s {best["width"]}x{best["height"]}')
    
    # Get video files
    video_files = best.get('video_files', [])
    # Pick 1080p or highest
    best_file = None
    for vf in sorted(video_files, key=lambda x: x.get('height', 0), reverse=True):
        if vf.get('height', 0) >= 720:
            best_file = vf
            break
    if best_file is None:
        best_file = video_files[0]
    
    print(f'  File: {best_file["width"]}x{best_file["height"]} link: {best_file["link"]}')
    results[shot_id] = {
        'id': best['id'],
        'url': best_file['link'],
        'duration': best['duration'],
        'width': best['width'],
        'height': best['height']
    }

print('\n=== Selected clips ===')
print(json.dumps(results, indent=2))
