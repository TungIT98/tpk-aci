import requests
key = '1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa'
headers = {'Authorization': key}

# Test the long query
q = 'Extreme wide shot - deep in a forest at night'
r = requests.get('https://api.pexels.com/videos/search', headers=headers, params={'query': q, 'per_page': 5, 'orientation': 'portrait'})
data = r.json()
print('Long query total:', data.get('total_results', 0))

# Test with shorter keywords
queries = ['dark forest night', 'kneeling mud', 'ancient book pagoda', 'storm clouds rain', 'fantasy warrior', 'chinese martial arts']
for q in queries:
    r = requests.get('https://api.pexels.com/videos/search', headers=headers, params={'query': q, 'per_page': 3, 'orientation': 'portrait'})
    data = r.json()
    print(f'Query "{q}": {data.get("total_results", 0)} videos')
    if data.get('videos'):
        v = data['videos'][0]
        print(f'  Best: {v["width"]}x{v["height"]} dur:{v.get("duration")}s id:{v["id"]}')
