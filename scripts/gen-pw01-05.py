#!/usr/bin/env python3
"""Generate PW-01 to PW-05 using Pexels video + gTTS + FFmpeg."""
import os, sys, json, subprocess, shutil
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_pw0105"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPTS_DIR = ROOT / "scripts" / "pending"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Scripts that need videos (missing from output_topic/videos/)
SCRIPTS = ["PW-01_2-minute-rule", "PW-02_meeting-output", "PW-03_sunday-night-ritual",
           "PW-04_email-trap", "PW-05_90-minute-rhythm"]

def log(p, *a): print(f"[{p}]", *a)

def curl_get_json(url):
    r = subprocess.run(["curl", "-s", "-L", url, "-H", f"Authorization: {PEXELS_KEY}"],
                      capture_output=True, text=True, timeout=30)
    try:
        return json.loads(r.stdout)
    except:
        return {}

def curl_download(url, path):
    r = subprocess.run(["curl", "-s", "-L", "-o", str(path), "-w", "%{http_code}", url,
                       "-H", f"Authorization: {PEXELS_KEY}"],
                      capture_output=True, text=True, timeout=60)
    if r.stdout.strip() != "200":
        raise RuntimeError(f"Download failed: HTTP {r.stdout}")

def run_ffmpeg(args):
    r = subprocess.run(["ffmpeg", "-y"] + args, capture_output=True, timeout=120)
    if r.returncode != 0:
        err = r.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"FFmpeg error: {err[-300:]}")

def search_pexels(query):
    q = quote(query)
    url = f"https://api.pexels.com/videos/search?query={q}&per_page=5&orientation=portrait"
    return curl_get_json(url).get("videos", [])

def get_best_clip(videos):
    for v in videos:
        for f in v.get("video_files", []):
            if f.get("quality") == "hd" and f.get("height", 0) >= 720:
                return f, v
    if videos and videos[0].get("video_files"):
        return videos[0]["video_files"][0], videos[0]
    return None, None

def get_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
        capture_output=True, text=True)
    try:
        return float(json.loads(out.stdout)["format"]["duration"])
    except:
        return 5.0

results = []

for sid in SCRIPTS:
    sp = SCRIPTS_DIR / f"{sid}.json"
    if not sp.exists():
        log(sid, "No script, skip")
        results.append({"id": sid, "status": "skip"}); continue

    with open(sp, "r", encoding="utf-8") as f:
        sd = json.load(f)

    out_vid = OUTPUT_DIR / f"{sid}.mp4"
    if out_vid.exists() and out_vid.stat().st_size > 100_000:
        log(sid, f"Exists ({out_vid.stat().st_size//1024}KB), skip")
        results.append({"id": sid, "status": "exists"}); continue

    # Get tags and script text
    tags = sd.get("tags", [])
    if isinstance(tags, list):
        tags_str = " ".join(tags)
    else:
        tags_str = str(tags)

    script_text = sd.get("script", "") or sd.get("concept", {}).get("hook", "") or sd.get("title", "")

    log(sid, f"Starting: {sd.get('title', '')[:50]}")
    log(sid, f"Tags: {tags_str[:60]}")

    c1 = TEMP / f"{sid}_c1.mp4"
    tts = TEMP / f"{sid}_tts.mp3"
    tts_wav = TEMP / f"{sid}_tts.wav"

    try:
        # Search Pexels
        search_queries = [tags_str] if tags_str else [sd.get("title", "productivity office work")]
        videos = []
        for q in search_queries + [sd.get("title", "productivity")]:
            if len(videos) == 0:
                videos = search_pexels(q)
            if videos:
                break

        if not videos:
            videos = search_pexels("productivity office worker desk")

        log(sid, f"Pexels: {len(videos)} videos found")

        vf1, vid_info = get_best_clip(videos)
        if not vf1:
            log(sid, "No suitable clip found"); results.append({"id": sid, "status": "fail_no_clip"}); continue

        curl_download(vf1["link"], str(c1))
        log(sid, f"Downloaded: {vf1['width']}x{vf1['height']}")

        # Get video duration
        vid_dur = get_duration(c1)
        target_dur = min(vid_dur, 10.0)
        log(sid, f"Video duration: {vid_dur:.1f}s, targeting: {target_dur:.1f}s")

        # Trim + pad to portrait 1080x1920
        c1t = TEMP / f"{sid}_c1t.mp4"
        run_ffmpeg([
            "-ss", "0", "-t", str(target_dur),
            "-i", str(c1),
            "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-r", "30",
            "-pix_fmt", "yuv420p", str(c1t)
        ])
        log(sid, "Trimmed clip ready")

        # Generate TTS
        if script_text:
            try:
                tts_obj = gTTS(text=script_text[:500], lang="en", slow=False)
                tts_obj.save(str(tts))
                log(sid, f"TTS saved ({os.path.getsize(tts)//1024}KB)")
            except Exception as e:
                log(sid, f"TTS failed: {e}, using silent audio")
                # Create silent audio
                run_ffmpeg(["-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo", "-t", "5",
                           "-q:a", "9", "-acodec", "libmp3lame", str(tts)])
        else:
            run_ffmpeg(["-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo", "-t", "5",
                       "-q:a", "9", "-acodec", "libmp3lame", str(tts)])

        # Get TTS duration
        tts_dur = get_duration(tts) if os.path.exists(tts) else 5.0

        # Trim TTS to video length if needed
        if tts_dur > target_dur:
            log(sid, f"Trim TTS {tts_dur:.1f}s -> {target_dur:.1f}s")
            tts_trim = TEMP / f"{sid}_tts_trim.mp3"
            run_ffmpeg(["-i", str(tts), "-t", str(target_dur), "-c", "copy", str(tts_trim)])
            tts = tts_trim
            tts_dur = target_dur

        # Mux video + audio
        run_ffmpeg([
            "-i", str(c1t), "-i", str(tts),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
            "-shortest", str(out_vid)
        ])
        size = os.path.getsize(out_vid) if os.path.exists(out_vid) else 0
        log(sid, f"DONE: {size//1024}KB -> {out_vid}")
        results.append({"id": sid, "status": "done", "size": size})

        # Cleanup
        for f in [c1, c1t, tts]:
            try: os.remove(f)
            except: pass

    except Exception as e:
        log(sid, f"ERROR: {e}")
        results.append({"id": sid, "status": "error", "error": str(e)})

for r in results:
    print(f"RESULT: {r['id']} -> {r['status']}")
