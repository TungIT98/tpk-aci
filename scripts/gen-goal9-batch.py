"""
gen-goal9-batch.py - GOAL-9 Xianxia Batch production (E31-40)
XIANYX-171 to 230 (60 videos)
Skip Hailuo (broken). Pexels fallback. gTTS Vietnamese.
Output: output/xianxia/{id}/final.mp4
"""
import os, json, sys, urllib.parse, ssl, urllib.request, subprocess, time, requests, tempfile
from pathlib import Path

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
SCRIPT_DIR = ROOT / "scripts/pending/xianxia"
OUTPUT_BASE = ROOT / "output/xianxia"

FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
MINIMAX_KEY = "sk-cp-JKcLn8JXdkygpTgwCS72isp9Zz7AswQeFdh5uKnvk0vngQHaLa6NVBOwSZ8v6xZybbPM3ck-L1UmOYff7EsliddMUK4Hk-za3N0-wUWse_Nsj--6J_n9XPw"
MINIMAX_BASE = "https://api.minimax.io"

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
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with urllib.request.urlopen(req, timeout=60) as r:
        with open(out_path, 'wb') as f:
            while True:
                chunk = r.read(65536)
                if not chunk:
                    break
                f.write(chunk)
    return os.path.getsize(out_path) > 10000

def process_clip(in_path, out_path, duration=6):
    actual_dur = get_duration(in_path)
    if actual_dur <= duration + 0.5:
        start = 0.0
        clip_dur = min(duration, actual_dur)
    else:
        start = actual_dur - duration - 0.5
        clip_dur = duration
    cmd = [FFMPEG, '-y', '-i', str(in_path), '-ss', str(start), '-t', str(clip_dur),
           '-vf', 'scale=1080:-2', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
           '-pix_fmt', 'yuv420p', '-an', str(out_path)]
    r = run(cmd, timeout=120, check=False)
    if r.returncode != 0 or not Path(out_path).exists() or Path(out_path).stat().st_size < 10000:
        log(f"  process_clip failed")
        raise RuntimeError("FFmpeg process_clip failed")
    return True

def make_black(path, duration=6):
    os.makedirs(os.path.dirname(str(path)), exist_ok=True)
    run([FFMPEG, '-y', '-f', 'lavfi', '-i', f'color=c=black:s=1080x1920:d={duration}',
         '-t', str(duration), str(path)], timeout=30, check=False)

def gen_gtts(text, out_path):
    import tempfile
    os.makedirs(os.path.dirname(str(out_path)), exist_ok=True)
    tmp = Path(tempfile.gettempdir()) / "_gtts_temp.py"
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write('from gtts import gTTS; gTTS(' + repr(text) + ', lang="vi", slow=False).save(' + repr(str(out_path)) + ')')
    r = subprocess.run(['python', str(tmp)], capture_output=True, timeout=30)
    if r.returncode != 0:
        log(f"gTTS failed")
        return False
    if os.path.getsize(out_path) < 1000:
        return False
    probe = subprocess.run([FFMPEG, '-v', 'quiet', '-i', str(out_path), '-f', 'null', '-'],
                           capture_output=True, timeout=15)
    if probe.returncode != 0:
        pcm = str(out_path) + ".pcm"
        wav = str(out_path) + ".wav"
        r1 = subprocess.run([FFMPEG, '-y', '-i', str(out_path), '-f', 'wav', pcm], capture_output=True, timeout=30)
        if r1.returncode == 0:
            r2 = subprocess.run([FFMPEG, '-y', '-i', pcm, '-acodec', 'libmp3lame', '-q:a', '2', str(out_path)],
                               capture_output=True, timeout=30)
            for p in [pcm, wav]:
                Path(p).unlink(missing_ok=True)
        if r2.returncode != 0 or os.path.getsize(out_path) < 1000:
            Path(out_path).unlink(missing_ok=True)
            return False
    return True

def make_silent_audio(path, duration=30):
    import tempfile as _tmp
    silent_wav = Path(_tmp.gettempdir()) / f"_silent_{int(duration)}.wav"
    silent_mp3 = Path(_tmp.gettempdir()) / f"_silent_{int(duration)}.mp3"
    try:
        if not silent_wav.exists():
            with open(silent_wav, 'wb') as f:
                f.write(b'\x80' * int(32000 * duration))
        if not silent_mp3.exists():
            run([FFMPEG, '-y', '-f', 'u8', '-ar', '32000', '-ac', '1',
                 '-i', str(silent_wav), '-t', str(duration),
                 '-c:a', 'libmp3lame', '-b:a', '32k', str(silent_mp3)],
                timeout=30, check=False)
        if silent_mp3.exists() and silent_mp3.stat().st_size > 100:
            import shutil
            shutil.copy2(str(silent_mp3), str(path))
            return True
    except Exception as e:
        log(f"make_silent_audio failed: {e}")
    return False

