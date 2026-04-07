"""
Test runner for GOAL-8 — process first 3 videos to verify pipeline works
"""
import sys, json, subprocess
from pathlib import Path

ROOT = Path(r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI")
sys.path.insert(0, str(ROOT / "scripts"))

# Import the key vars and function from gen-goal8-batch.py
import gen_goal8_batch as g8

temp_parent = ROOT / "temp"
temp_parent.mkdir(exist_ok=True)

test_videos = {
    "XIANYX-111": False,
    "XIANYX-112": False,
    "XIANYX-113": False,
}

def log(*args):
    ts = subprocess.run('powershell Get-Date -Format "HH:mm:ss"', shell=True, capture_output=True, text=True).stdout.strip()
    print(f"[{ts}]", *args)

results = {}
for vid, raw_exists in test_videos.items():
    script_path = ROOT / "scripts" / "pending" / "xianxia" / f"{vid}.json"
    if not script_path.exists():
        print(f"{vid}: MISSING SCRIPT")
        results[vid] = "script_missing"
        continue
    with open(script_path, encoding='utf-8-sig') as f:
        script = json.load(f)
    log(f"Starting {vid}...")
    ok, msg = g8.produce_video(vid, script, raw_exists, temp_parent)
    results[vid] = msg
    print(f"{vid}: {ok} - {msg}")

log("\n=== TEST SUMMARY ===")
for vid, msg in results.items():
    log(f"  {vid}: {msg}")
