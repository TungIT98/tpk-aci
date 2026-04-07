"""
video_studio_app/job_queue.py
==============================
Persistent job queue for video production pipeline.

States: pending → processing → done | failed

Public API:
  add_job(script_path, template, platforms, scheduled_time=None, priority=0)
  get_queue(status=None)           -> list[Job]
  get_next_job()                   -> Job | None  (oldest pending job)
  mark_done(job_id)                -> Job
  mark_failed(job_id, error=None)  -> Job
  requeue(job_id)                  -> Job         (reset to pending)
  get_stats()                      -> dict        (counts by status)
  clear(failed_only=True)          -> int         (delete resolved jobs)
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

QUEUE_DB = os.getenv("QUEUE_DB", "video_studio_app/queue_db.json")

JOB_STATES = ("pending", "processing", "done", "failed")
PLATFORMS = ("youtube", "tiktok", "instagram", "linkedin")


# ---------------------------------------------------------------------------
# Data Model
# ---------------------------------------------------------------------------

@dataclass
class Job:
    job_id: str
    script_path: str
    template: str
    platforms: list[str]                    # e.g. ["youtube", "tiktok"]
    scheduled_time: Optional[str] = None    # ISO-8601 or None
    priority: int = 0                       # higher = more urgent
    status: str = "pending"                  # pending | processing | done | failed
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> Job:
        return cls(**d)


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _load_db() -> dict:
    path = Path(QUEUE_DB)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {"jobs": [], "next_id": 1}


def _save_db(db: dict) -> None:
    path = Path(QUEUE_DB)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = str(path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    os.replace(tmp, str(path))


def _find_job(db: dict, job_id: str) -> tuple[int, dict] | tuple[None, None]:
    for i, entry in enumerate(db["jobs"]):
        if entry["job_id"] == job_id:
            return i, entry
    return None, None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def add_job(
    script_path: str,
    template: str,
    platforms: list[str],
    scheduled_time: Optional[str] = None,
    priority: int = 0,
    metadata: Optional[dict] = None,
) -> Job:
    """
    Add a new job to the queue.

    Args:
        script_path:  Path to the script file (e.g. "content/seo-briefs/PW-01.md")
        template:     Template name (e.g. "morning-routine")
        platforms:    List of target platforms
        scheduled_time: ISO-8601 datetime string, or None for immediate
        priority:     Higher = more urgent (processed first within pending)
        metadata:     Arbitrary extra data (video_id, seo_brief_id, etc.)
    """
    db = _load_db()
    job_id = f"job_{db['next_id']:04d}"
    db["next_id"] += 1

    job = Job(
        job_id=job_id,
        script_path=script_path,
        template=template,
        platforms=platforms,
        scheduled_time=scheduled_time,
        priority=priority,
        status="pending",
        metadata=metadata or {},
    )
    db["jobs"].append(asdict(job))
    _save_db(db)
    return job


def get_queue(status: Optional[str] = None) -> list[Job]:
    """
    Return all jobs, optionally filtered by status.
    Sorted: priority desc, then created_at asc (urgent first, then FIFO within priority).
    """
    db = _load_db()
    jobs = []
    for entry in db["jobs"]:
        if status and entry["status"] != status:
            continue
        jobs.append(Job.from_dict(entry))

    jobs.sort(key=lambda j: (-j.priority, j.created_at))
    return jobs


def get_next_job() -> Optional[Job]:
    """
    Return the most urgent pending job (highest priority, oldest first).
    Does not change job status — caller should call mark_processing() or equivalent.
    """
    pending = get_queue(status="pending")
    return pending[0] if pending else None


def get_job(job_id: str) -> Optional[Job]:
    """Get a single job by ID."""
    db = _load_db()
    _, entry = _find_job(db, job_id)
    if entry is None:
        return None
    return Job.from_dict(entry)


def mark_processing(job_id: str) -> Optional[Job]:
    """Transition a pending job to 'processing'."""
    db = _load_db()
    idx, entry = _find_job(db, job_id)
    if entry is None:
        return None
    if entry["status"] not in ("pending", "failed"):
        raise ValueError(f"Cannot start job in '{entry['status']}' state.")
    entry["status"] = "processing"
    entry["started_at"] = datetime.now(timezone.utc).isoformat()
    _save_db(db)
    return Job.from_dict(entry)


def mark_done(job_id: str) -> Optional[Job]:
    """Mark a job as successfully completed."""
    db = _load_db()
    idx, entry = _find_job(db, job_id)
    if entry is None:
        return None
    entry["status"] = "done"
    entry["completed_at"] = datetime.now(timezone.utc).isoformat()
    entry["error_message"] = None
    _save_db(db)
    return Job.from_dict(entry)


def mark_failed(job_id: str, error: Optional[str] = None) -> Optional[Job]:
    """Mark a job as failed. Increments retry_count; auto-requeues if under max_retries."""
    db = _load_db()
    idx, entry = _find_job(db, job_id)
    if entry is None:
        return None
    entry["retry_count"] += 1
    entry["error_message"] = error or "Unknown error"

    if entry["retry_count"] < entry["max_retries"]:
        entry["status"] = "pending"
        entry["started_at"] = None
    else:
        entry["status"] = "failed"
        entry["completed_at"] = datetime.now(timezone.utc).isoformat()

    _save_db(db)
    return Job.from_dict(entry)


def requeue(job_id: str) -> Optional[Job]:
    """Reset a failed or done job back to pending."""
    db = _load_db()
    idx, entry = _find_job(db, job_id)
    if entry is None:
        return None
    entry["status"] = "pending"
    entry["started_at"] = None
    entry["completed_at"] = None
    entry["error_message"] = None
    _save_db(db)
    return Job.from_dict(entry)


def get_stats() -> dict:
    """Return queue statistics (counts by status)."""
    db = _load_db()
    counts = {s: 0 for s in JOB_STATES}
    for entry in db["jobs"]:
        if entry["status"] in counts:
            counts[entry["status"]] += 1
    counts["total"] = len(db["jobs"])
    return counts


def clear(failed_only: bool = True) -> int:
    """
    Remove resolved jobs from the queue.
    By default removes only 'failed' jobs. Set failed_only=False to also remove 'done'.
    Returns the number of jobs removed.
    """
    db = _load_db()
    original = len(db["jobs"])
    keep_states = {"pending", "processing"}
    if not failed_only:
        keep_states.add("done")
    db["jobs"] = [j for j in db["jobs"] if j["status"] in keep_states]
    removed = original - len(db["jobs"])
    _save_db(db)
    return removed


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Job Queue CLI")
    sub = parser.add_subparsers(dest="cmd")

    list_p = sub.add_parser("list", help="List queued jobs")
    list_p.add_argument("--status", default=None, choices=JOB_STATES)

    next_p = sub.add_parser("next", help="Show next job to process")
    next_p.add_argument("--claim", action="store_true", help="Mark the job as processing")

    stats_p = sub.add_parser("stats", help="Show queue statistics")

    done_p = sub.add_parser("done", help="Mark a job as done")
    done_p.add_argument("job_id")

    fail_p = sub.add_parser("fail", help="Mark a job as failed")
    fail_p.add_argument("job_id")
    fail_p.add_argument("--error", default=None)

    clear_p = sub.add_parser("clear", help="Remove resolved jobs")
    clear_p.add_argument("--all", action="store_true", help="Also remove done jobs")

    add_p = sub.add_parser("add", help="Add a job to the queue")
    add_p.add_argument("--script", required=True)
    add_p.add_argument("--template", required=True)
    add_p.add_argument("--platforms", required=True, help="Comma-separated: youtube,tiktok")
    add_p.add_argument("--scheduled", default=None)
    add_p.add_argument("--priority", type=int, default=0)

    args = parser.parse_args()

    if args.cmd == "list":
        jobs = get_queue(status=args.status)
        if not jobs:
            print("Queue empty.")
        for j in jobs:
            print(f"[{j.job_id}] {j.status:12s} | pri={j.priority} | {j.template} | {j.script_path}")

    elif args.cmd == "next":
        job = get_next_job()
        if not job:
            print("Queue empty.")
        else:
            print(f"Next job: [{job.job_id}] {job.template} / {job.script_path}")
            if args.claim:
                job = mark_processing(job.job_id)
                print(f"Claimed: now '{job.status}'")

    elif args.cmd == "stats":
        s = get_stats()
        print(f"Total:   {s['total']}")
        print(f"Pending:  {s['pending']}")
        print(f"Running:  {s['processing']}")
        print(f"Done:     {s['done']}")
        print(f"Failed:   {s['failed']}")

    elif args.cmd == "done":
        job = mark_done(args.job_id)
        print(f"Done: [{job.job_id}]" if job else f"Not found: {args.job_id}")

    elif args.cmd == "fail":
        job = mark_failed(args.job_id, error=args.error)
        print(f"Failed: [{job.job_id}] (retry {job.retry_count}/{job.max_retries})" if job else f"Not found: {args.job_id}")

    elif args.cmd == "clear":
        n = clear(failed_only=not args.all)
        print(f"Cleared {n} job(s).")

    elif args.cmd == "add":
        platforms = [p.strip() for p in args.platforms.split(",")]
        job = add_job(args.script, args.template, platforms,
                      scheduled_time=args.scheduled, priority=args.priority)
        print(f"Added: [{job.job_id}] {job.template}")

    else:
        parser.print_help()