def gen_minimax_tts(text, out_path):
    clean = text.replace('"', ' ').replace("'", ' ').replace('\n', ' ').replace('  ', ' ').strip()
    body = {
        "model": "speech-02-hd", "text": clean[:500], "stream": False,
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
        os.makedirs(os.path.dirname(str(out_path)), exist_ok=True)
        with open(out_path, 'wb') as f:
            f.write(audio)
        size = os.path.getsize(out_path)
        if size < max(10000, len(clean) * 15):
            return False
        return True
    except Exception as e:
        log(f"MiniMax TTS failed: {e}")
        return False

def concat_clips(clips, out_path):
    list_path = Path(tempfile.gettempdir()) / "concat_list.txt"
    with open(list_path, 'w') as f:
        for c in clips:
            f.write(f"file '{c}'\n")
    cmd = [FFMPEG, '-y', '-f', 'concat', '-safe', '0', '-i', str(list_path),
           '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-b:v', '2000k',
           '-maxrate', '4000k', '-bufsize', '8000k', '-movflags', '+faststart',
           '-pix_fmt', 'yuv420p', str(out_path)]
    r = run(cmd, timeout=120, check=False)
    if r.returncode != 0:
        raise RuntimeError(f"Concat failed: {r.stderr.decode()[-300:]}")
    p = Path(out_path)
    if p.exists() and p.stat().st_size < 500000:
        raise RuntimeError(f"Concat output too small: {p.stat().st_size} bytes")
    return True

def mux_final(video_path, audio_path, out_path):
    cmd = [FFMPEG, '-y', '-i', str(video_path), '-i', str(audio_path),
           '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', str(out_path)]
    r = run(cmd, timeout=60, check=False)
    if r.returncode != 0:
        raise RuntimeError(f"Mux failed: {r.stderr.decode()[-300:]}")
    return True

def build_narration(script):
    hook = script.get('concept', {}).get('hook', '')
    arc = script.get('concept', {}).get('story_arc', '')
    title = script.get('title', '')
    parts = [hook] if hook else []
    if arc:
        parts.append(arc.replace(' — ', '. ').replace(' -> ', '. '))
    if not parts:
        parts = [title]
    return ' '.join(parts)[:400]

def produce_video(vid, script, raw_shots_exist, temp_parent):
    OUTPUT_DIR = OUTPUT_BASE / vid
    OUTPUT_DIR.mkdir(exist_ok=True)
    OUTPUT_VIDEO = OUTPUT_DIR / "final.mp4"
    TEMP_DIR = temp_parent / f"_temp_{vid}"
    TEMP_DIR.mkdir(exist_ok=True)

    log(f"=== {vid}: {script.get('title', 'N/A')} ===")

    if OUTPUT_VIDEO.exists() and OUTPUT_VIDEO.stat().st_size > 1000000:
        log(f"  Already exists ({OUTPUT_VIDEO.stat().st_size} bytes) - SKIP")
        return True, "already_exists"

    shots = script.get('shots', [])
    clips_out = []

    for i, shot in enumerate(shots, 1):
        portrait_path = TEMP_DIR / f"shot{i}_portrait.mp4"
        raw_path = TEMP_DIR / f"shot{i}_raw.mp4"
        prompt = shot.get('prompt', '')

        if not prompt:
            make_black(portrait_path)
            clips_out.append(str(portrait_path))
            continue

        log(f"  Shot {i}: searching Pexels: {prompt[:80]}")
        videos = search_pexels(prompt, per_page=5)

        if videos:
            vid_data = videos[0]
            log(f"    Got video ID={vid_data['id']}, dur={vid_data['duration']}s")
            ok = download_pexels(vid_data['id'], str(raw_path))
            if ok and os.path.getsize(str(raw_path)) > 10000:
                try:
                    process_clip(str(raw_path), str(portrait_path), duration=6)
                    clips_out.append(str(portrait_path))
                except:
                    make_black(portrait_path)
                    clips_out.append(str(portrait_path))
            else:
                make_black(portrait_path)
                clips_out.append(str(portrait_path))
        else:
            log(f"    No video found, using black")
            make_black(portrait_path)
            clips_out.append(str(portrait_path))

        time.sleep(0.3)

    # Concat
    log(f"  Concatenating {len(clips_out)} clips...")
    concat_raw = TEMP_DIR / "concat_raw.mp4"
    try:
        concat_clips(clips_out, str(concat_raw))
        log(f"  Concat: {concat_raw.stat().st_size} bytes")
    except Exception as e:
        log(f"  Concat failed: {e}")
        return False, f"concat_failed: {e}"

    # TTS
    narration = build_narration(script)
    log(f"  TTS: {narration[:80]}...")
    audio_path = TEMP_DIR / "narration.mp3"
    tts_ok = False
    if gen_minimax_tts(narration, str(audio_path)):
        tts_ok = True
        log(f"  MiniMax TTS OK: {audio_path.stat().st_size} bytes")
    elif gen_gtts(narration, str(audio_path)):
        tts_ok = True
        log(f"  gTTS OK: {audio_path.stat().st_size} bytes")
    else:
        log(f"  All TTS failed, generating silent audio")
        if not make_silent_audio(str(audio_path), 30):
            Path(audio_path).touch()

    if tts_ok and audio_path.exists():
        probe = subprocess.run([FFMPEG, '-v', 'quiet', '-i', str(audio_path), '-f', 'null', '-'],
                              capture_output=True, timeout=15)
        if probe.returncode != 0:
            Path(audio_path).unlink(missing_ok=True)
            if not make_silent_audio(str(audio_path), 30):
                Path(audio_path).touch()
                tts_ok = False

    # Mux
    try:
        mux_final(str(concat_raw), str(audio_path), str(OUTPUT_VIDEO))
    except Exception as e:
        log(f"  Mux failed: {e}")
        return False, f"mux_failed: {e}"

    size = OUTPUT_VIDEO.stat().st_size
    log(f"  DONE: {OUTPUT_VIDEO} ({size} bytes)")

    try:
        for f in TEMP_DIR.glob("*"):
            f.unlink()
        TEMP_DIR.rmdir()
    except:
        pass

    return True, f"done:{size}bytes"

def main():
    videos = {
        # GOAL-9: XIANYX-171 to 230 — Episodes 31-40
        # Ha Tien Du E31-40
        'XIANYX-171': False, 'XIANYX-172': False, 'XIANYX-173': False,
        'XIANYX-174': False, 'XIANYX-175': False, 'XIANYX-176': False,
        'XIANYX-177': False, 'XIANYX-178': False, 'XIANYX-179': False,
        'XIANYX-180': False,
        # Trieu Tien E31-40
        'XIANYX-181': False, 'XIANYX-182': False, 'XIANYX-183': False,
        'XIANYX-184': False, 'XIANYX-185': False, 'XIANYX-186': False,
        'XIANYX-187': False, 'XIANYX-188': False, 'XIANYX-189': False,
        'XIANYX-190': False,
        # Dau Pha Thuong Khau E31-40
        'XIANYX-191': False, 'XIANYX-192': False, 'XIANYX-193': False,
        'XIANYX-194': False, 'XIANYX-195': False, 'XIANYX-196': False,
        'XIANYX-197': False, 'XIANYX-198': False, 'XIANYX-199': False,
        'XIANYX-200': False,
        # Tru Tien E31-40
        'XIANYX-201': False, 'XIANYX-202': False, 'XIANYX-203': False,
        'XIANYX-204': False, 'XIANYX-205': False, 'XIANYX-206': False,
        'XIANYX-207': False, 'XIANYX-208': False, 'XIANYX-209': False,
        'XIANYX-210': False,
        # Thanh Van Mon E31-40
        'XIANYX-211': False, 'XIANYX-212': False, 'XIANYX-213': False,
        'XIANYX-214': False, 'XIANYX-215': False, 'XIANYX-216': False,
        'XIANYX-217': False, 'XIANYX-218': False, 'XIANYX-219': False,
        'XIANYX-220': False,
        # Muc Than Ky E31-40
        'XIANYX-221': False, 'XIANYX-222': False, 'XIANYX-223': False,
        'XIANYX-224': False, 'XIANYX-225': False, 'XIANYX-226': False,
        'XIANYX-227': False, 'XIANYX-228': False, 'XIANYX-229': False,
        'XIANYX-230': False,
    }

    results = {}
    temp_parent = ROOT / "temp"
    temp_parent.mkdir(exist_ok=True)

    for vid, raw_exists in videos.items():
        script_path = SCRIPT_DIR / f"{vid}.json"
        if not script_path.exists():
            log(f"{vid}: script not found - SKIP")
            results[vid] = "script_not_found"
            continue

        with open(script_path, encoding='utf-8-sig') as f:
            script = json.load(f)

        ok, msg = produce_video(vid, script, raw_exists, temp_parent)
        results[vid] = msg

    log("\n=== SUMMARY ===")
    for vid, msg in results.items():
        log(f"  {vid}: {msg}")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        log(f"FATAL: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
