"""
video_studio_app/intro_outro.py
Intro / outro template manager for TKP Studio System.

Looks for pre-rendered intro and outro clips in the assets directory and
concatenates them with the main assembled video.

Directory layout (relative to video_studio_app/):
    assets/
        intro/
            default_intro.mp4       # default 3-second logo sting
            growth_intro.mp4        # optional growth-channel variant
        outro/
            default_outro.mp4       # 5-second subscribe CTA
            growth_outro.mp4       # optional growth-channel variant

If a file is missing, that segment is skipped silently so the pipeline
does not hard-fail on an incomplete asset library.

Usage:
    from intro_outro import IntroOutroManager

    io = IntroOutroManager(channel="productivity")
    final = io.wrap(main_video_path, output_path)
    # If intro and outro both exist: [intro] + [main] + [outro]
    # If only outro exists:          [main] + [outro]
    # If neither exists:             [main]
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional, List

from .ffmpeg_presets import build_scale_vf, run_ffmpeg


# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------

DEFAULT_INTRO_DURATION = 3.0    # seconds
DEFAULT_OUTRO_DURATION = 5.0    # seconds

DEFAULT_INTRO_DIR  = "assets/intro"
DEFAULT_OUTRO_DIR  = "assets/outro"

# Filename patterns per channel
CHANNEL_INTRO_FILES = {
    "productivity": "default_intro.mp4",
    "growth":       "growth_intro.mp4",
}
CHANNEL_OUTRO_FILES = {
    "productivity": "default_outro.mp4",
    "growth":       "growth_outro.mp4",
}

# Fallback filenames if channel-specific not found
FALLBACK_INTRO  = "default_intro.mp4"
FALLBACK_OUTRO  = "default_outro.mp4"


class IntroOutroManager:
    """
    Manage intro and outro clip insertion for the VideoAssemblyLine.

    Parameters
    ----------
    channel : str
        'productivity' | 'growth' — selects channel-specific intro/outro assets.
    intro_dir : str
        Directory containing intro clips (relative to cwd).
    outro_dir : str
        Directory containing outro clips (relative to cwd).
    """

    def __init__(
        self,
        channel: str = "productivity",
        *,
        intro_dir: str = DEFAULT_INTRO_DIR,
        outro_dir: str = DEFAULT_OUTRO_DIR,
    ) -> None:
        self.channel   = channel
        self.intro_dir = intro_dir
        self.outro_dir = outro_dir

        # Resolve base dir once
        self._base = Path(__file__).parent.resolve()

    # ------------------------------------------------------------------
    # Path resolution
    # ------------------------------------------------------------------

    def _resolve(self, rel_dir: str, filename: str) -> Optional[str]:
        """Return absolute path if file exists, else None."""
        path = self._base / rel_dir / filename
        return str(path) if path.is_file() else None

    def _intro_path(self) -> Optional[str]:
        primary = CHANNEL_INTRO_FILES.get(self.channel, FALLBACK_INTRO)
        # Try channel-specific first, then fallback
        return (
            self._resolve(self.intro_dir, primary)
            or self._resolve(self.intro_dir, FALLBACK_INTRO)
        )

    def _outro_path(self) -> Optional[str]:
        primary = CHANNEL_OUTRO_FILES.get(self.channel, FALLBACK_OUTRO)
        return (
            self._resolve(self.outro_dir, primary)
            or self._resolve(self.outro_dir, FALLBACK_OUTRO)
        )

    # ------------------------------------------------------------------
    # Probe duration
    # ------------------------------------------------------------------

    @staticmethod
    def get_duration(path: str) -> float:
        """Return video duration in seconds using ffprobe."""
        try:
            result = subprocess.run(
                [
                    "ffprobe", "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    path,
                ],
                capture_output=True,
                text=True,
                timeout=15,
            )
            return float(result.stdout.strip())
        except Exception:
            return 0.0

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    def has_intro(self) -> bool:
        """True if intro clip exists on disk."""
        return self._intro_path() is not None

    def has_outro(self) -> bool:
        """True if outro clip exists on disk."""
        return self._outro_path() is not None

    def intro_duration(self) -> float:
        """Duration of the intro clip in seconds (0 if none)."""
        path = self._intro_path()
        return self.get_duration(path) if path else 0.0

    def outro_duration(self) -> float:
        """Duration of the outro clip in seconds (0 if none)."""
        path = self._outro_path()
        return self.get_duration(path) if path else 0.0

    def wrap(
        self,
        main_video_path: str,
        output_path: str,
        *,
        aspect: str = "9:16",
        clip_main_start: float = 0.0,
        clip_main_end: Optional[float] = None,
    ) -> str:
        """
        Concatenate intro + main video + outro into a single output.

        Args:
            main_video_path:   Path to the assembled main video.
            output_path:       Destination MP4.
            aspect:            Target aspect ratio (passed to scale filter
                               for intro/outro if they differ).
            clip_main_start:   Start offset into main video (default 0).
            clip_main_end:     End offset into main video (None = full).

        Returns:
            ``output_path``
        """
        intro_path = self._intro_path()
        outro_path = self._outro_path()

        # Nothing to add — copy main and return
        if not intro_path and not outro_path:
            shutil.copy2(main_video_path, output_path)
            return output_path

        # Determine main duration
        if clip_main_end is None:
            clip_main_end = self.get_duration(main_video_path)
        main_duration = max(0.0, clip_main_end - clip_main_start)

        # Scale intro / outro to match main video's aspect ratio
        # (typically intro/outro are generated at a fixed resolution)
        scale_vf = build_scale_vf(aspect, letterbox=True)

        segments: List[str] = []
        import tempfile
        import math

        with tempfile.TemporaryDirectory(prefix="tkp_intro_outro_") as tmp:
            def _scale_copy(src: str, dst: str) -> str:
                """Re-encode a clip through the scale vf without re-encoding audio."""
                run_ffmpeg(
                    f"-i '{src}' -vf '{scale_vf}' "
                    f"-c:v libx264 -crf 18 -preset fast "
                    f"-c:a aac -b:a 192k -ar 48000 "
                    f"'{dst}'"
                )
                return dst

            # Build ordered segment list (paths in temp dir)
            if intro_path:
                intro_scaled = os.path.join(tmp, "intro_scaled.mp4")
                _scale_copy(intro_path, intro_scaled)
                segments.append(intro_scaled)

            # Extract main clip window
            main_scaled = os.path.join(tmp, "main_trim.mp4")
            dur = round(main_duration, 3)
            start = round(clip_main_start, 3)
            run_ffmpeg(
                f"-ss {start} -i '{main_video_path}' -t {dur} "
                f"-vf '{scale_vf}' "
                f"-c:v libx264 -crf 18 -preset fast "
                f"-c:a aac -b:a 192k -ar 48000 "
                f"'{main_scaled}'"
            )
            segments.append(main_scaled)

            if outro_path:
                outro_scaled = os.path.join(tmp, "outro_scaled.mp4")
                _scale_copy(outro_path, outro_scaled)
                segments.append(outro_scaled)

            # Concatenate
            if len(segments) == 1:
                shutil.copy2(segments[0], output_path)
            else:
                list_path = os.path.join(tmp, "concat_list.txt")
                Path(list_path).write_text("\n".join(f"file '{p}'" for p in segments))
                os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)
                run_ffmpeg(
                    f"-f concat -safe 0 -i '{list_path}' "
                    f"-c:v libx264 -crf 18 -preset fast "
                    f"-c:a aac -b:a 192k -ar 48000 "
                    f"'{output_path}'"
                )

        return output_path

    # ------------------------------------------------------------------
    # Summary string
    # ------------------------------------------------------------------

    def describe(self) -> str:
        """Return a human-readable summary of available intro/outro."""
        intro  = self._intro_path()
        outro  = self._outro_path()
        lines  = [f"IntroOutroManager(channel={self.channel!r})"]
        lines.append(
            f"  intro:  {os.path.basename(intro) if intro else '(not found)'}"
        )
        lines.append(
            f"  outro:  {os.path.basename(outro) if outro else '(not found)'}"
        )
        return "\n".join(lines)
