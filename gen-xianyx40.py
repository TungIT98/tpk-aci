import requests
import os

headers = {'Authorization': '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa'}

queries = {
    1: 'forest twilight mystical woman',
    4: 'emotional woman portrait closeup',
    5: 'golden flowers bloom forest'
}

for shot_num, q in queries.items():
    url = f'https://api.pexels.com/videos/search?query={q}&per_page=3&orientation=portrait'
    r = requests.get(url, headers=headers)
    data = r.json()
    print(f'Shot {shot_num} ({q}):')
    for v in data.get('videos', []):
        link = v['video_files'][0]['link']
        print(f'  ID={v["id"]} dur={v["duration"]}s: {link}')
    print()
