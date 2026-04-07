"""
video_studio_app/ffmpeg_presets.py
FFmpeg encoding presets, aspect ratio definitions, and quality configurations.

Used by video_assembler.py to drive resolution, bitrate, and encoding settings
across all export paths.

Usage:
    from ffmpeg_presets import QUALITY_PRESETS, ASPECT_RATIOS, get_encoding_params

    params = get_encoding_params("1080p", "16:9")
    # → {"width": 1920, "height": 1080, "crf": 18, "preset": "medium", ...}
"""

from __future__ import annotations

import shlex
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, Union

# ---------------------------------------------------------------------------
# FFmpeg runner
# ---------------------------------------------------------------------------

FFMPEG_TIMEOUT_SEC = 300  # 5 minutes per command


def ffmpeg_available() -> bool:
    """Return True if FFmpeg is installed and reachable."""
    try:
        subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            timeout=10,
        )
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return False


def run_ffmpeg(
    args: str,
    *,
    quiet: bool = True,
    timeout: int = FFMPEG_TIMEOUT_SEC,
) -> subprocess.CompletedProcess:
    """
    Execute ``ffmpeg -y <args>``.  Raises RuntimeError on non-zero exit.

    Args:
        args:    FFmpeg CLI arguments (without the leading ``ffmpeg -y``).
        quiet:   Suppress ffmpeg console output (loglevel error).
        timeout: Seconds before the subprocess is killed.
    """
    # Parse args into a list — strip surrounding quotes so bare paths work on Windows.
    raw = shlex.split(args)
    arg_list: list[str] = []
    for token in raw:
        stripped = token.strip()
        # Remove matching outer quotes (single or double) — needed on Windows
        if len(stripped) >= 2 and stripped[0] in ('"', "'") and stripped[-1] == stripped[0]:
            stripped = stripped[1:-1]
        arg_list.append(stripped)

    cmd = ["ffmpeg", "-y"]
    if quiet:
        cmd += ["-loglevel", "error"]
    cmd += arg_list

    cmd_str = " ".join(cmd)
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"FFmpeg timed out after {timeout}s.\nCMD: {cmd_str}") from exc

    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg exited with code {result.returncode}.\n"
            f"CMD: {cmd_str}\nSTDERR: {result.stderr[:1000]}"
        )
    return result

# ---------------------------------------------------------------------------
# Quality presets
# ---------------------------------------------------------------------------

QUALITY_PRESETS: Dict[str, Dict[str, Any]] = {
    # 720p — fast encode, good for social previews
    "720p": {
        "width": 1280,
        "height": 720,
        "crf": 22,           # visually good, smaller file
        "preset": "fast",    # encode speed
        "video_bitrate": "3M",
        "audio_bitrate": "128k",
        "maxrate": "4M",
        "bufsize": "6M",
        "label": "HD 720p",
    },
    # 1080p — default for YouTube / TikTok master
    "1080p": {
        "width": 1920,
        "height": 1080,
        "crf": 18,           # near-lossless
        "preset": "medium",
        "video_bitrate": "8M",
        "audio_bitrate": "192k",
        "maxrate": "10M",
        "bufsize": "15M",
        "label": "Full HD 1080p",
    },
    # 4K — maximum quality, slow encode
    "4k": {
        "width": 3840,
        "height": 2160,
        "crf": 15,           # visually lossless
        "preset": "slow",    # better compression at same quality
        "video_bitrate": "35M",
        "audio_bitrate": "256k",
        "maxrate": "45M",
        "bufsize": "60M",
        "label": "Ultra HD 4K",
    },
    # Hailuo quality — 1080p @ 30fps, stabilized, motion-interpolated
    # Matches TKP-80 target: smooth motion matching Hailuo video quality
    "hailuo": {
        "width": 1920,
        "height": 1080,
        "fps": 30,
        "crf": 18,           # visually lossless
        "preset": "slow",    # better compression (slow is worth it for quality)
        "video_bitrate": "12M",
        "audio_bitrate": "192k",
        "maxrate": "14M",
        "bufsize": "20M",
        "label": "1080p Hailuo (30fps, stabilized)",
        "description": "1080p @ 30fps with vidstab stabilization + motion interpolation — targets Hailuo-quality smooth motion",
    },
}

