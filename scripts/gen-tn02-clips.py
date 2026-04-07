#!/usr/bin/env python3
"""Generate TN-02 video clips (5 clips) using Pexels video + gTTS + FFmpeg."""
import os, sys, json, subprocess, shutil
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_tn02"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPTS_DIR = ROOT / "scripts" / "pending"
OUTPUT_BASE = ROOT / "output" / "tien-nghich" / "TN-02"

TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_BASE.mkdir(parents=True, exist_ok=True)

def log(p, *a): print(f"[{p}]", *a)

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

def run_ffmpeg(args):
    r = subprocess.run(["ffmpeg", "-y"] + args, capture_output=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-300:]}")

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

script_path = SCRIPTS_DIR / "TN-02.json"
if not script_path.exists():
    print("[TN-02] ERROR: TN-02.json not found in scripts/pending/")
    sys.exit(1)

with open(script_path, "r", encoding="utf-8") as f:
    tn02 = json.load(f)

clips = tn02["clips"]
results = []

for clip in clips:
    cid = clip["clip_id"]
    out_clip = OUTPUT_BASE / f"{cid}.mp4"
    log(cid, f"Processing: {clip['scene']}")

    # Check if exists
    if out_clip.exists() and out_clip.stat().st_size > 50_000:
        log(cid, f"Exists ({out_clip.stat().st_size//1024}KB), skip")
        results.append({"id": cid, "status": "exists", "size": out_clip.stat().st_size}); continue

    tts_path = TEMP / f"{cid}_tts.mp3"
    vid_path = TEMP / f"{cid}_v.mp4"
    clip_path = TEMP / f"{cid}_c.mp4"

    try:
        # Step 1: Generate TTS
        log(cid, "Generating gTTS...")
        tts = gTTS(text=clip["script_text"], lang="en", slow=False)
        tts.save(str(tts_path))
        log(cid, f"gTTS saved: {tts_path.stat().st_size} bytes")

        # Step 2: Search Pexels
        log(cid, f"Searching Pexels: {clip['prompt_for_pexels']}")
        videos = search_pexels(clip["prompt_for_pexels"])
        if not videos:
            log(cid, "No Pexels videos found, trying alternate query...")
            videos = search_pexels("ancient china warrior epic")

        clip_file = get_best_clip(videos)
        if not clip_file:
            raise RuntimeError("No suitable video found on Pexels")

        log(cid, f"Best video: {clip_file.get('link', '')[:60]}")

        # Step 3: Download video
        curl_download(clip_file["link"], vid_path)
        log(cid, f"Downloaded: {vid_path.stat().st_size//1024}KB")

        # Step 4: Get video duration
        out = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(vid_path)],
            capture_output=True, text=True)
        vid_dur = float(json.loads(out.stdout)["format"]["duration"])
        log(cid, f"Video duration: {vid_dur:.1f}s")

        # Step 5: Get TTS duration
        out2 = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(tts_path)],
            capture_output=True, text=True)
        tts_dur = float(json.loads(out2.stdout)["format"]["duration"])
        log(cid, f"TTS duration: {tts_dur:.1f}s")

        # Step 6: Trim video to ~5s (or match TTS if shorter)
        target_dur = min(5.5, tts_dur + 0.5)
        log(cid, f"Trimming to {target_dur:.1f}s...")
        run_ffmpeg([
            "-ss", str(max(0, vid_dur/2 - target_dur/2)),
            "-i", str(vid_path),
            "-t", str(target_dur),
            "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
            "-an", "-c:v", "libx264", "-preset", "fast",
            str(clip_path)
        ])
        log(cid, f"Clipped: {clip_path.stat().st_size//1024}KB")

        # Step 7: Trim TTS to target_dur and mux
        tts_trim = TEMP / f"{cid}_tts_trim.mp3"
        run_ffmpeg([
            "-ss", "0",
            "-i", str(tts_path),
            "-t", str(target_dur),
            "-c:a", "copy",
            str(tts_trim)
        ])

        # Step 8: Mux video + audio
        run_ffmpeg([
            "-i", str(clip_path),
            "-i", str(tts_trim),
            "-c:v", "copy", "-c:a", "aac",
            "-shortest",
            str(out_clip)
        ])
        log(cid, f"Final: {out_clip.stat().st_size//1024}KB - DONE!")
        results.append({"id": cid, "status": "done", "size": out_clip.stat().st_size})

        # Cleanup temp
        for fp in [vid_path, clip_path, tts_path, tts_trim]:
            if fp.exists(): fp.unlink()

    except Exception as e:
        log(cid, f"ERROR: {e}")
        results.append({"id": cid, "status": "error", "error": str(e)})

print("\n=== TN-02 GENERATION RESULTS ===")
for r in results:
    print(f"  {r['id']}: {r['status']} | size={r.get('size', 'N/A')}")
