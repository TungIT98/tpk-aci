import requests

pexels_key = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa'

headers = {'Authorization': pexels_key}

queries = [
    ('shot1', 'person scrolling phone in bed dark room alarm morning'),
    ('shot2', 'morning routine productive person running workout notebook coffee'),
    ('shot3', 'phone locked drawer confident person morning walk'),
    ('shot4', 'young person speaking camera motivation success morning light'),
]

for name, q in queries:
    resp = requests.get('https://api.pexels.com/videos/search',
        headers=headers, params={'query': q, 'per_page': 5, 'orientation': 'portrait'})
    print(f'{name} ({resp.status_code}): {q}')
    if resp.status_code == 200:
        videos = resp.json()['videos']
        for v in videos[:3]:
            print(f'  ID={v["id"]} dur={v["duration"]}s {v["width"]}x{v["height"]}')
    print()
