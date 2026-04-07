"""
video_studio_app/competitor_analyzer.py
SEO Specialist — TKP Video Studio (TKP-65)

Analyzes competitor TikTok/YouTube channels to extract:
  - Top-performing videos
  - Common hashtag usage
  - Posting frequency
  - Best posting times

YouTube: Uses YouTube Data API v3 (if YOUTUBE_API_KEY available).
         Falls back to web scraping if not.

TikTok:  No official public API. Uses web scraping fallback.
         Documents limitation clearly. Do NOT use for spam or bulk extraction.

Usage:
    from competitor_analyzer import CompetitorAnalyzer, Platform

    analyzer = CompetitorAnalyzer()

    # YouTube analysis
    yt = analyzer.analyze_youtube("channel_id_or_handle")
    print(yt.common_hashtags)
    print(yt.best_posting_times)

    # TikTok analysis
    tt = analyzer.analyze_tiktok("username")
    print(tt.top_videos)

    # Store competitor profiles
    analyzer.save_profile("creatorName", Platform.YOUTUBE, yt.to_dict())

    # Load saved profiles
    profiles = analyzer.load_all_profiles()
"""

from __future__ import annotations

import json
import logging
import math
import re
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums & Dataclasses
# ---------------------------------------------------------------------------

class Platform(Enum):
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    INSTAGRAM = "instagram"


@dataclass
class TopVideo:
    """A top-performing video from a competitor channel."""
    title: str
    video_id: str
    url: str
    views: int
    likes: int
    comments: int
    published_at: str       # ISO timestamp
    duration_seconds: int
    hashtags: list[str]
    description_snippet: str


