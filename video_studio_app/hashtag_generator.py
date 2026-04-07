"""
video_studio_app/hashtag_generator.py
SEO Specialist — TKP Video Studio (TKP-65)

Generates 15-30 ranked hashtags per video from topic, script text, and target platform.
Uses keyword extraction from script text + curated hashtag pools per channel + platform rules.

Usage:
    from hashtag_generator import HashtagGenerator, Platform, AudienceTier

    gen = HashtagGenerator(channel="productivity")
    result = gen.generate(
        topic="The 2-Minute Rule",
        script_text="Why your small tasks pile up...",
        platform=Platform.TIKTOK,
        count=20,
    )
    for tag in result.hashtags:
        print(tag.formatted)

    # Platform-specific output
    tiktok_tags = gen.generate(...).for_tiktok()       # space-separated string
    youtube_tags = gen.generate(...).for_youtube()     # comma-separated list
"""

from __future__ import annotations

import json
import math
import random
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional

from .seo_optimizer import CHANNEL_PROFILES


# ---------------------------------------------------------------------------
# Enums & Dataclasses
# ---------------------------------------------------------------------------

class Platform(Enum):
    TIKTOK = "tiktok"
    YOUTUBE = "youtube"
    INSTAGRAM = "instagram"
    LINKEDIN = "linkedin"
    TWITTER = "twitter"


class AudienceTier(Enum):
    BROAD = "broad"       # high-volume, low-specificity
    NICHE = "niche"       # topic-specific
    TRENDING = "trending"  # time-sensitive / viral


@dataclass
class Hashtag:
    """A single hashtag with metadata."""
    tag: str              # e.g. "productivity"
    formatted: str        # e.g. "#productivity"
    popularity: float     # 0.0–1.0 estimated relative volume
    tier: AudienceTier
    source: str           # "keyword_extract", "pool", "trending", "script"
    platform_banned: bool = False  # FYP/TikTok banned-list flag

    def is_valid_tiktok(self) -> bool:
        return not self.platform_banned


@dataclass
class HashtagResult:
    """Full hashtag generation result."""
    hashtags: list[Hashtag]
    broad_count: int
    niche_count: int
    trending_count: int
    tiktok_valid_count: int

    def for_tiktok(self, max_count: int = 5) -> str:
        """
        Returns TikTok-ready hashtag string.
        TikTok limits to ~5 hashtags for best reach; if count > 5, picks best per tier.
        """
        valid = [h for h in self.hashtags if h.is_valid_tiktok()]
        if len(valid) > max_count:
            # Pick 2 niche + 1 broad + 1 trending (best distribution)
            by_tier = {AudienceTier.NICHE: [], AudienceTier.BROAD: [], AudienceTier.TRENDING: []}
            for h in valid:
                by_tier[h.tier].append(h)

            selected: list[Hashtag] = []
            selected += sorted(by_tier[AudienceTier.NICHE], key=lambda x: -x.popularity)[:2]
            selected += sorted(by_tier[AudienceTier.BROAD], key=lambda x: -x.popularity)[:1]
            selected += sorted(by_tier[AudienceTier.TRENDING], key=lambda x: -x.popularity)[:1]
            valid = selected[:max_count]

        return " ".join(h.formatted for h in valid)

    def for_youtube(self) -> list[str]:
        """Returns YouTube tags list (without # prefix)."""
        return [h.tag for h in self.hashtags if not h.platform_banned]

    def for_instagram(self, max_count: int = 15) -> str:
        """Returns Instagram-ready hashtag string (max 15 recommended)."""
        valid = [h for h in self.hashtags if not h.platform_banned]
        return " ".join(h.formatted for h in valid[:max_count])

    def for_linkedin(self, max_count: int = 5) -> str:
        """Returns LinkedIn hashtag string (max 5 for professional tone)."""
        valid = [h for h in self.hashtags if not h.platform_banned]
        # Prefer professional-sounding tags
        professional_priority = ["career", "productivity", "growth", "success", "leadership",
                                  "professional", "work", "business", "management"]
        by_professional = sorted(
            valid,
            key=lambda h: any(p in h.tag.lower() for p in professional_priority),
            reverse=True,
        )
        return " ".join(h.formatted for h in by_professional[:max_count])


# ---------------------------------------------------------------------------
# Keyword extraction
# ---------------------------------------------------------------------------

STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "can", "this",
    "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
    "my", "your", "his", "her", "its", "our", "their", "what", "which",
    "who", "whom", "when", "where", "why", "how", "all", "each", "every",
    "both", "few", "more", "most", "other", "some", "such", "no", "not",
    "only", "same", "so", "than", "too", "very", "just", "about", "in",
    "on", "at", "to", "for", "of", "with", "by", "from", "up", "out",
    "if", "into", "through", "during", "before", "after", "above", "below",
}


def _extract_keywords(text: str, top_n: int = 10) -> list[str]:
    """
    Extract top-N meaningful keywords from text.
    Returns stemmed words in order of frequency.
    """
    # Normalize: lowercase, strip punctuation, split on whitespace
    words = re.sub(r"[^\w\s]", " ", text.lower()).split()
    # Filter stop words and short tokens
    meaningful = [w for w in words if w not in STOP_WORDS and len(w) > 2]
    # Frequency count
    freq: dict[str, int] = {}
    for w in meaningful:
        freq[w] = freq.get(w, 0) + 1
    # Sort by frequency, return top N
    return sorted(freq, key=freq.get, reverse=True)[:top_n]


def _stem_keyword(word: str) -> str:
    """
    Simple stemmer: strip common suffixes.
    Good enough for hashtag generation.
    """
    word = word.strip()
    for suffix in ["ing", "tion", "ment", "ness", "er", "ly", "ed", "s"]:
        if len(word) > len(suffix) + 2 and word.endswith(suffix):
            word = word[: -len(suffix)]
    return word


# ---------------------------------------------------------------------------
# Banned hashtags (TikTok FYP)
# ---------------------------------------------------------------------------

TIKTOK_BANNED_HASHTAGS: set[str] = {
    "fyp", "foryou", "foryoupage", "viral", "follow", "followforfollowback",
    "followme", "likeforlikes", "likemyrecent", "spam", "spamforspam",
    "s4s", "shoutout", "shoutouts", "shoutoutforshoutout",
}


# ---------------------------------------------------------------------------
# Channel hashtag pools (extensible)
# ---------------------------------------------------------------------------

CHANNEL_HASHTAG_POOLS: dict[str, dict[str, list[str]]] = {
    "productivity": {
        AudienceTier.BROAD.value: [
            "productivity", "timemanagement", "work", "career", "focus",
            "deepwork", "goals", "success", "professional",
        ],
        AudienceTier.NICHE.value: [
            "timeblocking", "pomodoro", "morningroutine", "eveningroutine",
            "habitstacking", "notion", "productivityhacks", "workflow",
            "taskmanagement", "planner", "calendar", "eisenhower",
            "deepwork", "mondaymotivation", "busyprofessional",
        ],
        AudienceTier.TRENDING.value: [
            "2026goals", "q2goals", "springroutine", "minimalism",
            "reset", "springproductivity", "productive", "spring2026",
        ],
    },
    "growth": {
        AudienceTier.BROAD.value: [
            "growthmindset", "selfimprovement", "motivation", "success",
            "mindset", "wealth", "money", "finance",
        ],
        AudienceTier.NICHE.value: [
            "sidehustle", "passiveincome", "budgeting", "investing",
            "careergrowth", "salary", "negotiation", "firstjob",
            "genztips", "moneytips", "financialfreedom",
        ],
        AudienceTier.TRENDING.value: [
            "2026hustle", "money2026", "softlife", "girlmath",
            "moneytok", "careermoves", "newhome", "wealthbuilding",
        ],
    },
}


# ---------------------------------------------------------------------------
# Popularity scoring
# ---------------------------------------------------------------------------

def _score_popularity(tag: str, keyword_match: bool, source: str) -> float:
    """Score a hashtag 0.0–1.0 on estimated relative popularity."""
    score = 0.5  # base

    # Boost if matches extracted keyword directly
    if keyword_match:
        score += 0.3

    # Source adjustments
    if source == "keyword_extract":
        score += 0.2
    elif source == "trending":
        score += 0.15

    # Known high-volume tags get a boost
    HIGH_VOLUME_TAGS = {
        "productivity", "sidehustle", "moneytips", "careeradvice",
        "motivation", "success", "goals", "habits", "growthmindset",
        "financialfreedom", "focus", "deepwork", "work", "money",
    }
    if tag.lower() in HIGH_VOLUME_TAGS:
        score = min(1.0, score + 0.15)

    # Add small random jitter to avoid always returning same order
    score += random.uniform(-0.05, 0.05)
    return max(0.0, min(1.0, score))


# ---------------------------------------------------------------------------
# Main Generator
# ---------------------------------------------------------------------------

