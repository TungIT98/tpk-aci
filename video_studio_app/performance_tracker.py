"""
video_studio_app/performance_tracker.py
=======================================
Video performance tracking — stores per-video metrics, aggregates channel stats,
and surfaces top-performing content.

Data is stored in `performance_db.json` (separate from uploads_db.json).
Integrates with upload_tracker.UploadRecord so metrics are co-located.

Public API:
  get_video_metrics(video_id)   -> VideoMetrics | None
  get_channel_stats(channel, days=30) -> ChannelStats
  get_top_performing(channel=None, limit=5, days=30) -> list[VideoMetrics]
  record_metrics(video_id, **fields) -> VideoMetrics
  refresh_mock_metrics(video_id) -> VideoMetrics
"""

from __future__ import annotations

import json
import os
import random
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PERF_DB = os.getenv("PERF_DB", "video_studio_app/performance_db.json")

PLATFORMS = {"youtube", "tiktok", "instagram", "linkedin"}

CHANNELS = {
    "productivity_worker": {
        "name": "Productivity Worker",
        "platform": "youtube",
        "cpm": 3.50,
        "target_subs": 1_000,
        "target_watch_hours": 4_000,
    },
    "genz_success": {
        "name": "Gen Z Success",
        "platform": "youtube",
        "cpm": 4.00,
        "target_subs": 1_000,
        "target_watch_hours": 4_000,
    },
}


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class VideoMetrics:
    """Per-video performance snapshot."""
    video_id: str
    upload_id: str
    title: str = ""
    channel: str = "productivity_worker"
    platform: str = "youtube"
    views: int = 0
    likes: int = 0
    shares: int = 0
    comments: int = 0
    watch_time_hours: float = 0.0
    avg_view_duration_sec: float = 0.0
    impressions: int = 0
    ctr: float = 0.0
    subscriber_gained: int = 0
    revenue_usd: float = 0.0
    cpm: float = 3.50
    engagement_rate: float = 0.0        # (likes+comments+shares) / views
    retention_rate: float = 0.0        # avg_view_duration_sec / video_duration_sec (if known)
    video_duration_sec: float = 0.0    # source video length in seconds
    thumbnail_url: str = ""
    tags: list[str] = field(default_factory=list)
    published_at: str = ""
    last_refreshed_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> VideoMetrics:
        return cls(**d)

    def refresh_engagement(self) -> None:
        """Recalculate derived fields from raw counts."""
        if self.views > 0:
            total_eng = self.likes + self.comments + self.shares
            self.engagement_rate = round(total_eng / self.views, 4)
        if self.video_duration_sec > 0:
            self.retention_rate = round(self.avg_view_duration_sec / self.video_duration_sec, 4)
        if self.views > 0:
            self.revenue_usd = round(self.views * self.cpm / 1000, 4)
        self.last_refreshed_at = datetime.now(timezone.utc).isoformat()


@dataclass
class ChannelStats:
    """Aggregated performance over a time window."""
    channel: str
    period_start: str
    period_end: str
    period_days: int
    total_videos: int = 0
    total_views: int = 0
    total_likes: int = 0
    total_shares: int = 0
    total_comments: int = 0
    total_watch_time_hours: float = 0.0
    avg_ctr: float = 0.0
    avg_engagement_rate: float = 0.0
    avg_retention_rate: float = 0.0
    avg_view_duration_sec: float = 0.0
    total_revenue_usd: float = 0.0
    rpm: float = 0.0
    new_subscribers: int = 0
    top_video_id: Optional[str] = None
    top_video_views: int = 0
    best_topic: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _load_db() -> dict:
    path = Path(PERF_DB)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {"metrics": []}


