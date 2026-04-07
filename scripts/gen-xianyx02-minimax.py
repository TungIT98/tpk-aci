#!/usr/bin/env python3
"""Generate XIANYX-02 video clips using Pexels + MiniMax TTS + FFmpeg.
Dau Pha Thuong Khau Episode 1: The Ruins of the Falling Heavens (REVISED SCRIPT)
"""
import os, sys, json, subprocess, shutil, base64
from pathlib import Path
from urllib.parse import quote
import requests

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
SCRIPTS_DIR = ROOT / "scripts" / "pending" / "xianxia"
OUTPUT_DIR = ROOT / "outputs" / "xianxia" / "XIANYX-02"
TEMP = ROOT / "outputs" / "_temp_xianyx02"
FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"
MINIMAX_KEY = "sk-cp-JKcLn8JXdkygpTgwCS72isp9Zz7AswQeFdh5uKnvk0vngQHaLa6NVBOwSZ8v6xZybbPM3ck-L1UmOYff7EsliddMUK4Hk-za3N0-wUWse_Nsj--6J_n9XPw"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)

def log(p, *a): print(f"[{p}]", *a)

def run_ffmpeg(args):
    r = subprocess.run([FFMPEG, "-y"] + args, capture_output=True, timeout=180)
    if r.returncode != 0:
        raise RuntimeError(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-500:]}")
    return r

def get_duration(path):
    out = subprocess.run([FPROBE, "-v", "quiet", "-print_format", "json", "-show_format", str(path)], capture_output=True, text=True)
    return float(json.loads(out.stdout)["format"]["duration"])

def minimax_tts(text, output_path):
    """Generate TTS using MiniMax API with speech-2.8-hd model."""
    url = "https://api.minimax.io/v1/t2a_v2"
    headers = {"Authorization": f"Bearer {MINIMAX_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": "speech-2.8-hd",
        "text": text,
        "voice_setting": {"voice_id": "male-qn-qingse"},
        "audio_setting": {"sample_rate": 32000, "bitrate": 128000, "format": "mp3"}
    }
    r = requests.post(url, json=payload, headers=headers, timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"MiniMax TTS HTTP {r.status_code}: {r.text[:200]}")
    
    resp = r.json()
    if "data" not in resp or "audio" not in resp["data"]:
        raise RuntimeError(f"MiniMax TTS response missing audio data: {r.text[:200]}")
    
    # Audio data is returned as a hex string or base64
    audio_hex = resp["data"]["audio"]
    # Convert hex string to bytes
    audio_bytes = bytes.fromhex(audio_hex)
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    return len(audio_bytes)

# Load revised script
script_path = SCRIPTS_DIR / "XIANYX-02.json"
if not script_path.exists():
    print(f"ERROR: {script_path} not found")
    sys.exit(1)

with open(script_path, "r", encoding="utf-8") as f:
    script = json.load(f)

print(f"=== XIANYX-02 Video Production (Revised Script) ===")
print(f"Title: {script['title']}")
print(f"Shots: {len(script['shots'])}")
print(f"Total duration: {script['duration_seconds']}s")

results = []
for shot in script["shots"]:
    i = shot["shot_number"]
    cid = f"shot_{i}"
    out_clip = OUTPUT_DIR / f"raw_{cid}.mp4"
    log(cid, f"Processing shot {i}")

    # Check if existing clip is good (>500KB)
    if out_clip.exists() and out_clip.stat().st_size > 500_000:
        log(cid, f"Exists ({out_clip.stat().st_size//1024}KB), checking if has gTTS audio (regenerating with MiniMax)...")
        # Always regenerate with MiniMax TTS since that's the revision requirement
        pass

    vid_path = TEMP / f"{cid}_v.mp4"
    tts_path = TEMP / f"{cid}_tts.mp3"
    clip_path = TEMP / f"{cid}_c.mp4"

    try:
        # Step 1: Search Pexels for stock footage
        pexels_query = shot["prompt"][:150]
        log(cid, f"Pexels: {pexels_query[:80]}...")
        
        q = quote(pexels_query)
        search_url = f"https://api.pexels.com/videos/search?query={q}&per_page=5&orientation=portrait"
        r = requests.get(search_url, headers={"Authorization": PEXELS_KEY}, timeout=30)
        r.raise_for_status()
        videos = r.json().get("videos", [])
        
        if not videos:
            alt_query = "ancient ruins warrior storm epic dramatic"
            log(cid, f"No results, trying: {alt_query}")
            r = requests.get(f"https://api.pexels.com/videos/search?query={quote(alt_query)}&per_page=5&orientation=portrait",
                          headers={"Authorization": PEXELS_KEY}, timeout=30)
            videos = r.json().get("videos", [])

        # Get best clip
        clip_file = None
        for v in videos:
            for f in v.get("video_files", []):
                if f.get("quality") == "hd" and f.get("height", 0) >= 720:
                    clip_file = f
                    break
        if not clip_file and videos:
            clip_file = videos[0]["video_files"][0]
        if not clip_file:
            raise RuntimeError(f"No suitable video found")

        # Download
        log(cid, f"Downloading video ID: {clip_file.get('id')}")
        dl = requests.get(clip_file["link"], stream=True, headers={"Authorization": PEXELS_KEY}, timeout=60)
        dl.raise_for_status()
        with open(vid_path, "wb") as f:
            for chunk in dl.iter_content(chunk_size=65536):
                f.write(chunk)
        log(cid, f"Downloaded: {vid_path.stat().st_size//1024}KB")

        # Step 2: Generate MiniMax TTS
        narration = shot["narration"]
        log(cid, f"Generating MiniMax TTS: {narration[:50]}...")
        tts_bytes = minimax_tts(narration, tts_path)
        log(cid, f"MiniMax TTS: {tts_bytes//1024}KB saved")

        # Step 3: Trim video to target duration
        vid_dur = get_duration(vid_path)
        tts_dur = get_duration(tts_path)
        target_dur = min(6.5, tts_dur + 0.5)
        start_time = max(0, vid_dur / 2 - target_dur / 2)
        
        run_ffmpeg([
            "-ss", str(start_time),
            "-i", str(vid_path),
            "-t", str(target_dur),
            "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1",
            "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            str(clip_path)
        ])
        log(cid, f"Clipped: {clip_path.stat().st_size//1024}KB")

        # Step 4: Mux video + MiniMax TTS audio
        run_ffmpeg([
            "-i", str(clip_path),
            "-i", str(tts_path),
            "-c:v", "copy", "-c:a", "aac",
            "-shortest",
            str(out_clip)
        ])
        log(cid, f"Final: {out_clip.stat().st_size//1024}KB - DONE!")
        results.append({"id": cid, "status": "done", "size": out_clip.stat().st_size})

        # Cleanup temp
        for fp in [vid_path, clip_path, tts_path]:
            if fp.exists(): fp.unlink()

    except Exception as e:
        log(cid, f"ERROR: {e}")
        results.append({"id": cid, "status": "error", "error": str(e)})

print("\n=== RESULTS ===")
for r2 in results:
    print(f"  {r2['id']}: {r2['status']} | size={r2.get('size', 'N/A')}")

done = sum(1 for r2 in results if r2["status"] == "done")
print(f"\n{done}/{len(results)} clips ready")
