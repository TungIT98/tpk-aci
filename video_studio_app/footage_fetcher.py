"""
footage_fetcher.py — Stock footage fetcher for TKP Content Agency.

Integrates with Pexels and Pixabay to search, download, and organize
stock video footage by scene/theme keywords. Falls back to mock data
when API keys are not configured.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
import urllib.parse
import urllib.error
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class FootageItem:
    """A single stock footage clip."""
    id: str
    source: str          # "pexels" | "pixabay" | "mock"
    url: str              # preview / download URL
    thumbnail_url: str
    width: int
    height: int
    duration: float      # seconds
    tags: list[str]
    credit_line: str     # attribution text
    local_path: Optional[str] = None  # set after download


@dataclass
class SearchResult:
    query: str
    source: str
    items: list[FootageItem]
    total: int


# ---------------------------------------------------------------------------
# Base provider
# ---------------------------------------------------------------------------

class FootageProvider:
    """Abstract base for stock footage providers."""

    name: str = "base"

    def search(self, query: str, per_page: int = 10) -> SearchResult:
        raise NotImplementedError

    def download(self, item: FootageItem, dest_dir: Path) -> Path:
        raise NotImplementedError

    def _attribution(self, item: FootageItem) -> str:
        return f"Video by {item.credit_line} via {self.name}"


# ---------------------------------------------------------------------------
# Pexels provider
# ---------------------------------------------------------------------------

class PexelsProvider(FootageProvider):
    """
    Pexels API integration.

    API docs: https://www.pexels.com/api/documentation/#videos-search
    Free tier: 200 credits/month (≈ 200 video downloads).
    """

    BASE_URL = "https://api.pexels.com/videos/search"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("PEXELS_API_KEY")
        self._enabled = bool(self.api_key)

    @property
    def enabled(self) -> bool:
        return self._enabled

    def search(self, query: str, per_page: int = 10) -> SearchResult:
        if not self._enabled:
            return _mock_search("pexels", query, per_page)

        url = f"{self.BASE_URL}?{urllib.parse.urlencode({'query': query, 'per_page': per_page})}"
        req = urllib.request.Request(url, headers={
            "Authorization": self.api_key,
        })
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
        except urllib.error.URLError as exc:
            print(f"[PexelsProvider] network error: {exc}", file=sys.stderr)
            return _mock_search("pexels", query, per_page)

        items = []
        for v in data.get("videos", []):
            tags = [t["name"] for t in v.get("tags", [])]
            best_video = v["video_files"][0] if v.get("video_files") else None
            items.append(FootageItem(
                id=f"pexels-{v['id']}",
                source="pexels",
                url=best_video["link"] if best_video else "",
                thumbnail_url=v["image"] or "",
                width=best_video["width"] if best_video else 0,
                height=best_video["height"] if best_video else 0,
                duration=v.get("duration", 0),
                tags=tags,
                credit_line=v.get("user", {}).get("name", "Unknown"),
            ))

        return SearchResult(
            query=query,
            source="pexels",
            items=items,
            total=data.get("total_results", len(items)),
        )

    def download(self, item: FootageItem, dest_dir: Path) -> Path:
        if not item.url:
            raise ValueError("FootageItem has no download URL")
        dest_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{item.id}.mp4"
        dest_path = dest_dir / filename
        _download_file(item.url, dest_path)
        item.local_path = str(dest_path)
        return dest_path


# ---------------------------------------------------------------------------
# Pixabay provider
# ---------------------------------------------------------------------------

class PixabayProvider(FootageProvider):
    """
    Pixabay API integration.

    API docs: https://pixabay.com/api/docs/#videos
    Free tier: requires free API key (generous quota for still images,
    video quota varies — check your plan).
    """

    BASE_URL = "https://pixabay.com/api/videos/"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("PIXABAY_API_KEY")
        self._enabled = bool(self.api_key)

    @property
    def enabled(self) -> bool:
        return self._enabled

    def search(self, query: str, per_page: int = 10) -> SearchResult:
        if not self._enabled:
            return _mock_search("pixabay", query, per_page)

        url = f"{self.BASE_URL}?{urllib.parse.urlencode({'key': self.api_key, 'q': query, 'per_page': per_page, 'video_type': 'film'})}"
        try:
            with urllib.request.urlopen(url, timeout=15) as resp:
                data = json.loads(resp.read())
        except urllib.error.URLError as exc:
            print(f"[PixabayProvider] network error: {exc}", file=sys.stderr)
            return _mock_search("pixabay", query, per_page)

        items = []
        for v in data.get("hits", []):
            tags = v.get("tags", "").split(", ")
            best = v["videos"]["medium"] if v.get("videos", {}).get("medium") else (
                list(v.get("videos", {}).values())[0] if v.get("videos") else {}
            )
            items.append(FootageItem(
                id=f"pixabay-{v['id']}",
                source="pixabay",
                url=best.get("url", ""),
                thumbnail_url=v.get("largeThumbUrl") or v.get("previewURL", ""),
                width=best.get("width", 0),
                height=best.get("height", 0),
                duration=best.get("duration", 0),
                tags=tags,
                credit_line=v.get("user", "Unknown"),
            ))

        return SearchResult(
            query=query,
            source="pixabay",
            items=items,
            total=data.get("totalHits", len(items)),
        )

    def download(self, item: FootageItem, dest_dir: Path) -> Path:
        if not item.url:
            raise ValueError("FootageItem has no download URL")
        dest_dir.mkdir(parents=True, exist_ok=True)
        ext = _ext_from_url(item.url)
        filename = f"{item.id}{ext}"
        dest_path = dest_dir / filename
        _download_file(item.url, dest_path)
        item.local_path = str(dest_path)
        return dest_path


# ---------------------------------------------------------------------------
# Multi-provider orchestrator
# ---------------------------------------------------------------------------

class FootageFetcher:
    """
    High-level footage fetcher that queries Pexels + Pixabay in parallel
    (best-effort) and returns deduplicated results.

    Usage:
        fetcher = FootageFetcher()
        results = fetcher.search("productivity workspace", themes=["PW"])
        for item in results:
            print(item.url)
    """

    def __init__(
        self,
        pexels_key: Optional[str] = None,
        pixabay_key: Optional[str] = None,
        storage_root: Optional[Path] = None,
    ):
        self.pexels = PexelsProvider(pexels_key)
        self.pixabay = PixabayProvider(pixabay_key)
        self.storage_root = Path(storage_root or Path(__file__).parent / "footage")

    def search(
        self,
        query: str,
        themes: Optional[list[str]] = None,
        per_provider: int = 5,
    ) -> list[FootageItem]:
        """
        Search both providers and return combined FootageItems.

        Args:
            query:        primary keyword / phrase
            themes:       TKP theme tags (e.g. ["PW","GZ"]) to tag the result set
            per_provider: max results per provider

        Returns:
            list of FootageItems from all enabled providers
        """
        seen_ids: set[str] = set()
        results: list[FootageItem] = []

        for provider in [self.pexels, self.pixabay]:
            if not provider.enabled:
                print(f"[FootageFetcher] {provider.name} skipped — no API key")
                continue
            sr = provider.search(query, per_page=per_provider)
            for item in sr.items:
                if item.id not in seen_ids:
                    seen_ids.add(item.id)
                    if themes:
                        item.tags = list(set(item.tags + themes))
                    results.append(item)
            print(f"[FootageFetcher] {provider.name}: {len(sr.items)} results for '{query}'")

        if not results:
            print("[FootageFetcher] no live results — using mock data")
            mock = _mock_search("aggregated", query, per_provider * 2)
            results = mock.items

        return results

    def fetch(
        self,
        items: list[FootageItem],
        organize_by: str = "theme",
    ) -> dict[str, list[FootageItem]]:
        """
        Download footage items and organize them by theme/keyword.

        Args:
            items:       FootageItems to download
            organize_by: "theme" (use first tag) or "source"

        Returns:
            {group_name: [FootageItem]} mapping
        """
        organized: dict[str, list[FootageItem]] = {}

        for item in items:
            group = item.tags[0] if (organize_by == "theme" and item.tags) else item.source
            organized.setdefault(group, [])
            try:
                dest = self.storage_root / group.replace(" ", "_")
                path = self._provider_for(item).download(item, dest)
                print(f"[FootageFetcher] downloaded {item.id} → {path}")
            except Exception as exc:
                print(f"[FootageFetcher] download failed for {item.id}: {exc}", file=sys.stderr)
                item.local_path = None
            organized[group].append(item)

        return organized

    def _provider_for(self, item: FootageItem) -> FootageProvider:
        if item.source == "pexels":
            return self.pexels
        elif item.source == "pixabay":
            return self.pixabay
        else:
            raise ValueError(f"Unknown source: {item.source}")

    # ── B-roll auto-suggestion ───────────────────────────────────────────────

    def get_broll_options_for_scene(
        self,
        scene_description: str,
        scene_index: int,
        num_clips: int = 3,
        themes: Optional[list[str]] = None,
    ) -> dict:
        """
        High-level B-roll auto-suggestion for a scene.

        Called automatically when a scene description is set in the editor.
        Returns top {num_clips} B-roll clip options with download URLs,
        formatted for the SaaS UI.

        Args:
            scene_description: The scene's visual_direction or script text.
            scene_index: The 0-based index of the scene in the template.
            num_clips: Number of clip options to return (default 3).
            themes: Optional TKP theme tags (e.g. ["PW", "GZ"]).

        Returns:
            dict with keys:
              - scene_index, scene_description, query_used
              - clips: list of BrollClipOption dicts (each with url, thumbnail_url, download_url, etc.)
              - top_clip: the best match (rank 1) as a dict, or None
        """
        suggestion = self.search_for_scene(
            scene_description=scene_description,
            num_clips=num_clips,
            themes=themes,
        )

        clip_options = []
        for rank, item in enumerate(suggestion.items, start=1):
            # Build download URL — for real providers this is item.url,
            # for mock we construct a placeholder path
            download_url = item.url
            if item.source == "mock" or not item.url:
                download_url = f"mock://footage/{item.id}.mp4"

            clip_options.append(BrollClipOption(
                clip_id=item.id,
                source=item.source,
                url=item.url,
                thumbnail_url=item.thumbnail_url,
                download_url=download_url,
                duration=item.duration,
                resolution=f"{item.width}x{item.height}" if item.width and item.height else "unknown",
                tags=item.tags,
                credit=item.credit_line,
                rank=rank,
            ))

        result = {
            "scene_index": scene_index,
            "scene_description": scene_description,
            "query_used": suggestion.query_used,
            "num_options": len(clip_options),
            "clips": [c.to_dict() for c in clip_options],
            "top_clip": clip_options[0].to_dict() if clip_options else None,
        }

        logger.info(
            f"[FootageFetcher] B-roll options for scene {scene_index}: "
            f"{len(clip_options)} clips (top: {clip_options[0].clip_id if clip_options else 'none'})"
        )
        return result

    def search_for_scene(
        self,
        scene_description: str,
        num_clips: int = 3,
        themes: Optional[list[str]] = None,
    ) -> "BrollSuggestion":
        """
        Auto-suggest B-roll clips for a scene given its description.
        Searches both Pexels and Pixabay using keywords extracted from
        the scene description, returning the top {num_clips} results.
        """
        query = self._extract_broll_query(scene_description)
        results = self.search(query, themes=themes, per_provider=num_clips)

        suggestion = BrollSuggestion(
            scene_description=scene_description,
            items=results[:num_clips],
            query_used=query,
        )

        print(f"[FootageFetcher] B-roll for: '{scene_description[:50]}' -> {len(suggestion.items)} clips")
        return suggestion

    def _extract_broll_query(self, scene_description: str) -> str:
        """Extract visual keywords from a scene description for B-roll search."""
        stop = {
            "the", "a", "an", "is", "are", "was", "were", "be", "been",
            "have", "has", "had", "do", "does", "did", "will", "would",
            "could", "should", "may", "might", "must", "can", "need",
            "to", "of", "in", "for", "on", "with", "at", "by", "from",
            "into", "through", "during", "before", "after", "above", "below",
            "between", "under", "again", "further", "then", "once", "here",
            "there", "when", "where", "why", "how", "all", "each", "few",
            "more", "most", "other", "some", "such", "no", "nor", "not",
            "only", "own", "same", "so", "than", "too", "very", "just",
            "and", "but", "if", "or", "because", "until", "while",
            "this", "that", "these", "those", "i", "you", "he", "she", "it",
            "we", "they", "me", "him", "her", "us", "them", "my", "your",
            "his", "its", "our", "their", "what", "which", "who", "whom",
            "about", "like", "get", "got", "go", "going", "make", "made",
            "know", "think", "see", "look", "want", "give", "use", "find",
            "tell", "ask", "work", "seem", "feel", "try", "leave", "call",
            "keep", "let", "begin", "help", "show", "hear", "play",
            "run", "move", "live", "believe", "hold", "bring", "happen",
            "say", "also", "back", "still", "way", "thing", "things",
            "people", "person", "time", "year", "years", "day", "days",
            "now", "first", "last", "long", "great", "little",
            "old", "right", "big", "high", "different", "small",
            "large", "next", "early", "young", "important", "public",
            "bad", "good", "never", "always", "even", "ever", "well",
            "much", "many", "real", "actually", "really", "basically",
            "literally", "honestly", "probably", "maybe",
            "every", "another", "two", "one", "three", "new", "lot", "lots",
            "start", "stop", "take", "put", "read", "learn",
            "continue", "set", "turn", "become", "grow", "look", "point",
            "form", "build", "open", "inside", "outside", "around", "close",
            "up", "down", "out", "off", "over", "again",
        }
        words = scene_description.lower().split()
        keywords = [w for w in words if w not in stop and len(w) > 2]
        visual = {
            "person", "people", "man", "woman", "work", "desk", "office",
            "phone", "laptop", "computer", "screen", "coffee", "window",
            "city", "street", "building", "nature", "sky", "water", "ocean",
            "mountain", "forest", "beach", "room", "home", "kitchen",
            "food", "cooking", "writing", "typing", "reading", "walking",
            "running", "exercise", "gym", "fitness", "car", "bike",
            "money", "finance", "phone", "social", "media", "scrolling",
        }
        prioritized = sorted(keywords, key=lambda w: w in visual, reverse=True)
        return " ".join(prioritized[:4]) or scene_description[:30]


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _ext_from_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    path = parsed.path
    ext = os.path.splitext(path)[1]
    return ext if ext in {".mp4", ".webm", ".mov", ".avi"} else ".mp4"


def _download_file(url: str, dest: Path) -> None:
    """Download a file with a User-Agent header to avoid 403s."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "TKP-Content-Agency/1.0 (footage-fetcher)"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        dest.write_bytes(resp.read())


