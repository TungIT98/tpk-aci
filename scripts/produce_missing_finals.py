#!/usr/bin/env python3
"""Produce final.mp4 for the 14 scripts missing them.
Group A: FINAL file exists in uploads, just copy to outputs/
Group B: Need TTS generation + mux from raw videos in output_topic/videos/
"""
import os, json, shutil, subprocess
from pathlib import Path

FFMPEG = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe"
FFPROBE = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffprobe.exe"
UPLOADS = r"C:/tmp/openclaw/uploads"
OUTPUTS_DIR = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\output_topic\videos"
SCRIPTS_PENDING = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\scripts\pending"
FINAL_OUTPUTS = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\outputs"

def get_duration(path):
    try:
        cmd = [FFPROBE, "-v", "error", "-show_entries", "format=duration",
               "-of", "default=noprint_wrappers=1:nokey=1", path]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return float(r.stdout.strip())
    except:
        return None

def generate_tts(text, output_wav, target_dur):
    """Generate gTTS audio and trim/speed-adjust to target_dur seconds."""
    tmp_mp3 = output_wav + ".tmp.mp3"
    try:
        from gtts import gTTS
        tts = gTTS(text=text, lang='en', slow=False)
        tts.save(tmp_mp3)
    except Exception as e:
        print(f"    gTTS error: {e}")
        return False
    
    try:
        actual = get_duration(tmp_mp3)
        if actual and actual > 0:
            speed = actual / target_dur
            cmd = [FFMPEG, "-y", "-i", tmp_mp3,
                   "-filter:a", f"atempo={speed}",
                   "-t", str(target_dur),
                   "-ar", "44100", "-ac", "2",
                   output_wav]
        else:
            cmd = [FFMPEG, "-y", "-i", tmp_mp3,
                   "-t", str(target_dur),
                   "-ar", "44100", "-ac", "2",
                   output_wav]
        r = subprocess.run(cmd, capture_output=True, timeout=60)
        if r.returncode != 0:
            print(f"    FFmpeg audio error: {r.stderr.decode('utf-8','replace')[-200:]}")
            return False
    finally:
        if os.path.exists(tmp_mp3):
            os.remove(tmp_mp3)
    return True

def mux(video_path, audio_path, output_path):
    """Combine video + audio. Uses -c:v copy when no vf filter needed."""
    cmd = [FFMPEG, "-y", "-i", video_path, "-i", audio_path,
           "-c:v", "copy", "-c:a", "aac", "-shortest", output_path]
    r = subprocess.run(cmd, capture_output=True, timeout=60)
    if r.returncode != 0:
        print(f"    mux error: {r.stderr.decode('utf-8','replace')[-200:]}")
        return False
    return True

def get_narration(script_path):
    """Extract full narration text from script JSON."""
    with open(script_path, encoding='utf-8-sig') as f:
        data = json.load(f)
    # Try audio.narration first
    audio = data.get('audio', {})
    if audio and isinstance(audio, dict):
        narration = audio.get('narration', '')
        if narration:
            return narration
    # Fall back to shots narration
    parts = []
    for shot in data.get('shots', []):
        n = shot.get('narration', '')
        if n:
            parts.append(n)
    return ' '.join(parts)

# =============================================================================
# GROUP A: Copy existing FINAL files from uploads
# =============================================================================
group_a = [
    # (script_id, upload_filename, output_folder)
    ("GZ-07", "GZ-07-final.mp4", "GZ-07"),
    ("GZ-10", "GZ-10-final.mp4", "GZ-10"),
    ("GZ-11", "GZ-11-final.mp4", "GZ-11"),
    ("GZ-12", "GZ-12-final.mp4", "GZ-12"),
    ("GZ-18", "GZ-18-FINAL.mp4", "GZ-18"),
    ("GZ-19", "GZ-19-FINAL.mp4", "GZ-19"),
    ("GZ-20", "GZ-20-FINAL.mp4", "GZ-20"),
]

