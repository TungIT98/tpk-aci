"""
Regenerate missing GZ-02, GZ-04, GZ-05 videos.
Clips already exist in C:/tmp/openclaw/uploads/{id}/ directories.
Just need to assemble FINAL.mp4 with narration audio.
"""
import os
import json
import subprocess

FFMPEG = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe"
WORKSPACE = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI"
UPLOADS = r"C:\tmp\openclaw\uploads"

# FFmpeg path
if not os.path.exists(FFMPEG):
    FFMPEG = "ffmpeg"

def run(cmd):
    print("RUN:", " ".join(cmd if isinstance(cmd, list) else [cmd]))
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print("STDERR:", result.stderr[-500:])
    else:
        print("OK")
    return result.returncode == 0

def regenerate_video(script_id, clip_dir, narration_file, output_file):
    """Combine video clips with narration using FFmpeg."""
    concat_txt = os.path.join(clip_dir, "concat.txt")
    video_only = os.path.join(clip_dir, "video_only.mp4")
    final = os.path.join(UPLOADS, output_file)
    
    # Step 1: Create concat list if clips exist
    mp4_files = sorted([f for f in os.listdir(clip_dir) if f.startswith("clip") and f.endswith(".mp4")])
    
    if mp4_files:
        with open(concat_txt, "w") as f:
            for clip in mp4_files:
                f.write(f"file '{os.path.join(clip_dir, clip)}'\n")
        
        # Concatenate clips
        print(f"Concatenating {len(mp4_files)} clips...")
        run(f'"{FFMPEG}" -y -f concat -safe 0 -i "{concat_txt}" -c copy "{video_only}"')
    else:
        print("No clip files found!")
        return False
    
    # Step 2: Combine video with narration audio
    if os.path.exists(narration_file):
        print(f"Combining with audio: {narration_file}")
        run(f'"{FFMPEG}" -y -i "{video_only}" -i "{narration_file}" -shortest -c:v libx264 -preset fast -c:a aac "{final}"')
    else:
        print(f"Narration not found: {narration_file}, copying video only")
        run(f'copy "{video_only}" "{final}"')
    
    if os.path.exists(final):
        size = os.path.getsize(final)
        print(f"Generated: {final} ({size/1024:.0f}KB)")
        return True
    return False

# Check and regenerate each
missing = []
for script_id in ["GZ-02", "GZ-04", "GZ-05"]:
    clip_dir = os.path.join(UPLOADS, script_id)
    output_file = f"{script_id}-FINAL.mp4"
    final_path = os.path.join(UPLOADS, output_file)
    
    if not os.path.exists(final_path) or os.path.getsize(final_path) < 1_000_000:
        if os.path.exists(clip_dir):
            print(f"\n=== Regenerating {script_id} ===")
            
            # Find narration file
            narration = os.path.join(clip_dir, "narration.mp3")
            if not os.path.exists(narration):
                # Try finding any audio
                audio_files = [f for f in os.listdir(clip_dir) if f.endswith((".mp3", ".wav", ".aac"))]
                if audio_files:
                    narration = os.path.join(clip_dir, audio_files[0])
            
            success = regenerate_video(script_id, clip_dir, narration if os.path.exists(narration) else None, output_file)
            
            if not success:
                missing.append(script_id)
        else:
            print(f"Clip dir missing: {clip_dir}")
            missing.append(script_id)
    else:
        print(f"{script_id} already OK: {os.path.getsize(final_path)} bytes")

# Also copy to workspace output
for script_id in ["GZ-02", "GZ-04", "GZ-05"]:
    src = os.path.join(UPLOADS, f"{script_id}-FINAL.mp4")
    dst_dir = os.path.join(WORKSPACE, "output_topic", "videos")
    dst = os.path.join(dst_dir, f"{script_id}.mp4")
    
    if os.path.exists(src):
        size = os.path.getsize(src)
        if size > 1_000_000:
            import shutil
            shutil.copy2(src, dst)
            print(f"Copied to workspace: {dst} ({size/1024:.0f}KB)")
        else:
            print(f"Source too small: {src} ({size} bytes)")
    else:
        print(f"Source not found: {src}")

print("\nDone!")
