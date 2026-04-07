#!/usr/bin/env python3
"""
run_analytics.py
===============
Launcher script for the Video Studio Analytics Dashboard v3.0.

Usage:
    python run_analytics.py                    # default: 127.0.0.1:5001
    python run_analytics.py --host 0.0.0.0   # bind to all interfaces
    python run_analytics.py --port 8080       # custom port
    python run_analytics.py --debug           # Flask debug mode
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
ANALYTICS_APP = ROOT / "video_studio_app" / "analytics" / "app.py"


def main():
    if not ANALYTICS_APP.exists():
        print(f"ERROR: {ANALYTICS_APP} not found.")
        sys.exit(1)

    cmd = [
        sys.executable,
        str(ANALYTICS_APP),
        "--host", "127.0.0.1",
        "--port", "5001",
    ]

    import argparse
    parser = argparse.ArgumentParser(description="Video Studio Analytics Dashboard")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5001)
    parser.add_argument("--debug", action="store_true")
    args, unknown = parser.parse_known_args()

    cmd[2] = args.host
    cmd[4] = str(args.port)
    if args.debug:
        cmd.append("--debug")

    print(f"\n=== Video Studio Analytics Dashboard v3.0 ===")
    print(f"  URL:     http://{args.host}:{args.port}/")
    print(f"  Queue:   http://{args.host}:{args.port}/queue")
    print(f"  Calendar:http://{args.host}:{args.port}/calendar")
    print(f"  Batch:   http://{args.host}:{args.port}/batch")
    print(f"  Export:  http://{args.host}:{args.port}/export")
    print(f"  Debug:   {args.debug}")
    print()

    # Seed sample data on first run
    _seed_if_empty()

    subprocess.run(cmd)


def _seed_if_empty():
    import json
    queue_path = ROOT / "video_studio_app" / "queue_db.json"
    if queue_path.exists():
        try:
            with open(queue_path, encoding="utf-8") as f:
                data = json.load(f)
            if data.get("jobs"):
                return  # already has data
        except (json.JSONDecodeError, OSError):
            pass

    print("  [First run detected — seeding sample data...]")
    from datetime import datetime, timezone, timedelta
    import random

    now = datetime.now(timezone.utc)
    templates = [
        "morning-routine", "productivity_quick_tips", "genz_trend",
        "motivational_quote", "travel_vlog", "cooking-food-tutorial",
        "fitness_workout", "tech_review", "listicle-top-10",
        "storytime-commentary", "before-after-transformation",
    ]
    platforms = [
        ["youtube", "tiktok"], ["youtube"], ["tiktok", "instagram"],
        ["youtube", "linkedin"], ["tiktok"],
    ]
    statuses = ["pending", "processing", "done", "done", "done", "done", "failed"]

    jobs = []
    for i in range(15):
        created = (now - timedelta(hours=random.randint(1, 72))).isoformat()
        started = (now - timedelta(hours=random.randint(0, 24))).isoformat() if random.random() > 0.3 else None
        completed = (now - timedelta(hours=random.randint(0, 12))).isoformat() if random.random() > 0.4 else None
        status = random.choice(statuses)
        if status == "processing":
            started = (now - timedelta(minutes=random.randint(1, 30))).isoformat()
            completed = None
        if status == "pending":
            started = None
            completed = None

        jobs.append({
            "job_id": f"job_{i+1:04d}",
            "script_path": f"content/seo-briefs/PW-{(i%11)+1:02d}.md",
            "template": random.choice(templates),
            "platforms": random.choice(platforms),
            "scheduled_time": None,
            "priority": random.randint(-1, 2),
            "status": status,
            "created_at": created,
            "started_at": started,
            "completed_at": completed,
            "error_message": "Simulated API timeout — MiniMax billing limit reached" if status == "failed" else None,
            "retry_count": 1 if status == "failed" else 0,
            "max_retries": 3,
            "metadata": {},
        })

    queue_data = {"jobs": jobs, "next_id": len(jobs) + 1}
    with open(queue_path, "w", encoding="utf-8") as f:
        json.dump(queue_data, f, indent=2, ensure_ascii=False)

    # Seed schedule data
    schedule_path = ROOT / "video_studio_app" / "schedule_db.json"
    schedule_items = []
    for i in range(8):
        dt = now + timedelta(days=i // 4, hours=(9 + i * 2) % 20)
        schedule_items.append({
            "scheduled_video_id": f"sv_{i+1:04d}",
            "video_id": f"vid_{(i%5)+1:03d}",
            "platform": random.choice(["youtube", "tiktok", "instagram", "linkedin"]),
            "scheduled_datetime": dt.isoformat(),
            "title": random.choice([
                "5 Morning Habits That Changed My Life",
                "Gen Z Productivity Hacks 2026",
                "I Tried This For 30 Days — Results",
                "How I Stay Focused (Real Tips)",
                "My Morning Routine as a Remote Worker",
                "Weird Productivity Tricks That Work",
                "Day in My Life: Software Engineer",
                "Building a Second Brain: Full Guide",
            ]),
            "upload_status": "posted" if i < 2 else ("scheduled" if i < 6 else "cancelled"),
            "posted_at": (now - timedelta(days=2)).isoformat() if i < 2 else None,
            "job_id": f"job_{(i%8)+1:04d}",
            "error_message": None,
            "metadata": {},
            "created_at": (now - timedelta(days=3)).isoformat(),
        })

    schedule_data = {"scheduled_videos": schedule_items, "next_id": len(schedule_items) + 1}
    with open(schedule_path, "w", encoding="utf-8") as f:
        json.dump(schedule_data, f, indent=2, ensure_ascii=False)

    print("  [Sample data seeded: queue_db.json + schedule_db.json]")


if __name__ == "__main__":
    main()
