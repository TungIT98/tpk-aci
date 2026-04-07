# -*- coding: utf-8 -*-
import subprocess, os, sys

FFMPEG = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe"
FFPROBE = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffprobe.exe"
WORKSPACE = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI"
SCRIPTS_PENDING = os.path.join(WORKSPACE, "scripts", "pending")
UPLOADS = r"C:/tmp/openclaw/uploads"
OUTPUT_VIDEOS = os.path.join(WORKSPACE, "output_topic", "videos")

def get_duration(video_path):
    try:
        cmd = [FFPROBE, "-v", "error", "-show_entries", "format=duration",
               "-of", "default=noprint_wrappers=1:nokey=1", video_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return float(result.stdout.strip())
    except:
        return None

def generate_audio(script_text, output_wav, target_duration):
    """Generate TTS audio and trim to target duration"""
    import tempfile
    from gtts import gTTS
    
    # Generate full TTS
    tmp_mp3 = output_wav + ".tmp.mp3"
    tts = gTTS(text=script_text, lang='en', slow=False)
    tts.save(tmp_mp3)
    
    # Get actual audio duration
    actual_duration = get_duration(tmp_mp3.replace('/', '\\'))
    if actual_duration is None:
        print(f"  [WARN] Could not get audio duration for {os.path.basename(output_wav)}")
        actual_duration = target_duration
    
    # Trim to target duration using ffmpeg
    speed_factor = actual_duration / target_duration
    cmd = [
        FFMPEG, "-y",
        "-i", tmp_mp3,
        "-filter:a", f"atempo={speed_factor}",
        "-t", str(target_duration),
        "-ar", "44100", "-ac", "2",
        output_wav
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        print(f"  [ERROR] ffmpeg: {result.stderr[:200]}")
    
    try:
        os.remove(tmp_mp3)
    except:
        pass
    
    return result.returncode == 0

def mux(video_path, audio_path, output_path):
    """Combine video + audio into final mp4"""
    cmd = [
        FFMPEG, "-y",
        "-i", video_path,
        "-i", audio_path,
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        print(f"  [ERROR] mux ffmpeg: {result.stderr[:300]}")
    return result.returncode == 0

def main():
    scripts = ["GZ-17", "GZ-18", "GZ-19", "GZ-20"]
    
    for sid in scripts:
        json_path = os.path.join(SCRIPTS_PENDING, f"{sid}.json")
        if not os.path.exists(json_path):
            print(f"[SKIP] {sid}.json not found")
            continue
        
        import json
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        script = data.get("script", "")
        duration = float(data.get("duration_seconds", 6))
        status = data.get("status", "")
        
        print(f"\n=== {sid} ===")
        print(f"  Status: {status}")
        print(f"  Duration: {duration}s")
        print(f"  Script: {script[:80]}...")
        
        # Video path
        video_path = os.path.join(OUTPUT_VIDEOS, f"{sid}.mp4")
        if not os.path.exists(video_path):
            # Try uploads dir
            video_path = os.path.join(UPLOADS, f"{sid}.mp4")
        
        final_path = os.path.join(UPLOADS, f"{sid}-FINAL.mp4")
        audio_path = os.path.join(UPLOADS, f"{sid}-audio.wav")
        
        if not os.path.exists(video_path):
            print(f"  [SKIP] Video not found: {video_path}")
            continue
        
        # Check if final already exists and is valid
        if os.path.exists(final_path):
            dur = get_duration(final_path.replace('/', '\\'))
            if dur and abs(dur - duration) < 1:
                print(f"  [SKIP] Final already exists and matches duration ({dur:.1f}s)")
                continue
        
        print(f"  Video: {os.path.basename(video_path)}")
        
        # Generate audio
        print(f"  Generating TTS audio...")
        ok = generate_audio(script, audio_path, duration)
        if not ok:
            print(f"  [FAIL] Audio generation failed")
            continue
        
        # Mux
        print(f"  Muxing video + audio...")
        ok = mux(video_path, audio_path, final_path)
        if not ok:
            print(f"  [FAIL] Mux failed")
            continue
        
        final_dur = get_duration(final_path.replace('/', '\\'))
        final_size = os.path.getsize(final_path) / (1024*1024)
        print(f"  [OK] {os.path.basename(final_path)} - {final_dur:.1f}s - {final_size:.1f}MB")
        
        # Clean up temp audio
        try:
            os.remove(audio_path)
        except:
            pass

if __name__ == "__main__":
    main()