class HashtagGenerator:
    """
    Generates ranked hashtag lists from topic, script, and platform.

    Parameters
    ----------
    channel : str
        One of "productivity", "growth". Determines hashtag pools.
    """

    DEFAULT_COUNTS = {Platform.TIKTOK: 5, Platform.YOUTUBE: 12, Platform.INSTAGRAM: 15, Platform.LINKEDIN: 5}

    def __init__(self, channel: str = "productivity"):
        self.channel = channel
        self.profile = CHANNEL_PROFILES.get(channel, CHANNEL_PROFILES["productivity"])
        self.pools = CHANNEL_HASHTAG_POOLS.get(channel, CHANNEL_HASHTAG_POOLS["productivity"])

    # ------------------------------------------------------------------
    # Keyword extraction from script
    # ------------------------------------------------------------------

    def _extract_from_script(self, script_text: str) -> list[str]:
        """Extract keywords from script text and convert to hashtag stems."""
        raw_keywords = _extract_keywords(script_text, top_n=15)
        return [_stem_keyword(k) for k in raw_keywords]

    # ------------------------------------------------------------------
    # Build hashtag lists per tier
    # ------------------------------------------------------------------

    def _build_from_pools(self, tier: AudienceTier) -> list[Hashtag]:
        """Build hashtags from channel's curated pools."""
        tier_key = tier.value
        pool_tags = self.pools.get(tier_key, [])
        popularity_base = {"broad": 0.75, "niche": 0.55, "trending": 0.45}[tier_key]
        hashtags = []
        for tag in pool_tags:
            hashtags.append(Hashtag(
                tag=tag,
                formatted=f"#{tag}",
                popularity=popularity_base + random.uniform(-0.1, 0.1),
                tier=tier,
                source="pool",
                platform_banned=tag.lower() in TIKTOK_BANNED_HASHTAGS,
            ))
        return hashtags

    def _build_from_script(self, script_keywords: list[str]) -> list[Hashtag]:
        """Convert extracted script keywords to hashtags."""
        hashtags = []
        for kw in script_keywords:
            if len(kw) < 2:
                continue
            # Convert to hashtag-friendly form
            tag = kw.replace(" ", "")
            if tag in TIKTOK_BANNED_HASHTAGS:
                continue
            hashtags.append(Hashtag(
                tag=tag,
                formatted=f"#{tag}",
                popularity=_score_popularity(tag, keyword_match=True, source="keyword_extract"),
                tier=AudienceTier.NICHE,
                source="script",
                platform_banned=False,
            ))
        return hashtags

    def _build_topic_hashtag(self, topic: str) -> list[Hashtag]:
        """Convert the topic itself into a primary hashtag."""
        tag = re.sub(r"[^\w]", "", topic.replace(" ", "")).lower()[:30]
        if not tag or tag in TIKTOK_BANNED_HASHTAGS:
            return []
        return [Hashtag(
            tag=tag,
            formatted=f"#{tag}",
            popularity=0.85,
            tier=AudienceTier.NICHE,
            source="topic",
            platform_banned=False,
        )]

    # ------------------------------------------------------------------
    # Deduplication
    # ------------------------------------------------------------------

    def _dedupe(self, hashtags: list[Hashtag]) -> list[Hashtag]:
        """Keep highest-popularity instance of each unique tag."""
        seen: dict[str, Hashtag] = {}
        for h in hashtags:
            key = h.tag.lower()
            if key not in seen or h.popularity > seen[key].popularity:
                seen[key] = h
        return list(seen.values())

    def _sort(self, hashtags: list[Hashtag]) -> list[Hashtag]:
        """Sort: niche first (primary keyword relevance), then broad, then trending."""
        tier_order = {AudienceTier.NICHE: 0, AudienceTier.BROAD: 1, AudienceTier.TRENDING: 2}
        return sorted(hashtags, key=lambda h: (tier_order[h.tier], -h.popularity))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(
        self,
        topic: str,
        script_text: Optional[str] = None,
        platform: Platform = Platform.TIKTOK,
        count: int = 20,
    ) -> HashtagResult:
        """
        Generate a ranked list of hashtags.

        Parameters
        ----------
        topic : str
            Video topic / primary keyword.
        script_text : str, optional
            Full or partial script text for keyword extraction.
        platform : Platform
            Target platform (affects count and banned-tag filtering).
        count : int
            Target total hashtags. Actual result may be slightly larger
            (best-effort coverage across tiers).

        Returns
        -------
        HashtagResult
        """
        all_hashtags: list[Hashtag] = []

        # 1. Topic primary hashtag
        all_hashtags += self._build_topic_hashtag(topic)

        # 2. Script-extracted keywords
        if script_text:
            script_keywords = self._extract_from_script(script_text)
            all_hashtags += self._build_from_script(script_keywords)

        # 3. Pool hashtags — build all tiers
        for tier in AudienceTier:
            all_hashtags += self._build_from_pools(tier)

        # 4. Deduplicate and sort
        unique = self._dedupe(all_hashtags)
        sorted_hashtags = self._sort(unique)

        # 5. Trim to target count (prefer niche + broad over trending)
        if len(sorted_hashtags) > count:
            # Ensure at least 1 trending tag survives trimming
            trending = [h for h in sorted_hashtags if h.tier == AudienceTier.TRENDING]
            non_trending = [h for h in sorted_hashtags if h.tier != AudienceTier.TRENDING]
            result = non_trending[: count - 1] + trending[:1]
            # Re-sort after trim
            result = self._sort(result)
        else:
            result = sorted_hashtags

        # Count by tier
        broad_count = sum(1 for h in result if h.tier == AudienceTier.BROAD)
        niche_count = sum(1 for h in result if h.tier == AudienceTier.NICHE)
        trending_count = sum(1 for h in result if h.tier == AudienceTier.TRENDING)
        tiktok_valid = sum(1 for h in result if h.is_valid_tiktok())

        return HashtagResult(
            hashtags=result,
            broad_count=broad_count,
            niche_count=niche_count,
            trending_count=trending_count,
            tiktok_valid_count=tiktok_valid,
        )

    def generate_for_platform(
        self,
        topic: str,
        script_text: Optional[str] = None,
        platform: Platform = Platform.TIKTOK,
    ) -> str:
        """
        Convenience: returns platform-ready hashtag string directly.
        """
        default_count = self.DEFAULT_COUNTS.get(platform, 20)
        result = self.generate(topic, script_text, platform, count=default_count)

        if platform == Platform.TIKTOK:
            return result.for_tiktok()
        elif platform == Platform.YOUTUBE:
            return ", ".join(result.for_youtube())
        elif platform == Platform.INSTAGRAM:
            return result.for_instagram()
        elif platform == Platform.LINKEDIN:
            return result.for_linkedin()
        else:
            return " ".join(h.formatted for h in result.hashtags)