@dataclass
class CompetitorProfile:
    """Full analysis result for a competitor channel."""
    handle: str
    platform: Platform
    channel_name: str
    subscriber_count: int
    total_videos: int
    top_videos: list[TopVideo]
    common_hashtags: list[str]      # sorted by frequency
    posting_frequency: str           # e.g. "3 videos/week"
    best_posting_times: list[str]   # e.g. ["Monday 9am", "Thursday 6pm"]
    analysis_date: str
    data_source: str               # "youtube_api" | "web_scrape" | "mock" | "tiktok_no_api"

    def to_dict(self) -> dict:
        return {
            "handle": self.handle,
            "platform": self.platform.value,
            "channel_name": self.channel_name,
            "subscriber_count": self.subscriber_count,
            "total_videos": self.total_videos,
            "top_videos": [asdict(v) for v in self.top_videos],
            "common_hashtags": self.common_hashtags,
            "posting_frequency": self.posting_frequency,
            "best_posting_times": self.best_posting_times,
            "analysis_date": self.analysis_date,
            "data_source": self.data_source,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "CompetitorProfile":
        data["platform"] = Platform(data["platform"])
        data["top_videos"] = [TopVideo(**v) for v in data["top_videos"]]
        return cls(**data)


# ---------------------------------------------------------------------------
# Config & constants
# ---------------------------------------------------------------------------

_DB_PATH = Path(__file__).parent.parent / "output" / "competitors_db.json"
_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

DEFAULT_BEST_TIMES: dict[str, list[str]] = {
    Platform.YOUTUBE.value: ["Saturday 9am", "Sunday 10am", "Wednesday 3pm"],
    Platform.TIKTOK.value: ["Tuesday 7pm", "Thursday 8pm", "Saturday 12pm"],
    Platform.INSTAGRAM.value: ["Monday 11am", "Wednesday 12pm", "Friday 5pm"],
}


# ---------------------------------------------------------------------------
# YouTube API helpers
# ---------------------------------------------------------------------------

def _get_youtube_api_key() -> Optional[str]:
    """Get YouTube API key from environment variables."""
    import os
    # Check dedicated API key env var
    key = os.getenv("YOUTUBE_API_KEY", "")
    if key:
        return key
    # Check client secrets format (first colon-separated segment)
    secrets = os.getenv("YOUTUBE_CLIENT_SECRETS", "")
    if secrets and ":" in secrets:
        return secrets.split(":")[0]
    return None


def _fetch_youtube_channel_videos(channel_id: str, api_key: str, max_results: int = 20) -> list[dict]:
    """Fetch recent videos from a YouTube channel via Data API v3."""
    import urllib.request

    videos: list[dict] = []

    # Step 1: Get uploads playlist ID from channel
    channel_url = (
        f"https://www.googleapis.com/youtube/v3/channels"
        f"?part=contentDetails&id={channel_id}&key={api_key}"
    )
    req = urllib.request.Request(channel_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        channel_data = json.loads(resp.read())

    items = channel_data.get("items", [])
    if not items:
        return []
    uploads_playlist_id = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]

    # Step 2: Get video IDs from uploads playlist
    playlist_url = (
        f"https://www.googleapis.com/youtube/v3/playlistItems"
        f"?part=snippet&playlistId={uploads_playlist_id}&maxResults={max_results}&key={api_key}"
    )
    req2 = urllib.request.Request(playlist_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req2, timeout=15) as resp:
        playlist_data = json.loads(resp.read())

    playlist_items = playlist_data.get("items", [])
    if not playlist_items:
        return []

    video_ids = [
        item["snippet"]["resourceId"]["videoId"]
        for item in playlist_items
        if item["snippet"]["resourceId"]["kind"] == "youtube#video"
    ]
    if not video_ids:
        return []

    # Step 3: Get video statistics (batched, max 50 per call)
    batch_ids = video_ids[:50]
    stats_url = (
        f"https://www.googleapis.com/youtube/v3/videos"
        f"?part=statistics,contentDetails,snippet"
        f"&id={','.join(batch_ids)}&key={api_key}"
    )
    req3 = urllib.request.Request(stats_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req3, timeout=15) as resp:
        stats_data = json.loads(resp.read())

    for item in stats_data.get("items", []):
        snippet = item["snippet"]
        stats = item["statistics"]
        duration_str = item["contentDetails"]["duration"]

        # Extract hashtags from description and tags
        desc = snippet.get("description", "")
        tags = snippet.get("tags", [])
        all_text = desc + " " + " ".join(tags)
        hashtags = list(dict.fromkeys(h.lower() for h in re.findall(r"#(\w+)", all_text)))

        videos.append({
            "video_id": item["id"],
            "title": snippet["title"],
            "url": f"https://www.youtube.com/watch?v={item['id']}",
            "views": int(stats.get("viewCount", 0)),
            "likes": int(stats.get("likeCount", 0)),
            "comments": int(stats.get("commentCount", 0)),
            "published_at": snippet["publishedAt"],
            "duration_seconds": _parse_iso_duration(duration_str),
            "hashtags": hashtags,
            "description_snippet": desc[:200],
        })

    return videos


def _parse_iso_duration(iso: str) -> int:
    """Parse ISO 8601 duration string (PT1H2M3S) to seconds."""
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso)
    if not match:
        return 0
    h, m, s = (int(x) if x else 0 for x in match.groups())
    return h * 3600 + m * 60 + s


# ---------------------------------------------------------------------------
# YouTube web scraper (fallback — no API key)
# ---------------------------------------------------------------------------

def _scrape_youtube_channel(channel_id_or_handle: str) -> list[dict]:
    """
    Best-effort scrape of YouTube channel videos via web page.
    Used when YouTube Data API key is not available.

    Note: YouTube's HTML changes frequently — this is a maintenance-sensitive fallback.
    """
    import urllib.request

    if channel_id_or_handle.startswith("UC"):
        url = f"https://www.youtube.com/channel/{channel_id_or_handle}/videos"
    else:
        url = f"https://www.youtube.com/@{channel_id_or_handle}/videos"

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        # YouTube embeds JSON data in script tags — look for video renderer blocks
        # Pattern: videoId + title runs
        pattern = re.findall(
            r'"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[(\{"text":"([^"]+)"\})\]\}',
            html,
        )
        videos = []
        for video_id, _, title_text in pattern[:20]:
            videos.append({
                "video_id": video_id,
                "title": title_text,
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "views": 0,
                "likes": 0,
                "comments": 0,
                "published_at": datetime.now().isoformat(),
                "duration_seconds": 0,
                "hashtags": [],
                "description_snippet": "",
            })
        return videos
    except Exception as exc:
        logger.warning(f"YouTube scrape failed for {channel_id_or_handle}: {exc}")
        return []


