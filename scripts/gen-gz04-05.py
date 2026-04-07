"""
gen-gz04-05.py - Generate GZ-04 and GZ-05 missing videos
"""
import os, json, sys, math, urllib.parse, ssl
import subprocess
from pathlib import Path

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
SCRIPTS_DIR = ROOT / "scripts/pending"
OUTPUT_DIR = ROOT / "output_topic/videos"
TEMP_DIR = ROOT / "output/_temp_gz04_05"
FFMPEG = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffmpeg.exe"
FPROBE = "C:/New folder/ffmpeg-2025-12-01-git-7043522fe0-essentials_build/bin/ffprobe.exe"

OUTPUT_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOZfhgJtKiT04fWsaEa"
MINIMAX_KEY = "sk-cp-JKcLn8JXdkygpTgwCS72isp9Zz7AswQeFdh5uKnvk0vngQHaLa6NVBOwSZ8v6xZybbPM3ck-L1UmOYff7EsliddMUK4Hk-za3N0-wUWse_Nsj--6J_n9XPw"
MINIMAX_BASE = "https://api.minimax.io"

def log(*args):
    ts = subprocess.run('powershell Get-Date -Format HH:mm:ss', shell=True, capture_output=True, text=True).stdout.strip()
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

def download_file(url, out_path):
    import urllib.request
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    with open(out_path, 'wb') as f:
        f.write(data)
    return len(data)

def search_pexels(query, per_page=5):
    import requests
    url = f"https://api.pexels.com/videos/search?query={urllib.parse.quote(query)}&per_page={per_page}&orientation=portrait&duration_max=30"
    resp = requests.get(url, headers={'Authorization': PEXELS_KEY}, timeout=15)
    data = resp.json()
    videos = data.get('videos', [])
    return [v for v in videos if v['width'] >= 720 and 5 <= v['duration'] <= 30]

def process_clip_to_portrait(in_path, out_path, target_duration=None, duration=None):
    if duration is None:
        duration = get_duration(in_path)
    if target_duration is None:
        target_duration = min(duration, 15)

    cmd = [
        FFMPEG, '-y', '-i', in_path,
        '-vf', f'trim=0:{target_duration},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=in_h*9/16:in_h,scale=1080:-2',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-an', '-t', str(target_duration),
        str(out_path)
    ]
    r = run(cmd, timeout=120, check=False)
    if r.returncode != 0:
        log(f"  First attempt failed, trying copy codec...")
        # Try stream copy first then encode
        cmd2 = [
            FFMPEG, '-y', '-i', in_path,
            '-vf', f'trim=0:{target_duration},setpts=PTS-STARTPTS,scale=1080:-2',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
            '-pix_fmt', 'yuv420p',
            '-an', '-t', str(target_duration),
            str(out_path)
        ]
        r2 = run(cmd2, timeout=120, check=False)
        if r2.returncode != 0:
            raise RuntimeError(f"FFmpeg failed both attempts: {r2.stderr.decode()[-200] if r2.stderr else 'no stderr'}")

def gen_minimax_tts(text, out_path):
    clean = text.replace('"', ' ').replace("'", ' ').replace('\n', ' ').replace('  ', ' ').strip()
    body = {
        "model": "speech-2.8-hd",
        "text": clean,
        "stream": False,
        "voice_setting": {"voice_id": "male_qn_qingse", "speed": 1.1, "vol": 1.0, "pitch": 0},
        "output_format": {"sample_rate": 32000, "bitrate": 128000, "format": "mp3"}
    }
    data = json.dumps(body).encode()
    ctx = ssl.create_default_context()
    req = urllib.request.Request(
        f"{MINIMAX_BASE}/v1/t2a_v2",
        data=data,
        headers={'Authorization': f'Bearer {MINIMAX_KEY}', 'Content-Type': 'application/json'},
        method='POST'
    )
    with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
        audio = resp.read()
    with open(out_path, 'wb') as f:
        f.write(audio)
    return len(audio) > 1000

