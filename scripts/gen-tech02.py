# -*- coding: utf-8 -*-
import sys, os, subprocess, json, re

sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_TEXT = "Bạn nghĩ ChatGPT chỉ trả lời câu hỏi? Sai rồi. ChatGPT có thể viết code, phân tích dữ liệu, dịch thuật, sáng tác nhạc, và thậm chí lập trình cả một trang web chỉ trong 30 giây. Nhưng 90% người dùng chỉ dùng 10% sức mạnh của nó. Đây là 5 trick vào prompt cực kỳ hiệu quả mà những người dùng pro ai cũng dùng mà bạn chưa biết."

TMP_DIR = "C:/tmp/openclaw/uploads"
FFMPEG = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe"
FFPROBE = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffprobe.exe"
VIDEO_IN = f"{TMP_DIR}/TECH-02-raw.mp4"
AUDIO_OUT = f"{TMP_DIR}/TECH-02-tts.mp3"
FINAL_OUT = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output_topic/videos/TECH-02.mp4"

# Generate TTS
from gtts import gTTS
tts = gTTS(text=SCRIPT_TEXT, lang="vi", slow=False)
tts.save(AUDIO_OUT)
print(f"TTS saved: {AUDIO_OUT}")

# Get durations using ffprobe
def get_duration(filepath):
    result = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", filepath],
        capture_output=True, text=True, check=True
    )
    return float(result.stdout.strip())

video_dur = get_duration(VIDEO_IN)
tts_dur = get_duration(AUDIO_OUT)
print(f"Video duration: {video_dur:.2f}s, TTS duration: {tts_dur:.2f}s")

# Target duration = min(video, tts)
target_dur = min(video_dur, tts_dur)
print(f"Target duration: {target_dur:.2f}s")

# Trim audio to target_dur
cmd = [
    FFMPEG, "-y",
    "-i", AUDIO_OUT,
    "-t", str(target_dur),
    "-c:a", "libmp3lame", "-q:a", "2",
    f"{TMP_DIR}/TECH-02-tts-trimmed.mp3"
]
subprocess.run(cmd, check=True, capture_output=True)
print("Audio trimmed")

# Combine video + audio (scale to 1080x1920 portrait)
cmd2 = [
    FFMPEG, "-y",
    "-i", VIDEO_IN,
    "-i", f"{TMP_DIR}/TECH-02-tts-trimmed.mp3",
    "-t", str(target_dur),
    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-c:a", "aac",
    "-shortest",
    FINAL_OUT
]
result = subprocess.run(cmd2, capture_output=True, text=True)
if result.returncode != 0:
    print("FFmpeg stderr:", result.stderr[-2000:])
    sys.exit(1)
print(f"Final video saved: {FINAL_OUT}")

size = os.path.getsize(FINAL_OUT)
print(f"File size: {size} bytes ({size/1024/1024:.2f}MB)")
