#!/usr/bin/env python3
"""Generate GZ-19, GZ-20 using Pexels video + gTTS + FFmpeg."""
import os, sys, json, subprocess
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_gz19"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPTS_DIR = ROOT / "scripts" / "pending"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SCRIPTS = {
    "GZ-19": {
        "text": "Fake it till you make it has a reputation problem. Half the people who say it mean lie confidently. The other half mean act as if until you become it. One of those approaches works. The other one gets you fired. Here is the framework that actually works. It has three steps: observe, adopt, integrate. Observe: find the people who have the career you want and study what they actually do, not what they say they do. Watch how they communicate, how they present ideas, how they handle uncertainty. Adopt: start acting as if you already have the attributes, even if you do not feel qualified. Not lying. Adopting the behaviors of someone who belongs. Integrate: the moment you stop feeling like an imposter and start knowing you belong — that is integration. The key to using this without imposter syndrome destroying you: fake it does not mean bluff your credentials. It means expand your behavior before your confidence catches up. Confidence is built from the outside in, not the inside out. The person who acts like they belong long enough eventually knows it for certain.",
        "pexels_search": "career growth professional development confidence workplace"
    },
    "GZ-20": {
        "text": "Not every side hustle requires investment. I built one that cost zero dollars to start and replaced my 9-to-5 income within 18 months. Let me be clear about the work involved — this is not a get-rich-quick story. It is a framework story. The business model: information arbitrage. You learn something, you package it, you sell the knowledge. Step one: find one skill you have that others want. It does not need to be impressive. It needs to be useful. Step two: document what you learn as you go. Every week, write one post about one thing you learned. Step three: after three months of content, package your best insights into a simple offer. A guide, a template, a one-hour call. Price it at 99 dollars and see who buys. The first 500 dollars usually takes three to six months. The decision point that determines whether you make it: are you willing to be uncomfortable for 18 months without giving up? Most people quit at month four. The ones who make it just decided to outlast the dip. No course. No 500 dollar investment. Just skill, consistency, and time.",
        "pexels_search": "side hustle make money online laptop work home office"
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
CLIP_DUR = 3.0

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
    c1_raw = TEMP / f"{sid}_c1.mp4"; c2_raw = TEMP / f"{sid}_c2.mp4"
    c1t = TEMP / f"{sid}_c1t.mp4"; c2t = TEMP / f"{sid}_c2t.mp4"
    vid = TEMP / f"{sid}_v.mp4"; tts = TEMP / f"{sid}_tts.mp3"

    try:
        vids = search_pexels(search_q)
        log(sid, f"Pexels: {len(vids)} videos")
        if not vids: raise RuntimeError("No videos found")

        vf1 = get_best_clip(vids[:3])
        curl_download(vf1["link"], str(c1_raw))
        log(sid, f"Clip1: {vf1['width']}x{vf1['height']}")

        vids2 = search_pexels("laptop desk work home " + search_q.split()[0])
        vf2 = get_best_clip(vids2[:3]) if vids2 else get_best_clip(vids)
        curl_download(vf2["link"], str(c2_raw))
        log(sid, f"Clip2: {vf2['width']}x{vf2['height']}")

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

        sd["status"] = "produced"
        sd["video_path"] = f"output_topic/videos/{sid}.mp4"
        sd["generated_at"] = "2026-03-30T06:55:00+07:00"
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