def gen_gtts(text, out_path):
    import tempfile
    script_path = TEMP_DIR / "_gtts_runner.py"
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write('from gtts import gTTS; gTTS(text=' + repr(text) + ', lang="en", slow=False).save(' + repr(out_path) + ')')
    r = subprocess.run(['python', str(script_path)], capture_output=True, timeout=30)
    if r.returncode != 0:
        raise RuntimeError(f"gTTS failed: {r.stderr.decode()[:200]}")
    return True

def make_concat_list(clips, out_path):
    with open(out_path, 'w') as f:
        for c in clips:
            f.write(f"file '{c}'\n")

def concat_clips(clips, out_path):
    list_path = TEMP_DIR / "concat.txt"
    make_concat_list(clips, str(list_path))
    cmd = [FFMPEG, '-y', '-f', 'concat', '-safe', '0',
           '-i', str(list_path), '-c', 'copy', str(out_path)]
    run(cmd, timeout=120)

def loop_video_to_audio(video_path, audio_path, out_path, audio_duration):
    cmd = [FFMPEG, '-y', '-stream_loop', '-1', '-i', video_path,
           '-i', audio_path,
           '-map', '0:v', '-map', '1:a',
           '-c:v', 'libx264', '-preset', 'ultrafast',
           '-c:a', 'aac',
           '-shortest', '-t', str(math.ceil(audio_duration) + 1),
           str(out_path)]
    run(cmd, timeout=120)

def mux(video_path, audio_path, out_path):
    cmd = [FFMPEG, '-y', '-i', video_path, '-i', audio_path,
           '-c:v', 'copy', '-c:a', 'aac', '-shortest', str(out_path)]
    run(cmd, timeout=60)

def generate_video(video_id, video_filename, search_terms, narration, clip_count=3, clip_duration=12):
    """Main generation pipeline."""
    log(f"\n{'='*50}")
    log(f"Generating {video_id} -> {video_filename}")
    log(f"{'='*50}")

    temp_dir = TEMP_DIR / video_id
    temp_dir.mkdir(exist_ok=True)

    # 1. Search and download clips
    clips = []
    for i, term in enumerate(search_terms[:clip_count]):
        log(f"  Searching: {term}")
        results = search_pexels(term, per_page=5)
        if not results:
            log(f"    No results for: {term}")
            continue
        video = results[0]
        files = sorted(video['video_files'], key=lambda f: f.get('height', 0), reverse=True)
        best = files[0]
        clip_path = temp_dir / f"raw_{i}.mp4"
        log(f"    Downloading clip {video['id']} ({video['duration']}s, {best.get('width')}x{best.get('height')})")
        sz = download_file(best['link'], str(clip_path))
        log(f"    Downloaded: {sz/1024/1024:.1f}MB")
        clips.append((str(clip_path), video['duration']))
        if len(clips) >= clip_count:
            break

    if not clips:
        log(f"ERROR: No clips found for {video_id}")
        return False

    # 2. Process clips to portrait
    processed = []
    for i, (clip_path, duration) in enumerate(clips):
        out = temp_dir / f"proc_{i}.mp4"
        td = min(duration, clip_duration)
        log(f"  Processing clip {i}: trim to {td}s")
        process_clip_to_portrait(clip_path, out, target_duration=td)
        processed.append(str(out))

    # 3. Concatenate
    video_concat = str(temp_dir / "video_concat.mp4")
    concat_clips(processed, video_concat)
    video_duration = get_duration(video_concat)
    log(f"  Video duration: {video_duration:.1f}s")

    # 4. TTS
    tts_path = str(temp_dir / "audio.mp3")
    tts_ok = False
    try:
        gen_gtts(narration, tts_path)
        log(f"  gTTS OK")
        tts_ok = True
    except Exception as e2:
        log(f"  gTTS failed: {e2}, trying MiniMax")
        try:
            gen_minimax_tts(narration, tts_path)
            log(f"  MiniMax TTS OK")
            tts_ok = True
        except Exception as e:
            log(f"  MiniMax TTS also failed: {e}")

    if not tts_ok:
        log(f"ERROR: TTS failed for {video_id}")
        return False

    # Convert to wav for duration check
    wav_path = str(temp_dir / "audio.wav")
    run([FFMPEG, '-y', '-i', tts_path, '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', wav_path], timeout=30)
    tts_duration = get_duration(wav_path)
    log(f"  TTS duration: {tts_duration:.1f}s")

    # 5. Loop video if needed
    if tts_duration > video_duration + 0.5:
        log(f"  Looping video to match TTS...")
        final_video = str(temp_dir / "video_looped.mp4")
        loop_video_to_audio(video_concat, tts_path, final_video, tts_duration)
    else:
        final_video = video_concat

    # 6. Mux
    final_path = OUTPUT_DIR / video_filename
    mux(final_video, wav_path, str(final_path))

    size = os.path.getsize(str(final_path))
    final_dur = get_duration(str(final_path))
    log(f"\n✅ {video_id} DONE: {size/1024/1024:.1f}MB, {final_dur:.1f}s")
    log(f"   -> {final_path}")
    return True

