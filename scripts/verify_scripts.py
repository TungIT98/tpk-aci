import os
import json

pending_dir = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\scripts\pending"
videos_dir = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\output_topic\videos"

# Get all video files
video_files = set(f for f in os.listdir(videos_dir) if f.endswith('.mp4'))
print(f"Total videos: {len(video_files)}")

# Get all scripts and check status
scripts = []
missing_videos = []
already_done = []

for fname in os.listdir(pending_dir):
    if not fname.endswith('.json'):
        continue
    fpath = os.path.join(pending_dir, fname)
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        try:
            script = json.load(f)
        except:
            print(f"ERROR loading {fname}")
            continue
    
    script_id = script.get('id', fname.replace('.json',''))
    video_name = script_id + '.mp4'
    status = script.get('status', 'unknown')
    
    has_video = video_name in video_files
    
    if status in ('published', 'produced'):
        already_done.append((fname, script_id, status, has_video))
    else:
        scripts.append((fname, script_id, status, has_video))
        if not has_video:
            missing_videos.append((fname, script_id))

print(f"\nAlready done (published/produced): {len(already_done)}")
print(f"Pending/not-produced: {len(scripts)}")
print(f"Missing videos: {len(missing_videos)}")

if missing_videos:
    print("\nMISSING VIDEOS:")
    for s in missing_videos[:10]:
        print(f"  {s}")

print("\nSample already_done:")
for s in already_done[:5]:
    print(f"  {s[0]} -> {s[3]} (has_video={s[3]})")

# Check if any done scripts are missing videos
done_no_video = [(s[0], s[1]) for s in already_done if not s[3]]
print(f"\nDone but missing video: {len(done_no_video)}")
for s in done_no_video[:5]:
    print(f"  {s}")