# ---------------------------------------------------------------------------
# TikTok scraper (best-effort, documented limitation)
# ---------------------------------------------------------------------------

_TIKTOK_API_NOTICE = (
    "TikTok has no official public API for competitor analysis. "
    "Web scraping TikTok is unreliable due to heavy client-side JS rendering. "
    "Automated scraping may violate TikTok Terms of Service. "
    "For production use: RapidAPI TikTok Scraper, TikWM, or TikTok Business API."
)


def _scrape_tiktok_profile(username: str) -> dict:
    """
    Best-effort TikTok profile data via web scraping.
    Returns estimated/mock data — not suitable for production.

    Set TIKTOK_API_KEY (RapidAPI key) or TIKTOK_SESSION_COOKIES for real data.
    """
    import os

    username = username.lstrip("@")

    # Try RapidAPI TikTok Scraper if key is set
    rapidapi_key = os.getenv("RAPIDAPI_KEY", "")
    if rapidapi_key:
        return _scrape_tiktok_rapidapi(username, rapidapi_key)

    # Fall back to session cookies (TIKTOK_SESSION_COOKIES env var)
    session_cookies = os.getenv("TIKTOK_SESSION_COOKIES", "")
    if session_cookies:
        return _scrape_tiktok_cookies(username, session_cookies)

    logger.warning(f"TikTok scrape for @{username}: no API key or session cookies configured. "
                   f"{_TIKTOK_API_NOTICE}")

    return {
        "username": username,
        "profile_url": f"https://www.tiktok.com/@{username}",
        "notice": _TIKTOK_API_NOTICE,
        "hashtags_sample": ["#fyp", "#viral", "#trending"],
    }


def _scrape_tiktok_rapidapi(username: str, api_key: str) -> dict:
    """Scrape TikTok via RapidAPI TikTok Scraper."""
    import urllib.request

    url = "https://tiktok-api23.p.rapidapi.com/api/user/posts"
    querystring = {"uniqueId": username, "count": "20"}
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "tiktok-api23.p.rapidapi.com",
    }
    try:
        req = urllib.request.Request(
            f"{url}?uniqueId={username}&count=20",
            headers={**headers, "User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
            aweme_list = data.get("itemList", [])
            hashtags = []
            for item in aweme_list:
                desc = item.get("desc", "")
                hashtags += re.findall(r"#(\w+)", desc)
            return {
                "username": username,
                "videos": len(aweme_list),
                "hashtags_sample": list(dict.fromkeys(hashtags))[:15],
                "data_source": "rapidapi",
            }
    except Exception as exc:
        logger.warning(f"RapidAPI TikTok scrape failed: {exc}")
        return {"username": username, "notice": str(exc), "hashtags_sample": []}


def _scrape_tiktok_cookies(username: str, session_cookies: str) -> dict:
    """Scrape TikTok using session cookies (authenticated)."""
    import urllib.request

    url = f"https://www.tiktok.com/@{username}?lang=en"
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
                ),
                "Cookie": session_cookies,
            },
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            # Look for JSON data in script tags
            match = re.search(r'"desc":"([^"]+)"|hashtags.*?"title":"([^"]+)"', html)
            return {
                "username": username,
                "profile_url": url,
                "notice": "Session cookie method — data extraction limited",
                "hashtags_sample": [],
            }
    except Exception as exc:
        logger.warning(f"TikTok cookie scrape failed: {exc}")
        return {"username": username, "notice": str(exc), "hashtags_sample": []}


# ---------------------------------------------------------------------------
# Analytics helpers
# ---------------------------------------------------------------------------

