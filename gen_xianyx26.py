#!/usr/bin/env python3
"""Generate XIANYX-26: Trieu Tien Episode 6: The Patriarch's Arrival"""
import os, json, subprocess, urllib.parse, time
import requests
from pathlib import Path

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_xianyx26"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"

TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def log(msg):
    print(f"[XIANYX-26] {msg}")

def curl_get_json(url):
    resp = requests.get(url, headers={"Authorization": PEXELS_KEY}, timeout=30)
    return resp.json()

def curl_download(url, path):
    resp = requests.get(url, headers={"Authorization": PEXELS_KEY}, timeout=60, stream=True)
    with open(path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

def search_pexels(query, orientation="portrait"):
    q = urllib.parse.quote(query)
    url = f"https://api.pexels.com/videos/search?query={q}&per_page=5&orientation={orientation}"
    return curl_get_json(url).get("videos", [])

def get_best_clip_url(videos):
    for v in videos:
        for f in v.get("video_files", []):
            if f.get("quality") == "hd" and f.get("height", 0) >= 720:
                return f.get("link")
    if videos and videos[0].get("video_files"):
        return videos[0]["video_files"][0].get("link")
    return None

def get_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
        capture_output=True, text=True
    )
    try:
        return float(json.loads(out.stdout)["format"]["duration"])
    except:
        return 6.0

def run_ffmpeg(args, timeout=120):
    result = subprocess.run(["ffmpeg", "-y"] + args,
                          capture_output=True, timeout=timeout)
    if result.returncode != 0:
        log(f"FFmpeg error: {result.stderr.decode('utf-8', errors='replace')[-300:]}")
    return result.returncode == 0

def minimax_tts(text, output_path, speed=1.0):
    """Generate TTS using gTTS (Vietnamese)."""
    from gtts import gTTS
    lang = "vi"
    tts = gTTS(text=text, lang=lang, slow=False)
    tts.save(str(output_path))
    log(f"TTS saved: {output_path.stat().st_size//1024}KB")

def download_clip(query, output_path, orientation="portrait"):
    """Download best Pexels clip matching query."""
    if output_path.exists() and output_path.stat().st_size > 100_000:
        log(f"  Already exists: {output_path.name}")
        return True
    videos = search_pexels(query, orientation)
    if not videos:
        log(f"  No results for: {query[:50]}")
        return False
    url = get_best_clip_url(videos)
    if not url:
        log(f"  No suitable clip for: {query[:50]}")
        return False
    log(f"  Downloading: {query[:50]} -> {output_path.name}")
    try:
        curl_download(url, str(output_path))
        return output_path.exists() and output_path.stat().st_size > 100_000
    except Exception as e:
        log(f"  Download failed: {e}")
        return False

# Shot descriptions for XIANYX-26
shot_queries = [
    "ancient chinese temple dawn disciples practicing martial arts",  # Shot 1: temple + disciples
    "old master elderly warrior descending clouds mystical",            # Shot 2: patriarch arrives
    "dark figure silhouette evil emperor throne ancient",               # Shot 3: patriarch identity reveal
    "warrior woman sword fighting battle crimson energy",               # Shot 4: temple battlefield
    "woman warrior golden light transcend battle epic",                 # Shot 5: transcendent confrontation
]

# Narration text
narration = """Trong những ngày sau khi Đại Trưởng Lão bị đánh bại, tin đồn lan đi. Thánh Đường Kiếm Thánh không còn là đống hoang tàn. Nó đã trở thành nơi tu hành — nơi những đồ đệ chạy trốn khỏi các phe phái tham nhũng đến học kiếm pháp chân chính. Nhưng khi bình minh vừa ló dạng trên ngọn núi thiêng, một bóng người từ trên trời hạ xuống như thiên thần báo tử. Đó là lão tổ của lão tổ của lão tổ — người đã ra lệnh xử tử cha cô ba trăm năm trước. Trong tay ông ta: thanh kiếm nguyên bản của cha cô. Ông ta đến để tiêu diệt tất cả những gì cô đã xây dựng. Và cô — người đã trở thành Kiếm Thánh — phải đối mặt với kẻ đã giết cha mình."""

output_file = OUTPUT_DIR / "XIANYX-26.mp4"

# === Process ===
script_id = "XIANYX-26"

if output_file.exists() and output_file.stat().st_size > 1_000_000:
    log(f"Already exists: {output_file.stat().st_size//1024}KB - skipping")
else:
    # Download clips
    clip_paths = []
    for i, query in enumerate(shot_queries):
        clip_path = TEMP / f"{script_id}_clip{i+1}.mp4"
        ok = download_clip(query, clip_path)
        if ok:
            clip_paths.append(clip_path)
        else:
            log(f"  Using black frame fallback for shot {i+1}")
            black = TEMP / f"{script_id}_black{i+1}.mp4"
            run_ffmpeg(["-f", "lavfi", "-i", f"color=black:s=720x1280:d=6", "-c:v", "libx264", "-t", "6", "-pix_fmt", "yuv420p", str(black)], timeout=30)
            clip_paths.append(black)
        time.sleep(0.5)
    
    # Trim clips to 6s each
    trimmed = []
    for i, cp in enumerate(clip_paths):
        tp = TEMP / f"{script_id}_trim{i+1}.mp4"
        dur = get_duration(cp)
        start = max(0, (dur - 6) / 2)
        ok = run_ffmpeg([
            "-ss", str(start), "-i", str(cp), "-t", "6",
            "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
            "-an", str(tp)
        ], timeout=60)
        if ok:
            trimmed.append(tp)
        else:
            trimmed.append(cp)
    
    # Concatenate clips (RE-ENCODE to respect -t flags)
    concat_list = TEMP / f"{script_id}_concat.txt"
    with open(concat_list, "w") as f:
        for tp in trimmed:
            f.write(f"file '{tp}'\n")
    
    video_only = TEMP / f"{script_id}_video_only.mp4"
    ok = run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(concat_list),
                     "-c:v", "libx264", "-preset", "fast", "-crf", "20",
                     "-pix_fmt", "yuv420p", str(video_only)], timeout=120)
    if not ok:
        log("Concatenation failed")
    else:
        # Generate TTS
        tts_path = TEMP / f"{script_id}_tts.mp3"
        minimax_tts(narration, tts_path, speed=1.0)
        
        # Get durations
        video_dur = get_duration(video_only)
        tts_dur = get_duration(tts_path)
        target_dur = min(video_dur, tts_dur + 0.5)
        
        # Combine video + TTS
        ok = run_ffmpeg([
            "-i", str(video_only), "-i", str(tts_path),
            "-t", str(target_dur),
            "-c:v", "libx264", "-preset", "fast", "-crf", "20",
            "-c:a", "aac", "-b:a", "128k",
            "-shortest", str(output_file)
        ], timeout=120)
        
        if ok and output_file.exists() and output_file.stat().st_size > 500_000:
            log(f"DONE: {output_file.name} ({output_file.stat().st_size//1024}KB)")
        else:
            log(f"FAILED: {output_file}")
