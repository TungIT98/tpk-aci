"""
gen-goal8-batch.py - GOAL-8 Xianxia Batch 4 production (E21-30)
Supports Nova-1, Nova-2, Nova-3 with correct output path.
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
    # Clamp: if actual_dur <= duration+0.5, start from 0; otherwise start near end
    if actual_dur <= duration + 0.5:
        start = 0.0
        clip_dur = min(duration, actual_dur)
    else:
        start = actual_dur - duration - 0.5
        clip_dur = duration
    cmd = [
        FFMPEG, '-y',
        '-i', str(in_path),
        '-ss', str(start),
        '-t', str(clip_dur),
        '-vf', 'scale=1080:-2',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-an', str(out_path)
    ]
    r = run(cmd, timeout=120, check=False)
    if r.returncode != 0 or not Path(out_path).exists() or Path(out_path).stat().st_size < 10000:
        log(f"  process_clip failed: {r.stderr.decode()[-300:] if r.returncode != 0 else 'output too small'}")
        raise RuntimeError("FFmpeg process_clip failed")
    return True

def make_black(path, duration=6):
    os.makedirs(os.path.dirname(str(path)), exist_ok=True)
    run([FFMPEG, '-y', '-f', 'lavfi',
         '-i', f'color=c=black:s=1080x1920:d={duration}',
         '-t', str(duration), str(path)], timeout=30, check=False)

def gen_gtts(text, out_path):
    import tempfile
    os.makedirs(os.path.dirname(str(out_path)), exist_ok=True)
    tmp = Path(tempfile.gettempdir()) / "_gtts_temp.py"
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write('from gtts import gTTS; gTTS(' + repr(text) + ', lang="vi", slow=False).save(' + repr(str(out_path)) + ')')
    r = subprocess.run(['python', str(tmp)], capture_output=True, timeout=30)
    if r.returncode != 0:
        log(f"gTTS failed: {r.stderr.decode()[:200]}")
        return False
    if os.path.getsize(out_path) < 1000:
        return False
    # Validate audio can be decoded by FFmpeg before returning
    probe = subprocess.run(
        [FFMPEG, '-v', 'quiet', '-i', str(out_path), '-f', 'null', '-'],
        capture_output=True, timeout=15
    )
    if probe.returncode != 0:
        log(f"  gTTS output invalid for FFmpeg (re-encoding...)")
        # Re-encode to PCM then back to MP3 to normalize
        pcm_path = str(out_path) + ".pcm"
        wav_path = str(out_path) + ".wav"
        r1 = subprocess.run([FFMPEG, '-y', '-i', str(out_path), '-f', 'wav', pcm_path],
                           capture_output=True, timeout=30)
        if r1.returncode == 0:
            r2 = subprocess.run([FFMPEG, '-y', '-i', pcm_path, '-acodec', 'libmp3lame', '-q:a', '2', str(out_path)],
                                capture_output=True, timeout=30)
            for p in [pcm_path, wav_path]:
                Path(p).unlink(missing_ok=True)
        if r2.returncode != 0 or os.path.getsize(out_path) < 1000:
            log(f"  gTTS re-encode failed, will use silent audio")
            Path(out_path).unlink(missing_ok=True)
            return False
    return True

def make_silent_audio(path, duration=30):
    """Create silent audio using a pre-created silent MP3 to avoid FFmpeg path issues."""
    import tempfile as _tmp
    # Write PCM raw data to a tmp file then convert — avoids path issues with lavfi
    silent_wav = Path(_tmp.gettempdir()) / f"_silent_{int(duration)}.wav"
    silent_mp3 = Path(_tmp.gettempdir()) / f"_silent_{int(duration)}.mp3"
    try:
        if not silent_wav.exists():
            with open(silent_wav, 'wb') as f:
                # PCM: 32000Hz mono u8, duration seconds
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
        os.makedirs(os.path.dirname(str(out_path)), exist_ok=True)
        with open(out_path, 'wb') as f:
            f.write(audio)
        size = os.path.getsize(out_path)
        # Require minimum size: roughly 100 bytes per second of audio
        min_size = max(10000, len(clean) * 15)  # at least 10KB, or 15 bytes per char
        if size < min_size:
            log(f"MiniMax TTS too small: {size} bytes (expected >={min_size})")
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
    cmd = [FFMPEG, '-y', '-f', 'concat', '-safe', '0',
           '-i', str(list_path),
           '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
           '-b:v', '2000k',  # minimum 2Mbps bitrate floor
           '-maxrate', '4000k', '-bufsize', '8000k',
           '-movflags', '+faststart',
           '-pix_fmt', 'yuv420p',
           str(out_path)]
    r = run(cmd, timeout=120, check=False)
    if r.returncode != 0:
        raise RuntimeError(f"Concat failed: {r.stderr.decode()[-300:]}")
    # Verify minimum bitrate after concat (at least 500KB minimum for any video)
    out_path_p = Path(out_path)
    if out_path_p.exists():
        size = out_path_p.stat().st_size
        min_size = 500000  # 500KB minimum for any video
        if size < min_size:
            raise RuntimeError(f"Concat output too small: {size} bytes (min {min_size})")
    return True

def mux_final(video_path, audio_path, out_path):
    cmd = [FFMPEG, '-y', '-i', str(video_path), '-i', str(audio_path),
           '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', str(out_path)]
    r = run(cmd, timeout=60, check=False)
    if r.returncode != 0:
        raise RuntimeError(f"Mux failed: {r.stderr.decode()[-300:]}")
    return True

def build_narration(script):
    """Build Vietnamese narration from script concept"""
    hook = script.get('concept', {}).get('hook', '')
    arc = script.get('concept', {}).get('story_arc', '')
    emotion = script.get('concept', {}).get('emotion', '')
    title = script.get('title', '')
    # Create a narrative from available info
    parts = [hook] if hook else []
    if arc:
        parts.append(arc.replace(' — ', '. ').replace(' -> ', '. '))
    if len(parts) == 0:
        parts = [title]
    narration = ' '.join(parts)
    # Limit to reasonable TTS length
    return narration[:400]

def produce_video(vid, script, raw_shots_exist, temp_parent):
    """Produce a single video. Returns (success, message)"""
    OUTPUT_DIR = OUTPUT_BASE / vid
    OUTPUT_DIR.mkdir(exist_ok=True)
    OUTPUT_VIDEO = OUTPUT_DIR / "final.mp4"
    TEMP_DIR = temp_parent / f"_temp_{vid}"
    TEMP_DIR.mkdir(exist_ok=True)

    log(f"=== {vid}: {script.get('title', 'N/A')} ===")
    
    # Check already done
    if OUTPUT_VIDEO.exists() and OUTPUT_VIDEO.stat().st_size > 1000000:
        log(f"  Already exists: {OUTPUT_VIDEO} ({OUTPUT_VIDEO.stat().st_size} bytes) - SKIP")
        return True, "already_exists"

    shots = script.get('shots', [])
    
    # Get Pexels video IDs from shots (if any were previously downloaded)
    shot_dir = ROOT / "output/xianxia" / vid
    clips_out = []
    
    for i, shot in enumerate(shots, 1):
        shot_file = shot_dir / f"raw_shot_{i}.mp4"
        portrait_path = TEMP_DIR / f"shot{i}_portrait.mp4"
        
        if raw_shots_exist and shot_file.exists() and shot_file.stat().st_size > 10000:
            # Use existing raw shot
            log(f"  Shot {i}: using existing {shot_file.name}")
            try:
                process_clip(str(shot_file), str(portrait_path), duration=6)
                clips_out.append(str(portrait_path))
            except Exception as e:
                log(f"  Shot {i} process failed: {e}, using black")
                make_black(portrait_path)
                clips_out.append(str(portrait_path))
        else:
            # Download from Pexels
            prompt = shot.get('prompt', '')
            if not prompt:
                log(f"  Shot {i}: no prompt, using black")
                make_black(portrait_path)
                clips_out.append(str(portrait_path))
                continue
            
            log(f"  Shot {i}: searching Pexels: {prompt[:80]}")
            videos = search_pexels(prompt, per_page=5)
            
            raw_path = TEMP_DIR / f"shot{i}_raw.mp4"
            if videos:
                vid_data = videos[0]
                log(f"    Got video ID={vid_data['id']}, dur={vid_data['duration']}s")
                ok = download_pexels(vid_data['id'], str(raw_path))
                if not ok or os.path.getsize(str(raw_path)) < 10000:
                    log(f"    Download failed, using black")
                    make_black(raw_path)
            else:
                log(f"    No video found, using black")
                make_black(raw_path)

            try:
                process_clip(str(raw_path), str(portrait_path), duration=6)
                clips_out.append(str(portrait_path))
            except Exception as e:
                log(f"    Process clip failed: {e}, using black")
                make_black(portrait_path)
                clips_out.append(str(portrait_path))

        time.sleep(0.3)

    # Concat
    log(f"  Concatenating {len(clips_out)} clips...")
    concat_raw = TEMP_DIR / "concat_raw.mp4"
    try:
        concat_clips(clips_out, str(concat_raw))
        if not concat_raw.exists() or concat_raw.stat().st_size < 10000:
            raise RuntimeError(f"Concat output invalid: {concat_raw} ({concat_raw.stat().st_size if concat_raw.exists() else 'missing'} bytes)")
        log(f"  Concat: {concat_raw.stat().st_size} bytes")
    except Exception as e:
        log(f"  Concat failed: {e}")
        return False, f"concat_failed: {e}"

    # TTS
    narration = build_narration(script)
    log(f"  TTS: {narration[:100]}...")
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
            log(f"  Silent audio also failed — video will be silent")
            # Touch the file so mux doesn't crash
            Path(audio_path).touch()
            tts_ok = False
    # Validate audio is decodable by FFmpeg before muxing
    if tts_ok and audio_path.exists():
        probe = subprocess.run(
            [FFMPEG, '-v', 'quiet', '-i', str(audio_path), '-f', 'null', '-'],
            capture_output=True, timeout=15
        )
        if probe.returncode != 0:
            log(f"  Audio not decodable by FFmpeg — using silent audio")
            Path(audio_path).unlink(missing_ok=True)
            if not make_silent_audio(str(audio_path), 30):
                Path(audio_path).touch()
                tts_ok = False
            else:
                tts_ok = True

    # Mux
    try:
        mux_final(str(concat_raw), str(audio_path), str(OUTPUT_VIDEO))
    except Exception as e:
        log(f"  Mux failed: {e}")
        return False, f"mux_failed: {e}"

    size = OUTPUT_VIDEO.stat().st_size
    log(f"  DONE: {OUTPUT_VIDEO} ({size} bytes)")
    
    # Cleanup
    try:
        for f in TEMP_DIR.glob("*"):
            f.unlink()
        TEMP_DIR.rmdir()
    except:
        pass
    
    return True, f"done:{size}bytes"

def main():
    # Videos to produce and their raw_shot status
    videos = {
        # GOAL-8: All 60 new XiAnyX scripts — Episodes 21-30
        # Ha Tien Du E21-30
        'XIANYX-111': False, 'XIANYX-112': False, 'XIANYX-113': False,
        'XIANYX-114': False, 'XIANYX-115': False, 'XIANYX-116': False,
        'XIANYX-117': False, 'XIANYX-118': False, 'XIANYX-119': False,
        'XIANYX-120': False,
        # Trieu Tien E21-30
        'XIANYX-121': False, 'XIANYX-122': False, 'XIANYX-123': False,
        'XIANYX-124': False, 'XIANYX-125': False, 'XIANYX-126': False,
        'XIANYX-127': False, 'XIANYX-128': False, 'XIANYX-129': False,
        'XIANYX-130': False,
        # Dau Pha Thuong Khau E21-30
        'XIANYX-131': False, 'XIANYX-132': False, 'XIANYX-133': False,
        'XIANYX-134': False, 'XIANYX-135': False, 'XIANYX-136': False,
        'XIANYX-137': False, 'XIANYX-138': False, 'XIANYX-139': False,
        'XIANYX-140': False,
        # Tru Tien E21-30
        'XIANYX-141': False, 'XIANYX-142': False, 'XIANYX-143': False,
        'XIANYX-144': False, 'XIANYX-145': False, 'XIANYX-146': False,
        'XIANYX-147': False, 'XIANYX-148': False, 'XIANYX-149': False,
        'XIANYX-150': False,
        # Thanh Van Mon E21-30
        'XIANYX-151': False, 'XIANYX-152': False, 'XIANYX-153': False,
        'XIANYX-154': False, 'XIANYX-155': False, 'XIANYX-156': False,
        'XIANYX-157': False, 'XIANYX-158': False, 'XIANYX-159': False,
        'XIANYX-160': False,
        # Muc Than Ky E21-30
        'XIANYX-161': False, 'XIANYX-162': False, 'XIANYX-163': False,
        'XIANYX-164': False, 'XIANYX-165': False, 'XIANYX-166': False,
        'XIANYX-167': False, 'XIANYX-168': False, 'XIANYX-169': False,
        'XIANYX-170': False,
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
