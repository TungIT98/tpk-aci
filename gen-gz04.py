#!/usr/bin/env python3
"""Generate GZ-04 video: Pexels + gTTS + FFmpeg."""
import os, json, subprocess
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_gz04"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPT_PATH = ROOT / "scripts" / "pending" / "GZ-04_anxiety-superpower.json"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_FILE = OUTPUT_DIR / "GZ-04.mp4"

def log(*a):
    print("[GZ-04]", *a)

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
        raise RuntimeError(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-500:]}")

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

with open(SCRIPT_PATH, "r", encoding="utf-8-sig") as f:
    sd = json.load(f)

narration = sd["audio"]["narration"]
log(f"Narration length: {len(narration)} chars")

if OUTPUT_FILE.exists() and OUTPUT_FILE.stat().st_size > 100_000:
    log(f"Video already exists: {OUTPUT_FILE.stat().st_size//1024}KB")
else:
    log("Starting video production...")

    searches = [
        "person stressed laptop late night desk anxiety",
        "brain thinking anxiety stress close up portrait",
        "person planning organized desk confident energy",
        "person breathing calm meditation peaceful portrait",
    ]

    clip_paths = []
    for i, query in enumerate(searches):
        log(f"Searching Pexels: {query[:60]}")
        videos = search_pexels(query)
        log(f"  Found {len(videos)} videos")
        if not videos:
            continue
        clip = get_best_clip(videos[:3])
        if not clip:
            continue
        tmp = TEMP / f"clip{i+1}.mp4"
        curl_download(clip["link"], str(tmp))
        log(f"  Downloaded: {clip['width']}x{clip['height']} -> {tmp.stat().st_size//1024}KB")

        trimmed = TEMP / f"clip{i+1}_t.mp4"
        run_ffmpeg([
            "-ss", "0", "-t", "3",
            "-i", str(tmp),
            "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-an", "-r", "30",
            str(trimmed)
        ])
        clip_paths.append(trimmed)
        log(f"  Trimmed/converted: {trimmed.stat().st_size//1024}KB")

    if not clip_paths:
        raise RuntimeError("No clips downloaded")

    # Concat clips
    if len(clip_paths) == 1:
        final_vid = clip_paths[0]
    else:
        concat_vid = TEMP / "concat.mp4"
        lst = TEMP / "lst.txt"
        lst.write_text("\n".join(f"file '{p.as_posix()}'" for p in clip_paths))
        run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(concat_vid)])
        final_vid = concat_vid

    # gTTS - split into chunks of 490 chars
    chunk_size = 490
    tts_parts = []
    for start in range(0, len(narration), chunk_size):
        chunk = narration[start:start+chunk_size]
        # Try to end at sentence
        if start + chunk_size < len(narration):
            for punct in ['. ', '! ', '? ', ', ']:
                last_punct = chunk.rfind(punct)
                if last_punct > chunk_size * 0.6:
                    chunk = chunk[:last_punct+1]
                    break
        part_file = TEMP / f"tts_part_{start//chunk_size}.mp3"
        gTTS(text=chunk, lang="en", slow=False).save(str(part_file))
        tts_parts.append(part_file)

    log(f"Generated {len(tts_parts)} TTS chunks")

    # Combine TTS parts
    if len(tts_parts) == 1:
        tts_raw = tts_parts[0]
    else:
        tts_raw = TEMP / "tts_raw.mp3"
        lst = TEMP / "lst_tts.txt"
        lst.write_text("\n".join(f"file '{p.as_posix()}'" for p in tts_parts))
        run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(tts_raw)])

    dur = get_duration(final_vid)
    log(f"Video duration: {dur:.1f}s")
    tts_trim = TEMP / "tts_trim.mp3"
    run_ffmpeg(["-i", str(tts_raw), "-t", str(dur), "-c:a", "copy", str(tts_trim)])

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
sd["video_path"] = str(OUTPUT_FILE)
import datetime
sd["produced_at"] = datetime.datetime.utcnow().isoformat() + "Z"
sd["production_method"] = "Pexels+gTTS fallback (Hailuo unavailable)"

with open(SCRIPT_PATH, "w", encoding="utf-8") as f:
    json.dump(sd, f, indent=2, ensure_ascii=False)

log("Done - GZ-04.mp4 produced and script updated")
