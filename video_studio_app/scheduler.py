"""
video_studio_app/scheduler.py
==============================
Video upload scheduling calendar — schedules posts across platforms and
tracks which ones are due, posted, or overdue.

Data persisted to schedule_db.json.

Public API:
  schedule_video(video_id, platform, scheduled_datetime, title="", metadata={})
  get_upcoming(limit=10)                 -> list[ScheduledVideo]
  get_overdue()                         -> list[ScheduledVideo]
  mark_posted(scheduled_video_id)        -> ScheduledVideo
  cancel_schedule(scheduled_video_id)   -> bool
  get_schedule_stats()                  -> dict
  get_calendar(month, year)              -> dict  {date: [ScheduledVideo]}
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SCHEDULE_DB = os.getenv("SCHEDULE_DB", "video_studio_app/schedule_db.json")
PLATFORMS = ("youtube", "tiktok", "instagram", "linkedin")
VIDEO_STATUSES = ("scheduled", "posted", "missed", "cancelled")


# ---------------------------------------------------------------------------
# Data Model
# ---------------------------------------------------------------------------

@dataclass
class ScheduledVideo:
    """A single scheduled upload entry."""
    scheduled_video_id: str
    video_id: str
    platform: str
    scheduled_datetime: str           # ISO-8601 UTC
    title: str = ""
    upload_status: str = "scheduled"  # scheduled | posted | missed | cancelled
    posted_at: Optional[str] = None
    job_id: Optional[str] = None       # links to job_queue
    error_message: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @property
    def is_due(self) -> bool:
        """True if the scheduled time has passed and status is still 'scheduled'."""
        if self.upload_status != "scheduled":
            return False
        try:
            scheduled = datetime.fromisoformat(self.scheduled_datetime.replace("Z", "+00:00"))
            return datetime.now(timezone.utc) >= scheduled
        except ValueError:
            return False

    @property
    def is_overdue(self) -> bool:
        """True if more than 1 hour past scheduled time without being posted."""
        if not self.is_due:
            return False
        try:
            scheduled = datetime.fromisoformat(self.scheduled_datetime.replace("Z", "+00:00"))
            cutoff = scheduled + timedelta(hours=1)
            return datetime.now(timezone.utc) >= cutoff
        except ValueError:
            return False

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> ScheduledVideo:
        return cls(**d)


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _load_db() -> dict:
    path = Path(SCHEDULE_DB)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {"scheduled_videos": [], "next_id": 1}


def _save_db(db: dict) -> None:
    path = Path(SCHEDULE_DB)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = str(path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    os.replace(tmp, str(path))


def _find_entry(db: dict, scheduled_video_id: str) -> tuple[int, dict] | tuple[None, None]:
    for i, entry in enumerate(db["scheduled_videos"]):
        if entry["scheduled_video_id"] == scheduled_video_id:
            return i, entry
    return None, None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def schedule_video(
    video_id: str,
    platform: str,
    scheduled_datetime: str,
    title: str = "",
    job_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> ScheduledVideo:
    """
    Schedule a video for a specific platform at a specific UTC datetime.

    Args:
        video_id:          Internal video ID or upload_id
        platform:          One of PLATFORMS
        scheduled_datetime: ISO-8601 UTC string (e.g. "2026-03-26T14:00:00Z")
        title:             Display title for the calendar
        job_id:            Optional job_queue job_id to link
        metadata:          Extra data (seo_brief_id, template, etc.)
    """
    if platform not in PLATFORMS:
        raise ValueError(f"Invalid platform '{platform}'. Must be one of {PLATFORMS}")

    db = _load_db()
    sv_id = f"sv_{db['next_id']:04d}"
    db["next_id"] += 1

    sv = ScheduledVideo(
        scheduled_video_id=sv_id,
        video_id=video_id,
        platform=platform,
        scheduled_datetime=scheduled_datetime,
        title=title,
        job_id=job_id,
        metadata=metadata or {},
    )
    db["scheduled_videos"].append(asdict(sv))
    _save_db(db)
    return sv


def get_upcoming(limit: int = 10) -> list[ScheduledVideo]:
    """
    Return the soonest `limit` scheduled uploads that are not yet posted/cancelled.
    Sorted by scheduled_datetime asc.
    """
    db = _load_db()
    now = datetime.now(timezone.utc)
    results = []
    for entry in db["scheduled_videos"]:
        if entry["upload_status"] not in ("scheduled",):
            continue
        try:
            dt = datetime.fromisoformat(entry["scheduled_datetime"].replace("Z", "+00:00"))
            if dt >= now:
                results.append(ScheduledVideo.from_dict(entry))
        except ValueError:
            continue
    results.sort(key=lambda sv: sv.scheduled_datetime)
    return results[:limit]


def get_overdue() -> list[ScheduledVideo]:
    """Return scheduled videos that are due (>1 hr past) and not yet posted."""
    db = _load_db()
    now = datetime.now(timezone.utc)
    results = []
    for entry in db["scheduled_videos"]:
        if entry["upload_status"] != "scheduled":
            continue
        try:
            dt = datetime.fromisoformat(entry["scheduled_datetime"].replace("Z", "+00:00"))
            cutoff = dt + timedelta(hours=1)
            if now >= cutoff:
                results.append(ScheduledVideo.from_dict(entry))
        except ValueError:
            continue
    results.sort(key=lambda sv: sv.scheduled_datetime)
    return results


def get_all_scheduled(
    status: Optional[str] = None,
    platform: Optional[str] = None,
    days: Optional[int] = None,
) -> list[ScheduledVideo]:
    """Return all scheduled video entries, optionally filtered."""
    db = _load_db()
    now = datetime.now(timezone.utc)
    results = []
    for entry in db["scheduled_videos"]:
        if status and entry["upload_status"] != status:
            continue
        if platform and entry["platform"] != platform:
            continue
        if days is not None:
            try:
                dt = datetime.fromisoformat(entry["scheduled_datetime"].replace("Z", "+00:00"))
                if dt < now - timedelta(days=days):
                    continue
            except ValueError:
                continue
        results.append(ScheduledVideo.from_dict(entry))
    results.sort(key=lambda sv: sv.scheduled_datetime)
    return results


def mark_posted(
    scheduled_video_id: str,
    posted_at: Optional[str] = None,
    error: Optional[str] = None,
) -> Optional[ScheduledVideo]:
    """Mark a scheduled video as posted (or failed if error is set)."""
    db = _load_db()
    idx, entry = _find_entry(db, scheduled_video_id)
    if entry is None:
        return None
    entry["upload_status"] = "posted" if not error else "missed"
    entry["posted_at"] = posted_at or datetime.now(timezone.utc).isoformat()
    if error:
        entry["error_message"] = error
    _save_db(db)
    return ScheduledVideo.from_dict(entry)


def cancel_schedule(scheduled_video_id: str) -> bool:
    """Cancel a scheduled upload. Returns True if found and cancelled."""
    db = _load_db()
    idx, entry = _find_entry(db, scheduled_video_id)
    if entry is None:
        return False
    entry["upload_status"] = "cancelled"
    _save_db(db)
    return True


def reschedule(
    scheduled_video_id: str,
    new_datetime: str,
) -> Optional[ScheduledVideo]:
    """Move a scheduled video to a new time."""
    db = _load_db()
    idx, entry = _find_entry(db, scheduled_video_id)
    if entry is None:
        return None
    entry["scheduled_datetime"] = new_datetime
    entry["upload_status"] = "scheduled"
    _save_db(db)
    return ScheduledVideo.from_dict(entry)


def get_schedule_stats() -> dict:
    """Return counts of each status."""
    db = _load_db()
    counts = {s: 0 for s in VIDEO_STATUSES}
    overdue_count = 0
    now = datetime.now(timezone.utc)
    for entry in db["scheduled_videos"]:
        status = entry["upload_status"]
        if status in counts:
            counts[status] += 1
        if status == "scheduled":
            try:
                dt = datetime.fromisoformat(entry["scheduled_datetime"].replace("Z", "+00:00"))
                if now >= dt + timedelta(hours=1):
                    overdue_count += 1
            except ValueError:
                pass
    counts["overdue"] = overdue_count
    counts["total"] = sum(counts.values())
    return counts


def get_calendar(year: int, month: int) -> dict[str, list[ScheduledVideo]]:
    """
    Return a calendar view for the given year/month.
    Returns: { "2026-03-25": [ScheduledVideo, ...], ... }
    """
    from calendar import monthrange
    _, days_in_month = monthrange(year, month)
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year, month, days_in_month, 23, 59, 59, tzinfo=timezone.utc)

    db = _load_db()
    cal: dict[str, list[ScheduledVideo]] = {}
    for day in range(1, days_in_month + 1):
        cal[f"{year:04d}-{month:02d}-{day:02d}"] = []

    for entry in db["scheduled_videos"]:
        try:
            dt = datetime.fromisoformat(entry["scheduled_datetime"].replace("Z", "+00:00"))
            if start <= dt <= end:
                key = dt.strftime("%Y-%m-%d")
                cal.setdefault(key, []).append(ScheduledVideo.from_dict(entry))
        except ValueError:
            continue

    return cal


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Scheduler CLI")
    sub = parser.add_subparsers(dest="cmd")

    upcoming_p = sub.add_parser("upcoming", help="Show upcoming scheduled uploads")
    upcoming_p.add_argument("--limit", type=int, default=10)

    overdue_p = sub.add_parser("overdue", help="Show overdue uploads")

    stats_p = sub.add_parser("stats", help="Show scheduling stats")

    schedule_p = sub.add_parser("schedule", help="Add a scheduled upload")
    schedule_p.add_argument("--video-id", required=True)
    schedule_p.add_argument("--platform", required=True, choices=PLATFORMS)
    schedule_p.add_argument("--datetime", required=True, help="ISO-8601 UTC (e.g. 2026-03-26T14:00:00Z)")
    schedule_p.add_argument("--title", default="")

    posted_p = sub.add_parser("posted", help="Mark a scheduled video as posted")
    posted_p.add_argument("scheduled_video_id")

    cancel_p = sub.add_parser("cancel", help="Cancel a scheduled upload")
    cancel_p.add_argument("scheduled_video_id")

    cal_p = sub.add_parser("calendar", help="Show monthly calendar")
    cal_p.add_argument("--year", type=int, default=2026)
    cal_p.add_argument("--month", type=int, default=3)

    args = parser.parse_args()

    if args.cmd == "upcoming":
        items = get_upcoming(limit=args.limit)
        if not items:
            print("No upcoming uploads.")
        for sv in items:
            due_marker = " [DUE]" if sv.is_due else (" [OVERDUE]" if sv.is_overdue else "")
            print(
                f"[{sv.scheduled_video_id}] {sv.scheduled_datetime} | "
                f"{sv.platform:10s} | {sv.title[:40]}{due_marker}"
            )

    elif args.cmd == "overdue":
        items = get_overdue()
        if not items:
            print("No overdue uploads.")
        for sv in items:
            print(f"[{sv.scheduled_video_id}] {sv.scheduled_datetime} | {sv.platform} | {sv.title[:40]}")

    elif args.cmd == "stats":
        s = get_schedule_stats()
        print(f"Total:      {s['total']}")
        print(f"Scheduled:  {s['scheduled']}")
        print(f"Posted:      {s['posted']}")
        print(f"Missed:      {s['missed']}")
        print(f"Cancelled:  {s['cancelled']}")
        print(f"Overdue:    {s['overdue']}")

    elif args.cmd == "schedule":
        sv = schedule_video(args.video_id, args.platform, args.datetime, title=args.title)
        print(f"Scheduled: [{sv.scheduled_video_id}] {sv.platform} at {sv.scheduled_datetime}")

    elif args.cmd == "posted":
        sv = mark_posted(args.scheduled_video_id)
        print(f"Marked posted: [{sv.scheduled_video_id}]" if sv else "Not found.")

    elif args.cmd == "cancel":
        ok = cancel_schedule(args.scheduled_video_id)
        print(f"Cancelled." if ok else "Not found.")

    elif args.cmd == "calendar":
        cal = get_calendar(args.year, args.month)
        print(f"\n=== Calendar {args.year}-{args.month:02d} ===")
        for date, items in sorted(cal.items()):
            if items:
                print(f"\n{date}")
                for sv in items:
                    print(f"  [{sv.scheduled_video_id}] {sv.scheduled_datetime[11:]} | {sv.platform} | {sv.title[:40]}")

    else:
        parser.print_help()
