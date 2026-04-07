#!/usr/bin/env python3
"""Generate XIANYX-15 Muc Than Ky Episode 3 - Pexels + gTTS + FFmpeg.
Issue: TKP-2027 | Output: output_topic/videos/XIANYX-15.mp4
Hailuo broken - using Pexels stock footage + gTTS Vietnamese narration.
"""
import os, sys, json, subprocess, shutil, re
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS
import requests

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
SCRIPTS_DIR = ROOT / "scripts" / "pending" / "xianxia"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
TEMP = ROOT / "output" / "_temp_xianyx15"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)

# Pexels search queries per shot (portrait, dark xianxia/cinematic)
SHOT_QUERIES = [
    "graveyard fog moonless night ancient stones",   # Shot 1: burial ground at midnight, fog, grave markers
    "fog path mysterious woman standing moonlit",    # Shot 2: woman in fog discovering grave
    "woman face portrait dramatic dark mysterious", # Shot 3: close-up woman, calm knowing
    "ancient gold artifact dramatic light jewelry",  # Shot 4: brand/wrist close-up, ancient symbol
    "fog dark forest mysterious figure silhouette",  # Shot 5: woman in white, dark figure in fog
]

def log(*a): print("[XIANYX-15]", *a)

def search_pexels(query):
    q = quote(query)
    url = f"https://api.pexels.com/videos/search?query={q}&per_page=8&orientation=portrait"
    r = requests.get(url, headers={"Authorization": PEXELS_KEY}, timeout=30)
    r.raise_for_status()
    return r.json().get("videos", [])

def get_best_clip(videos):
    for v in videos:
        for f in v.get("video_files", []):
            if f.get("quality") == "hd" and f.get("height", 0) >= 720:
                return f
    if videos and videos[0].get("video_files"):
        return videos[0]["video_files"][0]
    return None

def curl_download(url, path):
    r = requests.get(url, stream=True, headers={"Authorization": PEXELS_KEY}, timeout=60)
    r.raise_for_status()
    with open(path, "wb") as f:
        for chunk in r.iter_content(chunk_size=65536):
            f.write(chunk)

def run_ffmpeg(args, timeout=180):
    r = subprocess.run([FFMPEG, "-y"] + args, capture_output=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-500:]}")

