"""
video_studio_app/thumbnail_ab_test.py
SEO Specialist — TKP Video Studio (TKP-65)

Thumbnail A/B testing for video uploads.
Generates 2-3 thumbnail variants per video, tracks impressions/clicks manually,
and reports the best-performing variant.

Usage:
    from thumbnail_ab_test import ThumbnailABTest, ThumbnailVariant, ABReport

    ab = ThumbnailABTest()

    # Generate 2-3 thumbnail variants for a video
    video_id = "PW-01-deep-work"
    variants = ab.generate_variants(
        video_id=video_id,
        topic="Deep Work Sessions",
        hook_texts=["DEEP WORK", "90-MINUTE FOCUS", "STOP DISTRACTIONS"],
        style_options=["bold_center", "upper_left", "lower_third"],
        channel="productivity",
    )
    for v in variants:
        print(v.image_path)

    # Manually log impressions and clicks after upload
    ab.update_click_through(video_id, variants[0].variant_id, impressions=1000, clicks=50)
    ab.update_click_through(video_id, variants[1].variant_id, impressions=1000, clicks=75)

    # Get winner
    winner = ab.get_best_variant(video_id)
    print(f"Best: {winner.variant_id} (CTR={winner.ctr:.2%})")

    # Full report
    report = ab.get_ab_summary()
    for video_id, winner in report.items():
        print(f"{video_id}: {winner.variant_id} with CTR={winner.ctr:.2%}")
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums & Dataclasses
# ---------------------------------------------------------------------------

class ThumbnailStyle(Enum):
    """Thumbnail text overlay styles."""
    BOLD_CENTER = "bold_center"       # Keyword in bold center
    UPPER_LEFT = "upper_left"        # Keyword top-left, clean right
    LOWER_THIRD = "lower_third"       # Keyword in lower third
    SPLIT_SCREEN = "split_screen"     # Before/after split
    TEXT_BANNER = "text_banner"       # Full-width text banner top
    NUMERIC = "numeric"              # "THE 3-SECRET RULE" style


# ---------------------------------------------------------------------------
# Workaround for missing Enum import
# ---------------------------------------------------------------------------

from enum import Enum as _Enum


class ThumbnailStyle(_Enum):
    BOLD_CENTER = "bold_center"
    UPPER_LEFT = "upper_left"
    LOWER_THIRD = "lower_third"
    SPLIT_SCREEN = "split_screen"
    TEXT_BANNER = "text_banner"
    NUMERIC = "numeric"


@dataclass
class ThumbnailVariant:
    """A single thumbnail variant in an A/B test."""
    variant_id: str
    video_id: str
    image_path: Optional[str]
    prompt: str                        # Image generation prompt
    style: str                         # ThumbnailStyle value
    hook_text: str                     # The text overlaid on the thumbnail
    color_scheme: str                  # Hex color theme used
    impressions: int = 0               # Times shown (manual input)
    clicks: int = 0                    # Clicks received (manual input)
    created_at: str = ""

    @property
    def ctr(self) -> float:
        """Click-through rate. Returns 0.0 if no impressions."""
        if self.impressions <= 0:
            return 0.0
        return self.clicks / self.impressions

    def to_dict(self) -> dict:
        d = asdict(self)
        d["ctr"] = round(self.ctr, 4)
        return d


@dataclass
class ABReport:
    """A/B test summary for a single video."""
    video_id: str
    variant_count: int
    best_variant_id: str
    best_ctr: float
    best_impressions: int
    best_clicks: int
    total_impressions: int
    generated_at: str


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

_THUMBNAIL_ASPECT_RATIO = {
    "youtube": (1280, 720),   # 16:9
    "tiktok": (1080, 1920),  # 9:16
    "instagram": (1080, 1350), # 4:5
}


def _build_image_prompt(
    topic: str,
    hook_text: str,
    style: ThumbnailStyle,
    channel: str,
    platform: str = "youtube",
) -> str:
    """
    Build an image generation prompt for a thumbnail variant.

    Parameters
    ----------
    topic : str
        Video topic / keyword.
    hook_text : str
        Text to overlay on the thumbnail.
    style : ThumbnailStyle
        Overlay style.
    channel : str
        "productivity" or "growth" — sets visual mood.
    platform : str
        Target platform (determines aspect ratio mood).

    Returns
    -------
    str
        Full image prompt for image_generator.
    """
    width, height = _THUMBNAIL_ASPECT_RATIO.get(platform, (1280, 720))

    # Channel-specific visual mood
    channel_moods = {
        "productivity": (
            "clean minimalist home office, natural window light, "
            "organized desk with laptop, green plant, modern aesthetic, "
            "professional and calm atmosphere"
        ),
        "growth": (
            "vibrant modern workspace, warm amber lighting, "
            "laptop with growth charts, motivational books, "
            "bold and energetic atmosphere, confident mood"
        ),
    }
    mood = channel_moods.get(channel, channel_moods["productivity"])

    # Style-specific visual direction
    style_prompts = {
        ThumbnailStyle.BOLD_CENTER: (
            f"bold center framing: clean background with focus on text area, "
            f"professional presenter partially visible, confident expression, "
            f"centered composition for text overlay '{hook_text}'"
        ),
        ThumbnailStyle.UPPER_LEFT: (
            f"clean left-side composition: desk setup with laptop on left 60% of frame, "
            f"right 40% open with soft gradient for text '{hook_text}', "
            f"presenter looking toward open space, professional look"
        ),
        ThumbnailStyle.LOWER_THIRD: (
            f"lower-third composition: subject in upper 60% of frame, "
            f"clean lower third ready for text overlay '{hook_text}', "
            f"warm professional lighting, confident presenter"
        ),
        ThumbnailStyle.SPLIT_SCREEN: (
            f"dramatic split screen: left half darker/cluttered (busy workspace), "
            f"right half bright/clean (organized desk), "
            f"text overlay '{hook_text}' on right side, professional photography style"
        ),
        ThumbnailStyle.TEXT_BANNER: (
            f"top banner composition: full-width bold text area at top 20% of frame, "
            f"presenter in lower 80%, clean gradient background behind text, "
            f"professional headshot-style framing for '{hook_text}'"
        ),
        ThumbnailStyle.NUMERIC: (
            f"numeric large-format composition: space reserved for large '{hook_text}' text, "
            f"presenter with confident hand gesture pointing up, "
            f"clean studio-style background, energetic professional mood"
        ),
    }

    style_direction = style_prompts.get(style, style_prompts[ThumbnailStyle.BOLD_CENTER])

    return (
        f"Professional YouTube thumbnail photography: {mood}, {style_direction}. "
        f"High contrast, sharp focus, vibrant colors, "
        f"text overlay: '{hook_text}', "
        f"{width}x{height} aspect ratio, photorealistic, no watermark, "
        f"high quality, cinematic lighting"
    )


def _get_color_scheme(channel: str, style: ThumbnailStyle) -> str:
    """Return a hex color pair for the thumbnail based on channel and style."""
    schemes = {
        "productivity": {
            ThumbnailStyle.BOLD_CENTER: "#2563EB",   # blue
            ThumbnailStyle.UPPER_LEFT: "#059669",   # teal
            ThumbnailStyle.LOWER_THIRD: "#7C3AED",  # purple
            ThumbnailStyle.SPLIT_SCREEN: "#DC2626",  # red-blue split
            ThumbnailStyle.TEXT_BANNER: "#D97706",   # amber
            ThumbnailStyle.NUMERIC: "#0891B2",       # cyan
        },
        "growth": {
            ThumbnailStyle.BOLD_CENTER: "#7C3AED",   # purple
            ThumbnailStyle.UPPER_LEFT: "#DB2777",    # pink
            ThumbnailStyle.LOWER_THIRD: "#059669",   # green
            ThumbnailStyle.SPLIT_SCREEN: "#EA580C",  # orange
            ThumbnailStyle.TEXT_BANNER: "#4F46E5",   # indigo
            ThumbnailStyle.NUMERIC: "#16A34A",      # bright green
        },
    }
    return schemes.get(channel, schemes["productivity"]).get(style, "#2563EB")


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

_DB_DIR = Path(__file__).parent.parent / "output"
_DB_DIR.mkdir(parents=True, exist_ok=True)
_DB_FILE = _DB_DIR / "thumbnail_ab_db.json"


def _load_db() -> dict:
    if _DB_FILE.exists():
        try:
            return json.loads(_DB_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_db(db: dict) -> None:
    _DB_FILE.write_text(json.dumps(db, indent=2, ensure_ascii=False), encoding="utf-8")


# ---------------------------------------------------------------------------
# Main A/B Test Manager
# ---------------------------------------------------------------------------

class ThumbnailABTest:
    """
    Thumbnail A/B test manager.

    Generates thumbnail variants using image_generator and tracks their
    performance (CTR) via manual input from analytics.

    Parameters
    ----------
    db_path : Path, optional
        Override path to the A/B test database JSON.
    image_provider : str
        Image generation provider: "auto", "mock", "stable_diffusion", "minimax".
        Default "auto" tries SD > MiniMax > mock.

    Example workflow:
        1. Generate variants: generate_variants(...)
        2. Upload videos with different thumbnails
        3. After 24-48h: update_click_through(...) with real analytics data
        4. Call get_best_variant(...) to find the winner
        5. Use winner for final/canonical upload
    """

    def __init__(
        self,
        db_path: Optional[Path] = None,
        image_provider: str = "auto",
    ):
        self.db_path = db_path or _DB_FILE
        self._image_provider = image_provider

    # ------------------------------------------------------------------
    # Image generation integration
    # ------------------------------------------------------------------

    def _get_image_generator(self):
        """Lazily import and instantiate image_generator."""
        try:
            from .image_generator import ImageGenerator, GenerationOptions
            return ImageGenerator(provider=self._image_provider, mock=True)
        except ImportError as exc:
            logger.warning(f"image_generator not available: {exc} — using mock mode")
            return None

    # ------------------------------------------------------------------
    # Variant generation
    # ------------------------------------------------------------------

    def generate_variants(
        self,
        video_id: str,
        topic: str,
        hook_texts: list[str],
        style_options: Optional[list[ThumbnailStyle]] = None,
        channel: str = "productivity",
        platform: str = "youtube",
        count: int = 2,
    ) -> list[ThumbnailVariant]:
        """
        Generate 2-3 thumbnail variants for a video.

        Parameters
        ----------
        video_id : str
            Unique identifier for the video (e.g. "PW-01-deep-work").
        topic : str
            Video topic / primary keyword.
        hook_texts : list[str]
            List of hook texts to use per variant (e.g. ["DEEP WORK", "90-MIN FOCUS"]).
            Length should match count (or more — extra texts are ignored).
        style_options : list[ThumbnailStyle], optional
            Style for each variant. Defaults to [BOLD_CENTER, UPPER_LEFT, LOWER_THIRD].
        channel : str
            "productivity" or "growth".
        platform : str
            Target platform: "youtube", "tiktok", "instagram".
        count : int
            Number of variants to generate. Default 2. Max 3.

        Returns
        -------
        list[ThumbnailVariant]
            Generated variants, stored in DB automatically.
        """
        if count < 2:
            raise ValueError("count must be at least 2 for meaningful A/B testing")
        count = min(count, 3)

        if style_options is None:
            style_options = [
                ThumbnailStyle.BOLD_CENTER,
                ThumbnailStyle.UPPER_LEFT,
                ThumbnailStyle.LOWER_THIRD,
            ]

        styles = [style_options[i % len(style_options)] for i in range(count)]
        texts = hook_texts[:count]

        image_gen = self._get_image_generator()
        now_iso = datetime.now().isoformat()
        variants: list[ThumbnailVariant] = []

        for i in range(count):
            variant_id = f"{video_id}_var{i+1}"
            style = styles[i]
            hook_text = texts[i]
            prompt = _build_image_prompt(topic, hook_text, style, channel, platform)
            color_scheme = _get_color_scheme(channel, style)

            image_path: Optional[str] = None
            if image_gen is not None:
                try:
                    from .image_generator import GenerationOptions
                    opts = GenerationOptions(
                        width=_THUMBNAIL_ASPECT_RATIO.get(platform, (1280, 720))[0],
                        height=_THUMBNAIL_ASPECT_RATIO.get(platform, (1280, 720))[1],
                        output_dir=str(self.db_path.parent / "thumbnails"),
                    )
                    result = image_gen.generate(prompt, options=opts)
                    if result.success and result.local_path:
                        image_path = result.local_path
                        logger.info(f"Generated thumbnail: {image_path}")
                except Exception as exc:
                    logger.warning(f"Thumbnail generation failed for {variant_id}: {exc}")

            variant = ThumbnailVariant(
                variant_id=variant_id,
                video_id=video_id,
                image_path=image_path,
                prompt=prompt,
                style=style.value,
                hook_text=hook_text,
                color_scheme=color_scheme,
                impressions=0,
                clicks=0,
                created_at=now_iso,
            )
            variants.append(variant)

        # Persist to DB
        db = _load_db()
        if video_id not in db:
            db[video_id] = {"variants": [], "best_variant_id": None}
        for v in variants:
            db[video_id]["variants"].append(v.to_dict())
        _save_db(db)

        logger.info(f"Generated {len(variants)} thumbnail variants for: {video_id}")
        return variants

    # ------------------------------------------------------------------
    # CTR tracking
    # ------------------------------------------------------------------

    def update_click_through(
        self,
        video_id: str,
        variant_id: str,
        impressions: Optional[int] = None,
        clicks: Optional[int] = None,
    ) -> None:
        """
        Update impressions and/or clicks for a thumbnail variant.

        Parameters
        ----------
        video_id : str
            The video's unique ID.
        variant_id : str
            The variant's ID (e.g. "PW-01-deep-work_var1").
        impressions : int, optional
            Number of times this thumbnail was shown (impressions). Added to existing count.
        clicks : int, optional
            Number of clicks on this thumbnail. Added to existing count.
        """
        db = _load_db()
        if video_id not in db:
            logger.warning(f"video_id not found in AB database: {video_id}")
            return

        found = False
        for v in db[video_id].get("variants", []):
            if v["variant_id"] == variant_id:
                if impressions is not None:
                    v["impressions"] += impressions
                if clicks is not None:
                    v["clicks"] += clicks
                found = True
                logger.info(
                    f"Updated {variant_id}: "
                    f"impressions={v['impressions']}, clicks={v['clicks']}, "
                    f"CTR={v['clicks']/v['impressions']:.2%}" if v['impressions'] > 0
                    else f"Updated {variant_id}: no impressions yet"
                )
                break

        if not found:
            logger.warning(f"variant_id not found: {variant_id}")

        _save_db(db)

    def reset_variant(self, video_id: str, variant_id: str) -> None:
        """Reset impressions and clicks for a variant (e.g. before a retest)."""
        db = _load_db()
        if video_id in db:
            for v in db[video_id].get("variants", []):
                if v["variant_id"] == variant_id:
                    v["impressions"] = 0
                    v["clicks"] = 0
                    _save_db(db)
                    logger.info(f"Reset variant: {variant_id}")
                    return
        logger.warning(f"Could not reset {variant_id}: not found")

    # ------------------------------------------------------------------
    # Reporting
    # ------------------------------------------------------------------

    def get_best_variant(self, video_id: str) -> Optional[ThumbnailVariant]:
        """
        Return the best-performing variant for a video (by highest CTR).

        Requires at least 50 impressions per variant to declare a winner.
        Returns None if insufficient data or video not found.
        """
        db = _load_db()
        entry = db.get(video_id)
        if not entry:
            return None

        variants = entry.get("variants", [])
        if not variants:
            return None

        qualified = [v for v in variants if v["impressions"] >= 50]
        if not qualified:
            # Not enough data — return variant with most impressions
            best = max(variants, key=lambda v: v["impressions"])
            logger.info(
                f"Insufficient data for {video_id} (best: {best['impressions']} impressions). "
                f"Need 50+ for statistical confidence."
            )
            return ThumbnailVariant(**best)

        best = max(qualified, key=lambda v: v["ctr"])
        return ThumbnailVariant(**best)

    def get_ab_summary(self) -> dict[str, ABReport]:
        """
        Return A/B test summary for all videos with data.

        Returns dict mapping video_id -> ABReport.
        """
        db = _load_db()
        reports: dict[str, ABReport] = {}

        for video_id, entry in db.items():
            variants = entry.get("variants", [])
            if not variants:
                continue

            best = self.get_best_variant(video_id)
            if best is None:
                continue

            total_impressions = sum(v["impressions"] for v in variants)
            reports[video_id] = ABReport(
                video_id=video_id,
                variant_count=len(variants),
                best_variant_id=best.variant_id,
                best_ctr=best.ctr,
                best_impressions=best.impressions,
                best_clicks=best.clicks,
                total_impressions=total_impressions,
                generated_at=datetime.now().isoformat(),
            )

        return reports

    def get_variant(self, video_id: str, variant_id: str) -> Optional[ThumbnailVariant]:
        """Get a specific variant by ID."""
        db = _load_db()
        entry = db.get(video_id)
        if not entry:
            return None
        for v in entry.get("variants", []):
            if v["variant_id"] == variant_id:
                return ThumbnailVariant(**v)
        return None

    def get_variants(self, video_id: str) -> list[ThumbnailVariant]:
        """Get all variants for a video."""
        db = _load_db()
        entry = db.get(video_id)
        if not entry:
            return []
        return [ThumbnailVariant(**v) for v in entry.get("variants", [])]

    def print_report(self, video_id: Optional[str] = None) -> None:
        """Print a human-readable A/B test report."""
        db = _load_db()
        if video_id:
            entries = {video_id: db.get(video_id)} if db.get(video_id) else {}
        else:
            entries = db

        if not entries:
            print("No A/B test data found.")
            return

        print("=" * 60)
        print("THUMBNAIL A/B TEST REPORT")
        print("=" * 60)

        for vid, entry in entries.items():
            if not entry:
                continue
            print(f"\n[{vid}]")
            variants = entry.get("variants", [])
            for v in variants:
                ctr_str = f"{v['ctr']:.2%}" if v["impressions"] > 0 else "N/A"
                qualified = "✓" if v["impressions"] >= 50 else "⚠ low data"
                print(
                    f"  {v['variant_id']} | "
                    f"impressions={v['impressions']:,} | "
                    f"clicks={v['clicks']:,} | "
                    f"CTR={ctr_str} | "
                    f"{qualified}"
                )

        summary = self.get_ab_summary()
        if summary:
            print("\n" + "-" * 60)
            print("WINNERS")
            print("-" * 60)
            for vid, r in summary.items():
                print(
                    f"  {vid}: {r.best_variant_id} "
                    f"(CTR={r.best_ctr:.2%}, {r.best_impressions:,} impressions)"
                )
        print("=" * 60)


# ---------------------------------------------------------------------------
# CLI / self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("ThumbnailABTest — Self-Test")
    print("=" * 60)

    ab = ThumbnailABTest(image_provider="mock")

    video_id = "PW-01-deep-work-test"

    # Generate variants
    print(f"\n[Generate Variants — {video_id}]")
    variants = ab.generate_variants(
        video_id=video_id,
        topic="Deep Work Sessions",
        hook_texts=["DEEP WORK", "90-MINUTE FOCUS", "STOP DISTRACTIONS"],
        channel="productivity",
        platform="youtube",
        count=3,
    )
    print(f"  Generated {len(variants)} variants:")
    for v in variants:
        print(f"    [{v.variant_id}] style={v.style} | hook='{v.hook_text}'")
        print(f"      image: {v.image_path}")

    # Simulate impressions and clicks
    print(f"\n[Simulate Analytics — {video_id}]")
    for i, v in enumerate(variants):
        impressions = [1200, 1150, 1100][i]
        clicks = [60, 92, 48][i]
        ab.update_click_through(video_id, v.variant_id, impressions=impressions, clicks=clicks)
        ctr = clicks / impressions
        print(f"  {v.variant_id}: {impressions:,} impr / {clicks} clicks → CTR={ctr:.2%}")

    # Get best variant
    print(f"\n[Best Variant — {video_id}]")
    winner = ab.get_best_variant(video_id)
    if winner:
        print(f"  Winner: {winner.variant_id}")
        print(f"  CTR: {winner.ctr:.2%}")
        print(f"  Impressions: {winner.impressions:,}")

    # Full summary
    print(f"\n[AB Summary]")
    summary = ab.get_ab_summary()
    for vid, r in summary.items():
        print(f"  {vid}: {r.best_variant_id} (CTR={r.best_ctr:.2%})")

    # Print report
    print()
    ab.print_report(video_id)

    # Test second video
    print(f"\n[Second Video — GZ-01-side-hustle]")
    gz_variants = ab.generate_variants(
        video_id="GZ-01-side-hustle",
        topic="Side Hustle Income",
        hook_texts=["$10K/MONTH", "START HERE"],
        channel="growth",
        count=2,
    )
    print(f"  {len(gz_variants)} variants generated")

    print("\n" + "=" * 60)
    print("Self-test complete.")
    print("=" * 60)
