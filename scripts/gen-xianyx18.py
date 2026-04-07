#!/usr/bin/env python3
"""Generate XIANYX-18 Tru Tien Episode 4 - Pexels + gTTS + FFmpeg."""
import os, sys, json, subprocess
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
SCRIPTS_DIR = ROOT / "scripts" / "pending" / "xianxia"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
TEMP = ROOT / "output" / "_temp_xianyx18"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)

# 5 shots matching the script
SHOT_QUERIES = [
    "volcanic lava fire glowing cave dark",          # shot1: volcanic cavern white-gold fire
    "volcano eruption fire phoenix rising flames",   # shot2: phoenix rising from volcano
    "dawn sunrise golden sky flying silhouette",     # shot3: flying at dawn arms raised to sun
    "ice mountain palace frozen architecture blue",   # shot4: ice-blue sect compound
    "fire burning ember flame closeup glow",         # shot5: hand burning handprint into stone
]

NARRATION = """The flame spirit bowed — and in bowing, gave him a gift no enemy could take. A compass that burned in his blood — always pointing toward the one who had carved the seal into his back. She was still there. Waiting for a dead man to be found. Three weeks ago, he had crawled out of this mountain on his elbows — broken, burned, left for dead. Now he rose from it like a phoenix born in white-gold fire — and the world below would learn what it had tried so desperately to bury. The sun rose on a changed world. And rising to meet it — a young man who had learned that the seal carved into his flesh was not his destruction. It was the foundation of his rebirth. White-gold fire blazed upward in answer — the heavens greeting their own. The Frozen Sky Sect — built on a mountain of ice and arrogance — had practiced forbidden techniques and carved forbidden seals. They had left a boy to die in volcanic ash. And now that boy stood at their gates — wreathed in fire that made their ice look like frozen water. One handprint — burned into stone that had never known heat — a message written in white-gold fire that needed no words. 'The fire you tried to bury has come home.' And in the silence that followed — the Frozen Sky Sect learned what they had tried so desperately to prevent: the boy they left for dead had become the flame that would consume them."""

def log(*a): print("[XIANYX-18]", *a)

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
        log(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-300:]}")
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

log("Starting XIANYX-18 Tru Tien Episode 4")

# Download 5 clips
clips = []
for i, query in enumerate(SHOT_QUERIES):
    log(f"Shot {i+1}: searching '{query}'")
    vids = search_pexels(query)
    vf = get_best_clip(vids)
    if not vf:
        log(f"  No clip found, retrying with fallback...")
        vids = search_pexels("fire flame dark")
        vf = get_best_clip(vids)
    path = TEMP / f"clip_{i}.mp4"
    curl_download(vf["link"], str(path))
    trimmed = TEMP / f"clip_{i}_t.mp4"
    scale_clip(path, trimmed, duration=6)
    clips.append(trimmed)
    log(f"  Clip{i+1}: {vf.get('width','?')}x{vf.get('height','?')} -> {trimmed.stat().st_size//1024}KB")

# Concat (use re-encode since we're trimming with -t)
log("Concatenating clips...")
lst = TEMP / "concat_list.txt"
lst.write_text("\n".join(f"file '{c.as_posix()}'" for c in clips))
concat_vid = TEMP / "concat.mp4"
# Use stream copy for speed, re-encode if concat demuxer has issues
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
out_vid = OUTPUT_DIR / "XIANYX-18.mp4"
log("Muxing...")
run_ffmpeg(["-i", str(concat_vid), "-i", str(tts_trim),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", str(out_vid)])

sz = out_vid.stat().st_size
log(f"DONE: {sz//1024}KB -> {out_vid}")

# Update script status
sp = SCRIPTS_DIR / "XIANYX-18.json"
with open(sp, "r", encoding="utf-8") as f:
    sd = json.load(f)
sd["status"] = "produced"
sd["video_path"] = str(out_vid)
with open(sp, "w", encoding="utf-8") as f:
    json.dump(sd, f, indent=2, ensure_ascii=False)
log("Script updated to produced")
