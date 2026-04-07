"""
gen-xianyx20.py - XIANYX-20 Muc Than Ky Episode 4: The Shadow's Name
5 shots x 6s = 30s. Pexels fallback. MiniMax TTS.
"""
import os, json, sys, urllib.parse, ssl, subprocess, time, requests
from pathlib import Path

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
OUTPUT_VIDEO = ROOT / "output_topic/videos/XIANYX-20.mp4"
TEMP_DIR = ROOT / "output/_temp_xianyx20"
FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
MINIMAX_KEY = "sk-cp-JKcLn8JXdkygpTgwCS72isp9Zz7AswQeFdh5uKnvk0vngQHaLa6NVBOwSZ8v6xZybbPM3ck-L1UmOYff7EsliddMUK4Hk-za3N0-wUWse_Nsj--6J_n9XPw"
MINIMAX_BASE = "https://api.minimax.io"

OUTPUT_VIDEO.parent.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

def log(*args):
    ts = subprocess.run('powershell Get-Date -Format "HH:mm:ss"', shell=True, capture_output=True, text=True).stdout.strip()
    print(f"[{ts}]", *args)

def run(cmd, timeout=120, check=True):
    r = subprocess.run(cmd, shell=True, capture_output=True, timeout=timeout)
    if check and r.returncode != 0:
        err = r.stderr.decode('utf-8', errors='replace')[-500:]
        raise RuntimeError(f"CMD failed ({r.returncode}): {err}")
    return r

def get_duration(path):
    try:
        out = subprocess.run([FPROBE, '-v', 'error', '-show_entries', 'format=duration',
                             '-of', 'default=noprint_wrappers=1:nokey=1', str(path)],
                            capture_output=True, text=True, timeout=15)
        return float(out.stdout.strip() or '0')
    except:
        return 0

def search_pexels(query, per_page=5):
    url = f"https://api.pexels.com/videos/search?query={urllib.parse.quote(query)}&per_page={per_page}&orientation=portrait&duration_max=30"
    resp = requests.get(url, headers={'Authorization': PEXELS_KEY}, timeout=15)
    data = resp.json()
    videos = data.get('videos', [])
    return [v for v in videos if v['width'] >= 720 and 5 <= v['duration'] <= 30]

def download_pexels(video_id, out_path):
    resp = requests.get(f'https://api.pexels.com/videos/videos/{video_id}', headers={'Authorization': PEXELS_KEY}, timeout=20)
    if resp.status_code != 200:
        return False
    files = resp.json().get('video_files', [])
    # Pick best portrait or best available
    best = None
    for vf in files:
        w, h = vf.get('width', 0), vf.get('height', 0)
        if h > 0 and w > 0 and h >= w * 0.7:
            if best is None or h > best.get('height', 0):
                best = vf
    if not best and files:
        best = files[0]
    if not best:
        return False
    url = best.get('link')
    if not url:
        return False
    import urllib.request
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        with open(out_path, 'wb') as f:
            while True:
                chunk = r.read(65536)
                if not chunk:
                    break
                f.write(chunk)
    return os.path.getsize(out_path) > 10000

def process_clip(in_path, out_path, duration=6):
    """Trim and convert to portrait 1080x1920."""
    actual_dur = get_duration(in_path)
    start = min(1.0, max(0, actual_dur - duration - 1))
    cmd = [
        FFMPEG, '-y', '-i', str(in_path),
        '-ss', str(start),
        '-t', str(duration),
        '-vf', f'trim=0:{duration},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=in_h*9/16:in_h,scale=1080:-2',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-an', str(out_path)
    ]
    r = run(cmd, timeout=120, check=False)
    if r.returncode != 0:
        log(f"  process_clip failed: {r.stderr.decode()[-300:]}")
        raise RuntimeError("FFmpeg process_clip failed")
    return True

