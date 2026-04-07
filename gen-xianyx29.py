#!/usr/bin/env python3
"""Generate XIANYX-29: Thanh Van Mon Episode 6 - The Realm's Reckoning
Pexels + gTTS + FFmpeg (Hailuo broken - using Pexels fallback).
"""
import os, json, subprocess
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_xianyx29"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPT_PATH = ROOT / "scripts" / "pending" / "xianxia" / "XIANYX-29.json"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_FILE = OUTPUT_DIR / "XIANYX-29.mp4"

def log(*a):
    print("[XIANYX-29]", *a)

def curl_get_json(url):
    r = subprocess.run(
        ["curl", "-s", "-L", url, "-H", f"Authorization: {PEXELS_KEY}"],
        capture_output=True, text=True, timeout=30
    )
    return json.loads(r.stdout)

def curl_download(url, path):
    r = subprocess.run(
        ["curl", "-s", "-L", "-o", str(path), "-w", "%{http_code}", url,
         "-H", f"Authorization: {PEXELS_KEY}"],
        capture_output=True, text=True, timeout=60
    )
    if r.stdout.strip() != "200":
        raise RuntimeError(f"Download failed: HTTP {r.stdout}")

def run_ffmpeg(args, timeout=120):
    r = subprocess.run(["ffmpeg", "-y"] + args, capture_output=True, timeout=timeout)
    if r.returncode != 0:
        log(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-500:]}")
        raise RuntimeError("FFmpeg failed")

def get_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
        capture_output=True, text=True
    )
    return float(json.loads(out.stdout)["format"]["duration"])

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

# Load script
with open(SCRIPT_PATH, "r", encoding="utf-8-sig") as f:
    sd = json.load(f)

narration = sd["audio"]["narration"]
log(f"Narration: {len(narration)} chars")

if OUTPUT_FILE.exists() and OUTPUT_FILE.stat().st_size > 100_000:
    log(f"Video already exists: {OUTPUT_FILE.stat().st_size//1024}KB - SKIPPING")
else:
    log("Starting video production...")

    # 5 shots matching Thanh Van Mon Episode 6: The Realm's Reckoning
    searches = [
        # Shot 1: Message board, crowd gathered, three tearing down, torn papers
        "crowd gathered city square thousands reading dramatic",
        # Shot 2: Young man standing calm facing opponents, rings glowing, torn papers ground
        "person standing calm dramatic confrontation dark silhouette",
        # Shot 3: Blue light circle magical arena, writing blazing, mystical energy
        "blue magical light energy circle ethereal mystical glowing",
        # Shot 4: Translucent woman manifesting ethereal beautiful ancient presence
        "ethereal woman glowing translucent beautiful fantasy elegant",
        # Shot 5: Three kneeling defeated, crowd cheering, two figures disappearing into darkness
        "crowd celebrating victory torch night darkness figures walking away",
    ]

    clip_paths = []
    for i, query in enumerate(searches):
        log(f"Searching Pexels: {query}")
        videos = search_pexels(query)
        log(f"  Found {len(videos)} videos")
        if not videos:
            log(f"  No videos found for query")
            continue
        clip = get_best_clip(videos[:3])
        if not clip:
            log(f"  No suitable clip found")
            continue
        tmp = TEMP / f"clip{i+1}.mp4"
        curl_download(clip["link"], str(tmp))
        size_kb = tmp.stat().st_size // 1024
        log(f"  Downloaded: {clip['width']}x{clip['height']} -> {size_kb}KB")

        # Convert to portrait 1080x1920, trim to 6s per shot
        trimmed = TEMP / f"clip{i+1}_t.mp4"
        run_ffmpeg([
            "-ss", "0", "-t", "6",
            "-i", str(tmp),
            "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-an", "-r", "30",
            str(trimmed)
        ])
        clip_paths.append(trimmed)
        log(f"  Trimmed: {trimmed.stat().st_size//1024}KB")

    if not clip_paths:
        raise RuntimeError("No clips downloaded")

    # Concat all 5 clips using RE-ENCODE (not stream copy - fixes -t ignore bug)
    if len(clip_paths) == 1:
        final_vid = clip_paths[0]
    else:
        concat_vid = TEMP / "concat.mp4"
        lst = TEMP / "lst.txt"
        lst.write_text("\n".join(f"file '{p.as_posix()}'" for p in clip_paths))
        # RE-ENCODE to fix concat demuxer -t ignore bug (MEMORY.md 2026-04-02)
        run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst),
                    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                    "-c:a", "aac",
                    str(concat_vid)])
        final_vid = concat_vid
        log(f"Concatenated {len(clip_paths)} clips -> {final_vid.stat().st_size//1024}KB")

    # gTTS Vietnamese narration
    tts_raw = TEMP / "tts_raw.mp3"
    gTTS(text=narration[:500], lang="vi", slow=False).save(str(tts_raw))
    log(f"gTTS generated: {tts_raw.stat().st_size//1024}KB")

    # Trim TTS to video duration
    dur = get_duration(final_vid)
    log(f"Video duration: {dur:.1f}s")
    tts_trim = TEMP / "tts_trim.mp3"
    run_ffmpeg(["-i", str(tts_raw), "-t", str(dur), "-c:a", "copy", str(tts_trim)])

    # Mux video + audio
    run_ffmpeg([
        "-i", str(final_vid),
        "-i", str(tts_trim),
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        str(OUTPUT_FILE)
    ])
    log(f"Output: {OUTPUT_FILE.stat().st_size//1024}KB")

# Update script JSON
sd["status"] = "produced"
sd["videoFile"] = str(OUTPUT_FILE)
import datetime
sd["produced_at"] = datetime.datetime.utcnow().isoformat() + "Z"

with open(SCRIPT_PATH, "w", encoding="utf-8") as f:
    json.dump(sd, f, indent=2, ensure_ascii=False)

log("DONE - script updated")