def _extract_common_hashtags(videos: list[dict]) -> list[str]:
    """Count hashtag frequency across videos, return top 15 by frequency."""
    freq: dict[str, int] = {}
    for v in videos:
        for tag in v.get("hashtags", []):
            freq[tag] = freq.get(tag, 0) + 1
    return [tag for tag, _ in sorted(freq.items(), key=lambda x: x[1], reverse=True)][:15]


def _estimate_posting_frequency(videos: list[dict]) -> str:
    """Estimate posting cadence from published dates of recent videos."""
    dates = []
    for v in videos:
        try:
            raw = v["published_at"].replace("Z", "+00:00")
            dates.append(datetime.fromisoformat(raw))
        except Exception:
            pass

    if len(dates) < 2:
        return "unknown"

    dates.sort(reverse=True)
    gaps = []
    for i in range(min(len(dates), 10) - 1):
        delta = (dates[i] - dates[i + 1]).total_seconds() / 86400
        gaps.append(delta)

    avg_gap = sum(gaps) / len(gaps)
    if avg_gap <= 1.5:
        return "daily"
    elif avg_gap <= 4:
        return "3-4 videos/week"
    elif avg_gap <= 8:
        return "1-2 videos/week"
    elif avg_gap <= 15:
        return "1-2 videos/month"
    return "sporadic"


def _estimate_best_times(videos: list[dict]) -> list[str]:
    """Estimate best posting times from engagement patterns in recent videos."""
    scored: list[tuple[float, datetime]] = []
    for v in videos:
        try:
            views = max(v.get("views", 0), 1)
            engagement = (v.get("likes", 0) + v.get("comments", 0)) / views
            raw = v["published_at"].replace("Z", "+00:00")
            scored.append((engagement, datetime.fromisoformat(raw)))
        except Exception:
            pass

    if len(scored) < 3:
        return DEFAULT_BEST_TIMES.get(Platform.YOUTUBE.value, [])

    scored.sort(reverse=True, key=lambda x: x[0])
    top_times = [dt for _, dt in scored[:5]]

    day_counts: dict[str, int] = {}
    hour_counts: dict[int, int] = {}
    for _, dt in top_times:
        day = dt.strftime("%A")
        hour = dt.hour
        day_counts[day] = day_counts.get(day, 0) + 1
        hour_counts[hour] = hour_counts.get(hour, 0) + 1

    best_day = max(day_counts, key=day_counts.get, default="Monday")
    best_hour = max(hour_counts, key=hour_counts.get, default=9)
    suffix = "am" if best_hour < 12 else "pm"
    display_hour = best_hour % 12 or 12
    return [f"{best_day} {display_hour}{suffix}"]


# ---------------------------------------------------------------------------
# Mock data
# ---------------------------------------------------------------------------

_MOCK_VIDEOS: list[dict] = [
    {
        "video_id": "mock001",
        "title": "How I Manage My Time — My Full Productivity System",
        "url": "https://www.youtube.com/watch?v=mock001",
        "views": 45000,
        "likes": 3200,
        "comments": 180,
        "published_at": "2026-03-20T14:00:00Z",
        "duration_seconds": 720,
        "hashtags": ["productivity", "timemanagement", "workflow", "deepwork"],
        "description_snippet": "My complete productivity system that I use every day...",
    },
    {
        "video_id": "mock002",
        "title": "Deep Work: 30 Days — What Actually Happened",
        "url": "https://www.youtube.com/watch?v=mock002",
        "views": 38000,
        "likes": 2800,
        "comments": 145,
        "published_at": "2026-03-13T10:00:00Z",
        "duration_seconds": 900,
        "hashtags": ["deepwork", "focus", "productivity", "habits"],
        "description_snippet": "I tried deep work for 30 days straight. Here's what happened...",
    },
    {
        "video_id": "mock003",
        "title": "The Best Tools for Remote Work in 2026",
        "url": "https://www.youtube.com/watch?v=mock003",
        "views": 62000,
        "likes": 5100,
        "comments": 320,
        "published_at": "2026-03-06T16:00:00Z",
        "duration_seconds": 1080,
        "hashtags": ["remotework", "productivity", "tech", "toolstack"],
        "description_snippet": "These are the exact tools I use every day for remote work...",
    },
    {
        "video_id": "mock004",
        "title": "I Tried the 2-Hour Rule for a Week",
        "url": "https://www.youtube.com/watch?v=mock004",
        "views": 29000,
        "likes": 2100,
        "comments": 98,
        "published_at": "2026-02-27T09:00:00Z",
        "duration_seconds": 660,
        "hashtags": ["productivity", "timemanagement", "focus", "workflow"],
        "description_snippet": "The 2-hour rule claims you can do anything in 2 hours...",
    },
]


