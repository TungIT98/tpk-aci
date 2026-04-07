#!/usr/bin/env python3
"""Generate XIANYX-28: Tru Tien Episode 6 - The New Sky
5 shots x 6s = 30s using Pexels stock + gTTS + FFmpeg
Uses filter_complex concat to avoid concat demuxer duration bug
"""
import subprocess, requests, json, os
from gtts import gTTS

WORKSPACE = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI"
OUTPUT    = f"{WORKSPACE}/output_topic/videos/XIANYX-28.mp4"
SCRIPT    = f"{WORKSPACE}/scripts/pending/xianxia/XIANYX-28.json"
FFMPEG    = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FFPROBE   = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"
PEXELS    = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOZfhgJtKiT04fWsaEa"
TEMP      = "C:/tmp/openclaw/uploads"
os.makedirs(TEMP, exist_ok=True)

with open(SCRIPT) as f:
    script = json.load(f)

shots = script["shots"]
search_terms = [
    "mountain road dawn mist fog",
    "frost crystals cold close up winter",
    "ancient ruins destroyed temple fog",
    "blue ice light supernatural glowing pool",
    "golden light explosion transformation",
]
alt_terms = [
    "foggy mountain morning two people walking",
    "ice crystals macro close up cold blue",
    "ruined palace ancient stone foggy",
    "glowing ice pool underground cave blue",
    "light burst golden energy transformation",
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

clip_paths = []
for i, term in enumerate(search_terms):
    clip_file = f"{TEMP}/xianyx28_shot{i+1}.mp4"
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

# Build filter_complex concat - trim + scale + concat all in one pass
# Each clip: trim start=0, duration=6, scale to 1080x1920
vf_parts = []
for i, path in enumerate(clip_paths):
    vf_parts.append(f"[{i}:v]trim=start=0:duration=6,setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v{i}];")
vf = "".join(vf_parts) + "".join([f"[v{i}]" for i in range(len(clip_paths))]) + f"concat=n={len(clip_paths)}:v=1:a=0[outv]"

concat_raw = f"{TEMP}/xianyx28_concat_raw2.mp4"
cmd = [FFMPEG, "-y"]
for path in clip_paths:
    cmd += ["-i", path]
cmd += ["-filter_complex", vf, "-map", "[outv]", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", concat_raw]
subprocess.run(cmd, capture_output=True)

def get_duration(path):
    r = subprocess.run([FFPROBE, "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except:
        return 30

dur = get_duration(concat_raw)
print(f"Concat raw duration: {dur:.1f}s")

# TTS via gTTS
narration = script["audio"]["narration"]
tts_out = f"{TEMP}/xianyx28_tts.mp3"
tts = gTTS(text=narration, lang="en", slow=False)
tts.save(tts_out)
print(f"gTTS saved: {os.path.getsize(tts_out)/1024:.0f}KB")

tts_dur = get_duration(tts_out)
print(f"TTS duration: {tts_dur:.1f}s")

# Mux
subprocess.run([
    FFMPEG, "-y",
    "-i", concat_raw,
    "-i", tts_out,
    "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-c:a", "aac", "-b:a", "128k",
    "-t", "30",
    OUTPUT
], capture_output=True)

sz = os.path.getsize(OUTPUT)/1024
print(f"\nOutput: {sz:.0f}KB -> {OUTPUT}")

# Verify
out_dur = get_duration(OUTPUT)
print(f"Output duration: {out_dur:.1f}s")

# Update script
script["status"] = "produced"
script["output_path"] = OUTPUT
script["produced_at"] = "2026-04-02T08:25:00Z"
with open(SCRIPT, "w") as f:
    json.dump(script, f, indent=2, ensure_ascii=False)
print("Script status: produced")
