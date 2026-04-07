#!/usr/bin/env python3
"""Generate XIANYX-25: Muc Than Ky Episode 5 - The Grave Watcher's Gift
5 shots x 6s = 30s using Pexels stock + gTTS + FFmpeg
"""
import subprocess, requests, json, os, sys, re, tempfile

# ─── Config ────────────────────────────────────────────────────────────────────
WORKSPACE = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI"
OUTPUT   = f"{WORKSPACE}/output_topic/videos/XIANYX-25.mp4"
SCRIPT   = f"{WORKSPACE}/scripts/pending/xianxia/XIANYX-25.json"
FFMPEG   = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FFPROBE  = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"
PEXELS   = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOZfhgJtKiT04fWsaEa"
TEMP     = "C:/tmp/openclaw/uploads"
os.makedirs(TEMP, exist_ok=True)

with open(SCRIPT) as f:
    script = json.load(f)

shots = script["shots"]
num_shots = len(shots)

# ─── Pexels Search Terms ───────────────────────────────────────────────────────
search_terms = [
    "foggy cemetery night grave markers",      # shot 1
    "dark mysterious hooded figure fog",       # shot 2
    "young man face dramatic lighting night", # shot 3
    "black smoke dissolving mist",             # shot 4
    "golden light transformation supernatural",# shot 5
]

# ─── Download Pexels clips ─────────────────────────────────────────────────────
def search_pexels(query, per_page=5):
    r = requests.get("https://api.pexels.com/videos/search",
        params={"query": query, "per_page": per_page, "orientation": "portrait"},
        headers={"Authorization": PEXELS})
    r.raise_for_status()
    return r.json().get("videos", [])

def download_pexels(video_id, out_path):
    r = requests.get(f"https://api.pexels.com/videos/videos/{video_id}",
        headers={"Authorization": PEXELS})
    r.raise_for_status()
    data = r.json()
    for f in data.get("video_files", []):
        if f["width"] <= 1080 and "download" in f.get("link", ""):
            url = f["link"]
            break
    else:
        url = data["video_files"][0]["link"]
    with requests.get(url, stream=True) as dl:
        dl.raise_for_status()
        with open(out_path, "wb") as out:
            for chunk in dl.iter_content(65536):
                out.write(chunk)
    print(f"  Downloaded {os.path.getsize(out_path)/1024:.0f}KB → {out_path}")

clip_paths = []
for i, term in enumerate(search_terms):
    clip_file = f"{TEMP}/xianyx25_shot{i+1}.mp4"
    if os.path.exists(clip_file):
        print(f"Shot {i+1}: using cached {clip_file}")
        clip_paths.append(clip_file)
        continue
    print(f"Shot {i+1}: searching Pexels for '{term}'...")
    results = search_pexels(term)
    if not results:
        print(f"  No results, trying alternate term...")
        alt_terms = [
            "foggy forest night",
            "dark forest foggy",
            "face close up dramatic",
            "smoke black studio",
            "golden light burst",
        ]
        results = search_pexels(alt_terms[i])
    if results:
        vid = results[0]
        download_pexels(vid["id"], clip_file)
        clip_paths.append(clip_file)
    else:
        print(f"  FATAL: No video found for shot {i+1}")
        sys.exit(1)

# ─── Trim clips to 6s each ─────────────────────────────────────────────────────
def get_duration(path):
    r = subprocess.run([FFPROBE, "-v", "quiet", "-show_entries", "format=duration",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip())

def trim_clip(in_path, out_path, start=0, duration=6):
    actual_dur = get_duration(in_path)
    if actual_dur < start + duration:
        start = max(0, actual_dur - duration)
    subprocess.run([
        FFMPEG, "-y", "-ss", str(start), "-i", in_path,
        "-t", str(duration),
        "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-an", out_path
    ], capture_output=True)
    sz = os.path.getsize(out_path)/1024
    print(f"  Trimmed {out_path} ({sz:.0f}KB)")

trimmed = []
for i, path in enumerate(clip_paths):
    out = f"{TEMP}/xianyx25_shot{i+1}_trim.mp4"
    trim_clip(path, out, start=0, duration=6)
    trimmed.append(out)

# ─── Concat (reencode to avoid concat demuxer -t ignore bug) ───────────────────
concat_list = f"{TEMP}/xianyx25_concat.txt"
with open(concat_list, "w") as f:
    for p in trimmed:
        f.write(f"file '{p}'\n")

concat_raw = f"{TEMP}/xianyx25_concat_raw.mp4"
subprocess.run([
    FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_list,
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    concat_raw
], capture_output=True)
print(f"Concat raw: {os.path.getsize(concat_raw)/1024:.0f}KB")

# ─── TTS Narration via MiniMax ─────────────────────────────────────────────────
MINIMAX_KEY = "sk-cp-JKcLn8JXdkygpTgwCS72isp9Zz7AswQeFdh5uKnvk0vngQHaLa6NVBOwSZ8v6xZybbPM3ck-L1UmOYff7EsliddMUK4Hk-za3N0-wUWse_Nsj--6J_n9XPw"

narration = script["audio"]["narration"]
print(f"Narration length: {len(narration)} chars")

# Use MiniMax TTS API
import urllib.parse
tts_url = "https://api.minimaxi.chat/v1/t2a_v2"
headers_tts = {
    "Authorization": f"Bearer {MINIMAX_KEY}",
    "Content-Type": "application/json"
}
payload = {
    "model": "speech-02-hd",
    "text": narration,
    "stream": False,
    "voice_setting": {
        "voice_id": "male-qn-qingse",
        "speed": 1.0,
        "pitch": 0,
        "volume": 0,
        "timbre": "male_deep_golden"
    },
    "audio_setting": {
        "sample_rate": 32000,
        "bitrate": 128000,
        "format": "mp3"
    }
}

tts_out = f"{TEMP}/xianyx25_tts.mp3"
r = requests.post(tts_url, headers=headers_tts, json=payload, timeout=60)
if r.status_code == 200:
    with open(tts_out, "wb") as f:
        f.write(r.content)
    print(f"TTS saved: {os.path.getsize(tts_out)/1024:.0f}KB")
else:
    print(f"TTS failed: {r.status_code} {r.text[:500]}")
    # Fallback to gTTS
    try:
        from gtts import gTTS
        tts = gTTS(text=narration, lang='en', slow=False)
        tts.save(tts_out)
        print(f"gTTS fallback: {os.path.getsize(tts_out)/1024:.0f}KB")
    except Exception as e:
        print(f"gTTS fallback failed: {e}")
        tts_out = None

# ─── Mux video + audio ─────────────────────────────────────────────────────────
if tts_out and os.path.exists(tts_out):
    # Get actual TTS duration
    tts_dur = get_duration(tts_out) if os.path.exists(tts_out) else 30
    print(f"TTS duration: {tts_dur:.1f}s (target ~28s)")

    # FFmpeg mux with proper duration handling
    subprocess.run([
        FFMPEG, "-y",
        "-i", concat_raw,
        "-i", tts_out,
        "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        "-t", "30",
        OUTPUT
    ], capture_output=True)
else:
    # Video only
    os.rename(concat_raw, OUTPUT)

sz = os.path.getsize(OUTPUT)/1024
print(f"\n✅ XIANYX-25.mp4: {sz:.0f}KB → {OUTPUT}")

# Update script status
script["status"] = "produced"
script["output_path"] = OUTPUT
script["produced_at"] = "2026-04-02T06:35:00Z"
with open(SCRIPT, "w") as f:
    json.dump(script, f, indent=2, ensure_ascii=False)
print(f"Script status updated to: produced")
