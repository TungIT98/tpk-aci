"""
XIANYX-71 to XIANYX-90 Production Script
Batch production: 20 Xianxia videos
"""
import requests
import os
import sys
import json
import re
import subprocess
from pathlib import Path
from datetime import datetime

BASE = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
SCRIPTS_DIR = BASE / "scripts" / "pending" / "xianxia"
OUTPUT_DIR = BASE / "output_topic" / "videos"
PRODUCED_DIR = BASE / "scripts" / "produced" / "xianxia"
UPLOAD_DIR = Path("C:/tmp/openclaw/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
PRODUCED_DIR.mkdir(parents=True, exist_ok=True)

FFMPEG = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe"
PEXELS_API = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"

def search_pexels(query, per_page=5):
    try:
        resp = requests.get("https://api.pexels.com/videos/search",
            params={"query": query, "per_page": per_page},
            headers={"Authorization": PEXELS_API}, timeout=15)
        if resp.status_code != 200:
            print(f"  Pexels error {resp.status_code}")
            return []
        data = resp.json()
        return data.get("videos", []) or []
    except Exception as e:
        print(f"  Pexels search error: {e}")
        return []

def download_pexels_video(video, clip_path):
    video_files = video.get("video_files", [])
    candidates = []
    for vf in video_files:
        w = vf.get("width", 0)
        h = vf.get("height", 0)
        link = vf.get("link", "")
        if w and h and link and w >= 720:
            if h > w:  # portrait
                candidates.append((h * w, -abs(h - w), vf))
            else:
                candidates.append((h * w, abs(h - w), vf))
    if not candidates:
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
    print(f"  Downloading: {dl_url[:70]}...")
    try:
        r = requests.get(dl_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=60, stream=True)
        if r.status_code == 200:
            with open(clip_path, 'wb') as f:
                for chunk in r.iter_content(65536):
                    f.write(chunk)
            return True
    except Exception as e:
        print(f"  Download error: {e}")
    return False

def get_duration(path):
    result = subprocess.run([FFMPEG, "-i", str(path), "-f", "null", "-"],
        capture_output=True, text=True, timeout=30)
    out = result.stderr
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", out)
    if m:
        return float(m.group(1))*3600 + float(m.group(2))*60 + float(m.group(3))
    return 6.0

def make_placeholder(clip_path, dur=6):
    subprocess.run([FFMPEG, "-f", "lavfi", "-i", f"color=c=black:s=1080x1920:d={dur}",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d={dur}",
        "-shortest", "-y", str(clip_path)], capture_output=True)

def process_video(video_id):
    print(f"\n{'='*60}")
    print(f"PROCESSING {video_id}")
    print(f"{'='*60}")
    
    json_path = SCRIPTS_DIR / f"{video_id}.json"
    if not json_path.exists():
        print(f"  SKIPPED: {json_path} not found!")
        return "SKIPPED"
    
    with open(json_path, 'r', encoding='utf-8') as f:
        script = json.load(f)
    
    shots = script.get("shots", [])
    print(f"  Title: {script.get('title', 'N/A')}")
    print(f"  Shots: {len(shots)}")
    
    # Step 1: Search and download clips for each shot
    clips_info = []
    for shot in shots:
        shot_num = shot.get("shot_number", 0)
        camera_query = shot.get("camera", "")
        # Clean camera query - take first 100 chars
        query = camera_query[:150] if camera_query else "mystical forest warrior"
        clip_path = UPLOAD_DIR / f"{video_id}_shot{shot_num}.mp4"
        
        print(f"\n  Shot {shot_num}: {query[:80]}")
        
        downloaded = False
        # Try Pexels with camera query
        videos = search_pexels(query)
        if not videos:
            # Try alternate queries
            alt_queries = [
                "dark mysterious dungeon ancient",
                "fantasy warrior sword battle",
                "ethereal mist forest glowing",
                "crystal cave magical light",
            ]
            for alt in alt_queries:
                videos = search_pexels(alt)
                if videos:
                    break
        
        if videos:
            for v in videos[:3]:
                if download_pexels_video(v, clip_path):
                    dur = get_duration(clip_path)
                    size = os.path.getsize(clip_path)
                    print(f"  OK: {size/1024/1024:.1f}MB, {dur:.1f}s")
                    clips_info.append((shot_num, clip_path, dur))
                    downloaded = True
                    break
        
        if not downloaded:
            print(f"  FAILED - using black placeholder")
            make_placeholder(clip_path)
            clips_info.append((shot_num, clip_path, 6.0))
    
    # Step 2: Trim to 6s and scale to 1080x1920
    print(f"\n  Trimming to 6s each...")
    trimmed = []
    for shot_num, clip_path, dur in clips_info:
        out = UPLOAD_DIR / f"{video_id}_shot{shot_num}_t.mp4"
        result = subprocess.run([FFMPEG, "-i", str(clip_path), "-t", "6",
            "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-an", "-y", str(out)], capture_output=True, timeout=60)
        if result.returncode == 0:
            trimmed.append(out)
            print(f"  Shot {shot_num}: trimmed OK")
        else:
            print(f"  Shot {shot_num}: trim failed - {result.stderr[-200:]}")
            # Make placeholder
            make_placeholder(out)
            trimmed.append(out)
    
    # Step 3: Concatenate with filter_complex
    print(f"\n  Concatenating...")
    if len(trimmed) < len(shots):
        print("  ERROR: Not enough clips")
        return False
    
    filter_str = ""
    for i in range(len(trimmed)):
        filter_str += f"[{i}:v]trim=start=0:duration=6,setpts=PTS-STARTPTS,scale=1080:1920,setsar=1[v{i}];"
    filter_str += "".join([f"[v{i}]" for i in range(len(trimmed))]) + f"concat=n={len(trimmed)}:v=1:a=0[outv]"
    
    concat_video = UPLOAD_DIR / f"{video_id}_concat_raw.mp4"
    cmd = [FFMPEG, "-y"]
    for t in trimmed:
        cmd += ["-i", str(t)]
    cmd += ["-filter_complex", filter_str, "-map", "[outv]",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", str(concat_video)]
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print(f"  Concat error: {result.stderr[-500:]}")
        # Fallback to concat demuxer
        concat_list = UPLOAD_DIR / f"{video_id}_concat.txt"
        with open(concat_list, 'w') as f:
            for t in trimmed:
                f.write(f"file '{t.as_posix()}'\n")
        result = subprocess.run([FFMPEG, "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-y", str(concat_video)],
            capture_output=True, text=True, timeout=120)
    
    if result.returncode == 0:
        print(f"  Concat OK: {os.path.getsize(concat_video)/1024/1024:.1f}MB")
    else:
        print(f"  Concat failed: {result.stderr[-300:]}")
        return False
    
    # Step 4: TTS narration
    print(f"\n  TTS narration...")
    narration_parts = []
    for shot in shots:
        narration_parts.append(shot.get("narration", ""))
    narration_text = " — ".join(narration_parts)
    
    tts_path = UPLOAD_DIR / f"{video_id}_tts.mp3"
    try:
        from gtts import gTTS
        tts = gTTS(text=narration_text, lang='en', slow=False)
        tts.save(str(tts_path))
        print(f"  TTS saved: {os.path.getsize(tts_path)/1024:.0f}KB")
    except Exception as e:
        print(f"  TTS error: {e} - using silent audio")
        subprocess.run([FFMPEG, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d=30",
            "-y", str(tts_path)], capture_output=True)
    
    # Step 5: Mux video + audio
    print(f"\n  Muxing final video...")
    final_output = OUTPUT_DIR / f"{video_id}.mp4"
    result = subprocess.run([
        FFMPEG, "-i", str(concat_video),
        "-i", str(tts_path),
        "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        "-y", str(final_output)
    ], capture_output=True, text=True, timeout=120)
    
    if result.returncode != 0:
        print(f"  Mux error: {result.stderr[-500:]}")
        return False
    
    final_size = os.path.getsize(final_output)
    print(f"  SUCCESS: {final_output}")
    print(f"  Size: {final_size/1024/1024:.1f}MB")
    
    # Step 6: Cleanup temp files
    for f in UPLOAD_DIR.glob(f"{video_id}_*"):
        try:
            if f.is_file():
                os.remove(str(f))
        except:
            pass
    
    # Step 7: Update JSON status and save to produced
    script["status"] = "produced"
    produced_path = PRODUCED_DIR / f"{video_id}.json"
    with open(produced_path, 'w', encoding='utf-8') as f:
        json.dump(script, f, ensure_ascii=False, indent=2)
    
    # Remove from pending
    try:
        os.remove(str(json_path))
    except:
        pass
    
    return str(final_output)

def main():
    # 71-74 already produced, process 75-90
    video_ids = [f"XIANYX-{i}" for i in range(75, 91)]
    
    results = []
    for vid in video_ids:
        try:
            result = process_video(vid)
            if result == "SKIPPED":
                results.append((vid, "SKIPPED", 0))
            elif result:
                size = os.path.getsize(result) if os.path.exists(result) else 0
                results.append((vid, result, size))
            else:
                results.append((vid, "FAILED", 0))
        except Exception as e:
            print(f"  EXCEPTION: {e}")
            results.append((vid, f"ERROR: {e}", 0))
    
    print(f"\n{'='*60}")
    print("PRODUCTION COMPLETE - SUMMARY")
    print(f"{'='*60}")
    for vid, path, size in results:
        if path == "SKIPPED":
            status = "SKIPPED (already produced or missing)"
        elif size > 0:
            status = f"OK ({size/1024/1024:.1f}MB)"
        else:
            status = str(path)
        print(f"  {vid}: {status}")
    
    # Save summary
    summary_path = BASE / "output_topic" / "videos" / "xianyx75-90_summary.txt"
    with open(summary_path, 'w') as f:
        f.write(f"XIANYX-71 to XIANYX-90 Production Summary\n")
        f.write(f"Generated: {datetime.now()}\n\n")
        for vid, path, size in results:
            if path == "SKIPPED":
                status = "SKIPPED (already produced or missing)"
            elif size > 0:
                status = f"OK ({size/1024/1024:.1f}MB)"
            else:
                status = str(path)
            f.write(f"{vid}: {status}\n")
    print(f"\nSummary saved to: {summary_path}")

if __name__ == "__main__":
    main()
