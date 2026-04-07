#!/usr/bin/env python3
"""Generate XIANYX-06 and XIANYX-07 videos: Pexels + MiniMax TTS + FFmpeg."""
import os, json, subprocess, urllib.parse, time
import requests
from pathlib import Path

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_xianyx06_07"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
MINIMAX_KEY = "sk-cp-JKcLn8JXdkygpTgwCS72isp9Zz7AswQeFdh5uKnvk0vngQHaLa6NVBOwSZ8v6xZybbPM3ck-L1UmOYff7EsliddMUK4Hk-za3N0-wUWse_Nsj--6J_n9XPw"

TEMP.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def log(msg):
    print(f"[XIANYX-06/07] {msg}")

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

def minimax_tts(text, output_path, voice_id="female-tianmei", speed=1.0):
    """Generate TTS using gTTS (Vietnamese)."""
    from gtts import gTTS
    lang = "vi"  # Vietnamese for xianxia content
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

def process_video(script_id, shots_searches, narration, voice_id, output_file):
    """Process a single video."""
    log(f"\n=== Processing {script_id} ===")
    
    if output_file.exists() and output_file.stat().st_size > 1_000_000:
        log(f"Already exists: {output_file.stat().st_size//1024}KB - skipping")
        return True
    
    # Download clips
    clip_paths = []
    for i, query in enumerate(shots_searches):
        clip_path = TEMP / f"{script_id}_clip{i+1}.mp4"
        ok = download_clip(query, clip_path)
        if ok:
            clip_paths.append(clip_path)
        else:
            # Fallback: use any existing clip or create black
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
    
    # Concatenate clips
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
        return False
    
    # Generate TTS
    tts_path = TEMP / f"{script_id}_tts.mp3"
    minimax_tts(narration, tts_path, voice_id=voice_id, speed=1.0)
    
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
        return True
    else:
        log(f"FAILED: {output_file}")
        return False


# === XIANYX-06: Trieu Tien E2 ===
xianyx06_searches = [
    "ancient sword stone altar glowing mystical",       # Shot 1: sword trembles
    "woman warrior crimson hanfu blood hands gripping sword",  # Shot 2: blood awakening
    "dark sword blade glowing crimson magical",       # Shot 3: sword breaks free
    "warriors soldiers charging temple steps night",  # Shot 4: soldiers charge
    "warrior woman sword strike crimson energy",      # Shot 5: the first strike
]
xianyx06_narration = "She had made her vow. And the blade — silent for three hundred years — answered. It trembled as if remembering what it was to be held by one worthy of its hunger. Three hundred years of silence. And it demanded blood to wake. She gave it freely — her palms split open on the ancient leather, and the blade tasted her oath. It was his. Her father's blade — the weapon the sect had sealed away the day they executed him. She held three hundred years of war in her trembling hands. The first soldier charged. A hundred pounds of iron and fury, screaming death at a woman in crimson silk. She did not move. Not yet. The blade was still remembering how to want blood. One strike. One dissolving soldier. And the ancient blade remembered what it had been made for — not defense. Not ceremony. War. And now — it had found its wielder once more."
xianyx06_output = OUTPUT_DIR / "XIANYX-06.mp4"

# === XIANYX-07: Dau Pha Thuong Khau E2 ===
xianyx07_searches = [
    "ruined courtyard night fog atmosphere",          # Shot 1: ruins walk
    "jade pendant glowing mystical ancient",          # Shot 2: jade pendant + tablet
    "elder white robes standing mysterious",         # Shot 3: elder arrives
    "purple violet flame fire magic darkness",       # Shot 4: violet flame strikes
    "dark figure standing ruins ash falling",        # Shot 5: aftermath + tear
]
xianyx07_narration = "One week had passed. The rain no longer touched him. He walked through the ruins of his father's sect — no longer a fallen man, but something far more dangerous walking in the skin of one. His father's name — carved in stone by the same sect that had murdered him. The jade pendant knew. It always knew who was responsible. And now — so did he. The elder arrived believing he was burying a ghost. He found instead — a grave that had learned to bite back. The violet flame burned without mercy. And it remembered everything. The elder struck with the same technique that had shattered a boy's spirit. This time — the fire answered back. And the elder finally understood what he had tried so desperately to destroy. One tear. Not for the elder who had burned his father's legacy to ash. For the father who would never see his son avenged. And then — silence. And the sound of footsteps walking deeper into the dark."
xianyx07_output = OUTPUT_DIR / "XIANYX-07.mp4"

# Process both
ok06 = process_video("XIANYX-06", xianyx06_searches, xianyx06_narration, "female-tianmei", xianyx06_output)
ok07 = process_video("XIANYX-07", xianyx07_searches, xianyx07_narration, "male-yunyang", xianyx07_output)

log(f"\n=== RESULTS ===")
log(f"XIANYX-06: {'SUCCESS' if ok06 else 'FAILED'}")
log(f"XIANYX-07: {'SUCCESS' if ok07 else 'FAILED'}")
