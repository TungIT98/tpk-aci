#!/usr/bin/env python3
"""Mux videos with corrected FFmpeg (no streamcopy when using vf)"""
import subprocess, os
from pathlib import Path

videos = ['GZ-02','GZ-03','GZ-04','GZ-05','HGF-02','HGF-03','HGF-04','HGF-05','PW-01','PW-02','PW-03','PW-04','PW-05']
ROOT = Path('C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI')
TEMP = ROOT / 'output' / '_temp_gtts_pending'
OUTPUT = ROOT / 'output_topic' / 'videos'

def get_duration(path):
    r = subprocess.run(['ffprobe','-v','error','-show_entries','format=duration',
                       '-of','default=noprint_wrappers=1:nokey=1',str(path)],
                      capture_output=True, text=True, timeout=10)
    return float(r.stdout.strip())

for v in videos:
    video_path = TEMP / f'{v}_video.mp4'
    tts_path = TEMP / f'{v}_tts.mp3'
    if not video_path.exists():
        print(f'[{v}] No video, skipping')
        continue
    if not tts_path.exists():
        print(f'[{v}] No TTS, skipping')
        continue
    
    try:
        vid_dur = get_duration(video_path)
        tts_dur = get_duration(tts_path)
    except Exception as e:
        print(f'[{v}] Duration error: {e}')
        continue
    
    target_dur = min(vid_dur, 6.0)
    print(f'[{v}] Video:{vid_dur:.1f}s TTS:{tts_dur:.1f}s target:{target_dur:.1f}s')
    
    # Trim audio
    audio_trim = TEMP / f'{v}_audio_trim.mp3'
    r = subprocess.run(['ffmpeg','-y','-i',str(tts_path),'-t',str(target_dur),'-c','copy',str(audio_trim)],
                      capture_output=True, timeout=30)
    
    # Mux with re-encode (cannot use -c:v copy with -vf)
    out = OUTPUT / f'{v}-FINAL.mp4'
    args = ['ffmpeg','-y','-i',str(video_path),'-i',str(audio_trim),
            '-c:v','libx264','-preset','fast','-crf','23',
            '-c:a','aac',
            '-vf','scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
            '-t',str(target_dur),'-shortest',str(out)]
    r = subprocess.run(args, capture_output=True, timeout=120)
    if r.returncode != 0:
        err = r.stderr.decode('utf-8', errors='replace')
        print(f'[{v}] FFmpeg error: {err[-300:]}')
    else:
        sz = out.stat().st_size // 1024
        print(f'[{v}] DONE -> {out.name} ({sz}KB)')
        # Cleanup
        for p in [video_path, tts_path, audio_trim]:
            if p.exists(): p.unlink()