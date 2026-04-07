import requests
import os
import json
import subprocess
import sys

PEXELS_KEY = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOZfhgJtKiT04fWsaEa'
WORKSPACE = r'C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI'
OUTPUT = os.path.join(WORKSPACE, 'output_topic', 'videos', 'XIANYX-48.mp4')
CLIPS_DIR = os.path.join(WORKSPACE, 'output_topic', 'clips', 'XIANYX-48')
os.makedirs(CLIPS_DIR, exist_ok=True)

FFMPEG = r'C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe'

queries = [
    ('ancient chinese throne room palace golden light', 'shot1'),
    ('mirror reflection magic glowing portal ancient', 'shot2'),
    ('fire blazing golden light dramatic cinematic', 'shot3'),
    ('portal light walking through transformation glowing', 'shot4'),
    ('people kneeling worship golden light ancient palace', 'shot5'),
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
    
    best = None
    for v in videos:
        w, h = v['width'], v['height']
        dur = v['duration']
        if h >= w and dur >= 6:
            if best is None or (abs(h-1080) < abs(best['height']-1080)):
                best = v
    if best is None:
        best = videos[0]
    
    print(f'  Selected: ID={best["id"]} dur={best["duration"]}s {best["width"]}x{best["height"]}')
    
    video_files = best.get('video_files', [])
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

# Save clips info
clips_info_path = os.path.join(CLIPS_DIR, 'clips_info.json')
with open(clips_info_path, 'w') as f:
    json.dump(results, f, indent=2)

# Download clips
clip_paths = []
for i, (shot_id) in enumerate([q[1] for q in queries]):
    if shot_id not in results:
        print(f'MISSING clip for {shot_id}')
        continue
    clip_path = os.path.join(CLIPS_DIR, f'{shot_id}.mp4')
    url = results[shot_id]['url']
    print(f'\nDownloading {shot_id}: {url}')
    r = requests.get(url, stream=True)
    with open(clip_path, 'wb') as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f'  Saved: {clip_path} ({os.path.getsize(clip_path)//1024}KB)')
    clip_paths.append((shot_id, clip_path, results[shot_id]['duration']))

print('\n=== Generating TTS ===')
try:
    from gtts import gTTS
    narration = "Three days. The mirror realm had cracked open three days ago — and the kingdom had not slept. They had watched three centuries of truth play across its surface — three princes, one soul — fire too dangerous to exist whole — split into three. And now — in the throne room — surrounded by mirrors showing the original prince choosing to split himself into three to save the kingdom — he raised his hand. And spoke the truth no one had dared to speak for three hundred years. The mirror showed the final moment: the original prince — choosing to fragment himself into three — because the fire inside him was too powerful to exist whole. Three centuries of civil war — beginning in one moment of desperate love. He had chosen to become three imperfect halves — so that the kingdom could survive what one whole soul could not. Three hundred years of war — over a sacrifice the original prince made to save everyone from himself. He raised his hand. And spoke the first decree of a new age: no more splitting — no more dividing. The mirror realm flared — not in violence — in completion. Three centuries of testimony, reaching its final word. The fire inside him blazed — unified — golden — not three flames. One. The fire the original prince had spent three hundred years trying to make the kingdom strong enough to contain. Whole at last. He walked through the mirror. Not as three. As one. The mirror realm collapsed behind him — sealing three centuries of division in the glass. And he emerged on the other side — whole — fire burning unified, golden, complete. The kingdom knelt. In waves — across the throne room — across the courtyard — across the realm. Not to a prince. To a man who had just ended three centuries of civil war — by becoming whole."
    tts = gTTS(text=narration, lang='en', slow=False)
    tts_path = os.path.join(CLIPS_DIR, 'narration.mp3')
    tts.save(tts_path)
    print(f'TTS saved: {tts_path} ({os.path.getsize(tts_path)//1024}KB)')
except Exception as e:
    print(f'TTS failed: {e}')
    sys.exit(1)

# FFmpeg: scale+trim each clip to 6s, concat with filter_complex, mux with TTS
print('\n=== FFmpeg assembly ===')

# Build filter_complex
filter_parts = []
concat_inputs = []
for i, (shot_id, clip_path, dur) in enumerate(clip_paths):
    scale_h = 1920  # portrait height
    scale_w = 1080  # portrait width (9:16)
    trim_dur = 6.0
    filter_parts.append(
        f'[{i}:v]trim=duration={trim_dur},setpts=PTS-STARTPTS,scale={scale_w}:{scale_h}:force_original_aspect_ratio=decrease,pad={scale_w}:{scale_h}:(ow-iw)/2:(oh-ih)/2,setsar=1[v{i}]'
    )
    concat_inputs.append(f'[v{i}]')

filter_str = ';'.join(filter_parts) + ';' + ''.join(concat_inputs) + f'concat=n={len(clip_paths)}:v=1:a=0[outv]'
print(f'Filter: {filter_str}')

# Build input args
input_args = []
for shot_id, clip_path, dur in clip_paths:
    input_args.extend(['-i', clip_path])

# Also add narration MP3
input_args.extend(['-i', tts_path])

# Output args
output_args = [
    '-filter_complex', filter_str,
    '-map', '[outv]',
    '-map', f'{len(clip_paths)}:a',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest',
    '-y', OUTPUT
]

cmd = [FFMPEG] + input_args + output_args
print(f'\nRunning FFmpeg...')
print(' '.join(cmd[:10]) + ' ...')

result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode != 0:
    print(f'FFmpeg STDERR: {result.stderr[-3000:]}')
    print(f'FFmpeg STDOUT: {result.stdout[-1000:]}')
    sys.exit(1)

print(f'\n=== OUTPUT: {OUTPUT} ({os.path.getsize(OUTPUT)//1024//1024}MB) ===')
print('DONE')
