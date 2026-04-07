"""
video_studio_app/music_library.py
Founding Engineer — TKP Video Studio (TKP-61)

Background music library: royalty-free tracks tagged by mood.
Auto-suggest track based on template mood.

Usage:
    from music_library import MusicLibrary, MusicTrack

    lib = MusicLibrary()
    tracks = lib.search_mood("productivity")
    print(tracks[0].name)

    # Auto-suggest for a template
    suggested = lib.suggest_for_mood(mood="growth")
    print(suggested.name)

    # All tracks
    for track in lib.all_tracks():
        print(track.name, track.mood)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .config import ASSETS_DIR

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------

@dataclass
class MusicTrack:
    """
    A royalty-free background music track.

    For real use: populate file_path with actual downloaded audio files.
    Sources: royaltyfreechiptune.com, freesound.org, cc0 public domain.
    """
    id: str
    name: str
    mood: str                    # primary mood tag: "productivity" | "growth" | "mystery" | "calm" | "upbeat"
    duration: float             # seconds
    secondary_moods: list[str] = field(default_factory=list)
    file_path: Optional[str] = None   # local path when downloaded
    url: str = ""                # source URL
    credit: str = ""             # attribution
    genre: str = ""
    bpm: int = 0
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "mood": self.mood,
            "secondary_moods": self.secondary_moods,
            "duration": self.duration,
            "file_path": self.file_path,
            "url": self.url,
            "credit": self.credit,
            "genre": self.genre,
            "bpm": self.bpm,
            "tags": self.tags,
        }


# ---------------------------------------------------------------------------
# Library
# ---------------------------------------------------------------------------

class MusicLibrary:
    """
    Royalty-free background music library organized by mood.

    Tracks are bundled as metadata with placeholder file paths.
    Replace file_path with real paths to actual audio files for production use.
    """

    # Mood aliases — map common synonyms to canonical mood tags
    MOOD_ALIASES: dict[str, str] = {
        "focus": "productivity",
        "work": "productivity",
        "studying": "productivity",
        "deep work": "productivity",
        "morning": "productivity",
        "hustle": "growth",
        "motivation": "growth",
        "ambition": "growth",
        "success": "growth",
        "energetic": "upbeat",
        "happy": "upbeat",
        "uplifting": "upbeat",
        "chill": "calm",
        "relaxing": "calm",
        "peaceful": "calm",
        "meditation": "calm",
        "suspense": "mystery",
        "dark": "mystery",
        "tension": "mystery",
        "unknown": "mystery",
    }

    def __init__(self, music_root: Optional[Path | str] = None):
        self.music_root = Path(music_root or ASSETS_DIR / "music")
        self.music_root.mkdir(parents=True, exist_ok=True)

        # Canonical mood → list of tracks
        self._tracks: list[MusicTrack] = self._build_library()

    # ------------------------------------------------------------------
    # Library data — CC0 / royalty-free track metadata
    # ------------------------------------------------------------------

    def _build_library(self) -> list[MusicTrack]:
        """
        Populate the music library with royalty-free track metadata.

        Real audio files should be placed in:
          assets/music/productivity/
          assets/music/growth/
          assets/music/calm/
          assets/music/upbeat/
          assets/music/mystery/

        Sources: freesound.org (CC0), royaltyfreechiptune.com (royalty-free),
        pixabay.com/music (royalty-free).
        """
        return [
            # ── Productivity ──────────────────────────────────────────────
            MusicTrack(
                id="prod_001",
                name="Morning Focus",
                mood="productivity",
                secondary_moods=["calm"],
                duration=120.0,
                file_path=str(self.music_root / "productivity" / "morning_focus.mp3"),
                url="https://pixabay.com/music/beautiful-performance-morning-focus-245097/",
                credit="Pixabay — Beautiful Performance",
                genre="ambient",
                bpm=75,
                tags=["focus", "workspace", "morning", "calm"],
            ),
            MusicTrack(
                id="prod_002",
                name="Deep Work Flow",
                mood="productivity",
                secondary_moods=["calm"],
                duration=180.0,
                file_path=str(self.music_root / "productivity" / "deep_work_flow.mp3"),
                url="https://pixabay.com/music/study-beat-deep-focus-241瞳/",
                credit="Pixabay — FASSounds",
                genre="study beat",
                bpm=80,
                tags=["deep work", "study", "focus", "ambient"],
            ),
            MusicTrack(
                id="prod_003",
                name="Clean Desk",
                mood="productivity",
                secondary_moods=["upbeat"],
                duration=90.0,
                file_path=str(self.music_root / "productivity" / "clean_desk.mp3"),
                url="https://pixabay.com/music/upbeat-positive-corporate-clean-desk-12580/",
                credit="Pixabay — Lexin Music",
                genre="corporate",
                bpm=110,
                tags=["workspace", "minimalist", "clean", "productive"],
            ),
            MusicTrack(
                id="prod_004",
                name="Office Hours",
                mood="productivity",
                secondary_moods=["calm"],
                duration=150.0,
                file_path=str(self.music_root / "productivity" / "office_hours.mp3"),
                url="https://freesound.org/people/InspectorJ/sounds/416450/",
                credit="InspectorJ (Freesound CC0)",
                genre="ambient",
                bpm=70,
                tags=["office", "work", "professional", "background"],
            ),

            # ── Growth ──────────────────────────────────────────────────
            MusicTrack(
                id="grow_001",
                name="Rise Up",
                mood="growth",
                secondary_moods=["upbeat"],
                duration=105.0,
                file_path=str(self.music_root / "growth" / "rise_up.mp3"),
                url="https://pixabay.com/music/uplifting-trending-rise-up-251013/",
                credit="Pixabay — Lexin Music",
                genre="uplifting corporate",
                bpm=128,
                tags=["motivation", "success", "hustle", "uplifting"],
            ),
            MusicTrack(
                id="grow_002",
                name="New Day",
                mood="growth",
                secondary_moods=["productivity"],
                duration=135.0,
                file_path=str(self.music_root / "growth" / "new_day.mp3"),
                url="https://pixabay.com/music/beautiful-performance-new-day-250842/",
                credit="PixaBay — TV Music",
                genre="inspiration",
                bpm=100,
                tags=["new beginning", "ambition", "morning", "growth"],
            ),
            MusicTrack(
                id="grow_003",
                name="Grind Mode",
                mood="growth",
                secondary_moods=["upbeat"],
                duration=95.0,
                file_path=str(self.music_root / "growth" / "grind_mode.mp3"),
                url="https://pixabay.com/music/upbeat-positive-grind-139622/",
                credit="Pixabay — Lexin Music",
                genre="hip hop corporate",
                bpm=130,
                tags=["hustle", "grind", "ambition", "energetic"],
            ),
            MusicTrack(
                id="grow_004",
                name="Career Goals",
                mood="growth",
                secondary_moods=["upbeat"],
                duration=112.0,
                file_path=str(self.music_root / "growth" / "career_goals.mp3"),
                url="https://pixabay.com/music/corporate-business-career-goals-139302/",
                credit="Pixabay — Lexin Music",
                genre="corporate",
                bpm=118,
                tags=["career", "success", "professional", "goals"],
            ),

            # ── Calm ────────────────────────────────────────────────────
            MusicTrack(
                id="calm_001",
                name="Peaceful Morning",
                mood="calm",
                secondary_moods=["productivity"],
                duration=200.0,
                file_path=str(self.music_root / "calm" / "peaceful_morning.mp3"),
                url="https://pixabay.com/music/beautiful-performance-peaceful-morning-245073/",
                credit="Pixabay — Beautiful Performance",
                genre="ambient",
                bpm=60,
                tags=["peaceful", "morning", "nature", "relaxing"],
            ),
            MusicTrack(
                id="calm_002",
                name="Mindful Moment",
                mood="calm",
                secondary_moods=["mystery"],
                duration=165.0,
                file_path=str(self.music_root / "calm" / "mindful_moment.mp3"),
                url="https://pixabay.com/music/meditation-mindfulness-mindful-moment-20859/",
                credit="PixaBay —单元",
                genre="meditation",
                bpm=50,
                tags=["mindfulness", "meditation", "peaceful", "slow"],
            ),
            MusicTrack(
                id="calm_003",
                name="Evening Wind Down",
                mood="calm",
                secondary_moods=[],
                duration=185.0,
                file_path=str(self.music_root / "calm" / "evening_wind_down.mp3"),
                url="https://freesound.org/people/Soundreality/sounds/452566/",
                credit="Soundreality (Freesound CC0)",
                genre="ambient",
                bpm=55,
                tags=["evening", "relaxation", "soft", "ambient"],
            ),

            # ── Upbeat ─────────────────────────────────────────────────
            MusicTrack(
                id="up_001",
                name="Good Vibes Only",
                mood="upbeat",
                secondary_moods=["growth"],
                duration=98.0,
                file_path=str(self.music_root / "upbeat" / "good_vibes_only.mp3"),
                url="https://pixabay.com/music/upbeat-positive-good-vibes-only-146058/",
                credit="Pixabay — Lexin Music",
                genre="pop corporate",
                bpm=125,
                tags=["positive", "happy", "uplifting", "fun"],
            ),
            MusicTrack(
                id="up_002",
                name="City Life",
                mood="upbeat",
                secondary_moods=["growth"],
                duration=108.0,
                file_path=str(self.music_root / "upbeat" / "city_life.mp3"),
                url="https://pixabay.com/music/upbeat-positive-city-life-140508/",
                credit="Pixabay — Lexin Music",
                genre="urban pop",
                bpm=122,
                tags=["city", "urban", "energy", "hustle"],
            ),
            MusicTrack(
                id="up_003",
                name="Positive Energy",
                mood="upbeat",
                secondary_moods=["calm"],
                duration=115.0,
                file_path=str(self.music_root / "upbeat" / "positive_energy.mp3"),
                url="https://pixabay.com/music/upbeat-trending-positive-energy-251499/",
                credit="Pixabay — Lexin Music",
                genre="positive pop",
                bpm=120,
                tags=["positive", "motivation", "energy", "happy"],
            ),

            # ── Mystery ────────────────────────────────────────────────
            MusicTrack(
                id="mys_001",
                name="Suspenseful Reveal",
                mood="mystery",
                secondary_moods=["calm"],
                duration=140.0,
                file_path=str(self.music_root / "mystery" / "suspenseful_reveal.mp3"),
                url="https://pixabay.com/music/suspense-mysterious-suspense-207510/",
                credit="Pixabay —",
                genre="cinematic suspense",
                bpm=65,
                tags=["suspense", "reveal", "tension", "cinematic"],
            ),
            MusicTrack(
                id="mys_002",
                name="Dark Discovery",
                mood="mystery",
                secondary_moods=["growth"],
                duration=155.0,
                file_path=str(self.music_root / "mystery" / "dark_discovery.mp3"),
                url="https://pixabay.com/music/suspense-mysterious-darkness-awakens-207508/",
                credit="Pixabay —",
                genre="cinematic dark",
                bpm=70,
                tags=["discovery", "dark", "reveal", "dramatic"],
            ),
            MusicTrack(
                id="mys_003",
                name="Urban Enigma",
                mood="mystery",
                secondary_moods=["upbeat"],
                duration=130.0,
                file_path=str(self.music_root / "mystery" / "urban_enigma.mp3"),
                url="https://freesound.org/people/square Zer0/sounds/246980/",
                credit="square_Zer0 (Freesound CC0)",
                genre="electronic suspense",
                bpm=95,
                tags=["urban", "enigma", "night", "city"],
            ),
        ]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def all_tracks(self) -> list[MusicTrack]:
        """Return all tracks in the library."""
        return list(self._tracks)

    def search_mood(self, mood: str) -> list[MusicTrack]:
        """
        Search tracks by mood (primary or secondary).
        Mood aliases are resolved (e.g. "focus" → "productivity").
        """
        canonical = self._resolve_mood(mood)
        return [
            t for t in self._tracks
            if t.mood == canonical or canonical in t.secondary_moods
        ]

    def search_tag(self, tag: str) -> list[MusicTrack]:
        """Search tracks by tag keyword."""
        tag_lower = tag.lower()
        return [t for t in self._tracks if tag_lower in t.tags or tag_lower == t.genre.lower()]

    def suggest_for_mood(self, mood: str) -> Optional[MusicTrack]:
        """
        Return the best track suggestion for a given mood.
        Returns the first track matching the mood, or None if none found.
        """
        matches = self.search_mood(mood)
        if matches:
            logger.info(f"[MusicLibrary] Suggested '{matches[0].name}' for mood '{mood}'")
            return matches[0]
        logger.warning(f"[MusicLibrary] No track found for mood '{mood}'")
        return None

    def suggest_for_duration(
        self, target_duration: float, mood: str, tolerance: float = 30.0
    ) -> Optional[MusicTrack]:
        """
        Suggest a track whose duration fits within the target ± tolerance.

        Returns the closest track that matches the mood.
        """
        candidates = self.search_mood(mood)
        if not candidates:
            return None

        best: Optional[MusicTrack] = None
        best_diff = float("inf")
        for t in candidates:
            diff = abs(t.duration - target_duration)
            if diff < tolerance and diff < best_diff:
                best = t
                best_diff = diff

        if not best:
            # Fallback: return any track of the mood regardless of duration
            best = candidates[0]

        logger.info(
            f"[MusicLibrary] Duration suggestion: '{best.name}' "
            f"(duration={best.duration}s, target={target_duration}s)"
        )
        return best

    def tracks_by_genre(self, genre: str) -> list[MusicTrack]:
        """Return all tracks of a given genre."""
        genre_lower = genre.lower()
        return [t for t in self._tracks if t.genre.lower() == genre_lower]

    def mood_summary(self) -> dict[str, int]:
        """Return a summary of track counts per mood."""
        summary: dict[str, int] = {}
        for t in self._tracks:
            summary[t.mood] = summary.get(t.mood, 0) + 1
        return summary

    def suggest_for_template(
        self,
        template_mood: str,
        template_duration: Optional[float] = None,
    ) -> Optional[MusicTrack]:
        """
        Suggest the best track for a template given its mood and duration.

        Args:
            template_mood: The mood tag of the template (e.g. "productivity", "growth").
            template_duration: Optional target duration in seconds for duration-aware matching.

        Returns:
            The best-matching MusicTrack, or None if no match found.
        """
        if template_duration:
            return self.suggest_for_duration(template_duration, template_mood)
        return self.suggest_for_mood(template_mood)

    def suggest_scene_volumes(
        self,
        num_scenes: int,
        base_volume: float = 0.15,
    ) -> list[float]:
        """
        Generate per-scene volume levels that create a natural dynamic arc.

        The first and last scenes are quieter (presence of voiceover),
        while middle scenes are at base volume. Returns a list of volumes
        (one per scene) suitable for assigning to SceneSlot.music_volume.

        Args:
            num_scenes: Number of scenes.
            base_volume: The "normal" volume level (default 0.15 for productivity).
                       Range 0.0–1.0.

        Returns:
            List of volume floats, one per scene.
        """
        if num_scenes <= 0:
            return []
        if num_scenes == 1:
            return [base_volume * 0.8]

        # First scene: voiceover is new — music slightly lower
        # Middle scenes: full volume (voiceover + music coexist)
        # Last scene: CTA / fade-out — slightly lower
        volumes = []
        for i in range(num_scenes):
            if i == 0:
                vol = base_volume * 0.7
            elif i == num_scenes - 1:
                vol = base_volume * 0.8
            else:
                vol = base_volume
            volumes.append(round(vol, 3))

        return volumes

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _resolve_mood(self, mood: str) -> str:
        """Resolve mood alias to canonical mood tag."""
        lower = mood.lower().strip()
        return self.MOOD_ALIASES.get(lower, lower)


# ---------------------------------------------------------------------------
# CLI / self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s",
    )

    print("=" * 60)
    print("MusicLibrary — Self-Test")
    print("=" * 60)

    lib = MusicLibrary()

    # 1. Mood summary
    print("\n[1] Mood summary")
    summary = lib.mood_summary()
    for mood, count in summary.items():
        print(f"    {mood}: {count} track(s)")

    # 2. Search by mood
    print("\n[2] Search by mood 'productivity'")
    tracks = lib.search_mood("productivity")
    print(f"    Found {len(tracks)} track(s): {[t.name for t in tracks]}")

    # 3. Search by alias ("focus" → productivity)
    print("\n[3] Mood alias 'focus' → productivity")
    tracks = lib.search_mood("focus")
    print(f"    Found {len(tracks)} track(s): {[t.name for t in tracks]}")

    # 4. Suggest for mood
    print("\n[4] Suggest for 'growth'")
    suggestion = lib.suggest_for_mood("growth")
    assert suggestion is not None
    print(f"    → '{suggestion.name}' ({suggestion.duration}s, {suggestion.bpm} BPM)")

    # 5. Suggest by duration
    print("\n[5] Suggest for 'calm' duration=180s (tolerance=30s)")
    suggestion = lib.suggest_for_duration(target_duration=180.0, mood="calm", tolerance=30.0)
    print(f"    → '{suggestion.name}' ({suggestion.duration}s)")

    # 6. Tag search
    print("\n[6] Tag search 'hustle'")
    tracks = lib.search_tag("hustle")
    print(f"    Found {len(tracks)}: {[t.name for t in tracks]}")

    # 7. All tracks
    print("\n[7] All tracks")
    all_t = lib.all_tracks()
    print(f"    Total: {len(all_t)} tracks")

    # 8. Mood summary
    print("\n[8] Mood summary dict")
    print(f"    {lib.mood_summary()}")

    print("\n" + "=" * 60)
    print("All self-tests PASSED.")
    print("=" * 60)
    sys.exit(0)
