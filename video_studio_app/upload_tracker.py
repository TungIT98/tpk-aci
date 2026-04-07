"""
video_studio_app/upload_tracker.py
===================================
Upload automation placeholders + analytics tracking + performance reporting.

Modules:
  - TikTokUploader   — TikTok Creator API upload placeholder
  - YouTubeUploader   — YouTube Data API v3 upload placeholder
  - InstagramUploader  — Instagram Graph API upload placeholder (placeholder)
  - LinkedInUploader  — LinkedIn API upload placeholder (placeholder)
  - UploadTracker     — tracks upload history, status, and metadata
  - AnalyticsTracker — aggregates views, CTR, subscribers, revenue signals
  - PerformanceReporter — generates periodic performance reports (markdown)

All uploaders work with mock data until OAuth credentials are available.
Run with USE_MOCK=True or set environment variables to activate real APIs.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field, asdict
from typing import Optional
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

USE_MOCK = os.getenv("USE_MOCK", "true").lower() == "true"

TRACKER_DB = os.getenv("TRACKER_DB", "video_studio_app/uploads_db.json")

CHANNELS = {
    "productivity_worker": {
        "name": "Productivity Worker",
        "platform": "youtube",
        "channel_id": os.getenv("YOUTUBE_CHANNEL_ID_PW", "mock_pw_channel"),
        "tiktok_handle": os.getenv("TIKTOK_HANDLE_PW", "@productivityworker"),
        "cpm": 3.50,   # USD per 1000 ad impressions — default estimate
        "target_subs": 1_000,
        "target_watch_hours": 4_000,
    },
    "genz_success": {
        "name": "Gen Z Success",
        "platform": "youtube",
        "channel_id": os.getenv("YOUTUBE_CHANNEL_ID_GZ", "mock_gz_channel"),
        "tiktok_handle": os.getenv("TIKTOK_HANDLE_GZ", "@genzsuccess"),
        "cpm": 4.00,
        "target_subs": 1_000,
        "target_watch_hours": 4_000,
    },
}


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class UploadRecord:
    """Single video upload record."""
    upload_id: str
    video_path: str
    title: str
    description: str = ""
    tags: list[str] = field(default_factory=list)
    channel: str = "productivity_worker"
    platform: str = "youtube"          # youtube | tiktok | instagram | linkedin
    upload_status: str = "pending"   # pending | uploading | published | failed
    video_id: Optional[str] = None    # platform-assigned ID after publish
    published_at: Optional[str] = None
    thumbnail_url: Optional[str] = None
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    watch_time_hours: float = 0.0
    avg_view_duration_sec: float = 0.0
    impressions: int = 0
    ctr: float = 0.0                  # click-through rate (impressions → views)
    subscriber_gained: int = 0
    revenue_usd: float = 0.0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    error_message: Optional[str] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


@dataclass
class ChannelMetrics:
    """Aggregated metrics for a channel over a time window."""
    channel: str
    period_start: str
    period_end: str
    total_videos: int = 0
    total_views: int = 0
    total_likes: int = 0
    total_comments: int = 0
    total_shares: int = 0
    total_watch_time_hours: float = 0.0
    avg_ctr: float = 0.0
    avg_view_duration_sec: float = 0.0
    new_subscribers: int = 0
    subscriber_count: int = 0
    total_revenue_usd: float = 0.0
    rpm: float = 0.0   # revenue per 1000 views
    top_video_id: Optional[str] = None
    top_video_views: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _load_db() -> dict:
    path = Path(TRACKER_DB)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {"uploads": [], "channels": {}}

def _save_db(db: dict) -> None:
    path = Path(TRACKER_DB)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = str(path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    os.replace(tmp, str(path))


# ---------------------------------------------------------------------------
# Mock data generators
# ---------------------------------------------------------------------------

def _mock_video_id(platform: str) -> str:
    return f"mock_{platform}_{uuid.uuid4().hex[:8]}"

def _mock_views() -> int:
    """Return a realistic mock view count for early-stage videos (100–5000)."""
    import random
    return random.randint(100, 5_000)

def _mock_engagement(views: int) -> dict:
    """Derive mock engagement metrics from view count."""
    return {
        "likes": int(views * 0.05),       # ~5% like rate
        "comments": int(views * 0.005),  # ~0.5% comment rate
        "shares": int(views * 0.01),       # ~1% share rate
    }

def _mock_watch_time(views: int, avg_duration_sec: float = 90.0) -> float:
    return round((views * avg_duration_sec) / 3600, 2)


# ---------------------------------------------------------------------------
# Uploaders (placeholders)
# ---------------------------------------------------------------------------

class TikTokUploader:
    """
    TikTok Creator API upload placeholder.

    Real integration requires:
      TIKTOK_ACCESS_TOKEN, TIKTOK_REFRESH_TOKEN,
      TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
    in environment or .env file.

    Workflow:
      1. exchangeAuthCode(code, redirect_uri) → tokens
      2. uploader.upload(video_path=..., title=..., description=..., tags=[...])
    """

    BASE_URL = "https://open.tiktokapis.com/v2"

    def __init__(
        self,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
    ):
        self.access_token = access_token or os.getenv("TIKTOK_ACCESS_TOKEN")
        self.refresh_token = refresh_token or os.getenv("TIKTOK_REFRESH_TOKEN")

    @property
    def is_authenticated(self) -> bool:
        return bool(self.access_token or self.refresh_token)

    async def _refresh_token(self) -> str:
        """Placeholder: exchange refresh token for fresh access token via TikTok OAuth."""
        if not self.refresh_token:
            raise RuntimeError(
                "TikTok not authenticated. "
                "Run `node scripts/oauth-tiktok.js` to complete OAuth, "
                "or set TIKTOK_ACCESS_TOKEN in .env."
            )
        # Real implementation would POST to:
        #   POST https://open.tiktokapis.com/v2/oauth/token/
        # with grant_type=refresh_token
        if USE_MOCK:
            return "mock_refreshed_token"
        raise NotImplementedError("Real TikTok token refresh — set USE_MOCK=true for testing.")

    async def upload(
        self,
        video_path: str,
        title: str,
        description: str = "",
        tags: list[str] | None = None,
    ) -> dict:
        """
        Upload a video to TikTok.

        Returns dict with platform video_id on success.
        Raises RuntimeError if not authenticated.
        """
        if not self.is_authenticated:
            raise RuntimeError(
                "TikTok not authenticated. "
                "Run `node scripts/oauth-tiktok.js` to complete OAuth setup."
            )

        if USE_MOCK:
            return {
                "video_id": _mock_video_id("tiktok"),
                "status": "published",
                "platform": "tiktok",
                "title": title,
            }

        # --- Real implementation path ---
        # 1. POST /video/upload/init/ → { upload_url, upload_id }
        # 2. PUT upload_url with video binary
        # 3. POST /video/publish/ with title, description, tags
        raise NotImplementedError("Real TikTok upload — set USE_MOCK=true for testing.")


class YouTubeUploader:
    """
    YouTube Data API v3 upload placeholder.

    Real integration requires:
      YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
    in environment or .env file.

    Requires google-auth library for production use.
    """

    UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
    TOKEN_URL = "https://oauth2.googleapis.com/token"

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        refresh_token: Optional[str] = None,
    ):
        self.client_id = client_id or os.getenv("YOUTUBE_CLIENT_ID")
        self.client_secret = client_secret or os.getenv("YOUTUBE_CLIENT_SECRET")
        self.refresh_token = refresh_token or os.getenv("YOUTUBE_REFRESH_TOKEN")
        self._access_token: Optional[str] = None

    @property
    def is_authenticated(self) -> bool:
        return bool(self.client_id and self.client_secret and self.refresh_token)

    async def _refresh_token(self) -> str:
        """Placeholder: refresh OAuth2 access token via Google."""
        if not self.is_authenticated:
            raise RuntimeError(
                "YouTube not authenticated. "
                "Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN."
            )
        if USE_MOCK:
            self._access_token = "mock_yt_access_token"
            return self._access_token
        # Real implementation would POST to TOKEN_URL with grant_type=refresh_token
        raise NotImplementedError("Real YouTube token refresh — set USE_MOCK=true for testing.")

    async def upload(
        self,
        video_path: str,
        title: str,
        description: str = "",
        tags: list[str] | None = None,
        category_id: str = "22",      # People & Blogs
        privacy_status: str = "private",
    ) -> dict:
        """
        Upload a video to YouTube.

        Returns dict with YouTube videoId on success.
        """
        if not self.is_authenticated:
            raise RuntimeError(
                "YouTube not authenticated. "
                "Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN."
            )

        if USE_MOCK:
            return {
                "video_id": _mock_video_id("youtube"),
                "status": "published",
                "platform": "youtube",
                "title": title,
                "privacy_status": privacy_status,
            }

        # --- Real implementation path ---
        # 1. _refresh_token() → access token
        # 2. resumable upload to UPLOAD_URL with Authorization: Bearer <token>
        raise NotImplementedError("Real YouTube upload — set USE_MOCK=true for testing.")


class InstagramUploader:
    """
    Instagram Graph API upload placeholder.
    Requires INSTAGRAM_PAGE_ID, INSTAGRAM_ACCESS_TOKEN.
    """

    def __init__(self, page_id: Optional[str] = None, access_token: Optional[str] = None):
        self.page_id = page_id or os.getenv("INSTAGRAM_PAGE_ID")
        self.access_token = access_token or os.getenv("INSTAGRAM_ACCESS_TOKEN")

    @property
    def is_authenticated(self) -> bool:
        return bool(self.page_id and self.access_token)

    async def upload(
        self,
        video_path: str,
        caption: str = "",
    ) -> dict:
        if not self.is_authenticated:
            raise RuntimeError("Instagram not authenticated. Set INSTAGRAM_PAGE_ID and INSTAGRAM_ACCESS_TOKEN.")
        if USE_MOCK:
            return {"video_id": _mock_video_id("instagram"), "status": "published"}
        raise NotImplementedError("Real Instagram upload — set USE_MOCK=true for testing.")


class LinkedInUploader:
    """
    LinkedIn API upload placeholder.
    Requires LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN.
    """

    def __init__(self, access_token: Optional[str] = None, person_urn: Optional[str] = None):
        self.access_token = access_token or os.getenv("LINKEDIN_ACCESS_TOKEN")
        self.person_urn = person_urn or os.getenv("LINKEDIN_PERSON_URN")

    @property
    def is_authenticated(self) -> bool:
        return bool(self.access_token and self.person_urn)

    async def upload(
        self,
        video_path: str,
        title: str,
        description: str = "",
    ) -> dict:
        if not self.is_authenticated:
            raise RuntimeError("LinkedIn not authenticated. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN.")
        if USE_MOCK:
            return {"video_id": _mock_video_id("linkedin"), "status": "published"}
        raise NotImplementedError("Real LinkedIn upload — set USE_MOCK=true for testing.")


# ---------------------------------------------------------------------------
# UploadTracker — record + query upload history
# ---------------------------------------------------------------------------

class UploadTracker:
    """
    Tracks all video uploads and their current performance metrics.

    Persists to JSON at TRACKER_DB. All times in UTC ISO-8601.
    """

    def __init__(self, db_path: str | None = None):
        self.db_path = db_path or TRACKER_DB

    # -- CRUD ----------------------------------------------------------------

    def add_upload(self, record: UploadRecord) -> UploadRecord:
        """Register a new upload record."""
        db = _load_db()
        db["uploads"].append(record.to_dict())
        _save_db(db)
        return record

    def update_upload(self, upload_id: str, **fields) -> Optional[UploadRecord]:
        """Patch fields on an existing upload record."""
        db = _load_db()
        for entry in db["uploads"]:
            if entry["upload_id"] == upload_id:
                entry.update(fields)
                entry["updated_at"] = datetime.now(timezone.utc).isoformat()
                _save_db(db)
                return UploadRecord(**entry)
        return None

    def get_upload(self, upload_id: str) -> Optional[UploadRecord]:
        db = _load_db()
        for entry in db["uploads"]:
            if entry["upload_id"] == upload_id:
                return UploadRecord(**entry)
        return None

    def list_uploads(
        self,
        channel: str | None = None,
        platform: str | None = None,
        status: str | None = None,
        limit: int = 100,
    ) -> list[UploadRecord]:
        db = _load_db()
        results = []
        for entry in db["uploads"]:
            if channel and entry.get("channel") != channel:
                continue
            if platform and entry.get("platform") != platform:
                continue
            if status and entry.get("upload_status") != status:
                continue
            results.append(UploadRecord(**entry))
        results.sort(key=lambda r: r.created_at, reverse=True)
        return results[:limit]

    def delete_upload(self, upload_id: str) -> bool:
        db = _load_db()
        before = len(db["uploads"])
        db["uploads"] = [u for u in db["uploads"] if u["upload_id"] != upload_id]
        if len(db["uploads"]) < before:
            _save_db(db)
            return True
        return False

    # -- Analytics helpers ----------------------------------------------------

    def refresh_mock_analytics(self, upload_id: str) -> Optional[UploadRecord]:
        """Simulate analytics refresh for a published video (mock only)."""
        record = self.get_upload(upload_id)
        if not record or record.upload_status != "published":
            return record
        views = _mock_views()
        eng = _mock_engagement(views)
        record.views = views
        record.likes = eng["likes"]
        record.comments = eng["comments"]
        record.shares = eng["shares"]
        record.watch_time_hours = _mock_watch_time(views, avg_duration_sec=record.avg_view_duration_sec or 90.0)
        record.impressions = int(views / max(record.ctr or 0.1, 0.01))
        record.updated_at = datetime.now(timezone.utc).isoformat()
        self.update_upload(upload_id, **asdict(record))
        return self.get_upload(upload_id)

    def get_channel_summary(self, channel: str, days: int = 30) -> ChannelMetrics:
        """Aggregate metrics for a channel over the last `days` days."""
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        uploads = [r for r in self.list_uploads(channel=channel) if r.created_at >= cutoff]

        total_views = sum(r.views for r in uploads)
        total_likes = sum(r.likes for r in uploads)
        total_comments = sum(r.comments for r in uploads)
        total_shares = sum(r.shares for r in uploads)
        total_watch = sum(r.watch_time_hours for r in uploads)
        total_impressions = sum(r.impressions for r in uploads)
        ctrs = [r.ctr for r in uploads if r.ctr > 0]
        avds = [r.avg_view_duration_sec for r in uploads if r.avg_view_duration_sec > 0]
        top_views = max((r.views for r in uploads), default=0)
        top_id = next((r.upload_id for r in uploads if r.views == top_views), None)

        total_revenue = sum(r.revenue_usd for r in uploads)
        rpm = (total_revenue / total_views * 1000) if total_views > 0 else 0.0

        return ChannelMetrics(
            channel=channel,
            period_start=cutoff,
            period_end=datetime.now(timezone.utc).isoformat(),
            total_videos=len(uploads),
            total_views=total_views,
            total_likes=total_likes,
            total_comments=total_comments,
            total_shares=total_shares,
            total_watch_time_hours=round(total_watch, 2),
            avg_ctr=round(sum(ctrs) / len(ctrs), 4) if ctrs else 0.0,
            avg_view_duration_sec=round(sum(avds) / len(avds), 2) if avds else 0.0,
            new_subscribers=sum(r.subscriber_gained for r in uploads),
            total_revenue_usd=round(total_revenue, 4),
            rpm=round(rpm, 4),
            top_video_id=top_id,
            top_video_views=top_views,
        )


# ---------------------------------------------------------------------------
# AnalyticsTracker — cross-platform metrics aggregation
# ---------------------------------------------------------------------------

class AnalyticsTracker:
    """
    Aggregates analytics from all platforms into unified ChannelMetrics.

    Usage:
        tracker = AnalyticsTracker()
        summary = tracker.get_ypp_progress("productivity_worker")
        print(summary)
    """

    def __init__(self, tracker_db: str | None = None):
        self.tracker = UploadTracker(db_path=tracker_db)

    def get_ypp_progress(self, channel: str) -> dict:
        """
        Calculate YPP readiness for a channel.

        Returns dict with subscriber count, watch hours, and % toward each threshold.
        """
        config = CHANNELS.get(channel, {})
        summary = self.tracker.get_channel_summary(channel, days=365)

        subs = summary.new_subscribers
        watch_hours = summary.total_watch_time_hours
        target_subs = config.get("target_subs", 1_000)
        target_hours = config.get("target_watch_hours", 4_000)

        return {
            "channel": channel,
            "channel_name": config.get("name", channel),
            "subscribers": subs,
            "target_subs": target_subs,
            "subs_pct": round(subs / target_subs * 100, 1) if target_subs else 0,
            "watch_hours": round(watch_hours, 1),
            "target_watch_hours": target_hours,
            "watch_hours_pct": round(watch_hours / target_hours * 100, 1) if target_hours else 0,
            "ypp_eligible": subs >= target_subs and watch_hours >= target_hours,
            "bottleneck": "subscribers" if subs < target_subs else ("watch_hours" if watch_hours < target_hours else "none"),
        }

    def get_cpm_estimate(self, channel: str) -> float:
        """Return estimated CPM for a channel (from CHANNELS config)."""
        return CHANNELS.get(channel, {}).get("cpm", 3.50)

    def estimate_revenue(self, channel: str, views: int) -> float:
        """Estimate revenue from view count using channel CPM."""
        cpm = self.get_cpm_estimate(channel)
        return round(views * cpm / 1000, 4)

    def refresh_all_mock_analytics(self) -> list[UploadRecord]:
        """Refresh mock analytics for all published uploads."""
        db = _load_db()
        updated = []
        for entry in db["uploads"]:
            if entry.get("upload_status") == "published":
                rec = UploadRecord(**entry)
                views = _mock_views()
                eng = _mock_engagement(views)
                rec.views = views
                rec.likes = eng["likes"]
                rec.comments = eng["comments"]
                rec.shares = eng["shares"]
                rec.watch_time_hours = _mock_watch_time(views)
                rec.impressions = int(views / max(rec.ctr or 0.1, 0.01))
                rec.revenue_usd = self.estimate_revenue(rec.channel, views)
                d = asdict(rec)
                uid = d.pop("upload_id")
                self.tracker.update_upload(uid, **d)
                updated.append(rec)
        return updated


# ---------------------------------------------------------------------------
# PerformanceReporter — markdown report generator
# ---------------------------------------------------------------------------

class PerformanceReporter:
    """
    Generates weekly and monthly performance reports in markdown format.

    Reports cover:
      - Upload summary (count, platforms, status)
      - View & engagement metrics
      - YPP progress
      - Revenue estimates
      - Top performing content
      - Recommended actions
    """

    def __init__(self, tracker_db: str | None = None):
        self.tracker = UploadTracker(db_path=tracker_db)
        self.analytics = AnalyticsTracker(tracker_db=tracker_db)

    def _format_number(self, n: int | float) -> str:
        if isinstance(n, float):
            return f"{n:,.2f}"
        return f"{n:,}"

    def _delta_arrow(self, current: float, previous: float) -> str:
        if previous == 0:
            return "—"
        delta = ((current - previous) / previous) * 100
        sign = "+" if delta >= 0 else ""
        return f"{sign}{delta:.1f}%"

    def generate_weekly_report(self, channel: str | None = None) -> str:
        """Generate a weekly performance report."""
        now = datetime.now(timezone.utc)
        week_start = (now - timedelta(days=7)).isoformat()
        uploads = self.tracker.list_uploads(channel=channel)
        weekly = [u for u in uploads if u.created_at >= week_start]
        prev_week_start = (now - timedelta(days=14)).isoformat()
        prev_weekly = [u for u in uploads if prev_week_start <= u.created_at < week_start]

        published = [u for u in weekly if u.upload_status == "published"]
        total_views = sum(u.views for u in published)
        total_likes = sum(u.likes for u in published)
        total_comments = sum(u.comments for u in published)
        total_shares = sum(u.shares for u in published)
        total_watch = sum(u.watch_time_hours for u in published)
        total_revenue = sum(u.revenue_usd for u in published)
        ctrs = [u.ctr for u in published if u.ctr > 0]

        # Previous week
        p_views = sum(u.views for u in [u for u in prev_weekly if u.upload_status == "published"])

        lines = [
            f"# Weekly Performance Report",
            f"> Generated: {now.strftime('%Y-%m-%d %H:%M UTC')}  |  Period: last 7 days",
            "",
            f"## Upload Summary",
            "",
            f"| Metric | Value | WoW Change |",
            f"|--------|-------|------------|",
            f"| Videos Published | {len(published)} | {self._delta_arrow(len(published), len([u for u in prev_weekly if u.upload_status == 'published']))} |",
            f"| Total Views | {self._format_number(total_views)} | {self._delta_arrow(total_views, p_views)} |",
            f"| Total Likes | {self._format_number(total_likes)} | — |",
            f"| Total Comments | {self._format_number(total_comments)} | — |",
            f"| Total Shares | {self._format_number(total_shares)} | — |",
            f"| Watch Time (hrs) | {self._format_number(total_watch)} | — |",
            f"| Avg CTR | {self._format_number(sum(ctrs)/len(ctrs)*100 if ctrs else 0)}% | — |",
            f"| Est. Revenue | ${self._format_number(total_revenue)} | — |",
            "",
            "## YPP Progress",
            "",
        ]

        if channel:
            ypp = self.analytics.get_ypp_progress(channel)
            lines += [
                f"| Requirement | Current | Target | % Complete |",
                f"|-------------|---------|--------|-------------|",
                f"| Subscribers | {self._format_number(ypp['subscribers'])} | {self._format_number(ypp['target_subs'])} | {ypp['subs_pct']}% |",
                f"| Watch Hours (12 mo) | {self._format_number(ypp['watch_hours'])} | {self._format_number(ypp['target_watch_hours'])} | {ypp['watch_hours_pct']}% |",
                f"| **YPP Eligible?** | {'**YES** ✅' if ypp['ypp_eligible'] else 'NOT YET ❌'} | — | Bottleneck: {ypp['bottleneck']} |",
                "",
            ]
        else:
            for ch_key, ch_cfg in CHANNELS.items():
                ypp = self.analytics.get_ypp_progress(ch_key)
                lines += [
                    f"### {ch_cfg['name']}",
                    f"| Requirement | Current | Target | % Complete |",
                    f"|-------------|---------|--------|-------------|",
                    f"| Subscribers | {self._format_number(ypp['subscribers'])} | {self._format_number(ypp['target_subs'])} | {ypp['subs_pct']}% |",
                    f"| Watch Hours | {self._format_number(ypp['watch_hours'])} | {self._format_number(ypp['target_watch_hours'])} | {ypp['watch_hours_pct']}% |",
                    "",
                ]

        # Top videos
        if published:
            top = sorted(published, key=lambda u: u.views, reverse=True)[:3]
            lines += [
                "## Top Performing Content",
                "",
                f"| # | Title | Views | Likes | Comments | Watch Time (hrs) | Revenue |",
                f"|---|-------|-------|-------|----------|-----------------|--------|",
            ]
            for i, u in enumerate(top, 1):
                title = u.title[:50] + ("..." if len(u.title) > 50 else "")
                lines.append(
                    f"| {i} | {title} | {self._format_number(u.views)} | "
                    f"{self._format_number(u.likes)} | {self._format_number(u.comments)} | "
                    f"{self._format_number(u.watch_time_hours)} | ${self._format_number(u.revenue_usd)} |"
                )
            lines.append("")

        # Actions
        lines += [
            "## Recommended Actions",
            "",
        ]
        if channel:
            ypp = self.analytics.get_ypp_progress(channel)
            if ypp["bottleneck"] == "subscribers":
                lines.append("- **Focus on subscriber growth:** Add strong CTAs (subscribe every video), optimize thumbnails for curiosity gaps.")
            elif ypp["bottleneck"] == "watch_hours":
                lines.append("- **Boost watch time:** Create longer-form content (8–15 min), use pattern interrupts every 30 seconds.")
            else:
                lines.append("- **YPP eligible — apply now:** Submit YouTube Partner Program application.")
        else:
            lines.append("- Monitor per-channel YPP progress above and adjust content strategy accordingly.")
        lines.append("- Maintain consistent posting cadence — aim for 1 video/day minimum.")
        lines.append("- Refresh analytics data weekly by running `python -m upload_tracker --refresh`")

        lines += [
            "",
            f"*Report generated by Analytics Agent on {now.strftime('%Y-%m-%d')}*",
        ]
        return "\n".join(lines)

    def generate_monthly_report(self, channel: str | None = None) -> str:
        """Generate a monthly deep-dive report."""
        now = datetime.now(timezone.utc)
        month_start = (now - timedelta(days=30)).isoformat()
        uploads = self.tracker.list_uploads(channel=channel)
        monthly = [u for u in uploads if u.created_at >= month_start]
        prev_month_start = (now - timedelta(days=60)).isoformat()
        prev_monthly = [u for u in uploads if prev_month_start <= u.created_at < month_start]

        published = [u for u in monthly if u.upload_status == "published"]
        total_views = sum(u.views for u in published)
        total_likes = sum(u.likes for u in published)
        total_comments = sum(u.comments for u in published)
        total_watch = sum(u.watch_time_hours for u in published)
        total_revenue = sum(u.revenue_usd for u in published)
        p_views = sum(u.views for u in [u for u in prev_monthly if u.upload_status == "published"])

        # Per-platform breakdown
        platform_breakdown = {}
        for u in published:
            platform_breakdown.setdefault(u.platform, {"views": 0, "videos": 0})
            platform_breakdown[u.platform]["views"] += u.views
            platform_breakdown[u.platform]["videos"] += 1

        lines = [
            f"# Monthly Analytics Report",
            f"> Generated: {now.strftime('%Y-%m-%d %H:%M UTC')}  |  Period: last 30 days",
            "",
            f"## Executive Summary",
            "",
            f"- **{len(published)} videos** published in the last 30 days",
            f"- **{self._format_number(total_views)} total views** ({self._delta_arrow(total_views, p_views)} vs prior month)",
            f"- **{self._format_number(total_watch)} watch hours**",
            f"- **{self._format_number(total_revenue)} estimated revenue**",
            "",
            f"## Platform Breakdown",
            "",
            f"| Platform | Videos | Views | % of Total Views |",
            f"|----------|--------|-------|------------------|",
        ]
        for plat, data in sorted(platform_breakdown.items()):
            pct = round(data["views"] / total_views * 100, 1) if total_views else 0
            lines.append(f"| {plat.title()} | {data['videos']} | {self._format_number(data['views'])} | {pct}% |")
        lines.append("")

        # Retention quality
        good_retention = [u for u in published if u.avg_view_duration_sec > 60]
        lines += [
            "## Content Quality",
            "",
            f"- Videos with avg view duration > 60s: **{len(good_retention)} / {len(published)}**",
            f"- Engagement rate (likes+comments / views): **{round((total_likes+total_comments)/total_views*100,2) if total_views else 0}%**",
            "",
        ]

        # YPP progress
        lines.append("## YPP Progress")
        if channel:
            ypp = self.analytics.get_ypp_progress(channel)
            lines += [
                f"- Subscribers: {ypp['subscribers']} / {ypp['target_subs']} (**{ypp['subs_pct']}%**)",
                f"- Watch Hours: {ypp['watch_hours']} / {ypp['target_watch_hours']} (**{ypp['watch_hours_pct']}%**)",
                f"- Bottleneck: `{ypp['bottleneck']}`",
                "",
            ]
        else:
            for ch_key, ch_cfg in CHANNELS.items():
                ypp = self.analytics.get_ypp_progress(ch_key)
                lines.append(
                    f"- **{ch_cfg['name']}**: Subs {ypp['subs_pct']}% | Watch {ypp['watch_hours_pct']}% | "
                    f"Bottleneck: `{ypp['bottleneck']}`"
                )
            lines.append("")

        # Top content
        if published:
            top = sorted(published, key=lambda u: u.views, reverse=True)[:5]
            lines += [
                "## Top 5 Videos (30d)",
                "",
                f"| # | Title | Views | Retention Signal | Revenue |",
                f"|---|-------|-------|-----------------|--------|",
            ]
            for i, u in enumerate(top, 1):
                title = u.title[:55] + ("..." if len(u.title) > 55 else "")
                retention = "🟢 High" if u.avg_view_duration_sec > 90 else ("🟡 Med" if u.avg_view_duration_sec > 45 else "🔴 Low")
                lines.append(
                    f"| {i} | {title} | {self._format_number(u.views)} | {retention} | "
                    f"${self._format_number(u.revenue_usd)} |"
                )
            lines.append("")

        lines += [
            "## Key Insights",
            "",
        ]
        if published:
            top = sorted(published, key=lambda u: u.views, reverse=True)
            if top:
                best = top[0]
                lines.append(f"- Best performing video: **\"{best.title[:60]}\"** with {self._format_number(best.views)} views.")
        if platform_breakdown:
            dominant = max(platform_breakdown, key=lambda p: platform_breakdown[p]["views"])
            lines.append(f"- **{dominant.title()}** drives the most views — prioritize cross-posting there.")
        lines.append("- Revenue estimates improve as real CPM data becomes available (update `cpm` in CHANNELS).")

        lines += [
            "",
            "## Recommended Actions",
            "",
            "- [ ] Update CPM estimates in `upload_tracker.py` CHANNELS config once AdSense data is live",
            "- [ ] Review underperforming videos (low CTR, high drop-off) and A/B test new thumbnails",
            "- [ ] Plan next month's content calendar based on top-performing topics",
            "- [ ] Begin AdSense linking at 75% YPP threshold",
            "",
            f"*Report generated by Analytics Agent — {now.strftime('%Y-%m-%d')}*",
        ]
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse, sys

    parser = argparse.ArgumentParser(description="Upload Tracker CLI")
    sub = parser.add_subparsers(dest="cmd")

    # Refresh analytics
    refresh_p = sub.add_parser("refresh", help="Refresh mock analytics for all published uploads")
    refresh_p.add_argument("--channel", default=None, help="Filter by channel")

    # Report
    report_p = sub.add_parser("report", help="Generate a performance report")
    report_p.add_argument("--channel", default=None)
    report_p.add_argument("--period", choices=["weekly", "monthly"], default="weekly")
    report_p.add_argument("--output", "-o", help="Write report to file")

    # List uploads
    list_p = sub.add_parser("list", help="List uploads")
    list_p.add_argument("--channel", default=None)
    list_p.add_argument("--platform", default=None)
    list_p.add_argument("--status", default=None)
    list_p.add_argument("--limit", type=int, default=20)

    # Record a new upload
    add_p = sub.add_parser("add", help="Register a new upload")
    add_p.add_argument("--video-path", required=True)
    add_p.add_argument("--title", required=True)
    add_p.add_argument("--description", default="")
    add_p.add_argument("--tags", default="")
    add_p.add_argument("--channel", default="productivity_worker")
    add_p.add_argument("--platform", default="youtube")

    args = parser.parse_args()

    tracker = UploadTracker()
    analytics = AnalyticsTracker()
    reporter = PerformanceReporter()

    if args.cmd == "refresh":
        updated = analytics.refresh_all_mock_analytics()
        print(f"Refreshed analytics for {len(updated)} uploads.")
        for u in updated:
            print(f"  [{u.upload_id}] {u.title[:50]} — {u.views} views, ${u.revenue_usd:.4f} est.")

    elif args.cmd == "report":
        if args.period == "weekly":
            report = reporter.generate_weekly_report(channel=args.channel)
        else:
            report = reporter.generate_monthly_report(channel=args.channel)
        if args.output:
            Path(args.output).parent.mkdir(parents=True, exist_ok=True)
            Path(args.output).write_text(report, encoding="utf-8")
            print(f"Report written to: {args.output}")
        else:
            print(report)

    elif args.cmd == "list":
        uploads = tracker.list_uploads(
            channel=args.channel,
            platform=args.platform,
            status=args.status,
            limit=args.limit,
        )
        if not uploads:
            print("No uploads found.")
        for u in uploads:
            print(f"[{u.upload_id}] {u.platform}/{u.channel} | {u.upload_status} | {u.title[:50]} | {u.views} views")

    elif args.cmd == "add":
        tags = [t.strip() for t in args.tags.split(",") if t.strip()]
        record = UploadRecord(
            upload_id=f"upload_{uuid.uuid4().hex[:8]}",
            video_path=args.video_path,
            title=args.title,
            description=args.description,
            tags=tags,
            channel=args.channel,
            platform=args.platform,
            upload_status="pending",
        )
        tracker.add_upload(record)
        print(f"Registered: {record.upload_id} — {record.title}")

    else:
        parser.print_help()
