"""
XIANYX-39: Thanh Van Mon Episode 8: The Two Butterflies
TikTok-only mode. 5 shots x 6s = 30s. Pexels fallback (Hailuo broken).
Output: output_topic/videos/XIANYX-39.mp4
"""
import requests, json, os, sys, re
import subprocess
from pathlib import Path

BASE = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
SCRIPTS_DIR = BASE / "scripts" / "pending" / "xianxia"
OUTPUT_DIR = BASE / "output_topic" / "videos"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR = Path("C:/tmp/openclaw/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

FFMPEG = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe"

# Pexels clips for each shot - ethereal, jade, bamboo, butterfly, freed soul themes
SHOT_QUERIES = [
    "ethereal bamboo forest dusk fireflies glowing",
    "two people facing each other emotional scene",
    "butterfly landing on glowing jade crystal",
    "hope tears face transformation close up",
    "bamboo forest light rays magical emergence",
]

def search_pexels(query, per_page=5):
    api_key = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
    resp = requests.get("https://api.pexels.com/videos/search",
        params={"query": query, "per_page": per_page},
        headers={"Authorization": api_key}, timeout=15)
    if resp.status_code != 200:
        print(f"  Pexels error {resp.status_code}: {resp.text[:200]}")
        return []
    data = resp.json()
    return data.get("videos", []) or []

def download_pexels(video, clip_path):
    video_files = video.get("video_files", [])
    # Find best: portrait/mobile first, then 1080x1920 or close
    candidates = []
    for vf in video_files:
        w = vf.get("width", 0)
        h = vf.get("height", 0)
        link = vf.get("link", "")
        if w and h and link and w >= 720:
            # Prefer portrait-ish or close to portrait
            if h > w:  # portrait
                candidates.append((h * w, -abs(h - w), vf))
            else:
                candidates.append((h * w, abs(h - w), vf))
    if not candidates:
        # fallback: first with link
        for vf in video_files:
            link = vf.get("link", "")
            if link:
                candidates.append((0, 0, vf))
                break
    if not candidates:
        return False
    candidates.sort()
    best = candidates[0][2]
    dl_url = best["link"]
    print(f"  Downloading: {dl_url[:80]}...")
    try:
        r = requests.get(dl_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30, stream=True)
        if r.status_code == 200:
            with open(clip_path, 'wb') as f:
                for chunk in r.iter_content(65536):
                    f.write(chunk)
            return True
    except Exception as e:
        print(f"  Download error: {e}")
    return False

def get_duration(path):
    result = subprocess.run([
        FFMPEG, "-i", str(path), "-f", "null", "-"
    ], capture_output=True, text=True)
    out = result.stderr
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", out)
    if m:
        return float(m.group(1))*3600 + float(m.group(2))*60 + float(m.group(3))
    return 6.0

def main():
    print("=== XIANYX-39 Production ===")
    
    clips_info = []
    for i, query in enumerate(SHOT_QUERIES):
        shot_num = i + 1
        clip_path = UPLOAD_DIR / f"XIANYX-39_shot{shot_num}.mp4"
        print(f"\nShot {shot_num}: {query}")
        
        videos = search_pexels(query)
        if not videos:
            print("  No results, trying alternate...")
            videos = search_pexels("ethreal fantasy forest magical")
        
        downloaded = False
        if videos:
            # Try first 3 videos
            for v in videos[:3]:
                if download_pexels(v, clip_path):
                    dur = get_duration(clip_path)
                    size = os.path.getsize(clip_path)
                    print(f"  OK: {size/1024/1024:.1f}MB, {dur:.1f}s")
                    clips_info.append((shot_num, clip_path, dur, size))
                    downloaded = True
                    break
        
        if not downloaded:
            print(f"  FAILED: could not download clip for shot {shot_num}")
            # Use placeholder black
            clip_path = UPLOAD_DIR / f"XIANYX-39_shot{shot_num}.mp4"
            subprocess.run([FFMPEG, "-f", "lavfi", "-i", f"color=c=black:s=1080x1920:d=6",
                "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d=6",
                "-shortest", "-y", str(clip_path)], capture_output=True)
            clips_info.append((shot_num, clip_path, 6.0, 50000))
    
    # Trim to 6s each
    print("\n=== Trimming to 6s each ===")
    trimmed = []
    for shot_num, clip_path, dur, size in clips_info:
        out = UPLOAD_DIR / f"XIANYX-39_shot{shot_num}_t.mp4"
        print(f"  Shot {shot_num}: {dur:.1f}s -> 6s")
        subprocess.run([FFMPEG, "-i", str(clip_path), "-t", "6",
            "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-an", "-y", str(out)], capture_output=True)
        trimmed.append(out)
    
    # Concat with filter_complex (avoids concat demuxer -t bug)
    print("\n=== Concatenating ===")
    concat_list = UPLOAD_DIR / "XIANYX-39_concat.txt"
    with open(concat_list, 'w') as f:
        for t in trimmed:
            f.write(f"file '{t.as_posix()}'\n")
    
    # Actually use filter_complex to avoid -t bug in concat demuxer
    filter_str = ""
    for i in range(len(trimmed)):
        filter_str += f"[{i}:v]trim=start=0:duration=6,setpts=PTS-STARTPTS,scale=1080:1920[v{i}];"
    filter_str += "".join([f"[v{i}]" for i in range(len(trimmed))]) + f"concat=n={len(trimmed)}:v=1:a=0[outv]"
    
    concat_video = UPLOAD_DIR / "XIANYX-39_concat_raw.mp4"
    cmd = [FFMPEG, "-y"]
    for t in trimmed:
        cmd += ["-i", str(t)]
    cmd += ["-filter_complex", filter_str, "-map", "[outv]",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", str(concat_video)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"FFmpeg concat error: {result.stderr[-500:]}")
        # fallback
        result = subprocess.run([
            FFMPEG, "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-y", str(concat_video)
        ], capture_output=True, text=True)
    
    # TTS narration
    print("\n=== TTS Narration ===")
    try:
        from gtts import gTTS
        narration = """Three months of peace. The jade bracelet glowed gentle green on her wrist — no longer a cage — a companion. She sat in the bamboo forest at dusk when a young girl stumbled into the clearing. Thin. Exhausted. Wearing jade ornaments — exactly the same shade of emerald as the ones that had trapped her for two hundred years. And in the jade — a trapped soul. Thanh Van Mon's face went white. She knew exactly what this girl carried. 'You're like me — aren't you?' The jade glowed brighter — responding to HER — to the fact that someone had survived. She stood frozen — her hand trembling. She had nearly died breaking her own curse. Breaking another's might kill her. But she could not walk away from someone wearing the same cage she had escaped. Because in that jade cage — she saw herself. A butterfly landed on the girl's jade ornament — drawn to it the way one had landed on her hairpin years ago. And Thanh Van Mon understood — the real power was never technique. It was CONNECTION. Showing the girl that survival was possible. She held up her jade bracelet — proof of survival — beside the girl's trapped jade. 'I wore jade like yours — for two hundred years — I survived.' One sentence. The girl's face transformed — hope, tears — the realization that someone understood what she was going through. The jade cracked — emerald light flooding out — and a second butterfly rose from the broken cage."""
        tts = gTTS(text=narration, lang='en', slow=False)
        tts_path = UPLOAD_DIR / "XIANYX-39_tts.mp3"
        tts.save(str(tts_path))
        print(f"  TTS saved: {os.path.getsize(tts_path)/1024:.0f}KB")
    except Exception as e:
        print(f"  TTS error: {e}")
        # Silent audio fallback
        tts_path = UPLOAD_DIR / "XIANYX-39_tts.mp3"
        subprocess.run([FFMPEG, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d=30",
            "-y", str(tts_path)], capture_output=True)
    
    # Get actual TTS duration
    tts_dur_result = subprocess.run([FFMPEG, "-i", str(tts_path), "2>&1"],
        capture_output=True, text=True)
    tts_m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", tts_dur_result.stderr)
    tts_dur = float(tts_m.group(1))*3600 + float(tts_m.group(2))*60 + float(tts_m.group(3)) if tts_m else 28.0
    print(f"  TTS duration: {tts_dur:.1f}s")
    
    # Mux video + audio
    print("\n=== Muxing final ===")
    final_output = OUTPUT_DIR / "XIANYX-39.mp4"
    result = subprocess.run([
        FFMPEG, "-i", str(concat_video),
        "-i", str(tts_path),
        "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        "-y", str(final_output)
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Mux error: {result.stderr[-500:]}")
    else:
        final_size = os.path.getsize(final_output)
        print(f"  SUCCESS: {final_output}")
        print(f"  Size: {final_size/1024/1024:.1f}MB")
    
    # Cleanup temp files
    for f in UPLOAD_DIR.glob("XIANYX-39_*"):
        if f != final_output:
            try:
                if f.is_file():
                    os.remove(str(f))
            except:
                pass
    
    print("\n=== DONE ===")
    return str(final_output)

if __name__ == "__main__":
    main()
