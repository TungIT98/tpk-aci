import requests
import json
import os
import subprocess
import hashlib

PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
script_id = "GZ-02"

# GZ-02 concept: morning phone scrolling vs productive morning
search_queries = [
    ("scroll", "person phone scrolling dark room morning"),  
    ("productive", "young person morning running productive"),  
]

headers = {"Authorization": PEXELS_KEY}
output_dir = f"C:/tmp/openclaw/uploads/{script_id}"
os.makedirs(output_dir, exist_ok=True)

results = {}
for label, q in search_queries:
    r = requests.get("https://api.pexels.com/videos/search", 
                     headers=headers, 
                     params={"query": q, "per_page": 5, "orientation": "portrait", "size": "small"})
    data = r.json()
    print(f"Query [{label}]: {q}")
    print(f"  Total: {data.get('total_results', 0)}")
    if data.get('videos'):
        v = data['videos'][0]
        video_id = v['id']
        video_files = v['video_files']
        # Find portrait video
        portrait = [f for f in video_files if f.get('width', 1080) < f.get('height', 1920)]
        if portrait:
            best = portrait[0]
        else:
            best = video_files[0]
        duration = best.get('duration', 0)
        link = best.get('link', '')
        print(f"  Best: id={video_id}, {best.get('width')}x{best.get('height')}, {best.get('size')}, duration={duration}s")
        print(f"  Link: {link[:80]}")
        
        # Download
        out_path = f"{output_dir}/{label}.mp4"
        dl = requests.get(link, headers=headers, timeout=30)
        with open(out_path, 'wb') as f:
            f.write(dl.content)
        md5 = hashlib.md5(dl.content).hexdigest()
        print(f"  Downloaded: {out_path} ({len(dl.content)} bytes, MD5={md5})")
        results[label] = {"path": out_path, "duration": duration, "md5": md5}
    else:
        print(f"  No results: {data}")

print("\nAll results:", json.dumps(results, indent=2))