# Default preset used when none specified
DEFAULT_QUALITY = "1080p"

# ---------------------------------------------------------------------------
# Aspect ratio definitions
# ---------------------------------------------------------------------------

ASPECT_RATIOS: Dict[str, Dict[str, Any]] = {
    # Vertical — TikTok, Reels, Shorts
    "9:16": {
        "width": 1080,
        "height": 1920,
        "ratio": 0.5625,            # 9/16
        "label": "9:16 Vertical (TikTok / Reels / Shorts)",
        "platforms": ["tiktok", "instagram_reels", "youtube_shorts"],
    },
    # Standard horizontal — YouTube
    "16:9": {
        "width": 1920,
        "height": 1080,
        "ratio": 1.7778,            # 16/9
        "label": "16:9 Widescreen (YouTube)",
        "platforms": ["youtube", "linkedin"],
    },
    # Square — Instagram feed
    "1:1": {
        "width": 1080,
        "height": 1080,
        "ratio": 1.0,
        "label": "1:1 Square (Instagram Feed)",
        "platforms": ["instagram"],
    },
    # Portrait — Instagram portrait posts
    "4:5": {
        "width": 1080,
        "height": 1350,
        "ratio": 0.8,
        "label": "4:5 Portrait (Instagram Portrait)",
        "platforms": ["instagram_portrait"],
    },
}

DEFAULT_ASPECT = "9:16"

# ---------------------------------------------------------------------------
# Encoding speed presets (CRF + preset pairs for different speed tiers)
# ---------------------------------------------------------------------------

SPEED_PRESETS: Dict[str, Dict[str, Any]] = {
    "ultrafast":  {"preset": "ultrafast",  "crf_offset":  4, "label": "Ultra Fast"},
    "superfast":  {"preset": "superfast",  "crf_offset":  3, "label": "Super Fast"},
    "veryfast":   {"preset": "veryfast",   "crf_offset":  2, "label": "Very Fast"},
    "faster":     {"preset": "faster",     "crf_offset":  1, "label": "Faster"},
    "fast":       {"preset": "fast",       "crf_offset":  0, "label": "Fast"},
    "medium":     {"preset": "medium",     "crf_offset":  0, "label": "Medium"},
    "slow":       {"preset": "slow",       "crf_offset": -2, "label": "Slow (Best Compression)"},
    "slower":     {"preset": "slower",     "crf_offset": -3, "label": "Slower"},
    "veryslow":   {"preset": "veryslow",   "crf_offset": -4, "label": "Very Slow (Best Quality)"},
}

DEFAULT_SPEED = "medium"

# ---------------------------------------------------------------------------
# Subtitle style presets (for use in SubtitleRenderer.to_ass)
# ---------------------------------------------------------------------------

SUBTITLE_STYLES: Dict[str, Dict[str, Any]] = {
    # Clean white text with dark outline — works on any background
    "default": {
        "font": "Arial",
        "font_size": 28,
        "primary_colour": "&H00FFFFFF",   # white
        "outline_colour": "&H00000000",   # black outline
        "alignment": "2",                  # bottom centre
        "margin_l": 40, "margin_r": 40, "margin_v": 10,
        "bold": True,
    },
    # Larger, bolder for growth channel
    "growth": {
        "font": "Arial",
        "font_size": 32,
        "primary_colour": "&H00FFFFFF",
        "outline_colour": "&H00222222",
        "alignment": "2",
        "margin_l": 60, "margin_r": 60, "margin_v": 15,
        "bold": True,
    },
    # Small / subtle for product demos
    "subtle": {
        "font": "Arial",
        "font_size": 20,
        "primary_colour": "&H00FFFFFF",
        "outline_colour": "&H00000000",
        "alignment": "2",
        "margin_l": 30, "margin_r": 30, "margin_v": 8,
        "bold": False,
    },
    # Top-of-screen placement
    "top": {
        "font": "Arial",
        "font_size": 26,
        "primary_colour": "&H00FFFFFF",
        "outline_colour": "&H00000000",
        "alignment": "8",                  # top centre in ASS
        "margin_l": 40, "margin_r": 40, "margin_v": 10,
        "bold": True,
    },
    # Centered mid-screen
    "center": {
        "font": "Arial",
        "font_size": 30,
        "primary_colour": "&H00FFFFFF",
        "outline_colour": "&H001A1A1A",
        "alignment": "5",                  # centre
        "margin_l": 80, "margin_r": 80, "margin_v": 0,
        "bold": True,
    },
}

