#!/usr/bin/env python3
"""Generate XIANYX-12: Dau Pha Thuong Khau Episode 3 - The Flame's Bargain
Pexels + MiniMax TTS + FFmpeg.
"""
import os, json, subprocess
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_xianyx12"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
MINIMAX_KEY = "sk-cp-JKcLn8JXdkygpTgwCS72isp9Zz7AswQeFdh5uKnvk0vngQHaLa6NVBOwSZ8v6xZybbPM3ck-L1UmOYff7EsliddMUK4Hk-za3N0-wUWse_Nsj--6J_n9XPw"
SCRIPT_PATH = ROOT / "scripts" / "pending" / "xianxia" / "XIANYX-12.json"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_FILE = OUTPUT_DIR / "XIANYX-12.mp4"

def log(*a):
    print("[XIANYX-12]", *a)

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

def minimax_tts(text, output_path):
    """Generate TTS via MiniMax API."""
    import urllib.request, urllib.error
    req = urllib.request.Request(
        "https://api.minimax.io/v1/t2a_v2",
        data=json.dumps({"model": "speech-2.8-hd", "text": text[:500], "speed": 1.0}).encode(),
        headers={
            "Authorization": f"Bearer {MINIMAX_KEY}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            if "data" in data and "audio_url" in data["data"]:
                audio_url = data["data"]["audio_url"]
                subprocess.run(["curl", "-s", "-L", "-o", str(output_path), audio_url], timeout=30)
                return
    except Exception as e:
        log(f"MiniMax TTS failed: {e}")
    raise RuntimeError("MiniMax TTS failed")

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

    # 5 shots matching the Dau Pha Thuong Khau Episode 3 narrative
    searches = [
        # Shot 1: Ancient ruins at night, fire/flame spiraling upward - controlled power
        "dark ancient ruins night fire flame dramatic",
        # Shot 2: Face shock expression, close-up dramatic, dark mood
        "dramatic face close-up dark intense shock",
        # Shot 3: Person on knees, gasping, dark dramatic
        "person kneeling ground dark dramatic intense",
        # Shot 4: Dramatic portrait dark fire, tears, jade glowing
        "dark dramatic portrait fire flame intense",
        # Shot 5: Torchlight at night, crowd surrounding, dark army
        "torch fire night dramatic crowd darkness",
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

    # Concat all 5 clips (5 x 6s = 30s)
    if len(clip_paths) == 1:
        final_vid = clip_paths[0]
    else:
        concat_vid = TEMP / "concat.mp4"
        lst = TEMP / "lst.txt"
        lst.write_text("\n".join(f"file '{p.as_posix()}'" for p in clip_paths))
        run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(concat_vid)])
        final_vid = concat_vid
        log(f"Concatenated {len(clip_paths)} clips -> {final_vid.stat().st_size//1024}KB")

    # MiniMax TTS with gTTS fallback
    tts_raw = TEMP / "tts_raw.mp3"
    try:
        minimax_tts(narration[:500], tts_raw)
        log("MiniMax TTS generated")
    except:
        log("MiniMax failed, using gTTS fallback...")
        gTTS(text=narration[:500], lang="en", slow=False).save(str(tts_raw))

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
