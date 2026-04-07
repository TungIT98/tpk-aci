from gtts import gTTS
from pathlib import Path
import subprocess, json

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
OUT_DIR = ROOT / "output" / "tien-nghich" / "TN-01"
TEMP = ROOT / "output" / "_temp_tn01_final"
TEMP.mkdir(parents=True, exist_ok=True)

script_text = ("When heaven denies you everything, you do not kneel. You rise. "
                "In the world of cultivation, the strong rule and the weak perish. "
                "But one man refused to accept his fate. Born with a shattered spirit root, "
                "mocked by all, he discovered an ancient secret that would change everything. "
                "Today, we tell the story of a cultivator who went from trash to legend. "
                "Subscribe, because this journey is only beginning.")

tts_path = OUT_DIR / "tn01_tts.mp3"
print(f"[TTS] Generating gTTS for full script ({len(script_text)} chars)...")
tts = gTTS(text=script_text, lang="en", slow=False)
tts.save(str(tts_path))
print(f"[TTS] Saved: {tts_path.stat().st_size} bytes")

# Get TTS duration
out = subprocess.run(
    ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(tts_path)],
    capture_output=True, text=True)
tts_dur = float(json.loads(out.stdout)["format"]["duration"])
print(f"[TTS] Duration: {tts_dur:.1f}s")

# Create concat list
clips = [OUT_DIR / f"TN-01-0{i}.mp4" for i in range(1, 6)]
concat_list = TEMP / "concat.txt"
with open(concat_list, "w") as f:
    for c in clips:
        f.write(f"file '{c}'\n")
print(f"[CONCAT] Created list with {len(clips)} clips")

# Concat clips (video only)
concat_raw = TEMP / "concat_raw.mp4"
r = subprocess.run(
    ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
     "-c", "copy", str(concat_raw)],
    capture_output=True, timeout=120)
if r.returncode != 0:
    print(f"[ERROR] Concat failed: {r.stderr.decode('utf-8', errors='replace')[-300:]}")
else:
    print(f"[CONCAT] Done: {concat_raw.stat().st_size // 1024}KB")

# Get concat duration
out2 = subprocess.run(
    ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(concat_raw)],
    capture_output=True, text=True)
concat_dur = float(json.loads(out2.stdout)["format"]["duration"])
print(f"[CONCAT] Duration: {concat_dur:.1f}s")

# Scale to 1080x1920
concat_scaled = TEMP / "concat_scaled.mp4"
r = subprocess.run(
    ["ffmpeg", "-y", "-i", str(concat_raw),
     "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
     "-c:v", "libx264", "-preset", "fast", "-r", "30",
     str(concat_scaled)],
    capture_output=True, timeout=120)
if r.returncode != 0:
    print(f"[ERROR] Scale failed: {r.stderr.decode('utf-8', errors='replace')[-300:]}")
else:
    print(f"[SCALE] Done: {concat_scaled.stat().st_size // 1024}KB")

# Trim TTS to match video
tts_trim = TEMP / "tn01_tts_trim.mp3"
target_dur = min(tts_dur, concat_dur)
r = subprocess.run(
    ["ffmpeg", "-y", "-i", str(tts_path), "-t", str(target_dur), "-c:a", "copy", str(tts_trim)],
    capture_output=True, timeout=60)
if r.returncode != 0:
    print(f"[ERROR] TTS trim failed: {r.stderr.decode('utf-8', errors='replace')[-300:]}")
else:
    print(f"[TTS_TRIM] Done: {tts_trim.stat().st_size // 1024}KB")

# Mux
final_out = OUT_DIR / "TN-01-final.mp4"
r = subprocess.run(
    ["ffmpeg", "-y", "-i", str(concat_scaled), "-i", str(tts_trim),
     "-c:v", "copy", "-c:a", "aac", "-shortest",
     str(final_out)],
    capture_output=True, timeout=120)
if r.returncode != 0:
    print(f"[ERROR] Mux failed: {r.stderr.decode('utf-8', errors='replace')[-300:]}")
else:
    print(f"[FINAL] Done: {final_out.stat().st_size // 1024}KB ({final_out.stat().st_size // 1024 // 1024}MB)")
    print(f"[OUTPUT] {final_out}")