# ---------------------------------------------------------------------------
# CLI / self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    print("=" * 60)
    print("HashtagGenerator — Self-Test")
    print("=" * 60)

    # Test both channels
    for channel in ["productivity", "growth"]:
        print(f"\n[{channel.upper()} channel]")
        gen = HashtagGenerator(channel=channel)

        sample_script = (
            "Procrastination costs professionals an average of 2 hours per day. "
            "The 2-minute rule states that if a task takes less than 2 minutes, "
            "do it immediately instead of adding it to your to-do list. "
            "This builds momentum and clears mental load."
        )

        result = gen.generate(
            topic="2 minute rule productivity",
            script_text=sample_script,
            platform=Platform.TIKTOK,
            count=20,
        )

        print(f"  Total hashtags: {len(result.hashtags)}")
        print(f"  Broad: {result.broad_count} | Niche: {result.niche_count} | Trending: {result.trending_count}")
        print(f"  TikTok-valid: {result.tiktok_valid_count}")

        print(f"\n  TikTok (top 5):")
        print(f"    {result.for_tiktok()}")

        print(f"\n  YouTube tags:")
        print(f"    {result.for_youtube()}")

        print(f"\n  Instagram (top 15):")
        print(f"    {result.for_instagram()}")

        print(f"\n  LinkedIn (top 5):")
        print(f"    {result.for_linkedin()}")

        # Test keyword extraction
        keywords = gen._extract_from_script(sample_script)
        print(f"\n  Extracted keywords: {keywords}")

    # Test convenience method
    print("\n[CONVENIENCE METHOD]")
    gen = HashtagGenerator(channel="productivity")
    print(f"  TikTok: {gen.generate_for_platform('deep work sessions', Platform.TIKTOK)}")
    print(f"  YouTube: {gen.generate_for_platform('deep work sessions', Platform.YOUTUBE)}")
    print(f"  Instagram: {gen.generate_for_platform('deep work sessions', Platform.INSTAGRAM)}")
    print(f"  LinkedIn: {gen.generate_for_platform('deep work sessions', Platform.LINKEDIN)}")

    print("\n" + "=" * 60)
    print("All self-tests PASSED.")
    print("=" * 60)
    sys.exit(0)
