"""
gen-xianyx26.py - XIANYX-26 Trieu Tien Episode 6: The Patriarch's Arrival
5 shots x 6s = 30s. Pexels fallback. gTTS Vietnamese.
"""
import os, json, sys, urllib.parse, ssl, subprocess, time, requests
from pathlib import Path

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
OUTPUT_VIDEO = ROOT / "output_topic/videos/XIANYX-26.mp4"
TEMP_DIR = ROOT / "output/_temp_xianyx26"
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

def make_black(path, duration=6):
    run([FFMPEG, '-y', '-f', 'lavfi',
         '-i', f'color=c=black:s=1080x1920:d={duration}',
         '-t', str(duration), str(path)], timeout=30, check=False)

def gen_gtts(text, out_path):
    import tempfile, subprocess as sp
    tmp = TEMP_DIR / "_gtts.py"
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write('from gtts import gTTS; gTTS(' + repr(text) + ', lang="vi", slow=False).save(' + repr(str(out_path)) + ')')
    r = sp.run(['python', str(tmp)], capture_output=True, timeout=30)
    if r.returncode != 0:
        log(f"gTTS failed: {r.stderr.decode()[:200]}")
        return False
    return os.path.getsize(out_path) > 1000

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

def concat_clips(clips, out_path):
    list_path = TEMP_DIR / "concat.txt"
    with open(list_path, 'w') as f:
        for c in clips:
            f.write(f"file '{c}'\n")
    cmd = [FFMPEG, '-y', '-f', 'concat', '-safe', '0',
           '-i', str(list_path),
           '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
           '-pix_fmt', 'yuv420p',
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
    log("=== XIANYX-26 Trieu Tien Episode 6: The Patriarch's Arrival ===")
    
    if OUTPUT_VIDEO.exists() and OUTPUT_VIDEO.stat().st_size > 1000000:
        log(f"Video already exists: {OUTPUT_VIDEO}")
        return True

    # 5 shots mapping:
    # Shot 1: Dawn temple sanctuary, disciples learning
    # Shot 2: Spiritual pressure descending, candles snuffing
    # Shot 3: Sky tearing, divine Patriarch descending
    # Shot 4: Hand catching divine blade, crimson light erupting
    # Shot 5: Three swords on altar, Patriarch humbled, dawn golden
    
    shot_queries = [
        ("ancient temple dawn golden light", "temple sunrise incense peaceful"),  # Shot 1: dawn temple sanctuary
        ("candles going out dark room", "light disappearing darkness supernatural"),  # Shot 2: candles extinguishing
        ("thunder lightning sky dramatic", "storm sky divine light breaking through"),  # Shot 3: sky tearing, divine descent
        ("fire explosion golden light dramatic", "flame burst dramatic close up golden energy"),  # Shot 4: crimson/gold light erupting
        ("golden sunrise temple ancient", "temple dawn golden peaceful serene"),  # Shot 5: three swords, dawn golden
    ]

    clips_out = []
    for i, (q1, q2) in enumerate(shot_queries, 1):
        log(f"Shot {i}: Searching: {q1}")
        videos = search_pexels(q1, per_page=5)
        if not videos:
            log(f"  No results, trying alt: {q2}")
            videos = search_pexels(q2, per_page=5)
        
        clip_path = TEMP_DIR / f"shot{i}_raw.mp4"
        portrait_path = TEMP_DIR / f"shot{i}_portrait.mp4"
        
        if videos:
            vid = videos[0]
            log(f"  Got video ID={vid['id']}, dur={vid['duration']}s")
            ok = download_pexels(vid['id'], str(clip_path))
            if not ok or os.path.getsize(str(clip_path)) < 10000:
                log(f"  Download failed, creating black fallback")
                make_black(clip_path)
        else:
            log(f"  No video found, creating black clip")
            make_black(clip_path)

        try:
            process_clip(str(clip_path), str(portrait_path), duration=6)
            clips_out.append(str(portrait_path))
        except Exception as e:
            log(f"  Process clip failed: {e}, using black portrait")
            make_black(portrait_path)
            clips_out.append(str(portrait_path))
        
        time.sleep(0.5)

    # Concat
    log("Concatenating clips...")
    concat_raw = TEMP_DIR / "concat_raw.mp4"
    concat_clips(clips_out, str(concat_raw))
    log(f"Concat done: {concat_raw.stat().st_size} bytes")

    # TTS narration (Vietnamese)
    narration = """Trong những ngày sau khi Đại Trưởng Lão bị đánh bại, tin đồn lan đi. Ngôi đền của Thánh Kiếm không còn là đống hoang tàn. Nó là một nơi thánh thiêng — nơi những đồ đệ chạy trốn khỏi các môn phái thối nát đến để học kiếm pháp đúng nghĩa: không phải vũ khí chinh phục, mà là lá chắn cho những ai không có gì. Cô đang giảng dạy thì bị gián đoạn bởi một áp lực tâm linh mà cô chỉ từng cảm nhận một lần trước đó — qua lưỡi kiếm, trong ký ức của cha cô. Người đã ra lệnh hành quyết ông. Trưởng Pháp Chủ của cả thiên hạ — kẻ đã ngồi phán xét ba trăm năm trước và ra lệnh giết Thánh Kiếm. Hắn ở ĐÂY. Hắn đến — không với một đội quân, không với một môn phái, mà với toàn bộ quyền uy thần thánh của thiên hạ. Trưởng Pháp Chủ dạy thầy của thầy của thầy — kẻ đã ra lệnh giết cha cô. Hắn mang theo thanh kiếm đã đầu hàng của cha cô như chiến lợi phẩm — bằng chứng rằng Thánh Kiếm đã bị làm nhục trước khi chết. Và hắn đến để làm điều tương với cô. Cô bắt được Lưỡi Phán Xét của thiên hạ — thanh kiếm có thể cắt qua bất kỳ phòng thủ tâm linh nào — trong tay không. Không phải vì cô mạnh hơn Trưởng Pháp Chủ. Mà vì cô đã trở thành điều cha cô không thể: không phải lưỡi kiếm có thể chiến đấu. Mà là trái tim có thể VƯỢT QUA chiến đấu. Cô không giết Trưởng Pháp Chủ. Cô thậm chí không đánh nhau hắn. Cô đơn giản biến đổi thanh kiếm của hắn — và cùng với nó, biểu tượng cuối cùng của quyền lực thiên hạ đối với di sản Thánh Kiếm. Ba thanh kiếm nay nằm trên bàn thờ đền: thanh kiếm phán xét của thiên hạ, đã biến đổi. Thanh kiếm đầu hàng của cha cô, đã được giành lại. Và thanh kiếm crimson cổ xưa đã bắt đầu tất cả. Ngôi đền — không chỉ là một nơi thánh thiêng. Nó là một tuyên ngôn."""

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
    log(f"✅ XIANYX-26 DONE: {OUTPUT_VIDEO} ({size} bytes)")

    # Cleanup
    for f in TEMP_DIR.glob("*"):
        try:
            f.unlink()
        except:
            pass
    try:
        TEMP_DIR.rmdir()
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
