"""Test-run GOAL-8: first 3 videos only"""
import sys, json, subprocess
from pathlib import Path

ROOT = Path(r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI")
sys.path.insert(0, str(ROOT / "scripts"))
temp_parent = ROOT / "temp"
temp_parent.mkdir(exist_ok=True)

def log(*args):
    ts = subprocess.run('powershell Get-Date -Format "HH:mm:ss"', shell=True, capture_output=True, text=True).stdout.strip()
    print(f"[{ts}]", *args)

# Load gen-goal8-batch globals by running it
gen_src = open(ROOT / "scripts" / "gen-goal8-batch.py", encoding='utf-8-sig').read()
ns = {'ROOT': ROOT, 'temp_parent': temp_parent}
exec(gen_src, ns)
produce_video = ns['produce_video']
SCRIPT_DIR = ns['SCRIPT_DIR']

test_ids = ["XIANYX-111", "XIANYX-112", "XIANYX-113"]
results = {}
for vid in test_ids:
    script_path = SCRIPT_DIR / f"{vid}.json"
    if not script_path.exists():
        log(f"{vid}: MISSING SCRIPT"); results[vid]=("skip","script_missing"); continue
    with open(script_path, encoding='utf-8-sig') as f:
        script = json.load(f)
    log(f"Producing {vid}...")
    ok, msg = produce_video(vid, script, False, temp_parent)
    results[vid] = (ok, msg)
    log(f"  -> {ok}: {msg}")

log("\n=== TEST SUMMARY ===")
for vid, (ok, msg) in results.items():
    log(f"  {vid}: {ok} - {msg}")
