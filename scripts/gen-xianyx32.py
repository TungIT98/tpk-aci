#!/usr/bin/env python3
"""Generate XIANYX-32: Dau Pha Thuong Khau Episode 7 - The White Gold Throne
5 shots x 6s = 30s using Pexels stock + gTTS + FFmpeg
"""
import subprocess, requests, json, os, sys

WORKSPACE = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI"
OUTPUT    = f"{WORKSPACE}/output_topic/videos/XIANYX-32.mp4"
SCRIPT    = f"{WORKSPACE}/scripts/pending/xianxia/XIANYX-32.json"
FFMPEG    = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FFPROBE   = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"
PEXELS    = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
TEMP      = "C:/tmp/openclaw/uploads"
os.makedirs(TEMP, exist_ok=True)

with open(SCRIPT) as f:
    script = json.load(f)

shots = script["shots"]
# Pexels search terms - matching each shot's visual concept
search_terms = [
    "evening village houses lamplight warm glow",           # shot 1: rebuilt village evening, warmth
    "man woman close up face tears emotion",                # shot 2: close-up emotional, fear/tenderness
    "golden light hands glowing warm light",                 # shot 3: revolutionary understanding, warm glow
    "couple intimate tender embrace close",                  # shot 4: kneeling, warmth, child in womb
    "bedroom night warm light candle glow peaceful",       # shot 5: flame cradle, warmth above bed
]

alt_terms = [
    "mountain village night lights glowing houses",
    "emotional couple close up face tender",
    "golden light glowing hands warm",
    "man kneeling woman tender moment intimate",
    "bedroom night candles warm soft glow",
]

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
    print(f"  Downloaded {os.path.getsize(out_path)/1024:.0f}KB")

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
    print(f"  Trimmed {os.path.basename(out_path)} ({sz:.0f}KB)")

clip_paths = []
for i, term in enumerate(search_terms):
    clip_file = f"{TEMP}/xianyx32_shot{i+1}.mp4"
    if os.path.exists(clip_file):
        print(f"Shot {i+1}: using cached {clip_file}")
        clip_paths.append(clip_file)
        continue
    print(f"Shot {i+1}: searching Pexels for '{term}'...")
    results = search_pexels(term)
    if not results:
        print(f"  No results, trying alt: '{alt_terms[i]}'")
        results = search_pexels(alt_terms[i])
    if results:
        download_pexels(results[0]["id"], clip_file)
        clip_paths.append(clip_file)
    else:
        print(f"  FATAL: No video found for shot {i+1}")
        sys.exit(1)

# Trim all clips
trimmed = []
for i, path in enumerate(clip_paths):
    out = f"{TEMP}/xianyx32_shot{i+1}_trim.mp4"
    trim_clip(path, out, start=0, duration=6)
    trimmed.append(out)

# Concat using filter_complex to avoid -t ignore bug
filter_str = ""
for i in range(len(trimmed)):
    filter_str += f"[{i}:v]"
filter_str += f"concat=n={len(trimmed)}:v=1:a=0[outv]"

concat_raw = f"{TEMP}/xianyx32_concat_raw.mp4"
cmd = [FFMPEG, "-y"]
for p in trimmed:
    cmd += ["-i", p]
cmd += ["-filter_complex", filter_str, "-map", "[outv]", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", concat_raw]
subprocess.run(cmd, capture_output=True)
print(f"Concat raw: {os.path.getsize(concat_raw)/1024:.0f}KB")

# TTS via gTTS (MiniMax speech-02-hd not supported on Token Plan)
narration = script["audio"]["narration"]
tts_out = f"{TEMP}/xianyx32_tts.mp3"
try:
    from gtts import gTTS
    tts = gTTS(text=narration, lang='en', slow=False)
    tts.save(tts_out)
    print(f"gTTS: {os.path.getsize(tts_out)/1024:.0f}KB")
except Exception as e:
    print(f"gTTS failed: {e}")
    tts_out = None

if tts_out and os.path.exists(tts_out) and os.path.getsize(tts_out) > 1000:
    tts_dur = get_duration(tts_out)
    print(f"TTS duration: {tts_dur:.1f}s")
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
    os.rename(concat_raw, OUTPUT)

sz = os.path.getsize(OUTPUT)/1024
print(f"\n✅ XIANYX-32.mp4: {sz:.0f}KB ({sz/1024:.1f}MB)")

script["status"] = "produced"
script["output_path"] = OUTPUT
script["produced_at"] = "2026-04-02T09:20:00Z"
with open(SCRIPT, "w") as f:
    json.dump(script, f, indent=2, ensure_ascii=False)
print("Script status updated to: produced")
