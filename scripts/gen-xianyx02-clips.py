#!/usr/bin/env python3
"""Generate XIANYX-02 video clips (5 shots) using Pexels + gTTS + FFmpeg.
Dau Pha Thuong Khau Episode 1: The Sect That Feared His Return
"""
import os, sys, json, subprocess, shutil
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS
import requests

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
SCRIPTS_DIR = ROOT / "scripts" / "pending" / "xianxia"
OUTPUT_DIR = ROOT / "outputs" / "xianxia" / "XIANYX-02"
TEMP = ROOT / "outputs" / "_temp_xianyx02"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)

def log(p, *a): print(f"[{p}]", *a)

def search_pexels(query):
    q = quote(query)
    url = f"https://api.pexels.com/videos/search?query={q}&per_page=5&orientation=portrait"
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

def run_ffmpeg(args):
    r = subprocess.run([FFMPEG, "-y"] + args, capture_output=True, timeout=180)
    if r.returncode != 0:
        err = r.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"FFmpeg error: {err[-500:]}")

def get_duration(path):
    out = subprocess.run(
        [FPROBE, "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
        capture_output=True, text=True)
    return float(json.loads(out.stdout)["format"]["duration"])

def process_shot(shot_num, narration, pexels_query, clip_duration=6):
    cid = f"shot_{shot_num}"
    out_clip = OUTPUT_DIR / f"raw_{cid}.mp4"
    log(cid, f"Processing shot {shot_num}")

    # Check existing
    if out_clip.exists() and out_clip.stat().st_size > 50_000:
        log(cid, f"Exists ({out_clip.stat().st_size//1024}KB), skip")
        return {"id": cid, "status": "exists", "size": out_clip.stat().st_size}

    vid_path = TEMP / f"{cid}_v.mp4"
    clip_path = TEMP / f"{cid}_c.mp4"
    tts_path = TEMP / f"{cid}_tts.mp3"

    try:
        # Step 1: Generate TTS
        log(cid, f"Generating gTTS for: {narration[:50]}...")
        tts = gTTS(text=narration, lang="en", slow=False)
        tts.save(str(tts_path))
        log(cid, f"gTTS saved: {tts_path.stat().st_size} bytes")

        # Step 2: Search Pexels
        log(cid, f"Pexels query: {pexels_query}")
        videos = search_pexels(pexels_query)
        if not videos:
            alt_query = "ancient china warrior epic dramatic"
            log(cid, f"No results, trying: {alt_query}")
            videos = search_pexels(alt_query)

        clip_file = get_best_clip(videos)
        if not clip_file:
            raise RuntimeError(f"No suitable video found for query: {pexels_query}")

        log(cid, f"Video ID: {clip_file.get('id')}, height: {clip_file.get('height')}")

        # Step 3: Download
        curl_download(clip_file["link"], vid_path)
        log(cid, f"Downloaded: {vid_path.stat().st_size//1024}KB")

        vid_dur = get_duration(vid_path)
        tts_dur = get_duration(tts_path)

        # Step 4: Trim video from middle to target duration
        target_dur = min(clip_duration + 0.5, tts_dur + 0.5)
        start_time = max(0, vid_dur / 2 - target_dur / 2)
        run_ffmpeg([
            "-ss", str(start_time),
            "-i", str(vid_path),
            "-t", str(target_dur),
            "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
            "-an", "-c:v", "libx264", "-preset", "fast",
            str(clip_path)
        ])
        log(cid, f"Clipped: {clip_path.stat().st_size//1024}KB")

        # Step 5: Mux video + audio
        run_ffmpeg([
            "-i", str(clip_path),
            "-i", str(tts_path),
            "-c:v", "copy", "-c:a", "aac",
            "-shortest",
            str(out_clip)
        ])
        log(cid, f"Final: {out_clip.stat().st_size//1024}KB - DONE!")

        # Cleanup
        for fp in [vid_path, clip_path, tts_path]:
            if fp.exists(): fp.unlink()

        return {"id": cid, "status": "done", "size": out_clip.stat().st_size}

    except Exception as e:
        log(cid, f"ERROR: {e}")
        return {"id": cid, "status": "error", "error": str(e)}

# Main
script_path = SCRIPTS_DIR / "XIANYX-02.json"
if not script_path.exists():
    print(f"ERROR: {script_path} not found")
    sys.exit(1)

with open(script_path, "r", encoding="utf-8") as f:
    script = json.load(f)

print(f"=== XIANYX-02 Clip Generation ===")
print(f"Script: {script['title']}")
print(f"Shots: {len(script['shots'])}")

results = []
for shot in script["shots"]:
    i = shot["shot_number"]
    r = process_shot(i, shot["narration"], shot.get("prompt_for_pexels", shot["prompt"][:80]))
    results.append(r)

print("\n=== RESULTS ===")
for r in results:
    print(f"  {r['id']}: {r['status']} | size={r.get('size', 'N/A')}")

done = sum(1 for r in results if r["status"] in ("done", "exists"))
print(f"\n{done}/{len(results)} clips ready")
