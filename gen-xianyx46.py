import subprocess, os

FFMPEG = r'C:\NEWFOL~1\FFMPEG~1\bin\ffmpeg.exe'
CLIPS_DIR = r'C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\output_topic\clips'

shot_trims = {
    'shot1': ('8710889', '0', '6'),
    'shot2': ('9467029', '5', '11'),
    'shot3': ('9645577', '0', '6'),
    'shot4': ('9467029', '15', '21'),
    'shot5': ('31368547', '0', '6'),
}

trimmed_files = []
for shot, (vid, start, end) in shot_trims.items():
    src = os.path.join(CLIPS_DIR, f'{vid}.mp4')
    out = os.path.join(CLIPS_DIR, f'xianyx46_{shot}.mp4')
    if os.path.exists(out):
        print(f'  Already exists: {shot}')
        trimmed_files.append(out)
        continue
    vf_filter = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2'
    cmd = [FFMPEG, '-y', '-ss', start, '-i', src, '-t', '6',
           '-vf', vf_filter, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-an', out]
    print(f'Trimming {shot}...')
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0 and os.path.exists(out):
        print(f'  Done: {os.path.getsize(out)//1024}KB')
        trimmed_files.append(out)
    else:
        print(f'  FAILED: {shot}')
        print(result.stdout[-500:] if result.stdout else '')
        print(result.stderr[-500:] if result.stderr else '')

print('Trimmed files:', len(trimmed_files))
