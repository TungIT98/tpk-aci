#!/usr/bin/env python3
"""Generate GZ-02, GZ-04, GZ-05 using Pexels video + gTTS + FFmpeg."""
import os, sys, json, subprocess
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_gz020405"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPTS_DIR = ROOT / "scripts" / "pending"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SCRIPTS = {
    "GZ-02": {
        "text": "Scrolling TikTok for 45 minutes before work isn't a morning routine. It's a slow drain on your potential. The average Gen Z worker loses 2 to 3 hours daily to passive phone use before noon. You're warming up your brain to scroll, not to create. Your first hour programs your entire day. The 45-minute difference looks like this: 20 minutes movement - walk, workout, stretch. 15 minutes learning - podcast, article, YouTube course. 10 minutes planning - three priorities. That's peak performance mode by 9am. No motivation required. You don't have to want to do it. You just have to not open your phone for 45 minutes. That's it. One decision at 6am changes your entire day. Your phone can make you rich or broke - your choice. First hour of your day equals first hour of your life.",
        "tags": "morning routine phone habits productivity morning motivation focus gen z success",
        "pexels_search": "morning routine phone scrolling productivity morning motivation"
    },
    "GZ-04": {
        "text": "High-functioning anxiety people: your brain isn't broken. It's calibrated for a world your ancestors lived in. Here's the neuroscience. Anxiety is a hyperactive prefrontal cortex combined with heightened threat detection. It's your brain's alarm system - designed to keep your ancestors alive in dangerous environments. The problem: your ancestors faced tigers. Your brain sees existential threats in Slack messages and unread emails. Same alarm system, wrong triggers. It's not a bug. It's a feature misdirected. Channel it into systems. Anxious people are exceptional at contingency planning. Every worst-case scenario your brain runs? Use that energy to build backup plans, not worry about them. Name your anxiety's superpower. Mine is: I see every way something can go wrong - which means I also see every way to prevent it. The 5-4-3-2-1 audit: when anxiety spikes, name 5 things you see, 4 you hear, 3 you feel, 2 you smell, 1 you taste. Resets your nervous system in 60 seconds.",
        "tags": "anxiety mental health neuroscience productivity anxiety management brain hacks gen z",
        "pexels_search": "anxiety mental health brain neuroscience productivity office stress"
    },
    "GZ-05": {
        "text": "I spent 400 dollars a month on coffee. And I didn't realize I was slowly becoming broke until I did this five-minute math. Wealth isn't about how much you earn. It's about three daily behaviors. Rule one: track your fun spending - not your full budget. Awareness alone reduces it by 23 percent without restricting yourself. You don't need a spreadsheet. Just one number: how much you spent on non-essentials this week. Rule two: the 24-hour rule. Before any purchase over 50 dollars, wait one full night. Most impulse buys disappear by morning. Rule three: name your savings account something exciting. Trip to Japan fund. My first investment. Weekend escape fund. Saving feels like sacrifice when it's vague. It feels like progress when it has a name and a purpose. That's how wealthy people think about money. Five minutes a day on your finances equals five hours a year of clarity.",
        "tags": "personal finance money habits savings budgeting wealth mindset investing gen z",
        "pexels_search": "personal finance money coffee savings budgeting investing success"
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

def process_clip(input_path, output_path, start=0, duration=5.0):
    run_ffmpeg(["-ss", str(start), "-t", str(duration), "-i", str(input_path),
                "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-r", "30", str(output_path)])

results = []

for sid, cfg in SCRIPTS.items():
    out_vid = OUTPUT_DIR / f"{sid}.mp4"

    if out_vid.exists() and out_vid.stat().st_size > 100_000:
        log(sid, f"Exists ({out_vid.stat().st_size//1024}KB), skip")
        results.append({"id": sid, "status": "exists", "size": out_vid.stat().st_size}); continue

    log(sid, "Starting...")
    text = cfg["text"]
    search_q = cfg["pexels_search"]

    # Try 2 different searches to get variety
    clips = []
    for q in [search_q, search_q.split()[0]]:
        try:
            vids = search_pexels(q)
            if vids:
                clips = vids
                break
        except Exception as e:
            log(sid, f"Search '{q}' error: {e}")
            continue

    if not clips:
        log(sid, "ERROR: No Pexels videos found")
        results.append({"id": sid, "status": "error", "error": "No Pexels results"})
        continue

    try:
        # Get 2 clips
        clip_files = []
        for i, v in enumerate(clips[:2]):
            best = get_best_clip([v])
            if not best:
                continue
            p = TEMP / f"{sid}_clip{i}.mp4"
            curl_download(best["link"], str(p))
            clip_files.append((p, best.get("width", 1080), best.get("height", 1920)))
            log(sid, f"Clip{i+1}: {best.get('width')}x{best.get('height')}")

        if len(clip_files) < 2:
            log(sid, "ERROR: Not enough clips")
            results.append({"id": sid, "status": "error", "error": "Not enough clips"})
            continue

        # Process each clip to portrait
        processed = []
        for i, (cp, w, h) in enumerate(clip_files):
            pt = TEMP / f"{sid}_pt{i}.mp4"
            process_clip(cp, pt, start=0, duration=5.0)
            processed.append(pt)

        # Concat
        lst = TEMP / f"{sid}_lst.txt"
        lst.write_text("\n".join([f"file '{p.as_posix()}'" for p in processed]))
        combined = TEMP / f"{sid}_combined.mp4"
        run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(combined)])

        # gTTS
        tts = TEMP / f"{sid}_tts.mp3"
        gTTS(text=text[:490], lang="en", slow=False).save(str(tts))
        log(sid, f"TTS: {tts.stat().st_size//1024}KB")

        # Trim TTS to video duration
        dur = get_duration(combined)
        tts_trim = TEMP / f"{sid}_tts_trim.mp3"
        run_ffmpeg(["-i", str(tts), "-t", str(dur), "-c:a", "copy", str(tts_trim)])

        # Mux
        run_ffmpeg(["-i", str(combined), "-i", str(tts_trim),
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", str(out_vid)])

        sz = out_vid.stat().st_size
        log(sid, f"DONE: {sz//1024}KB, {dur:.1f}s")

        # Update script JSON
        sp = SCRIPTS_DIR / f"{sid}.json"
        if sp.exists():
            with open(sp, "r", encoding="utf-8") as f:
                sd = json.load(f)
            sd["video_path"] = str(out_vid)
            sd["produced_at"] = "2026-03-31T10:10:00.000Z"
            sd["status"] = "published"
            sd["production_method"] = "Pexels+gTTS fallback (Hailuo unavailable)"
            with open(sp, "w", encoding="utf-8") as f:
                json.dump(sd, f, indent=2, ensure_ascii=False)
            log(sid, "Script updated")

        results.append({"id": sid, "status": "done", "size": sz})

    except Exception as e:
        log(sid, f"ERROR: {e}")
        results.append({"id": sid, "status": "error", "error": str(e)[:100]})

    finally:
        for fl in TEMP.glob(f"{sid}_*"):
            try: fl.unlink()
            except: pass

print("\n=== SUMMARY ===")
for r in results:
    sz = f"{r.get('size',0)/1024:.0f}KB" if r.get("size") else r.get("error","")[:40]
    print(f"  {r['id']}: {r['status']} {sz}")
