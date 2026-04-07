import requests
import os
import json
import subprocess
import sys

PEXELS_KEY = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOZfhgJtKiT04fWsaEa'
WORKSPACE = r'C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI'
OUTPUT = os.path.join(WORKSPACE, 'output_topic', 'videos', 'XIANYX-50.mp4')
CLIPS_DIR = os.path.join(WORKSPACE, 'output_topic', 'clips', 'XIANYX-50')
os.makedirs(CLIPS_DIR, exist_ok=True)

FFMPEG = r'C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe'

queries = [
    ('river sunset man writing peaceful', 'shot1'),
    ('magic golden light glowing eyes dramatic', 'shot2'),
    ('golden light passing magical transformation', 'shot3'),
    ('ancient chinese book reading peaceful village', 'shot4'),
    ('peaceful river child writing book', 'shot5'),
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
for shot_id, clip_path, dur in [(q[1], None, None) for q in queries]:
    if shot_id not in results:
        print(f'MISSING clip for {shot_id}')
        continue
    clip_path_local = os.path.join(CLIPS_DIR, f'{shot_id}.mp4')
    url = results[shot_id]['url']
    print(f'\nDownloading {shot_id}: {url}')
    r = requests.get(url, stream=True)
    with open(clip_path_local, 'wb') as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f'  Saved: {clip_path_local} ({os.path.getsize(clip_path_local)//1024}KB)')
    clip_paths.append((shot_id, clip_path_local, results[shot_id]['duration']))

print('\n=== Generating TTS ===')
try:
    from gtts import gTTS
    narration = "Three years after the golden seer eye began to dim — he sat by the river in evening light. Writing. Not reading deaths anymore — writing lives. The golden seer eye had been dimming slowly for three years — and he had made peace with it. Until a child arrived at the riverbank — seven years old — with a bundle of papers — and asked to show him her stories. And the golden seer eye — which had been searching for three years for its final reader — opened. And read her. And found her. The golden seer eye blazed. Not dim anymore. Bright. Recognizing. Inside this seven-year-old — ten thousand stories. Not read. Absorbed. Lived. The rarest kind of reader: one who becomes the story. He read her stories — and tears streamed down his face. These were the most beautiful stories he had ever read — written by a child who had never been taught. I have something to give you — and something to teach you — and then — I have finished. The golden eye had found its last reader. And he was ready to pass it on. He placed his hand over his golden seer eye. And it blazed — brighter than it had been in three years — and the light began to pass. Streaming from his eye — to hers. The child's eyes glowed gold. Pure and bright. He opened his hand — and his eye was simply gone. Not dimmed. Passed. He was just a man now. No eye. No curse. No weight. Just a reader — who had found his final story. And passed it on. She read his stories. And began to add her own. Her wild seven-year-old imagination — weaving into his quiet river wisdom. The book grew. Two writers now. And somewhere — the river carried it forward — to the next reader. He sat beside her. No longer a seer. Just a man — who had lived long enough to pass the story on."
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
for i, (shot_id, clip_path_local, dur) in enumerate(clip_paths):
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
for shot_id, clip_path_local, dur in clip_paths:
    input_args.extend(['-i', clip_path_local])

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

result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode != 0:
    print(f'FFmpeg STDERR: {result.stderr[-3000:]}')
    print(f'FFmpeg STDOUT: {result.stdout[-1000:]}')
    sys.exit(1)

print(f'\n=== OUTPUT: {OUTPUT} ({os.path.getsize(OUTPUT)//1024//1024}MB) ===')
print('DONE')