def get_duration(path):
    out = subprocess.run(
        [FPROBE, "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
        capture_output=True, text=True)
    return float(json.loads(out.stdout)["format"]["duration"])

# Load script (fix trailing commas first)
script_path = SCRIPTS_DIR / "XIANYX-15.json"
with open(script_path, "r", encoding="utf-8") as f:
    raw = f.read()
# Fix trailing commas before } or ]
fixed = re.sub(r',(\s*[}\]])', r'\1', raw)
script = json.loads(fixed)

shots = script["shots"]
log(f"Script: {script['title']}")
log(f"Shots: {len(shots)}")

# ============================================================
# Step 1: Generate 5 clips (6s each)
# ============================================================
clip_paths = []
for shot in shots:
    i = shot["shot_number"]
    cid = f"shot_{i}"
    out_clip = TEMP / f"{cid}.mp4"
    log(f"\n=== {cid} ===")

    if out_clip.exists() and out_clip.stat().st_size > 200_000:
        log(f"  Exists ({out_clip.stat().st_size//1024}KB), skip")
        clip_paths.append(out_clip)
        continue

    vid_path = TEMP / f"{cid}_v.mp4"
    clip_path = TEMP / f"{cid}_c.mp4"

    try:
        # Pexels search
        query = SHOT_QUERIES[i - 1]
        log(f"  Pexels: {query}")
        videos = search_pexels(query)
        if not videos:
            alt_queries = [
                "ancient ruins fog dark",
                "dramatic portrait woman dark",
                "mysterious forest fog",
                "gold jewelry close up dramatic",
                "woman white dress fog"
            ]
            alt = alt_queries[i - 1]
            log(f"  No results, alt: {alt}")
            videos = search_pexels(alt)

        clip_file = get_best_clip(videos)
        if not clip_file:
            raise RuntimeError(f"No video for query: {query}")

        log(f"  Video ID: {clip_file.get('id')}, {clip_file.get('width')}x{clip_file.get('height')}")

        # Download
        curl_download(clip_file["link"], vid_path)
        log(f"  Downloaded: {vid_path.stat().st_size//1024}KB")

        vid_dur = get_duration(vid_path)
        clip_dur = shot.get("duration", 6)
        start_time = max(0, vid_dur / 2 - clip_dur / 2)

        # Convert to portrait 1080x1920 + trim
        run_ffmpeg([
            "-ss", str(start_time),
            "-i", str(vid_path),
            "-t", str(clip_dur),
            "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1",
            "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            str(clip_path)
        ])
        log(f"  Clipped: {clip_path.stat().st_size//1024}KB")

        # Copy to final clip location
        shutil.copy2(str(clip_path), str(out_clip))
        clip_paths.append(out_clip)
        log(f"  DONE!")

        for fp in [vid_path, clip_path]:
            if fp.exists(): fp.unlink()

    except Exception as e:
        log(f"  ERROR: {e}")
        # Fallback: try alternative queries
        fallbacks = [
            "ancient cemetery fog night",
            "dramatic woman portrait fog",
            "dark forest mysterious woman",
            "ancient gold artifact close up",
            "woman white flowing dress fog"
        ]
        try:
            fb_query = fallbacks[i - 1]
            log(f"  Fallback: {fb_query}")
            videos = search_pexels(fb_query)
            clip_file = get_best_clip(videos)
            if clip_file:
                curl_download(clip_file["link"], vid_path)
                run_ffmpeg(["-ss", "0", "-t", "6", "-i", str(vid_path),
                    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
                    "-an", "-c:v", "libx264", "-preset", "fast", str(clip_path)])
                shutil.copy2(str(clip_path), str(out_clip))
                clip_paths.append(out_clip)
                log(f"  Fallback clip done: {out_clip.stat().st_size//1024}KB")
            else:
                log(f"  No fallback video found")
        except Exception as e2:
            log(f"  Fallback also failed: {e2}")

# ============================================================
# Step 2: Assemble final video
# ============================================================
log(f"\n=== ASSEMBLING FINAL VIDEO ({len(clip_paths)} clips) ===")

if len(clip_paths) < 3:
    log("ERROR: Not enough clips available")
    sys.exit(1)

# Pad with last available clip if needed
while len(clip_paths) < 5:
    clip_paths.append(clip_paths[-1])
    log(f"  Padded clip {len(clip_paths)} with repeat of clip {len(clip_paths)-1}")

# Concat
concat_list = TEMP / "lst.txt"
concat_list.write_text("\n".join(f"file '{p.as_posix()}'" for p in clip_paths), encoding="utf-8")
concat_vid = TEMP / "concat.mp4"
run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(concat_list), "-c", "copy", str(concat_vid)])
log(f"Concatenated: {concat_vid.stat().st_size//1024}KB")

# Full narration TTS
full_narration = script["audio"]["narration"]
log(f"Full narration: {len(full_narration)} chars")

# Split into chunks for gTTS (500 char limit)
tts_parts = []
for start in range(0, len(full_narration), 480):
    chunk = full_narration[start:start+480]
    chunk_path = TEMP / f"tts_chunk_{start//480}.mp3"
    gTTS(text=chunk, lang="vi", slow=False).save(str(chunk_path))
    tts_parts.append(chunk_path)

# Concatenate TTS parts
tts_list = TEMP / "tts_lst.txt"
tts_list.write_text("\n".join(f"file '{p.as_posix()}'" for p in tts_parts))
tts_combined = TEMP / "tts_combined.mp3"
run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(tts_list), "-c", "copy", str(tts_combined)])
log(f"TTS combined: {tts_combined.stat().st_size//1024}KB")

# Trim TTS to video duration
vid_dur = get_duration(concat_vid)
tts_trim = TEMP / "tts_trim.mp3"
run_ffmpeg(["-i", str(tts_combined), "-t", str(vid_dur), "-c:a", "copy", str(tts_trim)])
log(f"TTS trimmed to {vid_dur:.1f}s: {tts_trim.stat().st_size//1024}KB")

# Final mux
final_output = OUTPUT_DIR / "XIANYX-15.mp4"
run_ffmpeg([
    "-i", str(concat_vid),
    "-i", str(tts_trim),
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest",
    str(final_output)
])
log(f"\n=== FINAL: {final_output.stat().st_size//1024}KB ===")

# Update script JSON
script["status"] = "produced"
script["videoFile"] = str(final_output)
import datetime
script["produced_at"] = datetime.datetime.utcnow().isoformat() + "Z"
with open(script_path, "w", encoding="utf-8") as f:
    json.dump(script, f, indent=2, ensure_ascii=False)
log("Script updated: status=produced")

# Cleanup
for fp in tts_parts + [tts_combined, tts_trim, concat_vid, concat_list, tts_list]:
    try:
        if fp.exists(): fp.unlink()
    except: pass
for fp in list(TEMP.glob("shot_*")):
    try: fp.unlink()
    except: pass

log("DONE!")
