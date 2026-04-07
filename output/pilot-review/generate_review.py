#!/usr/bin/env python3
"""
Generate TTS for movie review pilot episode
"""
import sys
import os
import json
import urllib.request
import urllib.error

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def load_env():
    env = {}
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(env_path):
        for line in open(env_path):
            t = line.strip()
            if not t or t.startswith('#'): continue
            eq = t.find('=')
            if eq == -1: continue
            env[t[:eq].strip()] = t[eq+1:].strip()
    return env

env = load_env()
MINIMAX_API_KEY = env.get('MINIMAX_API_KEY', '') or env.get('ANTHROPIC_TOKEN_KEY', '')
MINIMAX_BASE = env.get('MINIMAX_BASE_URL', 'https://api.minimax.io')

# Read script
script_path = os.path.join(os.path.dirname(__file__), 'script.txt')
with open(script_path, 'r', encoding='utf-8') as f:
    script = f.read()

# Remove markdown headers
lines = script.split('\n')
content_lines = []
for line in lines:
    if line.startswith('#'):
        continue  # Skip headers
    content_lines.append(line)

text = '\n'.join(content_lines)

print(f"Script length: {len(text)} characters")

# Use MiniMax TTS API
url = f"{MINIMAX_BASE}/v1/t2a_v2"

payload = {
    "model": "speech-2.8-hd",
    "text": text,
    "stream": False
}

data = json.dumps(payload).encode('utf-8')

req = urllib.request.Request(
    url,
    data=data,
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {MINIMAX_API_KEY}'
    },
    method='POST'
)

output_path = os.path.join(os.path.dirname(__file__), 'review_voiceover.mp3')

try:
    with urllib.request.urlopen(req, timeout=60) as response:
        audio_data = response.read()
        with open(output_path, 'wb') as f:
            f.write(audio_data)
        print(f"TTS generated: {output_path} ({len(audio_data)} bytes)")
except urllib.error.HTTPError as e:
    error_body = e.read().decode('utf-8') if e.fp else ''
    print(f"HTTP Error {e.code}: {error_body}")
except Exception as e:
    print(f"Error: {e}")
