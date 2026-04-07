#!/usr/bin/env python3
"""Regenerate HGF-13 with 3 clips for better duration."""
import os, json, subprocess
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_hgf13"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
TEMP.mkdir(parents=True, exist_ok=True)

def curl_get_json(url):
    r = subprocess.run(["curl", "-s", "-L", url, "-H", f"Authorization: {PEXELS_KEY}"],
                      capture_output=True, text=True, timeout=30)
    return json.loads(r.stdout)

def curl_download(url, path):
    r = subprocess.run(["curl", "-s", "-L", "-o", str(path), "-w", "%{http_code}", url,
                       "-H", f"Authorization: {PEXELS_KEY}"],
                      capture_output=True, text=True, timeout=60)
    if r.stdout.strip() != "200":
        raise RuntimeError(f"Download failed: HTTP {r.stdout}")

def run_ffmpeg(args, timeout=120):
    r = subprocess.run(["ffmpeg", "-y"] + args, capture_output=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"FFmpeg: {r.stderr.decode('utf-8', errors='replace')[-200:]}")

def search_pexels(query):
    q = quote(query)
    url = f"https://api.pexels.com/videos/search?query={q}&per_page=5&orientation=portrait"
    return curl_get_json(url).get("videos", [])

def get_best_clip(videos):
    for v in videos:
        for f in v.get("video_files", []):
            if f.get("quality") == "hd" and f.get("height", 0) >= 720:
                return f
    if videos and videos[0].get("video_files"):
        return videos[0]["video_files"][0]
    return None

def get_duration(path):
    out = subprocess.run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
                         capture_output=True, text=True)
    try:
        return float(json.loads(out.stdout)["format"]["duration"])
    except:
        return 5.0

sid = "HGF-13"
sp = ROOT / "scripts" / "pending" / f"{sid}.json"
with open(sp, "r", encoding="utf-8") as f:
    sd = json.load(f)
text = sd["script"]
tags = " ".join(sd.get("tags", []))
out_vid = OUTPUT_DIR / f"{sid}.mp4"

print(f"Starting {sid}: {sd.get('title','')[:50]}")

# 3 clips instead of 2
clips = []
for i in range(3):
    vids = search_pexels(tags if i == 0 else "fitness gym woman training")
    vf = get_best_clip(vids[:3])
    path = TEMP / f"{sid}_c{i}.mp4"
    curl_download(vf["link"], str(path))
    # Trim to 2s each
    trimmed = TEMP / f"{sid}_c{i}t.mp4"
    run_ffmpeg(["-ss", "0", "-t", "2", "-i", str(path),
                "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-r", "30", str(trimmed)])
    clips.append(trimmed)
    print(f"Clip{i+1}: {vf['width']}x{vf['height']}")

# Concat 3 clips
lst = TEMP / f"{sid}_lst.txt"
lst.write_text("\n".join(f"file '{c.as_posix()}'" for c in clips))
vid = TEMP / f"{sid}_v.mp4"
run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(vid)])

# gTTS
tts = TEMP / f"{sid}_tts.mp3"
gTTS(text=text[:500], lang="en", slow=False).save(str(tts))
print(f"TTS: {tts.stat().st_size//1024}KB")

# Mux
dur = get_duration(vid)
tts_trim = TEMP / f"{sid}_tts_trim.mp3"
run_ffmpeg(["-i", str(tts), "-t", str(dur), "-c:a", "copy", str(tts_trim)])
run_ffmpeg(["-i", str(vid), "-i", str(tts_trim), "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", str(out_vid)])

sz = out_vid.stat().st_size
print(f"DONE: {sz//1024}KB (dur={dur:.1f}s)")

# Update script
sd["status"] = "produced"
sd["video_path"] = str(out_vid)
sd["produced_at"] = "2026-04-01T04:52:00.000Z"
with open(sp, "w", encoding="utf-8") as f:
    json.dump(sd, f, ensure_ascii=False, indent=2)
print(f"Updated {sp} status=produced")

# Cleanup
for fl in TEMP.glob(f"{sid}_*"):
    try: fl.unlink()
    except: pass
