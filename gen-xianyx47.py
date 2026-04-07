import requests, subprocess, os
from gtts import gTTS

FFMPEG = r'C:\NEWFOL~1\FFMPEG~1\bin\ffmpeg.exe'
WORKSPACE = r'C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI'
CLIPS_DIR = os.path.join(WORKSPACE, 'output_topic', 'clips')
OUTPUT = os.path.join(WORKSPACE, 'output_topic', 'videos', 'XIANYX-47.mp4')
TEMP_AUDIO = os.path.join(CLIPS_DIR, 'xianyx47_tts.mp3')
TEMP_CONCAT = os.path.join(CLIPS_DIR, 'xianyx47_concat.mp4')
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

PEXELS_KEY = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOZfhgJtKiT04fWsaEa'

queries = [
    ('ancient palace courtyard fire torch ceremony', 'shot1'),
    ('child face speaking emotional portrait closeup', 'shot2'),
    ('child walking toward fire flame warm glowing', 'shot3'),
    ('fire flame erupting golden amber magical', 'shot4'),
    ('family embracing crying emotional scene', 'shot5'),
]

clips_info = []
for q, shot_id in queries:
    resp = requests.get('https://api.pexels.com/videos/search',
        headers={'Authorization': PEXELS_KEY},
        params={'query': q, 'per_page': 10, 'orientation': 'portrait'}, timeout=15)
    videos = resp.json().get('videos', [])
    if not videos:
        print(f'No results for {shot_id}')
        continue
    best = None
    for v in videos:
        if v['height'] >= v['width'] and v['duration'] >= 6:
            if best is None or abs(v['height']-1080) < abs(best['height']-1080):
                best = v
    if best is None:
        best = videos[0]
    files = sorted(best.get('video_files', []), key=lambda x: x.get('height', 0), reverse=True)
    best_file = next((f for f in files if f.get('height', 0) >= 720), files[0])
    print(f'{shot_id}: ID={best["id"]} {best["width"]}x{best["height"]} dur={best["duration"]}s')
    clips_info.append((shot_id, best['id'], best_file['link']))

# Download unique clips
downloaded_vids = {}
for shot_id, vid, url in clips_info:
    path = os.path.join(CLIPS_DIR, f'{vid}.mp4')
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        print(f'Downloading {vid}...')
        r = requests.get(url, stream=True, timeout=60)
        with open(path, 'wb') as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)
    downloaded_vids[vid] = path
    print(f'  {vid}: {os.path.getsize(path)//1024}KB')

# Trim clips to 6s
trims = {'shot1': (0, 6), 'shot2': (0, 6), 'shot3': (0, 6), 'shot4': (0, 6), 'shot5': (0, 6)}
trimmed_paths = {}
for shot_id, vid, url in clips_info:
    src = downloaded_vids[vid]
    out = os.path.join(CLIPS_DIR, f'xianyx47_{shot_id}.mp4')
    if os.path.exists(out):
        os.remove(out)
    s, e = trims[shot_id]
    vf = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2'
    cmd = [FFMPEG, '-y', '-ss', str(s), '-i', src, '-t', '6', '-vf', vf,
           '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-an', out]
    subprocess.run(cmd, capture_output=True)
    if os.path.exists(out) and os.path.getsize(out) > 0:
        print(f'{shot_id}: {os.path.getsize(out)//1024}KB')
        trimmed_paths[shot_id] = out
    else:
        print(f'{shot_id} FAILED')

# Generate TTS
narration = """One year after a one-year-old reached for the palace torch and chose her fire lineage before an entire kingdom — the formal naming ceremony. The moment every royal child receives their name from the court — written on silk, sealed by tradition, owned by the throne. The historian unrolled the royal name scroll. The court held its breath. And the child — one year old today — looked up at the historian — and the kingdom wondered: what name would the palace give the daughter of a gravekeeper? Hong. Fire. The child's first word — spoken at one year old, at the palace naming ceremony, before the entire kingdom. Not the name the palace had chosen. Not the name tradition demanded. Hong — fire remembers — my mother was a gravekeeper — my name is Hong. The father knelt beside her and asked the question that would determine everything: what name did you choose? And the child answered: fire. Legacy transformed. Identity claimed. A name chosen — not given — in one full sentence that echoed across one year of silence. She walked. One year old. Steps still unsteady. Toward the eternal flame — burning in the center of the courtyard for a thousand years. The entire kingdom watched. A one-year-old — walking alone — toward the fire that would one day be hers. Not because the palace demanded it. Because she chose it. And fire — as it always does — recognized its keeper. She reached the flame. Both small hands — barely large enough to wrap around — placed them on the fire. And the flame erupted. Not white-gold. Not crimson. But warm amber. Fire transformed by love. Fire that remembers where it was born — and where it was chosen. The kingdom watched a one-year-old claim her name — and transform the eternal flame. A gravekeeper's daughter — with fire in her blood — and fire in her name. Hong. Fire remembers."""

print('Generating TTS...')
tts = gTTS(text=narration, lang='en', slow=False)
tts.save(TEMP_AUDIO)
print(f'TTS: {os.path.getsize(TEMP_AUDIO)//1024}KB')

# Concat
ordered = [trimmed_paths[f'shot{i}'] for i in range(1, 6)]
n = len(ordered)
filter_str = ''
for i, p in enumerate(ordered):
    filter_str += f'[{i}:v]scale=1080:1920,setsar=1[v{i}];'
filter_str += f'{"".join(f"[v{i}]" for i in range(n))}concat=n={n}:v=1:a=0[outv]'

print('Concatenating...')
input_list = []
for p in ordered:
    input_list.extend(['-i', p])
cmd = [FFMPEG, '-y'] + input_list + ['-filter_complex', filter_str, '-map', '[outv]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-an', TEMP_CONCAT]
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    print('CONCAT FAILED:', r.stderr[-1000:])
else:
    print(f'Concat: {os.path.getsize(TEMP_CONCAT)//1024}KB')

# Combine
print('Combining...')
cmd2 = [FFMPEG, '-y', '-i', TEMP_CONCAT, '-i', TEMP_AUDIO,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k', '-shortest', OUTPUT]
r2 = subprocess.run(cmd2, capture_output=True, text=True)
if r2.returncode != 0:
    print('COMBINE FAILED:', r2.stderr[-1000:])
else:
    print(f'DONE: {OUTPUT} ({os.path.getsize(OUTPUT)//1024}KB)')
