#!/usr/bin/env python3
"""Generate videos for pending scripts: GZ-02 to GZ-05, HGF-01 to HGF-05, PW-01 to PW-05"""
import os, sys, json, subprocess, shutil
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_gtts_pending"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPTS_DIR = ROOT / "scripts" / "pending"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Scripts to process (map script_name -> output_id)
SCRIPT_MAP = {
    "GZ-02_morning-scroll": "GZ-02",
    "GZ-03_dm-jobs": "GZ-03",
    "GZ-04_anxiety-superpower": "GZ-04",
    "GZ-05_rich-habits": "GZ-05",
    "HGF-01": "HGF-01",
    "HGF-02": "HGF-02",
    "HGF-03": "HGF-03",
    "HGF-04": "HGF-04",
    "HGF-05": "HGF-05",
    "PW-01_2-minute-rule": "PW-01",
    "PW-02_meeting-output": "PW-02",
    "PW-03_sunday-night-ritual": "PW-03",
    "PW-04_email-trap": "PW-04",
    "PW-05_90-minute-rhythm": "PW-05",
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

def get_duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                       "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
                      capture_output=True, text=True, timeout=10)
    return float(r.stdout.strip())

def get_script_text(j):
    """Extract script text from various JSON structures"""
    # Try audio.narration first
    if j.get("audio", {}).get("narration"):
        return j["audio"]["narration"]
    # Try top-level script
    if j.get("script"):
        return j["script"]
    # Try description
    if j.get("description"):
        return j["description"]
    return ""

def process_script(script_key, output_id, script_json):
    log(output_id, "Starting...")
    
    final_path = OUTPUT_DIR / f"{output_id}.mp4"
    if final_path.exists():
        log(output_id, "Already exists, skipping")
        return True

    # Get script text
    script_text = get_script_text(script_json)[:500]
    if not script_text:
        log(output_id, "ERROR: No script text found")
        return False
    
    log(output_id, f"Script text: {script_text[:60]}...")

    # Determine search query
    title = script_json.get("title", "")
    tags = script_json.get("tags", [])
    category = script_json.get("category", "")
    
    # Build search query
    search_terms = title.split()[:4]
    search_query = " ".join(search_terms)
    if not search_query or len(search_query) < 3:
        search_query = " ".join(tags[:3]) if tags else category or "lifestyle"
    
    log(output_id, f"Searching Pexels for: {search_query}")
    
    videos = search_pexels(search_query)
    if not videos:
        simpler = tags[0] if tags else (category or "lifestyle")
        log(output_id, f"Retry with: {simpler}")
        videos = search_pexels(simpler)
    
    clip = get_best_clip(videos)
    if not clip:
        log(output_id, "Trying fitness/workout...")
        videos = search_pexels("fitness workout woman athletic")
        clip = get_best_clip(videos)
    
    if not clip:
        log(output_id, "ERROR: No Pexels clip found")
        return False
    
    video_url = clip["link"]
    log(output_id, f"Downloading: {video_url}")
    
    video_path = TEMP / f"{output_id}_video.mp4"
    curl_download(video_url, video_path)
    
    # Generate TTS - handle Vietnamese vs English
    is_vietnamese = any(ord(c) > 127 for c in script_text)
    lang = "vi" if is_vietnamese else "en"
    log(output_id, f"Generating gTTS ({lang}): {script_text[:50]}...")
    
    txt_path = TEMP / f"{output_id}_text.txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(script_text)
    
    tts_path = TEMP / f"{output_id}_tts.mp3"
    try:
        tts = gTTS(text=script_text, lang=lang)
        tts.save(str(tts_path))
    except Exception as e:
        log(output_id, f"gTTS failed: {e}, trying English fallback")
        fallback = script_text[:300]
        tts = gTTS(text=fallback, lang="en")
        tts.save(str(tts_path))
    
    # Get durations
    vid_dur = get_duration(video_path)
    tts_dur = get_duration(tts_path)
    
    # Target ~6s
    target_dur = min(vid_dur, 6.0)
    log(output_id, f"Video: {vid_dur:.1f}s, TTS: {tts_dur:.1f}s, target: {target_dur:.1f}s")
    
    # Trim audio
    audio_trim = TEMP / f"{output_id}_audio_trim.mp3"
    run_ffmpeg(["-i", str(tts_path), "-t", str(target_dur), "-c", "copy", str(audio_trim)])
    
    # Mux to portrait (must re-encode video when using vf filter)
    final_path_temp = OUTPUT_DIR / f"{output_id}-FINAL.mp4"
    run_ffmpeg(["-i", str(video_path), "-i", str(audio_trim),
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac",
                "-vf", f"scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
                "-t", str(target_dur), "-shortest",
                str(final_path_temp)])
    
    # Move to final name
    if final_path_temp.exists():
        shutil.move(str(final_path_temp), str(final_path))
    
    actual_dur = get_duration(final_path)
    log(output_id, f"DONE -> {final_path} ({final_path.stat().st_size // 1024}KB, {actual_dur:.1f}s)")
    
    # Cleanup
    for p in [video_path, tts_path, txt_path, audio_trim]:
        if p.exists(): p.unlink()
    
    return True

def main():
    for script_key, output_id in SCRIPT_MAP.items():
        # Find the JSON file
        script_file = None
        for pattern in [script_key + ".json", script_key.replace("-","_") + ".json"]:
            p = SCRIPTS_DIR / pattern
            if p.exists():
                script_file = p
                break
        
        if not script_file:
            # Glob for partial match
            matches = list(SCRIPTS_DIR.glob(f"*{script_key.replace('-','_')}*.json"))
            if matches:
                script_file = matches[0]
        
        if not script_file:
            print(f"[{output_id}] JSON file not found for {script_key}")
            continue
        
        try:
            with open(script_file) as f:
                script_json = json.load(f)
            success = process_script(script_key, output_id, script_json)
            if not success:
                print(f"[{output_id}] FAILED")
        except Exception as e:
            print(f"[{output_id}] ERROR: {e}")
            import traceback; traceback.print_exc()

if __name__ == "__main__":
    main()