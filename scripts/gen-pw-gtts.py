#!/usr/bin/env python3
"""Generate PW-13 to PW-18 using Pexels video + gTTS + FFmpeg."""
import os, sys, json, subprocess, shutil
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_gtts"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPTS_DIR = ROOT / "scripts" / "pending"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SCRIPTS = ["PW-13", "PW-14", "PW-15", "PW-16", "PW-17", "PW-18"]

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
        raise RuntimeError(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-200:]}")

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
    return float(json.loads(out.stdout)["format"]["duration"])

results = []

for sid in SCRIPTS:
    sp = SCRIPTS_DIR / f"{sid}.json"
    if not sp.exists():
        log(sid, "No script, skip"); results.append({"id": sid, "status": "skip"}); continue

    with open(sp, "r", encoding="utf-8") as f:
        sd = json.load(f)

    text = sd["script"]
    tags = " ".join(sd.get("tags", []))
    out_vid = OUTPUT_DIR / f"{sid}.mp4"

    if out_vid.exists() and out_vid.stat().st_size > 100_000:
        log(sid, f"Exists ({out_vid.stat().st_size//1024}KB), skip")
        results.append({"id": sid, "status": "exists", "size": out_vid.stat().st_size}); continue

    log(sid, f"Starting: {sd.get('title', '')[:50]}")
    c1 = TEMP / f"{sid}_c1.mp4"; c2 = TEMP / f"{sid}_c2.mp4"
    vid = TEMP / f"{sid}_v.mp4"; tts = TEMP / f"{sid}_tts.mp3"

    try:
        vids = search_pexels(tags)
        log(sid, f"Pexels: {len(vids)} videos")
        if not vids: raise RuntimeError("No videos found")

        vf1 = get_best_clip(vids[:3])
        curl_download(vf1["link"], str(c1))
        log(sid, f"Clip1: {vf1['width']}x{vf1['height']}")

        vids2 = search_pexels(" ".join(tags.split()[:3]) + " office")
        vf2 = get_best_clip(vids2[:3]) if vids2 else get_best_clip(vids)
        curl_download(vf2["link"], str(c2))
        log(sid, f"Clip2: {vf2['width']}x{vf2['height']}")

        # Trim 2 clips to 2.5s each
        c1t = TEMP / f"{sid}_c1t.mp4"; c2t = TEMP / f"{sid}_c2t.mp4"
        run_ffmpeg(["-ss", "0", "-t", "2.5", "-i", str(c1),
                    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
                    "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-r", "30", str(c1t)])
        run_ffmpeg(["-ss", "0", "-t", "2.5", "-i", str(c2),
                    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
                    "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-r", "30", str(c2t)])

        # Concat
        lst = TEMP / f"{sid}_lst.txt"
        lst.write_text(f"file '{c1t.as_posix()}'\nfile '{c2t.as_posix()}'")
        run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(vid)])

        # gTTS
        log(sid, "gTTS...")
        gTTS(text=text[:500], lang="en", slow=False).save(str(tts))
        log(sid, f"TTS: {tts.stat().st_size//1024}KB")

        # Mux - trim TTS to video duration
        dur = get_duration(vid)
        tts_trim = TEMP / f"{sid}_tts_trim.mp3"
        run_ffmpeg(["-i", str(tts), "-t", str(dur), "-c:a", "copy", str(tts_trim)])
        run_ffmpeg(["-i", str(vid), "-i", str(tts_trim), "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", str(out_vid)])

        sz = out_vid.stat().st_size
        log(sid, f"DONE: {sz//1024}KB")
        results.append({"id": sid, "status": "done", "size": sz})

    except Exception as e:
        log(sid, f"ERROR: {e}")
        results.append({"id": sid, "status": "error", "error": str(e)[:100]})

    finally:
        for fl in list(TEMP.glob(f"{sid}_*")):
            try: fl.unlink()
            except: pass

print("\n=== SUMMARY ===")
for r in results:
    sz = f"{r.get('size',0)/1024:.0f}KB" if r.get("size") else r.get("error","")[:40]
    print(f"  {r['id']}: {r['status']} {sz}")
