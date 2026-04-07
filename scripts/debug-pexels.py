import requests
import json
import os

PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
headers = {"Authorization": PEXELS_KEY}

queries = [
    "person phone dark bedroom",  
    "morning runner sunrise portrait",
    "person waking up morning light bed",
    "motivation sunrise workout",
]

for q in queries:
    r = requests.get("https://api.pexels.com/videos/search",
                     headers=headers,
                     params={"query": q, "per_page": 5, "orientation": "portrait"})
    data = r.json()
    print(f"\nQuery: {q}")
    for v in data.get('videos', [])[:3]:
        for f in v['video_files']:
            dur = f.get('duration', 0)
            w, h = f.get('width', 0), f.get('height', 0)
            print(f"  id={v['id']} {w}x{h} dur={dur}s link={f.get('link','')[:60]}")
