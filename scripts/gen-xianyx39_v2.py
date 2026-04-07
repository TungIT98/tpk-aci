"""
XIANYX-39 Production - Fixed v2
"""
import subprocess, os, requests, re
from gtts import gTTS
from pathlib import Path

FFMPEG = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe"
BASE = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI"
OUTPUT_DIR = BASE + "\\output_topic\\videos"
UPLOAD_DIR = "C:/tmp/openclaw/uploads"
STAGING_DIR = "C:/tmp/openclaw/xianyx39_staging"
os.makedirs(STAGING_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

queries = [
    "ethereal bamboo forest dusk fireflies glowing",
    "two people facing each other emotional scene",
    "butterfly landing on glowing jade crystal",
    "hope tears face transformation close up",
    "bamboo forest light rays magical emergence",
]

api_key = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"

def get_duration(path):
    result = subprocess.run([FFMPEG, "-i", str(path), "-f", "null", "-"],
        capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", result.stderr)
    if m:
        return float(m.group(1))*3600 + float(m.group(2))*60 + float(m.group(3))
    return 6.0

def run_ffmpeg(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("  FFmpeg warn:", r.stderr[-300:])
    return r

# Step 1: Download clips to staging
print("=== Step 1: Downloading clips ===")
staged = []
for i, q in enumerate(queries, 1):
    out = STAGING_DIR + "/s" + str(i) + ".mp4"
    print(f"Shot {i}: {q[:50]}")
    r = requests.get("https://api.pexels.com/videos/search",
        params={"query": q, "per_page": 3},
        headers={"Authorization": api_key}, timeout=15)
    videos = r.json().get("videos", [])
    done = False
    for v in videos:
        for vf in v.get("video_files", []):
            link = vf.get("link", "")
            w = vf.get("width", 0)
            if link and w >= 720:
                print(f"  Downloading {w}x{vf.get('height')}...")
                rv = requests.get(link, headers={"User-Agent": "Mozilla/5.0"}, timeout=30, stream=True)
                if rv.status_code == 200:
                    with open(out, "wb") as f:
                        for chunk in rv.iter_content(65536):
                            f.write(chunk)
                    sz = os.path.getsize(out)
                    print(f"  OK {sz/1024/1024:.1f}MB")
                    staged.append(out)
                    done = True
                    break
        if done:
            break
    if not done:
        print("  FAILED - black clip")
        run_ffmpeg([FFMPEG, "-f", "lavfi", "-i", "color=c=black:s=1080x1920:d=6",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d=6", "-shortest", "-y", out])
        staged.append(out)

# Step 2: Trim to 6s and scale to 1080x1920
print("\n=== Step 2: Trim to 6s portrait ===")
trimmed = []
for i, clip in enumerate(staged, 1):
    out = STAGING_DIR + "/t" + str(i) + ".mp4"
    dur = get_duration(clip)
    print(f"  Shot {i}: {dur:.1f}s -> 6s")
    run_ffmpeg([FFMPEG, "-i", clip, "-t", "6",
        "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-an", "-y", out])
    trimmed.append(out)

# Step 3: Concat (filter_complex to avoid concat demuxer -t bug)
print("\n=== Step 3: Concat ===")
filter_str = ""
for i in range(len(trimmed)):
    filter_str += "[" + str(i) + ":v]trim=start=0:duration=6,setpts=PTS-STARTPTS,scale=1080:1920[v" + str(i) + "];"
filter_str += "".join(["[v" + str(i) + "]" for i in range(len(trimmed))]) + "concat=n=" + str(len(trimmed)) + ":v=1:a=0[outv]"

concat_out = STAGING_DIR + "/concat.mp4"
cmd = [FFMPEG, "-y"]
for t in trimmed:
    cmd += ["-i", t]
cmd += ["-filter_complex", filter_str, "-map", "[outv]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", concat_out]

print("  Running filter_complex concat...")
r = run_ffmpeg(cmd)
if r.returncode != 0:
    print("  filter_complex failed, trying concat demuxer...")
    concat_list = STAGING_DIR + "/list.txt"
    with open(concat_list, "w") as f:
        for t in trimmed:
            f.write("file '" + t.replace("\\", "/") + "'\n")
    r = run_ffmpeg([FFMPEG, "-f", "concat", "-safe", "0", "-i", concat_list,
        "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-an", "-y", concat_out])
    if r.returncode != 0:
        print("  concat demuxer also failed:", r.stderr[-300:])
    else:
        print("  concat demuxer OK")

print(f"  concat size: {os.path.getsize(concat_out)/1024/1024:.1f}MB")

# Step 4: TTS
print("\n=== Step 4: TTS ===")
tts_path = STAGING_DIR + "/tts.mp3"
try:
    narration = """Three months of peace. The jade bracelet glowed gentle green on her wrist -- no longer a cage -- a companion. She sat in the bamboo forest at dusk when a young girl stumbled into the clearing. Thin. Exhausted. Wearing jade ornaments -- exactly the same shade of emerald as the ones that had trapped her for two hundred years. And in the jade -- a trapped soul. Thanh Van Mon's face went white. She knew exactly what this girl carried. 'You're like me -- aren't you?' The jade glowed brighter -- responding to HER -- to the fact that someone had survived. She stood frozen -- her hand trembling. She had nearly died breaking her own curse. Breaking another's might kill her. But she could not walk away from someone wearing the same cage she had escaped. Because in that jade cage -- she saw herself. A butterfly landed on the girl's jade ornament -- drawn to it the way one had landed on her hairpin years ago. And Thanh Van Mon understood -- the real power was never technique. It was CONNECTION. Showing the girl that survival was possible. She held up her jade bracelet -- proof of survival -- beside the girl's trapped jade. 'I wore jade like yours -- for two hundred years -- I survived.' One sentence. The girl's face transformed -- hope, tears -- the realization that someone understood what she was going through. The jade cracked -- emerald light flooding out -- and a second butterfly rose from the broken cage."""
    tts = gTTS(text=narration, lang="en", slow=False)
    tts.save(tts_path)
    print(f"  TTS: {os.path.getsize(tts_path)/1024:.0f}KB")
except Exception as e:
    print(f"  TTS error: {e}")
    run_ffmpeg([FFMPEG, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d=30",
        "-y", tts_path])

# Get TTS duration
r = subprocess.run([FFMPEG, "-i", tts_path, "2>&1"], capture_output=True, text=True)
m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", r.stderr)
tts_dur = float(m.group(1))*3600 + float(m.group(2))*60 + float(m.group(3)) if m else 30.0
print(f"  TTS duration: {tts_dur:.1f}s")

# Step 5: Mux video + audio
print("\n=== Step 5: Mux ===")
final_output = OUTPUT_DIR + "\\XIANYX-39.mp4"
r = run_ffmpeg([FFMPEG, "-i", concat_out, "-i", tts_path,
    "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest", "-y", final_output])

final_size = os.path.getsize(final_output)
print(f"\n=== DONE ===")
print(f"Output: {final_output}")
print(f"Size: {final_size/1024/1024:.1f}MB")

# Cleanup staging
import shutil
shutil.rmtree(STAGING_DIR, ignore_errors=True)
print("Staging cleaned.")