def _save_db(db: dict) -> None:
    path = Path(PERF_DB)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = str(path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    os.replace(tmp, str(path))


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------

def _mock_views() -> int:
    return random.randint(50, 8_000)


def _mock_engagement(views: int) -> dict:
    return {
        "likes": int(views * random.uniform(0.03, 0.08)),
        "comments": int(views * random.uniform(0.002, 0.01)),
        "shares": int(views * random.uniform(0.005, 0.02)),
    }


def _mock_ctr() -> float:
    return round(random.uniform(0.02, 0.12), 4)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_video_metrics(video_id: str) -> Optional[VideoMetrics]:
    """Return VideoMetrics for a single video, or None if not found."""
    db = _load_db()
    for entry in db["metrics"]:
        if entry.get("video_id") == video_id:
            return VideoMetrics.from_dict(entry)
    return None


def get_all_metrics(
    channel: Optional[str] = None,
    platform: Optional[str] = None,
    limit: int = 100,
) -> list[VideoMetrics]:
    """Return all VideoMetrics records, optionally filtered."""
    db = _load_db()
    results = []
    for entry in db["metrics"]:
        if channel and entry.get("channel") != channel:
            continue
        if platform and entry.get("platform") != platform:
            continue
        results.append(VideoMetrics.from_dict(entry))
    results.sort(key=lambda m: m.last_refreshed_at, reverse=True)
    return results[:limit]


def record_metrics(
    video_id: str,
    upload_id: str,
    title: str = "",
    channel: str = "productivity_worker",
    platform: str = "youtube",
    **fields,
) -> VideoMetrics:
    """
    Insert or update a VideoMetrics record.
    Recalculates engagement_rate, retention_rate, and revenue_usd after upsert.
    """
    db = _load_db()
    now = datetime.now(timezone.utc).isoformat()

    # Upsert
    for entry in db["metrics"]:
        if entry["video_id"] == video_id:
            entry.update(fields)
            entry["last_refreshed_at"] = now
            m = VideoMetrics.from_dict(entry)
            m.refresh_engagement()
            entry.update(asdict(m))
            _save_db(db)
            return m

    # New record
    cpm = CHANNELS.get(channel, {}).get("cpm", 3.50)
    m = VideoMetrics(
        video_id=video_id,
        upload_id=upload_id,
        title=title,
        channel=channel,
        platform=platform,
        cpm=cpm,
        last_refreshed_at=now,
        created_at=now,
        **fields,
    )
    m.refresh_engagement()
    db["metrics"].append(asdict(m))
    _save_db(db)
    return m


def refresh_mock_metrics(video_id: str) -> Optional[VideoMetrics]:
    """Simulate an analytics refresh for a video (mock mode)."""
    m = get_video_metrics(video_id)
    if m is None:
        return None

    views = _mock_views()
    eng = _mock_engagement(views)

    m.views = views
    m.likes = eng["likes"]
    m.comments = eng["comments"]
    m.shares = eng["shares"]
    m.ctr = _mock_ctr()
    m.avg_view_duration_sec = random.uniform(30, 180)
    m.watch_time_hours = round((views * (m.avg_view_duration_sec or 90)) / 3600, 2)
    m.impressions = int(views / max(m.ctr, 0.01))
    m.subscriber_gained = int(views * random.uniform(0.001, 0.005))
    m.refresh_engagement()

    db = _load_db()
    for entry in db["metrics"]:
        if entry["video_id"] == video_id:
            entry.update(asdict(m))
            break
    _save_db(db)
    return m


def get_channel_stats(channel: str, days: int = 30) -> ChannelStats:
    """
    Aggregate performance metrics for a channel over the last `days`.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    metrics = get_all_metrics(channel=channel)
    period = [m for m in metrics if m.created_at >= cutoff]

    now = datetime.now(timezone.utc)
    period_end = now.isoformat()
    period_start = (now - timedelta(days=days)).isoformat()

    total_views = sum(m.views for m in period)
    total_likes = sum(m.likes for m in period)
    total_comments = sum(m.comments for m in period)
    total_shares = sum(m.shares for m in period)
    total_watch = sum(m.watch_time_hours for m in period)
    total_ctrs = [m.ctr for m in period if m.ctr > 0]
    total_eng = [m.engagement_rate for m in period if m.engagement_rate > 0]
    total_ret = [m.retention_rate for m in period if m.retention_rate > 0]
    total_avd = [m.avg_view_duration_sec for m in period if m.avg_view_duration_sec > 0]
    total_revenue = sum(m.revenue_usd for m in period)
    total_subs = sum(m.subscriber_gained for m in period)

    top = max((m for m in period), default=None, key=lambda m: m.views)

    tag_counts: dict[str, int] = {}
    for m in period:
        for tag in m.tags:
            tag_counts[tag] = tag_counts.get(tag, 0) + m.views
    best_topic = max(tag_counts, key=tag_counts.get) if tag_counts else None

    rpm = (total_revenue / total_views * 1000) if total_views > 0 else 0.0

    return ChannelStats(
        channel=channel,
        period_start=period_start,
        period_end=period_end,
        period_days=days,
        total_videos=len(period),
        total_views=total_views,
        total_likes=total_likes,
        total_comments=total_comments,
        total_shares=total_shares,
        total_watch_time_hours=round(total_watch, 2),
        avg_ctr=round(sum(total_ctrs) / len(total_ctrs), 4) if total_ctrs else 0.0,
        avg_engagement_rate=round(sum(total_eng) / len(total_eng), 4) if total_eng else 0.0,
        avg_retention_rate=round(sum(total_ret) / len(total_ret), 4) if total_ret else 0.0,
        avg_view_duration_sec=round(sum(total_avd) / len(total_avd), 2) if total_avd else 0.0,
        total_revenue_usd=round(total_revenue, 4),
        rpm=round(rpm, 4),
        new_subscribers=total_subs,
        top_video_id=top.video_id if top else None,
        top_video_views=top.views if top else 0,
        best_topic=best_topic,
    )


def get_top_performing(
    channel: Optional[str] = None,
    limit: int = 5,
    days: int = 30,
    sort_by: str = "views",
) -> list[VideoMetrics]:
    """
    Return the top-performing videos.
    sort_by: "views" | "engagement_rate" | "retention_rate" | "revenue_usd"
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    all_m = get_all_metrics(channel=channel)
    period = [m for m in all_m if m.created_at >= cutoff]

    sort_keys = {
        "views": lambda m: m.views,
        "engagement_rate": lambda m: m.engagement_rate,
        "retention_rate": lambda m: m.retention_rate,
        "revenue_usd": lambda m: m.revenue_usd,
    }
    key_fn = sort_keys.get(sort_by, sort_keys["views"])
    return sorted(period, key=key_fn, reverse=True)[:limit]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Performance Tracker CLI")
    sub = parser.add_subparsers(dest="cmd")

    show_p = sub.add_parser("stats", help="Show channel stats summary")
    show_p.add_argument("--channel", default="productivity_worker")
    show_p.add_argument("--days", type=int, default=30)

    top_p = sub.add_parser("top", help="Show top performing videos")
    top_p.add_argument("--channel", default=None)
    top_p.add_argument("--limit", type=int, default=5)
    top_p.add_argument("--days", type=int, default=30)
    top_p.add_argument("--sort", default="views")

    refresh_p = sub.add_parser("refresh", help="Refresh mock metrics for a video")
    refresh_p.add_argument("--video-id", required=True)

    args = parser.parse_args()

    if args.cmd == "stats":
        s = get_channel_stats(args.channel, days=args.days)
        print(f"\n=== Channel Stats: {s.channel} (last {s.period_days}d) ===")
        print(f"  Videos:        {s.total_videos}")
        print(f"  Views:         {s.total_views:,}")
        print(f"  Watch time:   {s.total_watch_time_hours:.1f} hrs")
        print(f"  Engagement:   {s.avg_engagement_rate:.2%}")
        print(f"  Retention:    {s.avg_retention_rate:.2%}")
        print(f"  Revenue est:  ${s.total_revenue_usd:.4f}")
        print(f"  RPM:          ${s.rpm:.4f}")
        print(f"  New subs:     {s.new_subscribers}")
        if s.top_video_id:
            print(f"  Top video:    {s.top_video_id} ({s.top_video_views:,} views)")
        if s.best_topic:
            print(f"  Best topic:   {s.best_topic}")

    elif args.cmd == "top":
        videos = get_top_performing(
            channel=args.channel, limit=args.limit, days=args.days, sort_by=args.sort
        )
        if not videos:
            print("No videos found.")
        else:
            print(f"\n=== Top {len(videos)} Videos ===")
            for i, m in enumerate(videos, 1):
                print(f"  {i}. [{m.video_id}] {m.title[:50]}")
                print(f"      Views: {m.views:,} | Eng: {m.engagement_rate:.2%} | Rev: ${m.revenue_usd:.4f}")

    elif args.cmd == "refresh":
        m = refresh_mock_metrics(args.video_id)
        if m:
            print(f"Refreshed: {m.video_id} — {m.views:,} views, ${m.revenue_usd:.4f}")
        else:
            print(f"Video '{args.video_id}' not found in performance_db.json")

    else:
        parser.print_help()
