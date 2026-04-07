#!/usr/bin/env python3
"""Generate XIANYX-19 Thanh Van Mon Episode 4 - Pexels + gTTS + FFmpeg."""
import os, sys, json, subprocess
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
SCRIPTS_DIR = ROOT / "scripts" / "pending" / "xianxia"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
TEMP = ROOT / "output" / "_temp_xianyx19"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)

# 5 shots matching the script
SHOT_QUERIES = [
    "bamboo forest warriors ancient chinese martial arts",   # shot1: six enforcers, barrier cracking, second ring blazing
    "beautiful man crying tears sad emotional closeup",     # shot2: grief overwhelm, jade blazing
    "person kneeling earth face down devastated",          # shot3: face pressed to earth, memory visions
    "jade crystal glowing blue light ethereal magical",     # shot4: touching jade, light pouring, two stable rings
    "blue butterflies flying magical forest ethereal beauty", # shot5: standing with two rings, butterflies, transcendence
]

NARRATION = """The first ring had taught him to receive. The second would teach him something far harder: to carry the grief of a woman who had waited three thousand years for justice. And the first lesson of sorrow — was that it could not be given. Only absorbed. The blade that killed her — entered him through the ring. Not as a memory he watched — but as a grief he felt in his own spirit. Three thousand years of sorrow, compressed into a single moment, poured into him without mercy. And he understood — this was the price of the second ring. He had to die to her loss — before he could carry it. Not just the blade. Not just the betrayal. Every loss she had ever suffered — compressed into the ring and poured into his spirit. Her mother's death at seven. Her student killed in war. Her jade butterfly sealed and executed alongside her. Three thousand years of sorrow — and she had carried it alone. Until now. He said yes. He chose to carry it. And in that moment — three thousand years of sorrow found a second pair of shoulders. The ring settled — no longer wild, no longer testing. Because sorrow, when shared — becomes the foundation of the deepest power. Two rings. Received and sorrowful. And three thousand years of grief — finally carried by two spirits instead of one. The woman who had waited in jade silence — was no longer alone. And the bamboo grove — which had been her prison — had become her witness."""

def log(*a): print("[XIANYX-19]", *a)

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
        log(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-500:]}")
        raise RuntimeError("FFmpeg failed")

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
        return 6.0

def scale_clip(src, dst, duration=6):
    """Scale + pad to 1080x1920 portrait, trim to duration."""
    run_ffmpeg(["-ss", "0", "-t", str(duration), "-i", str(src),
                "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-r", "30", str(dst)])

log("Starting XIANYX-19 Thanh Van Mon Episode 4")

# Download 5 clips
clips = []
for i, query in enumerate(SHOT_QUERIES):
    log(f"Shot {i+1}: searching '{query}'")
    vids = search_pexels(query)
    vf = get_best_clip(vids)
    if not vf:
        log(f"  No clip found, retrying with fallback...")
        vids = search_pexels("dark mysterious fantasy glowing light")
        vf = get_best_clip(vids)
    path = TEMP / f"clip_{i}.mp4"
    curl_download(vf["link"], str(path))
    trimmed = TEMP / f"clip_{i}_t.mp4"
    scale_clip(path, trimmed, duration=6)
    clips.append(trimmed)
    log(f"  Clip{i+1}: {vf.get('width','?')}x{vf.get('height','?')} -> {trimmed.stat().st_size//1024}KB")

# Concat clips with re-encode (NOT stream copy - because clips were trimmed with -t)
log("Concatenating clips...")
lst = TEMP / "concat_list.txt"
lst.write_text("\n".join(f"file '{c.as_posix()}'" for c in clips))
concat_vid = TEMP / "concat.mp4"
# RE-ENCODE: because concat demuxer with stream copy ignores -t on pre-trimmed clips
run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst),
            "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", str(concat_vid)])

# gTTS
log("Generating TTS...")
tts = TEMP / "narration.mp3"
gTTS(text=NARRATION, lang="en", slow=False).save(str(tts))
log(f"TTS: {tts.stat().st_size//1024}KB")

# Get video duration for TTS trimming
vid_dur = get_duration(concat_vid)
log(f"Video duration: {vid_dur:.1f}s")

# Trim TTS to match video
tts_trim = TEMP / "narration_trim.mp3"
run_ffmpeg(["-i", str(tts), "-t", str(vid_dur), "-c:a", "copy", str(tts_trim)])

# Mux video + audio
out_vid = OUTPUT_DIR / "XIANYX-19.mp4"
log("Muxing...")
run_ffmpeg(["-i", str(concat_vid), "-i", str(tts_trim),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", str(out_vid)])

sz = out_vid.stat().st_size
log(f"DONE: {sz//1024}KB -> {out_vid}")

# Update script status
sp = SCRIPTS_DIR / "XIANYX-19.json"
with open(sp, "r", encoding="utf-8") as f:
    sd = json.load(f)
sd["status"] = "produced"
sd["video_path"] = str(out_vid)
with open(sp, "w", encoding="utf-8") as f:
    json.dump(sd, f, indent=2, ensure_ascii=False)
log("Script updated to produced")
