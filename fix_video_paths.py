"""
fix_video_paths.py — Production Manager
Fix data integrity issues found in TKP-2885.

For each published script, ensure the video exists at the expected path
(output_topic/videos/{id}.mp4) and update script metadata accordingly.
"""
import os
import shutil
import json
import glob
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
OUT_OLD = os.path.join(BASE, "output/videos")       # old location
OUT_NEW = os.path.join(BASE, "output_topic/videos")  # expected location
PENDING = os.path.join(BASE, "scripts/pending")

FIXED = []
COPIED_TO_NEW = []
MISSING = []
BROKEN = []
UPDATED_PATHS = []


def strip_bom(raw: str) -> str:
    return raw.lstrip("\ufeff")


def ffprobe_duration(path: str) -> float:
    """Return video duration in seconds, or 0 on error."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return float(result.stdout.strip())
    except Exception:
        pass
    return 0.0


def find_video(base_id: str):
    """
    Search for a video matching base_id in both directories.
    Returns (found_path, size) or (None, 0).
    """
    candidates = []

    # 1. Exact in output_topic/videos
    p = os.path.join(OUT_NEW, f"{base_id}.mp4")
    if os.path.exists(p):
        candidates.append((p, os.path.getsize(p)))

    # 2. -FINAL variant
    p = os.path.join(OUT_NEW, f"{base_id}-FINAL.mp4")
    if os.path.exists(p):
        candidates.append((p, os.path.getsize(p)))

    # 3. Any file in output_topic starting with base_id
    if os.path.exists(OUT_NEW):
        for f in os.listdir(OUT_NEW):
            if f.endswith(".mp4") and f.replace(".mp4", "").replace("-FINAL", "").startswith(base_id):
                p = os.path.join(OUT_NEW, f)
                candidates.append((p, os.path.getsize(p)))

    # 4. Exact in output/videos
    p = os.path.join(OUT_OLD, f"{base_id}.mp4")
    if os.path.exists(p):
        candidates.append((p, os.path.getsize(p)))

    # 5. -FINAL in output/videos
    p = os.path.join(OUT_OLD, f"{base_id}-FINAL.mp4")
    if os.path.exists(p):
        candidates.append((p, os.path.getsize(p)))

    # 6. Any file in output starting with base_id
    if os.path.exists(OUT_OLD):
        for f in os.listdir(OUT_OLD):
            if f.endswith(".mp4") and f.replace(".mp4", "").replace("-FINAL", "").startswith(base_id):
                p = os.path.join(OUT_OLD, f)
                candidates.append((p, os.path.getsize(p)))

    # Prefer largest valid file (>2MB), fallback to first found
    valid = [(p, s) for p, s in candidates if s >= 2 * 1024 * 1024]
    if valid:
        return max(valid, key=lambda x: x[1])
    if candidates:
        return candidates[0]
    return None, 0


def fix_script(fpath: str):
    """Process a single script file. Returns dict with fix result."""
    raw = open(fpath, encoding="utf-8").read()
    d = json.loads(strip_bom(raw))

    if d.get("status") != "published":
        return None

    script_id = d.get("id", "")
    expected_path = d.get("video_path", d.get("videoPath", ""))
    if not expected_path:
        return None

    # Extract the base video ID from the expected path
    # e.g. output_topic/videos/GZ-01_10k-skill.mp4 -> GZ-01_10k-skill
    vid_basename = os.path.basename(expected_path).replace(".mp4", "").replace("-FINAL", "")
    vid_id = d.get("id") or vid_basename

    result = {
        "script_id": script_id,
        "expected": expected_path,
        "found_path": None,
        "size": 0,
        "status": "ok",
        "action": "none",
    }

    # Check if video already exists at expected path
    if os.path.exists(expected_path):
        size = os.path.getsize(expected_path)
        if size < 2 * 1024 * 1024:
            result["status"] = "broken"
            result["action"] = "file_too_small"
            result["found_path"] = expected_path
            result["size"] = size
            BROKEN.append(result)
        else:
            result["found_path"] = expected_path
            result["size"] = size
            result["status"] = "ok"
            result["action"] = "already_correct"
            FIXED.append(result)
        return result

    # Video NOT at expected path — search for it
    found_path, size = find_video(vid_id)
    result["found_path"] = found_path
    result["size"] = size

    if found_path is None:
        result["status"] = "missing"
        result["action"] = "no_file_found"
        MISSING.append(result)
        return result

    if size < 2 * 1024 * 1024:
        result["status"] = "broken"
        result["action"] = "found_but_too_small"
        BROKEN.append(result)
        return result

    # Good file found elsewhere — copy to expected location
    os.makedirs(os.path.dirname(expected_path), exist_ok=True)
    shutil.copy2(found_path, expected_path)
    result["status"] = "fixed"
    result["action"] = f"copied_from {found_path.replace(BASE, '')}"
    COPIED_TO_NEW.append(result)
    FIXED.append(result)

    # Verify the copied file
    new_size = os.path.getsize(expected_path)
    new_dur = ffprobe_duration(expected_path)
    result["size"] = new_size
    result["duration"] = new_dur
    result["verified"] = new_size >= 2 * 1024 * 1024

    return result


def main():
    os.makedirs(OUT_NEW, exist_ok=True)

    scripts = glob.glob(os.path.join(PENDING, "*.json"))

    print(f"Processing {len(scripts)} script files...")
    print()

    for f in scripts:
        fix_script(f)

    print(f"RESULTS:")
    print(f"  FIXED (copied to output_topic/videos/): {len(COPIED_TO_NEW)}")
    for r in COPIED_TO_NEW:
        print(f"    {r['script_id']}: {r['action']} -> {r['found_path'].replace(BASE,'')} ({r['size']//1024//1024}MB, {r.get('duration',0):.1f}s)")

    print(f"\n  BROKEN (< 2MB, need regen): {len(BROKEN)}")
    for r in BROKEN:
        src = r['found_path'].replace(BASE,'') if r['found_path'] else 'NO_FILE'
        print(f"    {r['script_id']}: {src} ({r['size']//1024//1024}MB) — NEEDS REGEN")

    print(f"\n  MISSING (no file found): {len(MISSING)}")
    for r in MISSING:
        print(f"    {r['script_id']}: no video file found anywhere")

    print(f"\n  ALREADY CORRECT: {len([r for r in FIXED if r['action']=='already_correct'])}")

    # Write summary report
    summary = {
        "fixed": [{"id": r["script_id"], "from": r["found_path"], "size_mb": round(r["size"]/1024/1024, 1), "duration_s": r.get("duration", 0)} for r in COPIED_TO_NEW],
        "broken": [{"id": r["script_id"], "size_mb": round(r["size"]/1024/1024, 1)} for r in BROKEN],
        "missing": [r["script_id"] for r in MISSING],
    }
    report_path = os.path.join(BASE, "data_integrity_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"\nReport: {report_path}")

    return len(COPIED_TO_NEW), len(BROKEN), len(MISSING)


if __name__ == "__main__":
    fixed, broken, missing = main()
    print(f"\nDONE: {fixed} fixed, {broken} broken, {missing} missing")
    sys.exit(0)