DEFAULT_SUBTITLE_STYLE = "default"

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def get_quality_preset(name: str) -> Dict[str, Any]:
    """Return quality preset dict, falling back to 1080p if unknown."""
    return QUALITY_PRESETS.get(name, QUALITY_PRESETS[DEFAULT_QUALITY])


def hailuo_quality_preset() -> Dict[str, Any]:
    """
    Return the Hailuo-quality encoding preset for TKP-80.

    Target: 1080p @ 30fps, H.264 CRF 18, vidstab-stabilized,
    motion-interpolated output.

    This preset is used in conjunction with MotionEnhancer for:
      1. vidstab 2-pass stabilization
      2. minterpolate FPS conversion (24 → 30 fps)
      3. Bicubic upscale to 1080p
      4. CRF 18 H.264 encoding

    Returns:
        Dict with width=1920, height=1080, fps=30, crf=18, preset="slow",
        and additional Hailuo-specific fields: stabilize=True, interpolate=True.
    """
    p = QUALITY_PRESETS["hailuo"].copy()
    p["stabilize"] = True       # vidstab 2-pass
    p["interpolate"] = True     # minterpolate 24→30fps
    p["upscale"] = True         # bicubic upscale to 1080p
    p["target_fps"] = 30
    p["source_fps"] = 24        # typical MiniMax/Hailuo source framerate
    return p


def get_aspect_ratio(name: str) -> Dict[str, Any]:
    """Return aspect ratio dict, falling back to 9:16 if unknown."""
    return ASPECT_RATIOS.get(name, ASPECT_RATIOS[DEFAULT_ASPECT])


def get_encoding_params(
    quality: str = DEFAULT_QUALITY,
    aspect: str = DEFAULT_ASPECT,
    *,
    speed: str = DEFAULT_SPEED,
    bitrate_mode: str = "crf",   # "crf" | "cbr" | "vbr"
) -> Dict[str, Any]:
    """
    Build a complete encoding parameter dict for FFmpeg.

    Args:
        quality:     '720p' | '1080p' | '4k'
        aspect:     '9:16' | '16:9' | '1:1' | '4:5'
        speed:       'ultrafast' … 'veryslow' (maps to x264 --preset)
        bitrate_mode: 'crf' (default, constant quality) |
                      'cbr' (constant bitrate) |
                      'vbr' (variable bitrate, VBV constrained)

    Returns:
        Dict with: width, height, crf, preset, video_bitrate, audio_bitrate,
        maxrate, bfsize, extra_video_args, scale_filter, aspect_label, quality_label
    """
    q   = get_quality_preset(quality)
    a   = get_aspect_ratio(aspect)
    spd = SPEED_PRESETS.get(speed, SPEED_PRESETS[DEFAULT_SPEED])

    crf = max(0, min(51, q.get("crf", 18) + spd["crf_offset"]))

    target_w = a["width"]
    target_h = a["height"]

    # FPS from preset (for Hailuo: 30fps target; default to 30)
    target_fps = q.get("fps") or a.get("fps") or 30

    # Build FFmpeg scale + pad filter chain
    scale_filter = f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease"
    pad_filter   = f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:black"

    if bitrate_mode == "cbr":
        video_bitrate = q["video_bitrate"]
        extra_video_args = (
            f"-b:v {video_bitrate} -maxrate {video_bitrate} "
            f"-bufsize {q['bufsize']} -minrate {video_bitrate}"
        )
    elif bitrate_mode == "vbr":
        video_bitrate = q["video_bitrate"]
        extra_video_args = (
            f"-b:v {video_bitrate} -maxrate {q['maxrate']} "
            f"-bufsize {q['bufsize']} -rc-lookahead 30"
        )
    else:
        # CRF mode (default) — no bitrate flags needed
        video_bitrate = None
        extra_video_args = f"-crf {crf}"

    return {
        "width":            target_w,
        "height":           target_h,
        "fps":              target_fps,
        "crf":              crf,
        "preset":           spd["preset"],
        "video_bitrate":    video_bitrate,
        "audio_bitrate":   q["audio_bitrate"],
        "maxrate":         q["maxrate"],
        "bufsize":         q["bufsize"],
        "extra_video_args": extra_video_args,
        "scale_filter":    scale_filter,
        "pad_filter":      pad_filter,
        "aspect_label":    a["label"],
        "quality_label":   q["label"],
        "speed_label":     spd["label"],
        "stabilize":       q.get("stabilize", False),
        "interpolate":      q.get("interpolate", False),
    }


