import json, os
from datetime import datetime, timezone

ids = ['PW-01_2-minute-rule','PW-02_meeting-output','PW-03_sunday-night-ritual',
       'PW-04_email-trap','PW-05_90-minute-rhythm']
scripts = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/scripts/pending'
output_dir = 'C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/output_topic/videos'
now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

for id in ids:
    path = f'{scripts}/{id}.json'
    with open(path, encoding='utf-8') as f:
        d = json.load(f)
    vid_path = f'{output_dir}/{id}.mp4'
    d['video_path'] = vid_path
    d['produced_at'] = now
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    size = os.path.getsize(vid_path) if os.path.exists(vid_path) else 0
    print(f'UPDATED: {id} -> {size//1024}KB')