# ---------------------------------------------------------------------------
# Main Analyzer
# ---------------------------------------------------------------------------

class CompetitorAnalyzer:
    """
    YouTube and TikTok competitor channel analyzer.

    YouTube:  Uses YouTube Data API v3 if YOUTUBE_API_KEY is set.
              Falls back to web scraping (best-effort, may break with UI changes).
              Falls back to mock data if scraping fails.

    TikTok:   No official public API available.
              Attempts RapidAPI TikTok Scraper if RAPIDAPI_KEY is set.
              Falls back to session cookie auth or returns mock/estimated data.

    Parameters
    ----------
    db_path : Path, optional
        Override path to competitors database JSON.
    """

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or _DB_PATH

    # ------------------------------------------------------------------
    # YouTube
    # ------------------------------------------------------------------

    def analyze_youtube(
        self,
        channel_id_or_handle: str,
        max_videos: int = 20,
    ) -> CompetitorProfile:
        """
        Analyze a YouTube channel.

        Parameters
        ----------
        channel_id_or_handle : str
            YouTube channel ID (UC...) or @handle.
        max_videos : int
            Number of recent videos to analyze. Default 20.

        Returns
        -------
        CompetitorProfile
        """
        api_key = _get_youtube_api_key()
        now_iso = datetime.now().isoformat()

        if api_key:
            logger.info(f"YouTube API available — fetching: {channel_id_or_handle}")
            videos = _fetch_youtube_channel_videos(channel_id_or_handle, api_key, max_videos)
            data_source = "youtube_api"
        else:
            logger.info(f"No YouTube API key — attempting scrape: {channel_id_or_handle}")
            videos = _scrape_youtube_channel(channel_id_or_handle)
            data_source = "web_scrape"

        if not videos:
            logger.warning(f"No YouTube videos retrieved — using mock data")
            videos = _MOCK_VIDEOS
            data_source = "mock"

        # Build top videos (sorted by views)
        top = sorted(videos, key=lambda v: v.get("views", 0), reverse=True)[:10]
        top_videos = [
            TopVideo(
                title=v["title"],
                video_id=v["video_id"],
                url=v["url"],
                views=v.get("views", 0),
                likes=v.get("likes", 0),
                comments=v.get("comments", 0),
                published_at=v["published_at"],
                duration_seconds=v.get("duration_seconds", 0),
                hashtags=v.get("hashtags", []),
                description_snippet=v.get("description_snippet", ""),
            )
            for v in top
        ]

        return CompetitorProfile(
            handle=channel_id_or_handle,
            platform=Platform.YOUTUBE,
            channel_name=top_videos[0].title if top_videos else channel_id_or_handle,
            subscriber_count=0,  # Requires separate API call
            total_videos=len(videos),
            top_videos=top_videos,
            common_hashtags=_extract_common_hashtags(videos),
            posting_frequency=_estimate_posting_frequency(videos),
            best_posting_times=_estimate_best_times(videos),
            analysis_date=now_iso,
            data_source=data_source,
        )

    # ------------------------------------------------------------------
    # TikTok
    # ------------------------------------------------------------------

    def analyze_tiktok(self, username: str) -> CompetitorProfile:
        """
        Analyze a TikTok profile (best-effort — no public API).

        Note: TikTok scraping may violate TikTok ToS. For production use,
        subscribe to RapidAPI TikTok Scraper or TikTok Business API.
        """
        now_iso = datetime.now().isoformat()
        scrape_result = _scrape_tiktok_profile(username)

        return CompetitorProfile(
            handle=username.lstrip("@"),
            platform=Platform.TIKTOK,
            channel_name=scrape_result.get("username", username),
            subscriber_count=0,
            total_videos=scrape_result.get("videos", 0),
            top_videos=[],
            common_hashtags=scrape_result.get("hashtags_sample", []),
            posting_frequency="unknown (TikTok API not available)",
            best_posting_times=DEFAULT_BEST_TIMES.get(Platform.TIKTOK.value, []),
            analysis_date=now_iso,
            data_source="tiktok_no_api",
        )

    # ------------------------------------------------------------------
    # Profile storage
    # ------------------------------------------------------------------

    def save_profile(
        self,
        handle: str,
        platform: Platform,
        profile_data: dict,
    ) -> None:
        """Save a competitor profile to competitors_db.json."""
        db = {}
        if self.db_path.exists():
            try:
                db = json.loads(self.db_path.read_text(encoding="utf-8"))
            except Exception:
                pass
        key = f"{platform.value}::{handle}"
        db[key] = profile_data
        self.db_path.write_text(json.dumps(db, indent=2, ensure_ascii=False), encoding="utf-8")
        logger.info(f"Saved competitor profile: {key}")

    def load_profile(self, handle: str, platform: Platform) -> Optional[dict]:
        """Load a saved competitor profile."""
        if not self.db_path.exists():
            return None
        try:
            db = json.loads(self.db_path.read_text(encoding="utf-8"))
            return db.get(f"{platform.value}::{handle}")
        except Exception as exc:
            logger.warning(f"Failed to load profile: {exc}")
            return None

    def load_all_profiles(self) -> dict[str, dict]:
        """Load all saved competitor profiles."""
        if not self.db_path.exists():
            return {}
        try:
            return json.loads(self.db_path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def list_profiles(self) -> list[dict]:
        """List all saved profiles as summary dicts."""
        profiles = self.load_all_profiles()
        return [
            {
                "handle": v["handle"],
                "platform": v["platform"],
                "channel_name": v["channel_name"],
                "total_videos": v["total_videos"],
                "common_hashtags": v["common_hashtags"][:5],
                "posting_frequency": v["posting_frequency"],
                "analysis_date": v["analysis_date"],
            }
            for v in profiles.values()
        ]


# ---------------------------------------------------------------------------
# CLI / self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("CompetitorAnalyzer — Self-Test")
    print("=" * 60)

    analyzer = CompetitorAnalyzer()

    # YouTube analysis
    print("\n[YouTube Analysis — sample channel]")
    yt = analyzer.analyze_youtube("UCkj0T7yLEd4bKlc7mC6B6cQ")
    print(f"  Channel: {yt.channel_name}")
    print(f"  Videos analyzed: {yt.total_videos}")
    print(f"  Data source: {yt.data_source}")
    print(f"  Posting frequency: {yt.posting_frequency}")
    print(f"  Best posting times: {yt.best_posting_times}")
    print(f"  Common hashtags: {yt.common_hashtags}")
    print(f"  Top 3 videos:")
    for v in yt.top_videos[:3]:
        print(f"    [{v.views:,} views] {v.title}")

    # TikTok analysis
    print("\n[TikTok Analysis — charlidamelio (example)]")
    tt = analyzer.analyze_tiktok("charlidamelio")
    print(f"  Channel: {tt.channel_name}")
    print(f"  Common hashtags: {tt.common_hashtags}")
    print(f"  Data source: {tt.data_source}")

    # Save and reload
    print("\n[Save & Reload Test]")
    analyzer.save_profile(yt.handle, Platform.YOUTUBE, yt.to_dict())
    loaded = analyzer.load_profile(yt.handle, Platform.YOUTUBE)
    print(f"  Reloaded: {loaded['handle'] if loaded else 'FAILED'}")

    # List all
    print("\n[Saved Profiles]")
    for p in analyzer.list_profiles():
        print(f"  {p['platform']} | {p['handle']} | {p['channel_name']}")

    print("\n" + "=" * 60)
    print("Self-test complete.")
    print("=" * 60)
