import requests
import subprocess
import os
import json
from gtts import gTTS

WORKSPACE = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI"
TMP = os.path.join(WORKSPACE, "output_topic/tmp/XIANYX-34")
OUT_VIDEO = os.path.join(WORKSPACE, "output_topic/videos/XIANYX-34.mp4")
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOZfhgJtKiT04fWsaEa"
FFMPEG = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe"

os.makedirs(TMP, exist_ok=True)

# Shot queries matching the Xianxia theme
shot_queries = [
    ("shot1", "village morning market ancient china peaceful", 6),
    ("shot2", "dark temple interior mysterious ancient", 6),
    ("shot3", "mirror reflection closeup dramatic woman face", 6),
    ("shot4", "horror face closeup fear expression woman", 6),
    ("shot5", "village elder kneeling gratitude ancient china", 6),
]

clips = []
for shot_id, query, duration in shot_queries:
    clip_path = os.path.join(TMP, f"{shot_id}.mp4")
    if os.path.exists(clip_path):
        print(f"  {shot_id}: already exists, skipping")
        clips.append((shot_id, clip_path, duration))
        continue
    
    # Search Pexels
    print(f"  Searching Pexels for {shot_id}: {query}")
    r = requests.get("https://api.pexels.com/videos/search",
        headers={"Authorization": PEXELS_KEY},
        params={"query": query, "per_page": 5, "orientation": "landscape"},
        timeout=15)
    if r.status_code != 200 or not r.json().get("videos"):
        print(f"  WARNING: No Pexels results for {query}, using fallback dark screen")
        # Create a dark placeholder
        with open(os.path.join(TMP, f"{shot_id}.txt"), "w") as f:
            f.write(f"no footage for: {query}")
        continue
    
    videos = r.json()["videos"]
    best = None
    for v in videos:
        if v["duration"] >= duration:
            best = v
            break
    if not best:
        best = videos[0]
    
    video_id = best["id"]
    video_files = best["video_files"]
    # Find 1080p or best available
    vf = sorted(video_files, key=lambda x: x.get("width", 0), reverse=True)
    url = vf[0]["link"]
    
    print(f"  Downloading {shot_id} from Pexels video {video_id}: {url}")
    r2 = requests.get(url, timeout=30, stream=True)
    raw_path = os.path.join(TMP, f"{shot_id}_raw.mp4")
    with open(raw_path, "wb") as f:
        for chunk in r2.iter_content(chunk_size=65536):
            f.write(chunk)
    
    # Scale to portrait 1080x1920, trim to duration
    scaled_path = os.path.join(TMP, f"{shot_id}_scaled.mp4")
    cmd = [
        FFMPEG, "-y", "-i", raw_path,
        "-vf", f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,trim=0:{duration},setpts=PTS-STARTPTS",
        "-t", str(duration), "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-an", scaled_path
    ]
    subprocess.run(cmd, capture_output=True, timeout=60)
    os.remove(raw_path)
    
    if os.path.exists(scaled_path):
        clips.append((shot_id, scaled_path, duration))
        print(f"  {shot_id}: done ({os.path.getsize(scaled_path)//1024}KB)")
    else:
        print(f"  WARNING: {shot_id} failed to produce")

print(f"\nClips ready: {len(clips)}/{len(shot_queries)}")

if not clips:
    print("ERROR: No clips available")
    exit(1)

# Concat with filter_complex
if len(clips) == 1:
    concat_path = clips[0][1]
else:
    concat_path = os.path.join(TMP, "concat.mp4")
    filter_parts = []
    for i, (sid, cpath, dur) in enumerate(clips):
        filter_parts.append(f"[{i}:v]")
    vf_str = ";".join([
        f"[{i}:v]trim=start=0:duration={dur},setpts=PTS-STARTPTS,scale=1080:1920[f{i}]"
        for i, (_, _, dur) in enumerate(clips)
    ])
    concat_str = "".join([f"[f{i}]" for i in range(len(clips))]) + f"concat=n={len(clips)}:v=1:a=0[outv]"
    
    cmd = [
        FFMPEG, "-y",
    ] + sum([["-i", cpath] for _, cpath, _ in clips], []) + [
        "-filter_complex", vf_str + ";" + concat_str,
        "-map", f"[outv]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-an", concat_path
    ]
    print(f"\nConcatenating {len(clips)} clips...")
    result = subprocess.run(cmd, capture_output=True, timeout=120)
    if result.returncode != 0:
        print("FFmpeg concat error:", result.stderr[-500:])
        exit(1)

print(f"Concat ready: {os.path.getsize(concat_path)//1024}KB")

# gTTS narration
narration = """Three months of peace. The jade bracelet glowed gentle green — a reminder that she had broken the curse, saved the valley, become the healer the realm needed. She had walked from village to village — freeing those trapped by Jade Mirrors, ending the Thanh Van Mon's three-century reign of terror. And then — in a village three months later — the word she had prayed never to hear again. Jade Mirror. Two faces in the Jade Mirror. The daughter — sixteen, terrified, trapped. And behind her — in the mirror's depths — her own face. Not a reflection. A RECORDING. The moment she had first looked into the Jade Mirror three months ago — moments before she had 'broken' the curse and become the healer the realm celebrated. The recording was not a memory. It was a WARNING. Because the Jade Mirror does not just show the present. It shows what was — to the one who will CARRY it next. She didn't break the curse. She became the curse's HOST. The Thanh Van Mon was never one person — it was a PERPETUATION CYCLE. The curse lives in a host until the next host is ready — then it transfers. She had been the host for three months. Freeing the valley, healing the villages, building a reputation as a curse-breaking healer — all while carrying the curse that would doom the next victim the moment the Jade Mirror chose someone new. The daughter was free. Because she — the healer, the breaker, the hero — was now the monster. She smiled at the villagers who called her hero. She wore the emerald bracelet that marked her as the realm's greatest healer. And in every house she entered for the rest of her long, cursed life — she would find the Jade Mirror already waiting. Already showing the face of the next victim. Already showing her own face. Three months of peace had been the curse's most brilliant trick. Break the monster. Become the monster. And call it healing. The Thanh Van Mon lives forever — because heroes always want to save people. And the curse is patient."""

tts_path = os.path.join(TMP, "narration.mp3")
print("Generating gTTS narration...")
tts = gTTS(text=narration, lang="en", slow=False)
tts.save(tts_path)
print(f"TTS done: {os.path.getsize(tts_path)//1024}KB")

# FFmpeg mux video + audio
cmd = [
    FFMPEG, "-y",
    "-i", concat_path,
    "-i", tts_path,
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest",
    OUT_VIDEO
]
print("Muxing final video...")
result = subprocess.run(cmd, capture_output=True, timeout=120)
if result.returncode != 0:
    print("FFmpeg mux error:", result.stderr[-500:])
    exit(1)

print(f"\n✅ OUTPUT: {OUT_VIDEO}")
print(f"   Size: {os.path.getsize(OUT_VIDEO)//1024//1024}MB")