# ---------------------------------------------------------------------------
# Mock data (no API keys needed)
# ---------------------------------------------------------------------------

_MOCK_SCENES = [
    {"tags": ["workspace", "productivity", "desk"], "query_hint": "modern desk setup"},
    {"tags": ["phone", "social media", " scrolling"], "query_hint": "phone scrolling social media"},
    {"tags": ["coffee", "morning routine", "focus"], "query_hint": "person drinking coffee morning"},
    {"tags": ["laptop", "coding", "remote work"], "query_hint": "laptop coding remote work"},
    {"tags": ["fitness", "workout", "motivation"], "query_hint": "fitness workout motivation"},
    {"tags": ["finance", "money", "success"], "query_hint": "business finance success"},
    {"tags": ["nature", "calm", "mindfulness"], "query_hint": "nature calm mindfulness"},
    {"tags": ["city", "hustle", "ambition"], "query_hint": "city hustle ambition"},
]


def _mock_search(source: str, query: str, count: int) -> SearchResult:
    """Return deterministic mock footage items."""
    items = []
    for i in range(min(count, len(_MOCK_SCENES))):
        scene = _MOCK_SCENES[i]
        items.append(FootageItem(
            id=f"mock-{source}-{i+1}",
            source=source,
            url=f"https://example.com/footage/mock-{source}-{i+1}.mp4",
            thumbnail_url=f"https://via.placeholder.com/640x360.png?text={urllib.parse.quote('+'.join(scene['tags']))}",
            width=1920,
            height=1080,
            duration=15.0,
            tags=scene["tags"] + [query],
            credit_line="Mock Footage",
        ))
    return SearchResult(query=query, source=source, items=items, total=len(items))


