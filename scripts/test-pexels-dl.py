from urllib.request import urlopen, Request

# Test video download without auth header
url = "https://videos.pexels.com/video-files/7989870/7989870-hd_1080_1920_25fps.mp4"
req = Request(url)
try:
    with urlopen(req, timeout=10) as r:
        print(f"Status: {r.status}")
        print(f"Content-Length: {r.headers.get('Content-Length', 'unknown')}")
        print("OK - no auth needed for video download")
except Exception as e:
    print(f"Error: {e}")
