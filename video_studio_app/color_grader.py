"""
video_studio_app/color_grader.py
FFmpeg-based color grading pipeline for TKP Studio System.

Provides professional color grading using FFmpeg video filters:
  - eq         — brightness, contrast, saturation, gamma
  - colorchannelmixer — channel-specific color shifts (teal-orange)
  - curves     — lift/gamma/gain master + per-channel curves

Presets:
  cinematic  — Teal shadows, warm orange highlights. DaVinci Resolve "teal-orange" look.
  natural    — Subtle warmth, slight contrast lift, neutral skin tones.
  vibrant    — Punchy saturation, high contrast, vivid colors.

Usage:
    from video_studio_app.color_grader import ColorGrader, COLOR_PRESETS

    grader = ColorGrader()
    grader.apply_preset("input.mp4", "output.mp4", preset="cinematic")
    # or with custom overrides:
    grader.apply(input, output, brightness=0.05, saturation=1.2, gamma=1.05)

FFmpeg filters used: eq, colorchannelmixer, curves, vibrance, hue
Requirements: FFmpeg with libx264, no external LUT files needed.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, List

from video_studio_app.video_assembler import run_ffmpeg, ffmpeg_available


# ---------------------------------------------------------------------------
# Preset definitions
# ---------------------------------------------------------------------------

class ColorPreset:
    """Parameters for one named color grading preset."""

    def __init__(
        self,
        name: str,
        label: str,
        description: str,
        # eq filter params
        brightness: float = 0.0,
        contrast: float = 1.0,
        saturation: float = 1.0,
        gamma: float = 1.0,
        # colorchannelmixer: RGB channel mixing coefficients
        # rr/gg/bb = how much red/green/blue contributes to each output channel
        # Default identity: rr=1,gg=0,bb=0 → output red = input red
        rr: float = 1.0, rg: float = 0.0, rb: float = 0.0,
        gr: float = 0.0, gg: float = 1.0, gb: float = 0.0,
        br: float = 0.0, bg: float = 0.0, bb: float = 1.0,
        # vibrance (advanced saturation, protects skin)
        vibrance: str = "",
        # curves master preset
        curves_master: str = "",
        # extra FFmpeg filter string appended
        extra: str = "",
    ):
        self.name = name
        self.label = label
        self.description = description
        self.brightness = brightness
        self.contrast = contrast
        self.saturation = saturation
        self.gamma = gamma
        self.rr = rr; self.rg = rg; self.rb = rb
        self.gr = gr; self.gg = gg; self.gb = gb
        self.br = br; self.bg = bg; self.bb = bb
        self.vibrance = vibrance
        self.curves_master = curves_master
        self.extra = extra

    def eq_str(self) -> str:
        parts = []
        if self.brightness != 0.0:
            parts.append(f"brightness={self.brightness}")
        if self.contrast != 1.0:
            parts.append(f"contrast={self.contrast}")
        if self.saturation != 1.0:
            parts.append(f"saturation={self.saturation}")
        if self.gamma != 1.0:
            parts.append(f"gamma={self.gamma}")
        return ":".join(parts) if parts else ""

    def mixer_str(self) -> str:
        return (
            f"rr={self.rr}:rg={self.rg}:rb={self.rb}"
            f":gr={self.gr}:gg={self.gg}:gb={self.gb}"
            f":br={self.br}:bg={self.bg}:bb={self.bb}"
        )

    def to_ffmpeg_vf(self) -> str:
        """Build a single FFmpeg -vf argument string for this preset."""
        filters = []

        eq = self.eq_str()
        if eq:
            filters.append(f"eq={eq}")

        mixer = self.mixer_str()
        if mixer != "rr=1:rg=0:rb=0:gr=0:gg=1:gb=0:br=0:bg=0:bb=1":
            filters.append(f"colorchannelmixer={mixer}")

        if self.vibrance:
            filters.append(f"vibrance={self.vibrance}")

        if self.curves_master:
            filters.append(f"curves={self.curves_master}")

        if self.extra:
            filters.append(self.extra)

        return ",".join(filters)


# Pre-defined presets ---------------------------------------------------------

PRESETS: dict[str, ColorPreset] = {}


def _define_presets() -> dict[str, ColorPreset]:
    global PRESETS

    # ── Cinematic ────────────────────────────────────────────────────────────
    # Teal shadows: reduce blue channel in darks, push cyan
    # Warm highlights: orange push in midtones/highlights
    # Subtle contrast lift, slightly desaturated for film look
    PRESETS["cinematic"] = ColorPreset(
        name="cinematic",
        label="Cinematic (Teal-Orange)",
        description="Teal shadows, warm orange highlights. Professional film look with high contrast.",
        brightness=0.02,
        contrast=1.15,
        saturation=0.90,
        gamma=1.02,
        # Push shadows toward teal: reduce red, boost green+blue in dark areas
        # Using colorchannelmixer for RGB channel remapping
        rr=1.0, rg=0.04, rb=0.06,    # red channel: slightly warm
        gr=0.0, gg=1.0, gb=0.04,    # green channel: tiny warm push
        br=-0.04, bg=0.08, bb=1.0,  # blue channel: push toward cyan in shadows
        vibrance=0.15,               # mild vibrance (protects skin, adds depth)
        extra="curves=r='0/0.05:0.5/0.48:1/0.95':g='0/0.02:0.5/0.50:1/0.96':b='0/0.08:0.5/0.52:1/0.90'",
    )

    # ── Moody ────────────────────────────────────────────────────────────────
    # Dark, desaturated, crushed blacks
    PRESETS["moody"] = ColorPreset(
        name="moody",
        label="Moody (Dark & Desaturated)",
        description="Dark tones, crushed blacks, desaturated colors. Cinematic drama.",
        brightness=-0.05,
        contrast=1.25,
        saturation=0.70,
        gamma=0.95,
        rr=1.0, rg=0.0, rb=0.02,
        gr=0.0, gg=1.0, gb=0.0,
        br=0.0, bg=0.0, bb=1.0,
        vibrance=0.0,
    )

    # ── Natural ─────────────────────────────────────────────────────────────
    # Balanced, slight warmth, slight contrast
    PRESETS["natural"] = ColorPreset(
        name="natural",
        label="Natural (Balanced)",
        description="Balanced color, slight warmth, natural contrast. Clean professional look.",
        brightness=0.01,
        contrast=1.05,
        saturation=1.05,
        gamma=1.0,
        # Slight warmth: boost red/green, reduce blue slightly
        rr=1.0, rg=0.02, rb=-0.02,
        gr=0.0, gg=1.0, gb=0.0,
        br=0.0, bg=0.0, bb=1.0,
        vibrance="strength=0.2",
    )

    # ── Vibrant ─────────────────────────────────────────────────────────────
    # Punchy, saturated, high contrast
    PRESETS["vibrant"] = ColorPreset(
        name="vibrant",
        label="Vibrant (Punchy Colors)",
        description="High saturation, vivid colors, boosted contrast. Perfect for energy content.",
        brightness=0.03,
        contrast=1.20,
        saturation=1.35,
        gamma=1.05,
        rr=1.0, rg=0.0, rb=0.0,
        gr=0.0, gg=1.0, gb=0.0,
        br=-0.02, bg=0.0, bb=1.0,
        vibrance="strength=0.6",
    )

    # ── Warm ─────────────────────────────────────────────────────────────────
    # Warm golden-hour tone
    PRESETS["warm"] = ColorPreset(
        name="warm",
        label="Warm (Golden Hour)",
        description="Golden-hour warmth, gentle orange tint. Great for lifestyle and growth content.",
        brightness=0.02,
        contrast=1.08,
        saturation=1.15,
        gamma=1.02,
        # Warm: boost red, slightly boost green, reduce blue
        rr=1.05, rg=0.05, rb=-0.08,
        gr=0.0, gg=1.0, gb=-0.02,
        br=-0.06, bg=0.0, bb=0.92,
        vibrance="strength=0.3",
    )

    # ── Cool ─────────────────────────────────────────────────────────────────
    # Cool blue tone for productivity/tech content
    PRESETS["cool"] = ColorPreset(
        name="cool",
        label="Cool (Blue Professional)",
        description="Cool blue tones, clean professional look. Great for tech and productivity content.",
        brightness=0.01,
        contrast=1.10,
        saturation=0.95,
        gamma=1.01,
        # Cool: reduce red, boost blue
        rr=0.94, rg=0.0, rb=0.06,
        gr=0.0, gg=1.0, gb=0.02,
        br=0.0, bg=0.02, bb=1.05,
        vibrance="strength=0.1",
    )

    return PRESETS


PRESETS = _define_presets()


# ---------------------------------------------------------------------------
# ColorGrader — main class
# ---------------------------------------------------------------------------

class ColorGrader:
    """
    Apply professional color grading to video files using FFmpeg.

    Supports named presets (cinematic, natural, vibrant, ...) or
    fully custom parameters via apply().

    Usage::

        grader = ColorGrader()
        # Preset
        grader.apply_preset("input.mp4", "output.mp4", preset="cinematic")
        # Custom
        grader.apply("input.mp4", "output.mp4", brightness=0.05, saturation=1.3)
    """

    def __init__(self, *, temp_dir: Optional[str] = None):
        self.temp_dir = temp_dir or tempfile.mkdtemp(prefix="tkp_color_")

    def apply_preset(
        self,
        input_path: str,
        output_path: str,
        *,
        preset: str = "cinematic",
        crf: int = 18,
        fps: int = 30,
    ) -> str:
        """
        Apply a named color grading preset.

        Args:
            input_path:   Source MP4.
            output_path:  Destination MP4.
            preset:       One of: cinematic, natural, vibrant, moody, warm, cool.
            crf:          x264 CRF (lower = higher quality, 18 = visually lossless).
            fps:          Output frame rate.

        Returns:
            ``output_path``
        """
        if preset not in PRESETS:
            raise ValueError(
                f"Unknown preset {preset!r}. Available: {list(PRESETS.keys())}"
            )

        p = PRESETS[preset]
        return self.apply(
            input_path, output_path,
            preset=p,
            crf=crf, fps=fps,
        )

    def apply(
        self,
        input_path: str,
        output_path: str,
        *,
        preset: Optional[ColorPreset] = None,
        # Custom overrides (applied on top of preset or standalone)
        brightness: float = 0.0,
        contrast: float = 1.0,
        saturation: float = 1.0,
        gamma: float = 1.0,
        crf: int = 18,
        fps: int = 30,
    ) -> str:
        """
        Apply color grading with full control.

        Args:
            input_path:   Source MP4.
            output_path:  Destination MP4.
            preset:       ColorPreset object. If provided, its values are used as base.
            brightness:   -1.0 to 1.0 (0.0 = no change).
            contrast:     0.0 to 4.0 (1.0 = no change).
            saturation:   0.0 to 3.0 (1.0 = no change).
            gamma:        0.1 to 10.0 (1.0 = no change).
            crf:          x264 CRF.
            fps:          Output frame rate.

        Returns:
            ``output_path``
        """
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input video not found: {input_path}")

        os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)

        # Build filter chain
        filters: list[str] = []

        if preset:
            # Start from preset's FFmpeg vf string
            preset_vf = preset.to_ffmpeg_vf()
            if preset_vf:
                filters.append(preset_vf)

        # Apply custom overrides on top of preset
        if preset is None or (
            brightness == 0.0 and contrast == 1.0
            and saturation == 1.0 and gamma == 1.0
        ):
            # No preset — apply custom params directly
            eq_parts = []
            if brightness != 0.0:
                eq_parts.append(f"brightness={brightness}")
            if contrast != 1.0:
                eq_parts.append(f"contrast={contrast}")
            if saturation != 1.0:
                eq_parts.append(f"saturation={saturation}")
            if gamma != 1.0:
                eq_parts.append(f"gamma={gamma}")
            if eq_parts:
                filters.append(f"eq={':'.join(eq_parts)}")

        if not filters:
            # No grading requested — just copy with re-encode
            run_ffmpeg(
                f"-i '{input_path}' "
                f"-c:v libx264 -crf {crf} -r {fps} -c:a copy "
                f"'{output_path}'"
            )
            return output_path

        vf_str = ",".join(filters)

        run_ffmpeg(
            f"-i '{input_path}' "
            f"-vf \"{vf_str}\" "
            f"-c:v libx264 -crf {crf} -preset fast "
            f"-c:a copy -r {fps} -pix_fmt yuv420p "
            f"'{output_path}'"
        )

        return output_path

    def apply_with_intensity(
        self,
        input_path: str,
        output_path: str,
        *,
        preset: str = "cinematic",
        intensity: float = 1.0,
        crf: int = 18,
        fps: int = 30,
    ) -> str:
        """
        Apply a preset at a custom intensity (0.0 = original, 1.0 = full preset).

        Intensity works by blending the graded output with the original:
        Use overlay filter at 50/50 blend, then mix with original based on intensity.
        """
        if intensity <= 0.0:
            # Just copy
            import shutil
            shutil.copy2(input_path, output_path)
            return output_path

        if intensity >= 1.0:
            return self.apply_preset(input_path, output_path, preset=preset, crf=crf, fps=fps)

        # Partial intensity: apply at full strength then blend back
        os.makedirs(self.temp_dir, exist_ok=True)
        graded = os.path.join(self.temp_dir, "graded.mp4")
        self.apply_preset(input_path, graded, preset=preset, crf=crf, fps=fps)

        # Blend graded + original using amix at specified ratio
        # intensity=0.5 → 50% graded, 50% original (video blend)
        alpha = min(intensity, 1.0)
        # Use blend filter for video overlay blend
        run_ffmpeg(
            f"-i '{graded}' -i '{input_path}' "
            f"-filter_complex "
            f"'[0:v][1:v]blend=all_expr='A*({alpha})+B*({1-alpha})'[v];"
            f"[0:a][1:a]amix=inputs=2:duration=first[a]' "
            f"-map '[v]' -map '[a]' "
            f"-c:v libx264 -crf {crf} -preset fast "
            f"-c:a aac -b:a 192k -ar 48000 "
            f"'{output_path}'"
        )
        return output_path

    @staticmethod
    def list_presets() -> List[dict]:
        """Return all available presets as dicts for API responses."""
        return [
            {
                "id": name,
                "label": p.label,
                "description": p.description,
                "brightness": p.brightness,
                "contrast": p.contrast,
                "saturation": p.saturation,
                "gamma": p.gamma,
            }
            for name, p in PRESETS.items()
        ]

    @staticmethod
    def get_preset(name: str) -> ColorPreset:
        """Get a preset by name. Raises ValueError if not found."""
        if name not in PRESETS:
            raise ValueError(f"Unknown preset {name!r}. Available: {list(PRESETS.keys())}")
        return PRESETS[name]