# ---------------------------------------------------------------------------
# B-roll auto-suggestion
# ---------------------------------------------------------------------------

@dataclass
class BrollSuggestion:
    """
    A B-roll clip suggested for a given scene.
    Returned by FootageFetcher.search_for_scene().
    """
    scene_description: str
    items: list[FootageItem]
    query_used: str

    @property
    def top_clip(self) -> Optional[FootageItem]:
        """Return the first (highest-ranked) clip, or None if no results."""
        return self.items[0] if self.items else None

    def to_dict(self) -> dict:
        return {
            "scene_description": self.scene_description,
            "query_used": self.query_used,
            "num_clips": len(self.items),
            "clips": [
                {
                    "id": item.id,
                    "source": item.source,
                    "url": item.url,
                    "thumbnail_url": item.thumbnail_url,
                    "duration": item.duration,
                    "tags": item.tags,
                    "credit": item.credit_line,
                }
                for item in self.items
            ],
        }


@dataclass
class BrollClipOption:
    """
    A single B-roll clip option formatted for the SaaS UI.
    Returned by FootageFetcher.get_broll_options_for_scene().
    """
    clip_id: str
    source: str
    url: str
    thumbnail_url: str
    download_url: str
    duration: float
    resolution: str
    tags: list[str]
    credit: str
    rank: int   # 1-based rank (1 = best)

    def to_dict(self) -> dict:
        return {
            "clip_id": self.clip_id,
            "source": self.source,
            "url": self.url,
            "thumbnail_url": self.thumbnail_url,
            "download_url": self.download_url,
            "duration": self.duration,
            "resolution": self.resolution,
            "tags": self.tags,
            "credit": self.credit,
            "rank": self.rank,
        }