print("=== GROUP A: Copy from uploads ===")
for script_id, upload_fn, out_folder in group_a:
    src = os.path.join(UPLOADS, upload_fn)
    dst_dir = os.path.join(FINAL_OUTPUTS, out_folder)
    dst = os.path.join(dst_dir, "final.mp4")
    if os.path.exists(src):
        os.makedirs(dst_dir, exist_ok=True)
        shutil.copy2(src, dst)
        sz = os.path.getsize(dst) / 1024
        print(f"  [{script_id}] COPY {upload_fn} -> outputs/{out_folder}/final.mp4 ({sz:.1f}KB)")
    else:
        print(f"  [{script_id}] MISSING: {src}")

# =============================================================================
# GROUP B: Need TTS + mux
# =============================================================================
group_b = [
    # (script_id, script_filename, video_filename, output_folder)
    ("GZ-01_10k-skill", "GZ-01_10k-skill.json", "GZ-01_10k-skill.mp4", "GZ-01_10k-skill"),
    ("HGF-02",          "HGF-02.json",          "HGF-02.mp4",          "HGF-02"),
    ("PW-01",           "PW-01_2-minute-rule.json", "PW-01_2-minute-rule.mp4", "PW-01"),
    ("PW-02",           "PW-02_meeting-output.json", "PW-02_meeting-output.mp4", "PW-02"),
    ("PW-03",           "PW-03_sunday-night-ritual.json", "PW-03_sunday-night-ritual.mp4", "PW-03"),
    ("PW-04",           "PW-04_email-trap.json",  "PW-04_email-trap.mp4",  "PW-04"),
    ("PW-05",           "PW-05_90-minute-rhythm.json", "PW-05_90-minute-rhythm.mp4", "PW-05"),
]

print("\n=== GROUP B: TTS + mux ===")
for script_id, script_fn, video_fn, out_folder in group_b:
    script_path = os.path.join(SCRIPTS_PENDING, script_fn)
    video_path = os.path.join(OUTPUTS_DIR, video_fn)
    dst_dir = os.path.join(FINAL_OUTPUTS, out_folder)
    dst = os.path.join(dst_dir, "final.mp4")
    
    if not os.path.exists(script_path):
        print(f"  [{script_id}] SCRIPT MISSING: {script_fn}")
        continue
    if not os.path.exists(video_path):
        print(f"  [{script_id}] VIDEO MISSING: {video_fn}")
        continue
    if os.path.exists(dst):
        sz = os.path.getsize(dst)
        print(f"  [{script_id}] Already exists: outputs/{out_folder}/final.mp4 ({sz/1024:.1f}KB)")
        continue
    
    print(f"  [{script_id}] Processing...")
    
    # Read script for duration and narration
    with open(script_path, encoding='utf-8-sig') as f:
        data = json.load(f)
    
    duration = float(data.get('duration_seconds', 6))
    narration = get_narration(script_path)
    
    if not narration:
        print(f"  [{script_id}] No narration text found, skipping TTS")
        # Just copy the video as-is
        os.makedirs(dst_dir, exist_ok=True)
        shutil.copy2(video_path, dst)
        print(f"  [{script_id}] Copied video-only to outputs/{out_folder}/final.mp4")
        continue
    
    # Generate TTS
    audio_path = os.path.join(dst_dir, "audio.wav")
    os.makedirs(dst_dir, exist_ok=True)
    
    print(f"  [{script_id}] Generating TTS ({len(narration)} chars, target={duration}s)...")
    ok = generate_tts(narration, audio_path, duration)
    if not ok:
        print(f"  [{script_id}] TTS failed, copying video only")
        shutil.copy2(video_path, dst)
        continue
    
    # Mux
    print(f"  [{script_id}] Muxing video+audio...")
    ok = mux(video_path, audio_path, dst)
    if ok:
        sz = os.path.getsize(dst)
        dur = get_duration(dst)
        print(f"  [{script_id}] DONE -> outputs/{out_folder}/final.mp4 ({sz/1024:.1f}KB, {dur:.1f}s)")
    else:
        print(f"  [{script_id}] MUX FAILED")

    # Cleanup audio
    if os.path.exists(audio_path):
        os.remove(audio_path)

print("\n=== All done ===")
