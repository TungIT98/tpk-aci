# -*- coding: utf-8 -*-
import sys, os, subprocess, json
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_TEXT = "Nam 2030, 10 công việc phổ biến nhất hiện nay sẽ biến mất hoàn toàn vì AI. Data entry - gone. Customer service co bản - gone. Basic accounting - gone. Thậm chí junior developers cung không còn nhu cầu. Nhung đây là điều thú vị: 15 công việc mới sẽ xuất hiện thay thế - AI Trainer, Prompt Engineer, Digital Forensic Analyst, và nhiều hơn nữa. Không phải AI thay thế con người - mà là người dùng AI thay thế người không dùng AI. Đây là thời điểm để thích nghi."

TMP_DIR = "C:/tmp/openclaw/uploads"
FFMPEG = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe"
FFPROBE = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffprobe.exe"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
OUTPUT_DIR = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output_topic/videos")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
FINAL_OUT = OUTPUT_DIR / "TECH-11.mp4"

def curl_get_json(url):
    r = subprocess.run(["curl.exe", "-s", "-L", url, "-H", f"Authorization: {PEXELS_KEY}"],
                      capture_output=True, text=True, timeout=30)
    return json.loads(r.stdout)

def curl_download(url, path):
    r = subprocess.run(["curl.exe", "-s", "-L", "-o", str(path), "-w", "%{http_code}", url,
                       "-H", f"Authorization: {PEXELS_KEY}"],
                      capture_output=True, text=True, timeout=60)
    if r.stdout.strip() != "200":
        raise RuntimeError(f"Download failed: HTTP {r.stdout}")

def get_duration(path):
    result = subprocess.run(
        [FFPROBE, "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
        capture_output=True, text=True
    )
    return float(json.loads(result.stdout)["format"]["duration"])

def run_ffmpeg(args):
    r = subprocess.run([FFMPEG, "-y"] + args, capture_output=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(f"FFmpeg error: {r.stderr.decode('utf-8', errors='replace')[-300:]}")

# Search Pexels for relevant video
print("Searching Pexels for 'future technology AI robot work'...")
url = "https://api.pexels.com/videos/search?query=future%20technology%20AI%20robot%20work&per_page=5&orientation=portrait"
vids = curl_get_json(url).get("videos", [])
print(f"Found {len(vids)} videos")

if not vids:
    raise RuntimeError("No videos found")

# Get best clip
best = None
for v in vids:
    for f in v.get("video_files", []):
        if f.get("quality") == "hd" and f.get("height", 0) >= 720:
            best = f
            break
    if best:
        break
if not best and vids and vids[0].get("video_files"):
    best = vids[0]["video_files"][0]

print(f"Selected: {best['width']}x{best['height']} {best['quality']}")

# Download
RAW_VID = Path(TMP_DIR) / "TECH-11-raw.mp4"
curl_download(best["link"], str(RAW_VID))
print(f"Downloaded: {RAW_VID.stat().st_size // 1024}KB")

# Trim to 5s and scale to portrait 1080x1920
CROP_VID = Path(TMP_DIR) / "TECH-11-crop.mp4"
run_ffmpeg(["-ss", "0", "-t", "5", "-i", str(RAW_VID),
            "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-r", "30", str(CROP_VID)])
print("Cropped to 1080x1920 portrait")

# Generate gTTS
from gtts import gTTS
TTS_OUT = Path(TMP_DIR) / "TECH-11-tts.mp3"
gTTS(text=SCRIPT_TEXT[:500], lang="vi", slow=False).save(str(TTS_OUT))
print(f"TTS saved: {TTS_OUT.stat().st_size // 1024}KB")

# Trim TTS to video duration
video_dur = get_duration(CROP_VID)
TTS_TRIM = Path(TMP_DIR) / "TECH-11-tts-trim.mp3"
run_ffmpeg(["-i", str(TTS_OUT), "-t", str(video_dur), "-c:a", "copy", str(TTS_TRIM)])
print(f"TTS trimmed to {video_dur:.2f}s")

# Mux
run_ffmpeg(["-i", str(CROP_VID), "-i", str(TTS_TRIM),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", str(FINAL_OUT)])
print(f"Final: {FINAL_OUT} ({FINAL_OUT.stat().st_size // 1024}KB)")

# Cleanup
for f in [RAW_VID, CROP_VID, TTS_OUT, TTS_TRIM]:
    try: f.unlink()
    except: pass

print("DONE!")