# ---------------------------------------------------------------------------
# CLI (standalone test)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="TKP Footage Fetcher CLI")
    sub = parser.add_subparsers(dest="cmd")

    search_p = sub.add_parser("search", help="Search for footage")
    search_p.add_argument("query", help="Search query")
    search_p.add_argument("--per-provider", "-n", type=int, default=5)
    search_p.add_argument("--themes", "-t", nargs="+", default=[])

    fetch_p = sub.add_parser("fetch", help="Download footage")
    fetch_p.add_argument("query", help="Search query")
    fetch_p.add_argument("--per-provider", "-n", type=int, default=5)
    fetch_p.add_argument("--themes", "-t", nargs="+", default=[])
    fetch_p.add_argument("--dry-run", action="store_true", help="Skip actual download")

    args = parser.parse_args()

    if not args.cmd:
        parser.print_help()
        sys.exit(0)

    fetcher = FootageFetcher()

    if args.cmd == "search":
        items = fetcher.search(args.query, themes=args.themes, per_provider=args.per_provider)
        print(f"\n{len(items)} footage item(s) found:\n")
        for item in items:
            print(f"  [{item.source}] {item.id}")
            print(f"    tags : {', '.join(item.tags)}")
            print(f"    url  : {item.url}")
            print()

    elif args.cmd == "fetch":
        if args.dry_run:
            print("[dry-run] Skipping actual download")
        items = fetcher.search(args.query, themes=args.themes, per_provider=args.per_provider)
        if not args.dry_run:
            organized = fetcher.fetch(items)
            print("\nOrganized footage:")
            for group, grp_items in organized.items():
                print(f"  {group}/ ({len(grp_items)} clips)")
                for item in grp_items:
                    print(f"    {item.id} → {item.local_path or 'FAILED'}")
        else:
            print(f"\n[ dry-run ] Would download {len(items)} clip(s):")
            for item in items:
                print(f"  {item.id}  ({item.tags})")
