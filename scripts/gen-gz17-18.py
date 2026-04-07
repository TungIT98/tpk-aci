#!/usr/bin/env python3
"""Generate GZ-17, GZ-18 using Pexels video + gTTS + FFmpeg."""
import os, sys, json, subprocess, shutil
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_gz17"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPTS_DIR = ROOT / "scripts" / "pending"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# GZ-17: job I hated for 2 years, career cost. Keywords: career anxiety, office stress, job dissatisfaction
# GZ-18: passion vs skills. Keywords: career strategy, skills first, money mindset
SCRIPTS = {
    "GZ-17": {
        "text": "I stayed at a job I hated for two years. Not because I was afraid to leave — because I did not have the framework to calculate the actual cost. Most people do not calculate the real cost. They just know they are miserable. Here is the math nobody shows you. The financial cost: your salary gap is obvious, but the hidden cost is your raises. Every year you stay underpaid, you fall further behind. Two years at a below-market rate with 3% annual raises means when you finally leave, you are negotiating from a lower number. The compounding career cost is worse. That job you hate is taking up brain space that could be going toward building something better. Two years of Sunday dread, Monday anxiety, and Friday relief — that is 104 days of your life per year in emotional debt. The psychological cost: chronic job dissatisfaction increases cortisol levels measurably. Your body is paying the bill too. Here is the framework: does this job make me better or bitter? If better, stay and use the income to build exit options. If bitter, start planning now. Staying because you are comfortable is the most expensive decision you can make.",
        "tags": "career advice job stress office monday anxiety career change work life balance",
        "pexels_search": "career advice office stress job burnout"
    },
    "GZ-18": {
        "text": "Following your passion is the worst career advice nobody wants to admit. You are not broke because you have not found your passion yet. You are broke because passion does not pay bills and someone told you it should. Here is the career reframing nobody gives you. Skills-first beats passion-first every time. Passion without skills is a nice hobby. Skills without passion is a paycheck. Build skills that pay, develop passion on the side. The difference between broke and building is one framework. Ask this question about any career decision: will this give me transferable skills or just good stories? If it builds transferable skills, do it even if it is not your passion. If it only builds stories, protect your time and do it as a hobby. The careers that look like passion usually looked like work for the first five years. The person who seems like they woke up doing what they love — they just got good at the parts other people quit. Skills are developed, not discovered. The paycheck funds the passion project. Not the other way around.",
        "tags": "career advice passion vs money skills first career money mindset career strategy",
        "pexels_search": "career growth skills development money success"
    }
}

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
    r = subprocess.run(["ffmpeg", "-y"] + args, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(f"FFmpeg error: {r.stderr[-300:]}")

def get_duration(path):
    out = subprocess.run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
                         capture_output=True, text=True)
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

def scale_pad(inp, out, dur):
    run_ffmpeg(["-ss", "0", "-t", str(dur), "-i", str(inp),
                "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-r", "30", str(out)])

results = []

for sid, info in SCRIPTS.items():
    sp = SCRIPTS_DIR / f"{sid}.json"
    if not sp.exists():
        log(sid, "No script, skip"); results.append({"id": sid, "status": "skip"}); continue

    with open(sp, "r", encoding="utf-8") as f:
        sd = json.load(f)

    out_vid = OUTPUT_DIR / f"{sid}.mp4"
    if out_vid.exists() and out_vid.stat().st_size > 100_000:
        log(sid, f"Exists ({out_vid.stat().st_size//1024}KB), skip")
        results.append({"id": sid, "status": "exists", "size": out_vid.stat().st_size}); continue

    text = info["text"]
    search_q = info["pexels_search"]

    log(sid, f"Starting: {sd.get('title', '')[:50]}")
    c1t = TEMP / f"{sid}_c1t.mp4"; c2t = TEMP / f"{sid}_c2t.mp4"
    vid = TEMP / f"{sid}_v.mp4"; tts = TEMP / f"{sid}_tts.mp3"

    try:
        vids = search_pexels(search_q)
        log(sid, f"Pexels: {len(vids)} videos")
        if not vids: raise RuntimeError("No videos found")

        vf1 = get_best_clip(vids[:3])
        c1_raw = TEMP / f"{sid}_c1.mp4"
        curl_download(vf1["link"], str(c1_raw))
        log(sid, f"Clip1: {vf1['width']}x{vf1['height']}")

        # Try a second different search for clip 2
        vids2 = search_pexels("laptop learning course skill " + search_q.split()[0])
        vf2 = get_best_clip(vids2[:3]) if vids2 else get_best_clip(vids)
        c2_raw = TEMP / f"{sid}_c2.mp4"
        curl_download(vf2["link"], str(c2_raw))
        log(sid, f"Clip2: {vf2['width']}x{vf2['height']}")

        CLIP_DUR = 3.0
        scale_pad(c1_raw, c1t, CLIP_DUR)
        scale_pad(c2_raw, c2t, CLIP_DUR)

        lst = TEMP / f"{sid}_lst.txt"
        lst.write_text(f"file '{c1t.as_posix()}'\nfile '{c2t.as_posix()}'")
        run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(vid)])

        log(sid, "gTTS...")
        gTTS(text=text[:500], lang="en", slow=False).save(str(tts))
        log(sid, f"TTS: {tts.stat().st_size//1024}KB")

        dur = get_duration(vid)
        tts_trim = TEMP / f"{sid}_tts_trim.mp3"
        run_ffmpeg(["-i", str(tts), "-t", str(dur), "-c:a", "copy", str(tts_trim)])
        run_ffmpeg(["-i", str(vid), "-i", str(tts_trim), "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", str(out_vid)])

        sz = out_vid.stat().st_size
        log(sid, f"DONE: {sz//1024}KB")

        # Update script JSON
        sd["status"] = "produced"
        sd["video_path"] = f"output_topic/videos/{sid}.mp4"
        sd["generated_at"] = "2026-03-30T06:50:00+07:00"
        with open(sp, "w", encoding="utf-8") as f:
            json.dump(sd, f, indent=2)

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