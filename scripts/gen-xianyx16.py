#!/usr/bin/env python3
"""Generate XIANYX-16 Trieu Tien Episode 4 - Pexels + gTTS + FFmpeg."""
import os, sys, json, subprocess, shutil, re
from pathlib import Path
from urllib.parse import quote
from gtts import gTTS
import requests
import datetime

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
SCRIPTS_DIR = ROOT / "scripts" / "pending" / "xianxia"
OUTPUT_DIR = ROOT / "output_topic" / "videos"
TEMP = ROOT / "output" / "_temp_xianyx16"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)

SHOT_QUERIES = [
    "ancient chinese temple foggy dawn warriors standing",      # Shot 1: Dawn temple, frozen army
    "warrior woman sword close duel stance",                     # Shot 2: Close-up, sword drawn, warrior
    "martial arts fight training dramatic dark",                 # Shot 3: Duel, combat, martial arts
    "water splash blood red dramatic closeup",                  # Shot 4: Extreme close-up, blood, locked blades
    "army soldiers kneeling warriors standing temple",           # Shot 5: Army kneeling, solitary warrior, dawn
]

def log(*a): print("[XIANYX-16]", *a)

def search_pexels(query):
    q = quote(query)
    url = f"https://api.pexels.com/videos/search?query={q}&per_page=8&orientation=portrait"
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

def curl_download(url, path):
    r = requests.get(url, stream=True, headers={"Authorization": PEXELS_KEY}, timeout=60)
    r.raise_for_status()
    with open(path, "wb") as f:
        for chunk in r.iter_content(chunk_size=65536):
            f.write(chunk)

def run_ffmpeg(args, timeout=180):
    r = subprocess.run([FFMPEG, "-y"] + args, capture_output=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-500:]}")

def get_duration(path):
    out = subprocess.run([FPROBE, "-v", "quiet", "-print_format", "json", "-show_format", str(path)], capture_output=True, text=True)
    return float(json.loads(out.stdout)["format"]["duration"])

# Load script
script_path = SCRIPTS_DIR / "XIANYX-16.json"
with open(script_path, "r", encoding="utf-8") as f:
    raw = f.read()
fixed = re.sub(r',(\s*[}\]])', r'\1', raw)
script = json.loads(fixed)

shots = script["shots"]
log(f"Script: {script['title']}")

# Step 1: Generate 5 clips (each 6s)
clip_paths = []
for shot in shots:
    i = shot["shot_number"]
    cid = f"shot_{i}"
    out_clip = TEMP / f"{cid}.mp4"
    log(f"--- {cid} ---")
    if out_clip.exists() and out_clip.stat().st_size > 200_000:
        log(f"  Exists ({out_clip.stat().st_size//1024}KB), skip")
        clip_paths.append(out_clip)
        continue

    vid_path = TEMP / f"{cid}_v.mp4"
    clip_path = TEMP / f"{cid}_c.mp4"

    try:
        query = SHOT_QUERIES[i - 1]
        log(f"  Pexels: {query}")
        videos = search_pexels(query)
        clip_file = get_best_clip(videos)
        if not clip_file:
            log(f"  No clip found, trying fallback query...")
            fallback_queries = ["foggy forest dark dramatic", "ancient building ruins", "warrior silhouette sword"]
            for fbq in fallback_queries:
                videos = search_pexels(fbq)
                clip_file = get_best_clip(videos)
                if clip_file:
                    break
        if not clip_file:
            log(f"  ERROR: No clip found for {cid}")
            continue
        log(f"  Video ID: {clip_file.get('id')}")
        curl_download(clip_file["link"], str(vid_path))
        vid_dur = get_duration(str(vid_path))
        clip_dur = shot.get("duration", 6)
        start_time = max(0, vid_dur / 2 - clip_dur / 2)
        run_ffmpeg([
            "-ss", str(start_time), "-i", str(vid_path),
            "-t", str(clip_dur),
            "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1",
            "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-r", "30",
            str(clip_path)
        ])
        log(f"  Clipped: {clip_path.stat().st_size//1024}KB, {get_duration(str(clip_path)):.1f}s")
        shutil.copy2(str(clip_path), str(out_clip))
        clip_paths.append(out_clip)
        log(f"  DONE!")
        for fp in [vid_path, clip_path]:
            if fp.exists(): fp.unlink()
    except Exception as e:
        log(f"  ERROR: {e}")

if not clip_paths:
    log("ERROR: No clips generated")
    sys.exit(1)

# Pad to 5 clips if needed
while len(clip_paths) < 5:
    clip_paths.append(clip_paths[-1])
    log(f"  Padded clip {len(clip_paths)}")

# Step 2: Concat with RE-ENCODE (not stream copy - fixes -t trim issue)
log(f"Assembling {len(clip_paths)} clips with re-encode...")
concat_list = TEMP / "lst.txt"
list_content = "\n".join(f"file '{p.as_posix()}'" for p in clip_paths)
concat_list.write_text(list_content, encoding="utf-8")
concat_vid = TEMP / "concat.mp4"
run_ffmpeg([
    "-f", "concat", "-safe", "0", "-i", str(concat_list),
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-c:a", "aac",
    str(concat_vid)
])
concat_dur = get_duration(str(concat_vid))
log(f"Concatenated: {concat_vid.stat().st_size//1024}KB, {concat_dur:.1f}s")

# Step 3: TTS (Vietnamese)
full_narration = script["audio"]["narration"]
log(f"Full narration: {len(full_narration)} chars")
tts_parts = []
for start in range(0, len(full_narration), 480):
    chunk = full_narration[start:start+480]
    chunk_path = TEMP / f"tts_chunk_{start//480}.mp3"
    gTTS(text=chunk, lang="vi", slow=False).save(str(chunk_path))
    tts_parts.append(chunk_path)
tts_list = TEMP / "tts_lst.txt"
tts_list.write_text("\n".join(f"file '{p.as_posix()}'" for p in tts_parts))
tts_combined = TEMP / "tts_combined.mp3"
run_ffmpeg(["-f", "concat", "-safe", "0", "-i", str(tts_list), "-c", "copy", str(tts_combined)])
log(f"TTS combined: {tts_combined.stat().st_size//1024}KB, {get_duration(str(tts_combined)):.1f}s")

# Trim TTS to video duration
tts_trim = TEMP / "tts_trim.mp3"
run_ffmpeg(["-i", str(tts_combined), "-t", str(concat_dur), "-c:a", "copy", str(tts_trim)])
log(f"TTS trimmed to {concat_dur:.1f}s")

# Step 4: Final mux
final_output = OUTPUT_DIR / "XIANYX-16.mp4"
run_ffmpeg(["-i", str(concat_vid), "-i", str(tts_trim), "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", str(final_output)])
final_dur = get_duration(str(final_output))
log(f"FINAL: {final_output.stat().st_size//1024}KB, {final_dur:.1f}s")

# Update script
script["status"] = "produced"
script["videoFile"] = str(final_output)
script["produced_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
with open(script_path, "w", encoding="utf-8") as f:
    json.dump(script, f, indent=2, ensure_ascii=False)
log("Script updated: status=produced")

# Cleanup
for fp in tts_parts + [tts_combined, tts_trim, concat_vid, concat_list, tts_list]:
    try:
        if fp.exists(): fp.unlink()
    except: pass
for fp in list(TEMP.glob("shot_*")):
    try: fp.unlink()
    except: pass

log("DONE!")
