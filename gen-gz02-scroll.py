#!/usr/bin/env python3
"""Generate GZ-02_morning-scroll video: Pexels + gTTS + FFmpeg."""
import os, json, subprocess, datetime
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_gz02"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPT_PATH = ROOT / "scripts" / "pending" / "GZ-02_morning-scroll.json"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
OUTPUT_FILE = OUTPUT_DIR / "GZ-02_morning-scroll.mp4"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)

FFMPEG = "C:\\New folder\\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\\bin\\ffmpeg.exe"

def log(*a):
    print("[GZ-02]", *a)

def curl_get_json(url):
    r = subprocess.run(
        ["curl", "-s", "-L", url, "-H", f"Authorization: {PEXELS_KEY}"],
        capture_output=True, text=True, timeout=30, encoding="utf-8", errors="replace"
    )
    try:
        return json.loads(r.stdout)
    except:
        return {}

def curl_download(url, path):
    r = subprocess.run(
        ["curl", "-s", "-L", "-o", str(path), "-w", "%{http_code}", url,
         "-H", f"Authorization: {PEXELS_KEY}"],
        capture_output=True, text=True, timeout=60
    )
    code = r.stdout.strip()
    if code != "200":
        raise RuntimeError(f"Download failed: HTTP {code}")

def run_ffmpeg(args, timeout=120):
    r = subprocess.run([FFMPEG, "-y"] + args, capture_output=True, timeout=timeout)
    if r.returncode != 0:
        log("FFmpeg error:", r.stderr.decode("utf-8", errors="replace")[-500:])
        raise RuntimeError("FFmpeg failed")
    return r

def get_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
        capture_output=True, text=True
    )
    try:
        return float(json.loads(out.stdout)["format"]["duration"])
    except:
        return 0

def search_pexels(query):
    q = quote(query)
    url = f"https://api.pexels.com/videos/search?query={q}&per_page=5&orientation=portrait"
    return curl_get_json(url).get("videos", [])

def get_best_clip(videos, min_duration=5):
    for v in videos:
        if v.get("duration", 0) < min_duration:
            continue
        for f in v.get("video_files", []):
            if f.get("quality") == "hd" and f.get("height", 0) >= 720:
                return v, f
    if videos and videos[0].get("video_files"):
        return videos[0], videos[0]["video_files"][0]
    return None, None

# Shot plan: [search_query, start_in_source, duration_needed]
shots = [
    ("person phone bed morning alarm dark room", 0, 5),
    ("morning routine productive person running workout", 0, 17),
    ("person walking morning coffee confident", 0, 13),
    ("young person speaking camera motivation success energy", 0, 13),
]

# Pexels IDs found from search
pexels_ids = {
    0: 28048582,  # person phone bed 16s
    1: 5310962,   # morning routine 18s
    2: 8164198,   # walking morning 20s
    3: 8847881,   # speaking camera 34s (1080x1920 native)
}

log(f"Output: {OUTPUT_FILE}")
if OUTPUT_FILE.exists() and OUTPUT_FILE.stat().st_size > 500_000:
    log(f"Already exists ({OUTPUT_FILE.stat().st_size//1024}KB), skipping")
else:
    log("Starting production...")

    clip_paths = []
    for i, (query, src_start, dur) in enumerate(shots):
        pexels_id = pexels_ids.get(i)
        tmp = TEMP / f"clip{i+1}.mp4"
        trimmed = TEMP / f"clip{i+1}_t.mp4"

        if not tmp.exists():
            if pexels_id:
                log(f"Fetching Pexels video ID={pexels_id}")
                videos_data = curl_get_json(f"https://api.pexels.com/videos/videos/{pexels_id}")
                videos = [videos_data] if videos_data.get("id") else []
            else:
                videos = search_pexels(query)
                log(f"  Search found {len(videos)} videos")

            vid_obj, clip_file = get_best_clip(videos, min_duration=dur)
            if not clip_file:
                log(f"  No suitable clip for shot {i+1}")
                continue

            log(f"  Downloading {clip_file['link'][:60]}...")
            curl_download(clip_file["link"], str(tmp))
            log(f"  Downloaded: {tmp.stat().st_size//1024}KB")
        else:
            log(f"  Using cached: {tmp}")

        # Crop to 1080x1920 portrait
        # If source is wider (landscape), crop center horizontally
        # If source is taller (tall portrait), scale down and pad
        vf = "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1"
        run_ffmpeg([
            "-ss", str(src_start), "-t", str(dur),
            "-i", str(tmp),
            "-vf", vf,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-an", "-r", "30",
            str(trimmed)
        ])
        clip_paths.append(trimmed)
        log(f"  Shot {i+1} done: {dur}s -> {trimmed.stat().st_size//1024}KB")

    if not clip_paths:
        raise RuntimeError("No clips produced")

    # Concat
    if len(clip_paths) == 1:
        concat_vid = clip_paths[0]
    else:
        concat_vid = TEMP / "concat.mp4"
        lst = TEMP / "lst.txt"
        lst.write_text("\n".join(f"file '{p.as_posix()}'" for p in clip_paths), encoding="utf-8")
        run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(concat_vid)])
        log("Clips concatenated")

    vid_dur = get_duration(concat_vid)
    log(f"Video duration: {vid_dur:.1f}s")

    # TTS narration
    narration = (
        "Scrolling TikTok for 45 minutes before work isn't a morning routine. "
        "It's a slow drain on your potential. "
        "The average Gen Z worker loses 2 to 3 hours daily to passive phone use before noon. "
        "You're warming up your brain to scroll, not to create. "
        "Your first hour programs your entire day. "
        "The 45-minute difference looks like this: 20 minutes movement, walk, workout, stretch. "
        "15 minutes learning, podcast, article, YouTube course. "
        "10 minutes planning, three priorities. "
        "That's peak performance mode by 9am. "
        "No motivation required. "
        "You don't have to want to do it. "
        "You just have to not open your phone for 45 minutes. "
        "That's it. One decision at 6am changes your entire day. "
        "Your phone can make you rich or broke, your choice. "
        "First hour of your day equals first hour of your life. "
        "Follow for more unfiltered success content that doesn't waste your time."
    )

    tts_raw = TEMP / "tts_raw.mp3"
    gTTS(text=narration, lang="en", slow=False).save(str(tts_raw))
    tts_dur = get_duration(tts_raw)
    log(f"TTS duration: {tts_dur:.1f}s")

    # Trim TTS to video length
    tts_trim = TEMP / "tts_trim.mp3"
    run_ffmpeg(["-i", str(tts_raw), "-t", str(vid_dur), "-c:a", "copy", str(tts_trim)])

    # Combine
    run_ffmpeg([
        "-i", str(concat_vid),
        "-i", str(tts_trim),
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        str(OUTPUT_FILE)
    ])
    log(f"Final: {OUTPUT_FILE.stat().st_size//1024}KB")

# Update script status
with open(SCRIPT_PATH, "r", encoding="utf-8-sig") as f:
    sd = json.load(f)

sd["status"] = "produced"
sd["video_path"] = str(OUTPUT_FILE)
sd["produced_at"] = datetime.datetime.utcnow().isoformat() + "Z"
sd["production_method"] = "Pexels+gTTS fallback (Hailuo unavailable)"

with open(SCRIPT_PATH, "w", encoding="utf-8") as f:
    json.dump(sd, f, indent=2, ensure_ascii=False)

log("Done!")
