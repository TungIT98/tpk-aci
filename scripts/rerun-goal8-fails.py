"""Re-run 4 QC-fail videos from GOAL-8"""
import sys, json, subprocess
from pathlib import Path

ROOT = Path(r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI")
sys.path.insert(0, str(ROOT / "scripts"))
temp_parent = ROOT / "temp"
temp_parent.mkdir(exist_ok=True)

def log(*args):
    ts = subprocess.run('powershell Get-Date -Format "HH:mm:ss"', shell=True, capture_output=True, text=True).stdout.strip()
    print(f"[{ts}]", *args)

gen_src = open(ROOT / "scripts" / "gen-goal8-batch.py", encoding='utf-8-sig').read()
ns = {'ROOT': ROOT, 'temp_parent': temp_parent}
exec(gen_src, ns)
produce_video = ns['produce_video']
SCRIPT_DIR = ns['SCRIPT_DIR']

# Delete existing QC-fail files so produce_video re-runs
fail_ids = ["XIANYX-139", "XIANYX-142", "XIANYX-152", "XIANYX-166"]
for vid in fail_ids:
    out = ROOT / "output/xianxia" / vid / "final.mp4"
    if out.exists():
        out.unlink()
        log(f"Deleted QC-fail: {out}")

results = {}
for vid in fail_ids:
    script_path = SCRIPT_DIR / f"{vid}.json"
    if not script_path.exists():
        log(f"{vid}: MISSING SCRIPT"); results[vid]=("skip","script_missing"); continue
    with open(script_path, encoding='utf-8-sig') as f:
        script = json.load(f)
    log(f"Re-producing {vid}...")
    ok, msg = produce_video(vid, script, False, temp_parent)
    results[vid] = (ok, msg)
    log(f"  -> {ok}: {msg}")

log("\n=== RE-RUN SUMMARY ===")
for vid, (ok, msg) in results.items():
    p = ROOT / "output/xianxia" / vid / "final.mp4"
    size = p.stat().st_size if p.exists() else 0
    status = "PASS" if size > 1000000 else "FAIL"
    log(f"  {vid}: {ok} - {msg} | {size} bytes | {status}")
