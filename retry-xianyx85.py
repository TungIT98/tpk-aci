"""
Retry XIANYX-85 with better error handling and fallback strategies
"""
import requests
import os
import sys
import json
import re
import subprocess
import time
from pathlib import Path
from gtts import gTTS

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

VIDEO_ID = "XIANYX-85"

def search_pexels(query, per_page=5):
    for attempt in range(3):
        try:
            resp = requests.get("https://api.pexels.com/videos/search",
                params={"query": query, "per_page": per_page},
                headers={"Authorization": PEXELS_API}, timeout=20)
            if resp.status_code == 429:
                print(f"  Rate limited, waiting {10*(attempt+1)}s...")
                time.sleep(10 * (attempt + 1))
                continue
            if resp.status_code != 200:
                print(f"  Pexels error {resp.status_code}")
                return []
            data = resp.json()
            return data.get("videos", []) or []
        except Exception as e:
            print(f"  Pexels search error: {e}, retry {attempt+1}")
            time.sleep(3)
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
    for best in candidates[:3]:
        vf = best[2]
        dl_url = vf["link"]
        print(f"  Downloading: {dl_url[:70]}...")
        try:
            r = requests.get(dl_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=60, stream=True)
            if r.status_code == 200:
                with open(clip_path, 'wb') as f:
                    for chunk in r.iter_content(65536):
                        f.write(chunk)
                return True
            else:
                print(f"  Download failed: {r.status_code}")
        except Exception as e:
            print(f"  Download error: {e}")
    return False