def build_vf_chain(
    quality: str = DEFAULT_QUALITY,
    aspect: str = DEFAULT_ASPECT,
    *,
    letterbox: bool = True,
    subtitles_path: Optional[str] = None,
    watermark_path: Optional[str] = None,
    watermark_position: str = "bottom-right",
    watermark_padding: int = 20,
    watermark_opacity: float = 0.10,
) -> Tuple[str, str, Optional[str]]:
    """
    Build FFmpeg filter chain for scale+pad + optional subtitles + optional watermark.

    Returns a 3-tuple:
        (vf_string, wm_filtergraph, watermark_safe_path)
    If no watermark: (vf_string, None, None)

    The vf_string covers scale+pad+crop for the single input path.
    The wm_filtergraph covers the two-input overlay (logo + main video).
    Both are shell-safe (single-quotes around paths already escaped).

    Usage with run_ffmpeg (watermark):
        vf, wm_fg, wm_path = build_vf_chain(..., watermark_path="logo.png")
        run_ffmpeg(
            f"-i video.mp4 -i logo.png "
            f"-filter_complex '[0:v]{vf}[base];[base]{wm_fg}[out]' "
            f"-map '[out]' ..."
        )

    Usage without watermark:
        vf, _, _ = build_vf_chain(...)
        run_ffmpeg(f"-i video.mp4 -vf '{vf}' ...")
    """
    a = get_aspect_ratio(aspect)
    target_w = a["width"]
    target_h = a["height"]

    # 1. Scale + pad/crop
    if letterbox:
        scale_vf = (
            f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,"
            f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:black"
        )
    else:
        scale_vf = (
            f"scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
            f"crop={target_w}:{target_h}"
        )

    filters: list[str] = [scale_vf]

    # 2. Subtitles burn-in
    if subtitles_path:
        safe_path = subtitles_path.replace("'", "'\\''")
        filters.append(f"ass='{safe_path}'")

    vf_string = ",".join(filters)

    # 3. Watermark overlay (two-input filtergraph)
    wm_filtergraph: Optional[str] = None
    safe_wm_path: Optional[str] = None

    if watermark_path:
        safe_wm_path = watermark_path.replace("'", "'\\''")
        pos_expr = {
            "top-left":     f"overlay={watermark_padding}:{watermark_padding}",
            "top-right":    f"overlay=W-w-{watermark_padding}:{watermark_padding}",
            "bottom-left":  f"overlay={watermark_padding}:H-h-{watermark_padding}",
            "bottom-right": f"overlay=W-w-{watermark_padding}:H-h-{watermark_padding}",
            "center":       "overlay=(W-w)/2:(H-h)/2",
        }.get(watermark_position, f"overlay=W-w-{watermark_padding}:H-h-{watermark_padding}")

        wm_filtergraph = (
            f"[1:v]format=rgba,colorchannelmixer=aa={watermark_opacity}[logo];"
            f"[0:v]{pos_expr}[out]"
        )

    return vf_string, wm_filtergraph, safe_wm_path


def build_scale_vf(
    aspect: str = DEFAULT_ASPECT,
    *,
    letterbox: bool = True,
) -> str:
    """
    Build just the scale+pad/crop vf string (single-input, no watermark/subtitles).
    Convenience wrapper for simpler calls.
    """
    a = get_aspect_ratio(aspect)
    target_w = a["width"]
    target_h = a["height"]
    if letterbox:
        return (
            f"scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,"
            f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:black"
        )
    else:
        return (
            f"scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
            f"crop={target_w}:{target_h}"
        )
