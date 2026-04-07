#!/usr/bin/env python3
"""Generate XIANYX-08 Tru Tien Episode 2 clips using Pexels + MiniMax TTS + FFmpeg."""
import os, sys, json, subprocess, shutil
from pathlib import Path
from urllib.parse import quote
import requests

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
SCRIPT_FILE = ROOT / "scripts" / "pending" / "xianxia" / "XIANYX-08.json"
OUTPUT_DIR = ROOT / "output" / "xianxia" / "XIANYX-08"
TEMP = ROOT / "output" / "_temp_xianyx08"
FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"
MINIMAX_KEY = "sk-cp-JKcLn8JXdkygpTgwCS72isp9Zz7AswQeFdh5uKnvk0vngQHaLa6NVBOwSZ8v6xZybbPM3ck-L1UmOYff7EsliddMUK4Hk-za3N0-wUWse_Nsj--6J_n9XPw"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)

def log(cid, *a):
    print(f"[{cid}]", *a)

def run_ffmpeg(args, timeout=180):
    r = subprocess.run([FFMPEG, "-y"] + args, capture_output=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-800:]}")
    return r

def get_duration(path):
    out = subprocess.run([FPROBE, "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
                        capture_output=True, text=True, timeout=30)
    try:
        return float(json.loads(out.stdout)["format"]["duration"])
    except:
        return 6.0

def minimax_tts(text, output_path):
    """Generate TTS using MiniMax speech-2.8-hd."""
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
    if "data" not in resp or "audio" not in resp.get("data", {}):
        raise RuntimeError(f"MiniMax TTS response missing audio: {r.text[:200]}")
    audio_hex = resp["data"]["audio"]
    audio_bytes = bytes.fromhex(audio_hex)
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    return len(audio_bytes)

def search_pexels(query):
    q = quote(query)
    url = f"https://api.pexels.com/videos/search?query={q}&per_page=5&orientation=portrait"
    r = requests.get(url, headers={"Authorization": PEXELS_KEY}, timeout=30)
    r.raise_for_status()
    return r.json().get("videos", [])

def get_best_clip(videos):
    for v in videos:
        for f in v.get("video_files", []):
            if f.get("quality") == "hd" and f.get("height", 0) >= 720:
                return f
    if videos and videos[0].get("video_files"):
        return videos[0]["video_files"][0]
    return None

# Pexels search queries mapped to shots
SHOT_QUERIES = {
    1: "dark cave meditation fire glowing ember warrior",
    2: "warrior in pain fire burning agony intense",
    3: "flame erupting fire explosion dramatic intense",
    4: "ancient warrior spirit ghost fire supernatural",
    5: "man standing fire flames powerful dramatic",
}

# Fallback queries
FALLBACK_QUERIES = [
    "dark volcanic cave fire red glow",
    "warrior battle fire intense flames",
    "fire explosion dramatic cinematic flames",
    "ghost spirit ancient warrior fire",
    "man fire flames dark dramatic portrait",
]

def process_shot(shot_num, narration):
    cid = f"shot_{shot_num}"
    out_clip = OUTPUT_DIR / f"raw_{cid}.mp4"
    log(cid, f"=== Processing shot {shot_num} ===")

    # Check existing
    if out_clip.exists() and out_clip.stat().st_size > 500_000:
        log(cid, f"Exists ({out_clip.stat().st_size//1024}KB), skipping")
        return {"id": cid, "status": "exists", "size": out_clip.stat().st_size}

    vid_path = TEMP / f"{cid}_v.mp4"
    tts_path = TEMP / f"{cid}_tts.mp3"
    clip_path = TEMP / f"{cid}_c.mp4"

    try:
        # Step 1: Generate MiniMax TTS
        log(cid, f"TTS: {narration[:60]}...")
        tts_bytes = minimax_tts(narration, tts_path)
        log(cid, f"TTS saved: {tts_bytes//1024}KB")

        # Step 2: Search Pexels
        query = SHOT_QUERIES.get(shot_num, f"xianxia fantasy warrior fire shot {shot_num}")
        videos = []
        for q in [query] + FALLBACK_QUERIES:
            log(cid, f"Pexels: {q[:70]}...")
            videos = search_pexels(q)
            if videos:
                break

        if not videos:
            raise RuntimeError(f"No Pexels results for shot {shot_num}")

        clip_file = get_best_clip(videos)
        if not clip_file:
            raise RuntimeError(f"No suitable clip found")

        log(cid, f"Video ID: {clip_file.get('id')}, height: {clip_file.get('height')}")

        # Step 3: Download
        dl = requests.get(clip_file["link"], stream=True, headers={"Authorization": PEXELS_KEY}, timeout=60)
        dl.raise_for_status()
        with open(vid_path, "wb") as f:
            for chunk in dl.iter_content(chunk_size=65536):
                f.write(chunk)
        log(cid, f"Downloaded: {vid_path.stat().st_size//1024}KB")

        # Step 4: Trim to 6s portrait
        vid_dur = get_duration(vid_path)
        tts_dur = get_duration(tts_path)
        target_dur = min(6.5, max(5.5, tts_dur + 0.5))
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

        # Step 5: Mux video + TTS audio
        run_ffmpeg([
            "-i", str(clip_path),
            "-i", str(tts_path),
            "-c:v", "copy", "-c:a", "aac",
            "-shortest",
            str(out_clip)
        ])
        log(cid, f"Final: {out_clip.stat().st_size//1024}KB - DONE!")

        # Cleanup
        for fp in [vid_path, clip_path, tts_path]:
            if fp.exists():
                try: fp.unlink()
                except: pass

        return {"id": cid, "status": "done", "size": out_clip.stat().st_size}

    except Exception as e:
        log(cid, f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        for fp in [vid_path, tts_path, clip_path]:
            if fp.exists():
                try: fp.unlink()
                except: pass
        return {"id": cid, "status": "error", "error": str(e)}

# Load script
with open(SCRIPT_FILE, "r", encoding="utf-8") as f:
    script = json.load(f)

print(f"=== XIANYX-08 Clip Generation ===")
print(f"Title: {script['title']}")
print(f"Shots: {len(script['shots'])}")

results = []
for shot in script["shots"]:
    i = shot["shot_number"]
    r = process_shot(i, shot["narration"])
    results.append(r)
    print()

print("=== RESULTS ===")
for r2 in results:
    print(f"  {r2['id']}: {r2['status']} | size={r2.get('size', 'N/A')}")

done = sum(1 for r2 in results if r2["status"] in ("done", "exists"))
print(f"\n{done}/{len(results)} clips ready")

if done == len(results):
    print("\n=== ASSEMBLING FINAL VIDEO ===")
    concat_list = OUTPUT_DIR / "concat.txt"
    with open(concat_list, "w") as f:
        for shot in script["shots"]:
            i = shot["shot_number"]
            clip = OUTPUT_DIR / f"raw_shot_{i}.mp4"
            f.write(f"file '{clip.resolve()}'\n")

    concat_video = OUTPUT_DIR / "concat_raw.mp4"
    r = run_ffmpeg([
        "-f", "concat", "-safe", "0", "-i", str(concat_list),
        "-c", "copy", str(concat_video)
    ], timeout=120)
    if r.returncode != 0:
        print(f"Concat error: {r.stderr.decode()[-500:]}")
    else:
        print(f"Concatenated: {concat_video.stat().st_size//1024}KB")

    # Trim to 30s
    final = OUTPUT_DIR / "final.mp4"
    r2 = run_ffmpeg([
        "-i", str(concat_video), "-t", "30",
        "-c:v", "copy", "-c:a", "aac", "-shortest",
        str(final)
    ])
    if r2.returncode != 0:
        print(f"Trim error: {r2.stderr.decode()[-500:]}")
    else:
        print(f"Final: {final.stat().st_size//1024}KB - DONE!")
        print(f"Output: {final}")