def gen_minimax_tts(text, out_path):
    clean = text.replace('"', ' ').replace("'", ' ').replace('\n', ' ').replace('  ', ' ').strip()
    body = {
        "model": "speech-02-hd",
        "text": clean[:500],
        "stream": False,
        "voice_setting": {"voice_id": "male_qn_qingse", "speed": 1.0, "vol": 1.0, "pitch": 0, "dict_set": []},
        "output_format": {"sample_rate": 32000, "bitrate": 128000, "format": "mp3"}
    }
    data = json.dumps(body).encode()
    ctx = ssl.create_default_context()
    req = urllib.request.Request(
        f"{MINIMAX_BASE}/v1/t2a_v2?GroupId=2172819003747760",
        data=data,
        headers={'Authorization': f'Bearer {MINIMAX_KEY}', 'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            audio = resp.read()
        with open(out_path, 'wb') as f:
            f.write(audio)
        return os.path.getsize(out_path) > 1000
    except Exception as e:
        log(f"MiniMax TTS failed: {e}")
        return False

def gen_gtts(text, out_path):
    import tempfile, subprocess
    tmp = TEMP_DIR / "_gtts.py"
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write('from gtts import gTTS; gTTS(' + repr(text) + ', lang="vi", slow=False).save(' + repr(str(out_path)) + ')')
    r = subprocess.run(['python', str(tmp)], capture_output=True, timeout=30)
    if r.returncode != 0:
        log(f"gTTS failed: {r.stderr.decode()[:200]}")
        return False
    return os.path.getsize(out_path) > 1000

def concat_clips(clips, out_path):
    list_path = TEMP_DIR / "concat.txt"
    with open(list_path, 'w') as f:
        for c in clips:
            f.write(f"file '{c}'\n")
    cmd = [FFMPEG, '-y', '-f', 'concat', '-safe', '0',
           '-i', str(list_path),
           '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
           str(out_path)]
    r = run(cmd, timeout=120, check=False)
    if r.returncode != 0:
        raise RuntimeError(f"Concat failed: {r.stderr.decode()[-300:]}")
    return True

def mux_final(video_path, audio_path, out_path):
    cmd = [FFMPEG, '-y', '-i', str(video_path), '-i', str(audio_path),
           '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', str(out_path)]
    r = run(cmd, timeout=60, check=False)
    if r.returncode != 0:
        raise RuntimeError(f"Mux failed: {r.stderr.decode()[-300:]}")
    return True

def main():
    log("=== XIANYX-20 Muc Than Ky Episode 4 ===")
    
    if OUTPUT_VIDEO.exists() and OUTPUT_VIDEO.stat().st_size > 1000000:
        log(f"Video already exists: {OUTPUT_VIDEO}")
        return True

    # Shot queries for 5 shots of burial ground / seer eye / shadow scenes
    shot_queries = [
        "foggy cemetery night fog grave markers",
        "dark mysterious cloaked figure silhouette",
        "mystical purple violet light supernatural glow",
        "ancient tombstone gravestone night cemetery",
        "moonless night cemetery fog atmosphere",
    ]

    clips_out = []
    for i, query in enumerate(shot_queries, 1):
        log(f"Shot {i}: Searching: {query}")
        videos = search_pexels(query, per_page=5)
        if not videos:
            log(f"  No results, trying alt query...")
            videos = search_pexels("dark fog cemetery", per_page=5)
        
        clip_path = TEMP_DIR / f"shot{i}_raw.mp4"
        portrait_path = TEMP_DIR / f"shot{i}_portrait.mp4"
        
        if videos:
            vid = videos[0]
            log(f"  Got video ID={vid['id']}, dur={vid['duration']}s")
            ok = download_pexels(vid['id'], str(clip_path))
            if not ok or os.path.getsize(str(clip_path)) < 10000:
                log(f"  Download failed, creating black fallback")
                run([FFMPEG, '-y', '-f', 'lavfi', '-i', f'color=black:size=1080:1920:duration=6',
                     '-t', '6', str(clip_path)], timeout=30)
        else:
            log(f"  No video found, creating black clip")
            run([FFMPEG, '-y', '-f', 'lavfi', '-i', f'color=black:size=1080:1920:duration=6',
                 '-t', '6', str(clip_path)], timeout=30)

        # Process to portrait 6s
        try:
            process_clip(str(clip_path), str(portrait_path), duration=6)
            clips_out.append(str(portrait_path))
        except:
            log(f"  Process failed, using black")
            run([FFMPEG, '-y', '-f', 'lavfi', '-i', f'color=black:size=1080:1920:duration=6',
                 '-t', '6', str(portrait_path)], timeout=30)
            clips_out.append(str(portrait_path))
        
        time.sleep(0.5)

    # Concat all clips
    log("Concatenating clips...")
    concat_raw = TEMP_DIR / "concat_raw.mp4"
    concat_clips(clips_out, str(concat_raw))
    log(f"Concat done: {concat_raw.stat().st_size} bytes")

    # TTS narration
    narration = """The woman ran — and the shadow hunted. He had seen a thousand deaths through his eye. But never one being committed in real time — never one he might stop if he could see it clearly enough. And now — at full power — he finally could. The burial ground was not just a library. It was a weapon. And in that moment — with his hand on the grave and his eye at full blaze — he read what the Seer King had written three thousand years ago. The shadow was not a demon. It was a man — who had made a bargain with death itself. And the Seer King had written his ending. He wrote the shadow's death — with the authority of the Seer King whose eye he carried. And the burial ground — which had been a silent witness for three thousand years — finally found its voice in him. Three thousand years the shadow had killed — bound by a death he could not escape. And the Seer King had written his ending — waiting for the one who could speak it aloud. The shadow dissolved not in fury — but in relief. Finally — finally — free from the endless harvest. Two lives — saved from death by the words of a king who had been dead for three thousand years. And a grave-keeper who had come to read the dead — had finally learned to write for them. The burial ground's last student — had become its voice. And the price was written on his palm — in ink that would never wash away."""

    audio_path = TEMP_DIR / "narration.mp3"
    if not gen_minimax_tts(narration, str(audio_path)):
        log("MiniMax TTS failed, trying gTTS...")
        if not gen_gtts(narration, str(audio_path)):
            log("All TTS failed, creating silent audio")
            run([FFMPEG, '-y', '-f', 'lavfi', '-i', 'anullsrc=r=32000:cl=mono', '-t', '30', str(audio_path)], timeout=30)

    # Mux
    log("Muxing video + audio...")
    mux_final(str(concat_raw), str(audio_path), str(OUTPUT_VIDEO))
    size = OUTPUT_VIDEO.stat().st_size
    log(f"✅ XIANYX-20 DONE: {OUTPUT_VIDEO} ({size} bytes)")

    # Cleanup
    for f in TEMP_DIR.glob("*"):
        try:
            f.unlink()
        except:
            pass
    return True

if __name__ == '__main__':
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        log(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