def make_placeholder(clip_path, dur=6):
    """Create a solid color placeholder video with audio"""
    cmd = [
        FFMPEG,
        "-f", "lavfi",
        "-i", f"color=c=black:s=1080x1920:d={dur}",
        "-f", "lavfi",
        "-i", f"anullsrc=r=44100:cl=stereo:d={dur}",
        "-shortest",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
        "-c:a", "aac",
        "-y", str(clip_path)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode == 0 and os.path.exists(clip_path):
        print(f"  Placeholder created: {os.path.getsize(clip_path)/1024:.0f}KB")
        return True
    else:
        print(f"  Placeholder failed: {result.stderr[-200:]}")
        return False

def run_ffmpeg(cmd, timeout=60):
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return result.returncode == 0, result

def main():
    print(f"=== RETRY {VIDEO_ID} ===")
    
    json_path = SCRIPTS_DIR / f"{VIDEO_ID}.json"
    with open(json_path, 'r', encoding='utf-8') as f:
        script = json.load(f)
    
    shots = script.get("shots", [])
    print(f"Title: {script.get('title', 'N/A')}")
    print(f"Shots: {len(shots)}")
    
    # Cleanup old temp files
    for f in UPLOAD_DIR.glob(f"{VIDEO_ID}_*"):
        try:
            os.remove(str(f))
        except:
            pass
    
    # Download clips with retries
    clips_info = []
    for shot in shots:
        shot_num = shot.get("shot_number", 0)
        camera_query = shot.get("camera", "")[:150]
        clip_path = UPLOAD_DIR / f"{VIDEO_ID}_shot{shot_num}.mp4"
        
        print(f"\n  Shot {shot_num}: {camera_query[:80]}")
        
        downloaded = False
        # Try camera query
        videos = search_pexels(camera_query)
        if videos:
            for v in videos[:3]:
                if download_pexels_video(v, clip_path):
                    dur = 6.0
                    size = os.path.getsize(clip_path)
                    print(f"  OK: {size/1024/1024:.1f}MB")
                    clips_info.append((shot_num, clip_path, dur))
                    downloaded = True
                    break
        
        # Fallback queries if main fails
        if not downloaded:
            fallbacks = [
                camera_query.split(',')[0].split('—')[0].strip(),
                "fantasy warrior sword battle dark",
                "mystical warrior fighting ancient",
            ]
            for fb in fallbacks[:2]:
                videos = search_pexels(fb)
                if videos:
                    for v in videos[:2]:
                        if download_pexels_video(v, clip_path):
                            dur = 6.0
                            size = os.path.getsize(clip_path)
                            print(f"  Fallback OK: {size/1024/1024:.1f}MB")
                            clips_info.append((shot_num, clip_path, dur))
                            downloaded = True
                            break
                if downloaded:
                    break
        
        if not downloaded:
            print(f"  Using placeholder...")
            make_placeholder(clip_path)
            clips_info.append((shot_num, clip_path, 6.0))
        
        time.sleep(1)  # Rate limit buffer
    
    # Trim each clip to 6s
    print(f"\n  Trimming to 6s each...")
    trimmed = []
    for shot_num, clip_path, dur in clips_info:
        out = UPLOAD_DIR / f"{VIDEO_ID}_shot{shot_num}_t.mp4"
        ok, result = run_ffmpeg([
            FFMPEG, "-i", str(clip_path), "-t", "6",
            "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-an", "-y", str(out)
        ], timeout=60)
        if ok and os.path.exists(out):
            trimmed.append(out)
            print(f"  Shot {shot_num}: OK")
        else:
            print(f"  Shot {shot_num}: TRIM FAILED, using placeholder")
            make_placeholder(out)
            trimmed.append(out)
    
    # Concat with concat demuxer (more reliable)
    print(f"\n  Concatenating...")
    concat_list = UPLOAD_DIR / f"{VIDEO_ID}_concat.txt"
    concat_video = UPLOAD_DIR / f"{VIDEO_ID}_concat_raw.mp4"
    
    with open(concat_list, 'w') as f:
        for t in trimmed:
            f.write(f"file '{t.as_posix()}'\n")
    
    ok, result = run_ffmpeg([
        FFMPEG, "-f", "concat", "-safe", "0", "-i", str(concat_list),
        "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an",
        "-y", str(concat_video)
    ], timeout=120)
    
    if ok:
        print(f"  Concat OK: {os.path.getsize(concat_video)/1024/1024:.1f}MB")
    else:
        print(f"  Concat FAILED: {result.stderr[-300:]}")
        return False
    
    # TTS
    print(f"\n  TTS narration...")
    narration_parts = [s.get("narration", "") for s in shots]
    narration_text = " — ".join(narration_parts)
    tts_path = UPLOAD_DIR / f"{VIDEO_ID}_tts.mp3"
    
    try:
        tts = gTTS(text=narration_text, lang='en', slow=False)
        tts.save(str(tts_path))
        print(f"  TTS OK: {os.path.getsize(tts_path)/1024:.0f}KB")
    except Exception as e:
        print(f"  TTS error: {e}")
        subprocess.run([FFMPEG, "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo:d=30",
            "-y", str(tts_path)], capture_output=True)
    
    # Mux
    print(f"\n  Muxing final video...")
    final_output = OUTPUT_DIR / f"{VIDEO_ID}.mp4"
    ok, result = run_ffmpeg([
        FFMPEG, "-i", str(concat_video),
        "-i", str(tts_path),
        "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest", "-y", str(final_output)
    ], timeout=120)
    
    if not ok:
        print(f"  Mux FAILED: {result.stderr[-300:]}")
        return False
    
    final_size = os.path.getsize(final_output)
    print(f"\n  SUCCESS: {final_output}")
    print(f"  Size: {final_size/1024/1024:.1f}MB")
    
    # Cleanup
    for f in UPLOAD_DIR.glob(f"{VIDEO_ID}_*"):
        try:
            if f.is_file():
                os.remove(str(f))
        except:
            pass
    
    # Update JSON
    script["status"] = "produced"
    produced_path = PRODUCED_DIR / f"{VIDEO_ID}.json"
    with open(produced_path, 'w', encoding='utf-8') as f:
        json.dump(script, f, ensure_ascii=False, indent=2)
    try:
        os.remove(str(json_path))
    except:
        pass
    
    # Verify duration
    probe = subprocess.run([FFMPEG.replace("ffmpeg", "ffprobe"), "-v", "quiet",
        "-show_entries", "format=duration", "-of", "csv=p=0", str(final_output)],
        capture_output=True, text=True)
    dur = probe.stdout.strip()
    print(f"  Duration: {dur}s")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
