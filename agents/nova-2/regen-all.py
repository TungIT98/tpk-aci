#!/usr/bin/env python3
"""Generate PW/AESTH videos using Pexels + gTTS + FFmpeg."""
import os, sys, json, subprocess, shutil, time
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_regen"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPTS_DIR = ROOT / "scripts" / "pending"
OUTPUT_DIR  = ROOT / "output_topic" / "videos"
UPLOAD_DIR  = Path("C:/tmp/openclaw/uploads")
TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Priority order from issue
SCRIPTS = ["PW-09", "PW-12", "PW-06", "PW-08", "PW-10", "PW-13", "PW-14", "PW-15", "PW-16", "PW-17", "PW-18", "AESTH-01"]

def log(p, *a): print(f"[{time.strftime('%H:%M:%S')}][{p}]", *a)

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
        raise RuntimeError(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-300:]}")

def get_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
        capture_output=True, text=True
    )
    try:
        return float(json.loads(out.stdout)["format"]["duration"])
    except:
        return 6.0

def search_pexels(query):
    q = quote(query)
    url = f"https://api.pexels.com/videos/search?query={q}&per_page=6&orientation=portrait"
    return curl_get_json(url).get("videos", [])

def get_best_clip(videos):
    """Pick best clip: HD quality, >= 720p height."""
    for v in videos:
        for f in v.get("video_files", []):
            if f.get("quality") == "hd" and f.get("height", 0) >= 720:
                return f, v.get("id")
    # Fallback: first HD file
    for v in videos:
        for f in v.get("video_files", []):
            if f.get("height", 0) >= 720:
                return f, v.get("id")
    if videos and videos[0].get("video_files"):
        return videos[0]["video_files"][0], videos[0].get("id")
    return None, None

def scale_pad(input_path, output_path, width=1080, height=1920):
    """Scale and pad to portrait 1080x1920."""
    run_ffmpeg([
        "-ss", "0", "-t", "3",
        "-i", str(input_path),
        "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-r", "30",
        str(output_path)
    ])

results = []

for sid in SCRIPTS:
    sp = SCRIPTS_DIR / f"{sid}.json"
    if not sp.exists():
        log(sid, "No script, skip")
        results.append({"id": sid, "status": "skip", "reason": "no_script"})
        continue

    with open(sp, "r", encoding="utf-8") as f:
        sd = json.load(f)

    title = sd.get("title", sid)
    text = sd.get("script", "") or sd.get("description", "") or title
    tags = " ".join(sd.get("tags", []))
    prompt_for_hailuo = sd.get("prompt_for_hailuo", "")
    
    # Use visual_scene or prompt_for_hailuo for search
    search_query = (
        prompt_for_hailuo[:150] if prompt_for_hailuo
        else (sd.get("visual_scene", "")[:150] if sd.get("visual_scene")
        else tags[:100] if tags else title)
    )

    out_vid = OUTPUT_DIR / f"{sid}.mp4"
    final_vid = UPLOAD_DIR / f"{sid}-FINAL.mp4"

    log(sid, f"Processing: {title[:50]}")
    log(sid, f"Search query: {search_query[:80]}")

    c1 = TEMP / f"{sid}_c1.mp4"; c2 = TEMP / f"{sid}_c2.mp4"
    c1t = TEMP / f"{sid}_c1t.mp4"; c2t = TEMP / f"{sid}_c2t.mp4"
    vid_noaudio = TEMP / f"{sid}_v.mp4"
    tts = TEMP / f"{sid}_tts.mp3"
    tts_trim = TEMP / f"{sid}_tts_trim.mp3"

    try:
        # Step 1: Pexels search
        videos = search_pexels(search_query)
        log(sid, f"Pexels: {len(videos)} videos found")

        if not videos:
            # Fallback: try title-based search
            videos = search_pexels(title[:50])

        if not videos:
            raise RuntimeError("No videos found on Pexels")

        # Step 2: Download clip 1
        vf1, vid1_id = get_best_clip(videos)
        if not vf1:
            raise RuntimeError("No suitable clip found")

        log(sid, f"Clip1: {vf1.get('width','?')}x{vf1.get('height','?')} (id={vid1_id})")
        curl_download(vf1["link"], str(c1))

        # Step 3: Download clip 2 (different search)
        videos2 = search_pexels(search_query.split()[0] if search_query else "office work")
        vf2, vid2_id = get_best_clip(videos2) if videos2 else (vf1, vid1_id)
        if vf2 and vf2["link"] != vf1["link"]:
            log(sid, f"Clip2: {vf2.get('width','?')}x{vf2.get('height','?')} (id={vid2_id})")
            curl_download(vf2["link"], str(c2))
        else:
            log(sid, "Clip2: same as clip1, copying")
            shutil.copy(c1, c2)
            vf2 = vf1

        # Step 4: Scale & trim clips to 1080x1920 @ 3s each
        log(sid, "Processing clips...")
        scale_pad(c1, c1t)
        scale_pad(c2, c2t)

        # Step 5: Concatenate
        lst = TEMP / f"{sid}_lst.txt"
        lst.write_text(f"file '{c1t.as_posix()}'\nfile '{c2t.as_posix()}'")
        run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(vid_noaudio)])
        log(sid, f"Concatenated: {get_duration(vid_noaudio):.1f}s")

        # Step 6: gTTS
        log(sid, "Generating gTTS audio...")
        gTTS(text=text[:500], lang="en", slow=False).save(str(tts))
        log(sid, f"TTS: {tts.stat().st_size//1024}KB")

        # Step 7: Mux audio to video
        dur = get_duration(vid_noaudio)
        run_ffmpeg(["-i", str(tts), "-t", str(dur), "-c:a", "copy", str(tts_trim)])
        run_ffmpeg(["-i", str(vid_noaudio), "-i", str(tts_trim),
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest",
                    str(out_vid)])
        
        # Step 8: Copy to FINAL location
        shutil.copy(str(out_vid), str(final_vid))

        sz = out_vid.stat().st_size
        log(sid, f"✅ DONE: {sz//1024}KB → {final_vid}")
        results.append({"id": sid, "status": "done", "size": sz, "output": str(final_vid)})

    except Exception as e:
        log(sid, f"❌ ERROR: {e}")
        results.append({"id": sid, "status": "error", "error": str(e)[:100]})

    finally:
        # Clean temp files for this script
        for fl in TEMP.glob(f"{sid}_*"):
            try: fl.unlink()
            except: pass

print("\n=== SUMMARY ===")
done = failed = skip = 0
for r in results:
    icon = {"done": "✅", "error": "❌", "skip": "⏭️"}.get(r["status"], "?")
    sz = f"{r.get('size',0)/1024:.0f}KB" if r.get("size") else r.get("error","")[:40]
    print(f"  {icon} {r['id']}: {r['status']} {sz}")
    if r["status"] == "done": done += 1
    elif r["status"] == "error": failed += 1
    else: skip += 1

print(f"\nTotal: {done} done, {failed} failed, {skip} skipped")
