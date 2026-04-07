#!/usr/bin/env python3
"""Generate HGF-02 video: Pexels stock footage + gTTS Vietnamese"""
import os, sys, json, subprocess, shutil
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_hgf02"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPT_FILE = ROOT / "scripts" / "pending" / "HGF-02.json"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def log(*a): print("[HGF-02]", *a)

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
        raise RuntimeError(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-500:]}")

def get_duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                       "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
                      capture_output=True, text=True, timeout=10)
    return float(r.stdout.strip())

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

def main():
    with open(SCRIPT_FILE) as f:
        script = json.load(f)
    
    script_text = script.get("script", "") or script.get("title", "")
    if not script_text:
        log("ERROR: No script text")
        return
    
    is_vi = any(ord(c) > 127 for c in script_text)
    lang = "vi" if is_vi else "en"
    log(f"Script text: {script_text[:60]}... (lang={lang})")
    
    # Search Pexels
    queries = ["fitness workout woman athletic morning", "gym woman exercise sport", "fitness athlete training"]
    videos = []
    for q in queries:
        log(f"Searching Pexels: {q}")
        videos = search_pexels(q)
        if videos:
            break
    
    clip = get_best_clip(videos)
    if not clip:
        log("ERROR: No clip found")
        return
    
    video_url = clip["link"]
    log(f"Downloading: {video_url}")
    
    video_path = TEMP / "HGF-02_video.mp4"
    curl_download(video_url, video_path)
    log(f"Video downloaded: {video_path.stat().st_size} bytes")
    
    # gTTS
    txt_path = TEMP / "HGF-02_text.txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(script_text)
    
    tts_path = TEMP / "HGF-02_tts.mp3"
    try:
        tts = gTTS(text=script_text, lang=lang)
        tts.save(str(tts_path))
        log("gTTS generated")
    except Exception as e:
        log(f"gTTS failed: {e}")
        return
    
    # Durations
    vid_dur = get_duration(video_path)
    tts_dur = get_duration(tts_path)
    target_dur = min(vid_dur, 6.0)
    log(f"Video: {vid_dur:.1f}s, TTS: {tts_dur:.1f}s, target: {target_dur:.1f}s")
    
    # Trim audio
    audio_trim = TEMP / "HGF-02_audio_trim.mp3"
    run_ffmpeg(["-i", str(tts_path), "-t", str(target_dur), "-c", "copy", str(audio_trim)])
    
    # Mux to portrait
    final_path = OUTPUT_DIR / "HGF-02-FINAL.mp4"
    run_ffmpeg(["-i", str(video_path), "-i", str(audio_trim),
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac",
                "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
                "-t", str(target_dur), "-shortest",
                str(final_path)])
    
    actual_size = final_path.stat().st_size
    actual_dur = get_duration(final_path)
    log(f"DONE -> {final_path} ({actual_size // 1024}KB, {actual_dur:.1f}s)")
    
    # Cleanup temp
    for p in [video_path, tts_path, txt_path, audio_trim]:
        if p.exists(): p.unlink()

if __name__ == "__main__":
    main()