# =====================================================================
# DEFINE THE 2 MISSING VIDEOS
# =====================================================================
videos = {
    "GZ-04": {
        "filename": "GZ-04_anxiety-superpower.mp4",
        "search_terms": [
            "stressed person laptop desk late night work",
            "anxious person working computer worry",
            "young professional stressed office work",
            "person desk late night laptop thinking"
        ],
        "narration": "High-functioning anxiety people: your brain isn't broken. It's calibrated for a world your ancestors lived in. Here's the neuroscience. Anxiety is a hyperactive prefrontal cortex combined with heightened threat detection. It's your brain's alarm system — designed to keep your ancestors alive in dangerous environments. The problem: your ancestors faced tigers. Your brain sees existential threats in Slack messages and unread emails. Same alarm system, wrong triggers. It's not a bug. It's a feature misdirected. Channel it into systems. Anxious people are exceptional at contingency planning. Every worst-case scenario your brain runs? Use that energy to build backup plans, not worry about them. Name your anxiety's superpower. Mine is: I see every way something can go wrong — which means I also see every way to prevent it. The 5-4-3-2-1 audit: when anxiety spikes, name 5 things you see, 4 you hear, 3 you feel, 2 you smell, 1 you taste. Resets your nervous system in 60 seconds. Your anxiety is a superpower when you understand the operating system. Drop SUPERPOWER if this resonated. Following is the best investment you make this year for understanding how your brain actually works."
    },
    "GZ-05": {
        "filename": "GZ-05_rich-habits.mp4",
        "search_terms": [
            "person holding coffee cup surprised",
            "young person coffee shop laptop money",
            "coffee laptop work cafe young person",
            "person calculator budget finance work"
        ],
        "narration": "I spent 400 dollars a month on coffee. And I didn't realize I was slowly becoming broke until I did this five-minute math. Wealth isn't about how much you earn. It's about three daily behaviors. Rule one: track your fun spending — not your full budget. Awareness alone reduces it by 23 percent without restricting yourself. You don't need a spreadsheet. Just one number: how much you spent on non-essentials this week. Rule two: the 24-hour rule. Before any purchase over 50 dollars, wait one full night. Most impulse buys disappear by morning. Rule three: automate savings last. Save after expenses — not before. And name your savings account something exciting. Trip to Japan fund. My first investment. Weekend escape fund. Saving feels like sacrifice when it's vague. It feels like progress when it has a name and a purpose. That's how wealthy people think about money. Five minutes a day on your finances equals five hours a year of clarity. Your future self will thank you. Drop a CLARITY in the comments. Follow for weekly money breakdowns that actually apply to your life."
    }
}

# Generate all 2
results = {}
for vid_id, info in videos.items():
    out_path = OUTPUT_DIR / info["filename"]
    if out_path.exists() and out_path.stat().st_size > 500_000:
        log(f"✅ {vid_id} already exists ({out_path.stat().st_size//1024}KB), skipping")
        results[vid_id] = True
        continue
    ok = generate_video(vid_id, info["filename"], info["search_terms"], info["narration"])
    results[vid_id] = ok

log("\n" + "="*50)
log("SUMMARY")
log("="*50)
for k, v in results.items():
    log(f"  {k}: {'✅ OK' if v else '❌ FAILED'}")
