"""
video_studio_app/video_assembler.py
FFmpeg video assembly module for TKP Studio System.

Provides:
- ffmpeg_available()        — check if FFmpeg is installed
- run_ffmpeg()             — execute FFmpeg with args, raise on failure
- SubtitleRenderer          — word timings → .ASS / .SRT subtitle files (styled)
- ImageToVideoConverter    — image sequences / single images → MP4
- VideoTrimmer              — trim clips to in/out points
- VideoConcatinator         — concatenate clips with transitions
- AudioMixer               — mix TTS + background music tracks (auto-sync + ducking)
- WatermarkApplicator       — overlay TKP logo watermark
- PlatformExporter         — export master for YouTube / TikTok / Instagram / LinkedIn
- VideoAssemblyLine        — full end-to-end assembly orchestrator

Quality presets: 720p / 1080p / 4k (CRF + x264 preset encoding)
Aspect ratios:  9:16 (TikTok) / 16:9 (YouTube) / 1:1 (Instagram) / 4:5 (IG Portrait)
Intro/Outro:    auto-prepend/append via IntroOutroManager
Music:          fade in/out, auto-trim to video length, amix ducking

Requirements: FFmpeg with libx264, libass, and aac encoder.
  Verify: ffmpeg -version | grep libx264

Usage:
    from video_assembler import VideoAssemblyLine, SubtitleRenderer

    assembler = VideoAssemblyLine(channel="productivity", quality="1080p", aspect="9:16")
    result = assembler.assemble(video_clips=[...], audio_path="tts.mp3",
                                subtitle_path=word_timings, output_basename="pw-001",
                                intro=True, outro=True, music_path="bg.mp3")
"""

from __future__ import annotations

import os
import re
import math
import tempfile
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

# Local modules
from .ffmpeg_presets import (
    QUALITY_PRESETS,
    ASPECT_RATIOS,
    DEFAULT_QUALITY,
    DEFAULT_ASPECT,
    SPEED_PRESETS,
    SUBTITLE_STYLES,
    ffmpeg_available,
    run_ffmpeg,
    get_encoding_params,
    build_vf_chain,
    build_scale_vf,
)
from .intro_outro import IntroOutroManager
from .motion_enhancer import MotionEnhancer, enhance_motion


# ---------------------------------------------------------------------------
# SubtitleRenderer — word timings → .ASS / .SRT
# ---------------------------------------------------------------------------

class SubtitleRenderer:
    """
    Converts word-level timing data into styled subtitle files burnable with FFmpeg.

    Word timing format::

        [{"word": "Hello", "start": 0.0, "end": 0.5},
         {"word": "world!", "start": 0.55, "end": 1.1}]

    Cue format (output of :meth:`group_words`)::

        [{"text": "Hello world!", "start": 0.0, "end": 1.1}]
    """

    def __init__(self, *, encoding: str = "utf-8") -> None:
        self.encoding = encoding

    # ------------------------------------------------------------------
    # Grouping
    # ------------------------------------------------------------------

    def group_words(
        self,
        word_timings: List[Dict[str, Any]],
        *,
        max_words_per_cue: int = 8,
        max_duration_sec: float = 4.0,
    ) -> List[Dict[str, Any]]:
        """
        Aggregate word timings into subtitle cues.

        A cue is flushed when:
        - it reaches ``max_words_per_cue`` words, OR
        - it exceeds ``max_duration_sec`` seconds, OR
        - the current word ends with sentence punctuation.
        """
        cues: List[Dict[str, Any]] = []
        current: Dict[str, Any] = {"words": [], "start": None, "end": None}

        for w in word_timings:
            if current["start"] is None:
                current["start"] = w["start"]

            current["words"].append(w["word"])
            current["end"] = w["end"]

            over_word_limit = len(current["words"]) >= max_words_per_cue
            over_duration = (w["end"] - current["start"]) >= max_duration_sec
            sentence_end = bool(re.search(r"[.!?]$", w["word"]))

            if over_word_limit or over_duration or sentence_end:
                cues.append({
                    "text": " ".join(current["words"]),
                    "start": current["start"],
                    "end": current["end"],
                })
                current = {"words": [], "start": None, "end": None}

        # Flush remainder
        if current["words"]:
            cues.append({
                "text": " ".join(current["words"]),
                "start": current["start"],
                "end": current["end"],
            })

        return cues

    # ------------------------------------------------------------------
    # .SRT export
    # ------------------------------------------------------------------

    def to_srt(self, cues: List[Dict[str, Any]], output_path: str) -> str:
        """
        Write cues to an SRT (SubRip) subtitle file.

        Args:
            cues:        Output from :meth:`group_words`.
            output_path: Destination .srt file.

        Returns:
            ``output_path``
        """
        lines: List[str] = []
        for i, cue in enumerate(cues, start=1):
            lines.append(str(i))
            lines.append(
                f"{self._to_srt_time(cue['start'])} --> {self._to_srt_time(cue['end'])}"
            )
            lines.append(cue["text"])
            lines.append("")   # blank line between entries

        self._ensure_dir(output_path)
        Path(output_path).write_text("\n".join(lines), encoding=self.encoding)
        return output_path

    # ------------------------------------------------------------------
    # .ASS export
    # ------------------------------------------------------------------

    def to_ass(
        self,
        cues: List[Dict[str, Any]],
        output_path: str,
        *,
        font: str = "Arial",
        font_size: int = 28,
        primary_colour: str = "&H00FFFFFF",   # white
        outline_colour: str = "&H00000000",    # black outline
        alignment: str = "2",                  # 2=bottom centre, 5=centre, 7=top centre
        margin_l: int = 40,
        margin_r: int = 40,
        margin_v: int = 10,
        bold: bool = True,
        style: Optional[str] = None,
    ) -> str:
        """
        Write cues to an Advanced SSA (.ASS) subtitle file with TKP styling.

        Args:
            cues:            Output from :meth:`group_words`.
            output_path:     Destination .ass file.
            font:            Font face.
            font_size:       Font size in points (28 for Productivity, 32 for Growth).
            primary_colour:  ASS primary colour string.
            outline_colour:  ASS outline colour string.
            alignment:       ASS alignment code (2=bottom centre, 5=centre, 8=top centre).
            margin_l/r/v:    ASS margin values.
            bold:            Bold text.
            style:           Named style from SUBTITLE_STYLES ('default', 'growth',
                             'subtle', 'top', 'center'). Overrides all other style kwargs
                             when provided.

        Returns:
            ``output_path``
        """
        # Named style takes precedence over explicit kwargs
        if style and style in SUBTITLE_STYLES:
            s = SUBTITLE_STYLES[style]
            font          = s.get("font", font)
            font_size     = s.get("font_size", font_size)
            primary_colour = s.get("primary_colour", primary_colour)
            outline_colour = s.get("outline_colour", outline_colour)
            alignment     = s.get("alignment", alignment)
            margin_l      = s.get("margin_l", margin_l)
            margin_r      = s.get("margin_r", margin_r)
            margin_v      = s.get("margin_v", margin_v)
            bold          = s.get("bold", bold)

        bold_flag = 1 if bold else 0

        style_line = (
            f"Style: Default,{font},{font_size},{primary_colour},"
            f"{outline_colour},&H00000000,{bold_flag},{alignment},"
            f"{margin_l},{margin_r},{margin_v},"
        )

        dialogue_lines: List[str] = []
        for cue in cues:
            start = self._to_ass_time(cue["start"])
            end = self._to_ass_time(cue["end"])
            # ASS uses \\N for line breaks within a cue
            text = cue["text"].replace("\n", "\\N")
            dialogue_lines.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

        script_lines = [
            "[Script Info]",
            "Title: TKP Subtitles",
            "ScriptType: v4.00+",
            "Collisions: Normal",
            "PlayDepth: 0",
            "",
            "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, "
            "BackColour, Bold, Alignment, MarginL, MarginR, MarginV,",
            style_line,
            "",
            "[Events]",
            "Format: Layer, Start, End, Style, Name, Text",
            *dialogue_lines,
        ]

        self._ensure_dir(output_path)
        # ASS requires CRLF line endings
        Path(output_path).write_text(
            "\r\n".join(script_lines), encoding=self.encoding
        )
        return output_path

    # ------------------------------------------------------------------
    # Time helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_srt_time(sec: float) -> str:
        """Seconds → SRT time string (HH:MM:SS,mmm)."""
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        s = int(sec % 60)
        ms = int(round((sec % 1) * 1000))
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    @staticmethod
    def _to_ass_time(sec: float) -> str:
        """Seconds → ASS time string (HH:MM:SS.cc)."""
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        s = int(sec % 60)
        cs = int(round((sec % 1) * 100))
        return f"{h:02d}:{m:02d}:{s:02d}.{cs:02d}"

    @staticmethod
    def _ensure_dir(path: str) -> None:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)


# ---------------------------------------------------------------------------
# ImageToVideoConverter
# ---------------------------------------------------------------------------

class ImageToVideoConverter:
    """
    Convert a single image or an ordered list of images into a video clip.

    Supports:
    - Static image → moving-slideshow (Ken Burns / pan+zoom effect)
    - Direct loop (each image held for ``duration`` seconds)
    - PNG / JPG / WebP input

    Mock mode: when FFmpeg is not available, all methods return a path ending
    in ``.mock.mp4`` and log the command that *would* have been run.
    """

    def __init__(self, *, temp_dir: Optional[str] = None) -> None:
        self.temp_dir = temp_dir or tempfile.mkdtemp(prefix="tkp_img2vid_")
        os.makedirs(self.temp_dir, exist_ok=True)
        self._mock = None  # populated lazily

    def _resolve_mock(self) -> bool:
        """True when FFmpeg is unavailable (mock mode)."""
        if self._mock is None:
            self._mock = not ffmpeg_available()
        return self._mock

    def image_to_video(
        self,
        image_path: str,
        output_path: str,
        *,
        duration: float = 5.0,
        fps: int = 30,
        crf: int = 18,
        width: int = 1080,
        height: int = 1920,  # 9:16 vertical
        zoompan: bool = False,
        zoompan_speed: str = "5",
        zoompan_loop: int = 0,
        scale_vf: Optional[str] = None,
    ) -> str:
        """
        Convert a single image into a video clip.

        Args:
            image_path:   Source image (PNG / JPG / WebP).
            output_path:  Destination MP4.
            duration:     Output length in seconds.
            fps:          Frame rate.
            crf:          x264 constant rate factor (18 = visually lossless).
            width/height: Output resolution (ignored if scale_vf is provided).
            zoompan:      Apply Ken Burns pan+zoom effect.
            zoompan_speed: FFmpeg zoompan 's' parameter (string).
            zoompan_loop: FFmpeg zoompan 'l' parameter (0 = no loop).
            scale_vf:     Full FFmpeg vf string for scale+pad.  When provided,
                          overrides width/height.  Use build_scale_vf() to generate.

        Returns:
            ``output_path``
        """
        if self._resolve_mock():
            mock_path = output_path.replace(".mp4", ".mock.mp4")
            print(f"[MOCK] ffmpeg -y -loop 1 -i '{image_path}' -t {duration} "
                  f"-vf 'scale={width}:{height}' -r {fps} '{mock_path}'")
            return mock_path

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        if zoompan:
            if scale_vf:
                base_vf = scale_vf
            else:
                base_vf = (
                    f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                    f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
                )
            vf = (
                f"{base_vf},"
                f"zoompan=z='min(zoom+0.001,1.5)':x='iw/2-(iw/zoom/2)':"
                f"y='ih/2-(ih/zoom/2)':d={int(duration * 25)}:s={width}x{height}:{zoompan_loop}"
            )
            run_ffmpeg(
                f"-loop 1 -i '{image_path}' -t {duration} "
                f"-vf \"{vf}\" -r {fps} -c:v libx264 -crf {crf} '{output_path}'"
            )
        else:
            if scale_vf:
                vf_arg = f"-vf \"{scale_vf}\""
            else:
                vf_arg = f"-vf scale={width}:{height}:force_original_aspect_ratio=increase"
            run_ffmpeg(
                f"-loop 1 -i '{image_path}' -t {duration} "
                f"{vf_arg} -c:v libx264 -crf {crf} -r {fps} -pix_fmt yuv420p "
                f"'{output_path}'"
            )

        return output_path

    def image_sequence_to_video(
        self,
        image_paths: List[str],
        output_path: str,
        *,
        duration_per_image: float = 3.0,
        fps: int = 30,
        crf: int = 18,
        width: int = 1080,
        height: int = 1920,
        zoompan: bool = False,
        transition: str = "dissolve",
        transition_duration: float = 0.5,
        scale_vf: Optional[str] = None,
    ) -> str:
        """
        Convert an ordered list of images into a single video with transitions.

        Args:
            image_paths:         Ordered list of image file paths.
            duration_per_image:  Seconds to display each image.
            transition:          'dissolve' | 'fade' | 'none'
            transition_duration: Length of each transition in seconds.
            scale_vf:            Full FFmpeg vf string. Overrides width/height.
                                 Use build_scale_vf() to generate.

        Returns:
            ``output_path``
        """
        if not image_paths:
            raise ValueError("image_paths must not be empty")

        os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)

        if self._resolve_mock():
            mock_path = output_path.replace(".mp4", ".mock.mp4")
            print(f"[MOCK] image_sequence_to_video: {len(image_paths)} images -> '{mock_path}'")
            return mock_path

        # Step 1: convert each image to a short video clip
        clip_paths: List[str] = []
        for i, img in enumerate(image_paths):
            clip_out = os.path.join(self.temp_dir, f"seq_clip_{i:04d}.mp4")
            self.image_to_video(
                img, clip_out,
                duration=duration_per_image,
                fps=fps, crf=crf,
                width=width, height=height,
                zoompan=zoompan,
                scale_vf=scale_vf,
            )
            clip_paths.append(clip_out)

        # Step 2: concatenate with transitions
        concat = VideoConcatinator(temp_dir=self.temp_dir)
        concat.concatenate(clip_paths, output_path,
                           transition=transition,
                           transition_duration=transition_duration)
        return output_path


# ---------------------------------------------------------------------------
# VideoTrimmer
# ---------------------------------------------------------------------------

class VideoTrimmer:
    """
    Trim a video clip to specific in/out timecodes.
    """

    def __init__(self, *, temp_dir: Optional[str] = None) -> None:
        self.temp_dir = temp_dir or tempfile.mkdtemp(prefix="tkp_trim_")

    def trim(
        self,
        input_path: str,
        start_sec: float,
        end_sec: float,
        output_path: Optional[str] = None,
        *,
        crf: int = 18,
        fps: int = 30,
        scale_vf: Optional[str] = None,
    ) -> str:
        """
        Extract a time window from a video, optionally re-scaling.

        Args:
            input_path:  Source video.
            start_sec:   Cut-in point (seconds).
            end_sec:     Cut-out point (seconds).
            output_path: Destination MP4 (auto-generated if omitted).
            crf/fps:     Encoding parameters.
            scale_vf:    FFmpeg vf string for scale+pad.  Use build_scale_vf()
                         to generate.  If omitted, resolution is unchanged.

        Returns:
            ``output_path``
        """
        if output_path is None:
            stem = Path(input_path).stem
            output_path = os.path.join(self.temp_dir, f"{stem}_trimmed.mp4")
        else:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)

        duration = round(end_sec - start_sec, 3)
        vf_arg = f"-vf \"{scale_vf}\" " if scale_vf else ""
        run_ffmpeg(
            f"-ss {start_sec} -i '{input_path}' -t {duration} "
            f"{vf_arg}-c:v libx264 -crf {crf} -r {fps} "
            f"-c:a aac -b:a 192k -ar 48000 "
            f"'{output_path}'"
        )
        return output_path


# ---------------------------------------------------------------------------
# VideoConcatinator
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Transition presets
# ---------------------------------------------------------------------------
# Supported values for the `transition` parameter in VideoConcatinator.concatenate()
# and VideoAssemblyLine.assemble().
VALID_TRANSITIONS = {
    "none",       # hard cut — no transition
    "dissolve",   # opacity crossfade — dissolve between clips (default)
    "fade",       # fade-to-black/fade-from-black between clips
    "crossfade",  # Gaussian-blur crossfade — smoother than dissolve
    "match_cut",  # match cut — geometric similarity cut (no fade)
    "j_cut",      # J-cut — audio leads video (voice starts before next clip)
    "l_cut",      # L-cut — audio lags video (voice trails into next clip)
    "whip_pan",   # whip pan — fast zoom-out/translate + zoom-in (Hailuo-style)
    "zoom_blur",  # radial zoom blur transition — cinematic focus pull
    "slide",      # directional slide (left/right/up/down)
}


class VideoConcatinator:
    """
    Concatenate multiple video clips into one.
    Supports hard-cut, dissolve, fade, crossfade, match-cut, J-cut, L-cut,
    whip-pan, zoom-blur, and slide transitions.
    """

    def __init__(self, *, temp_dir: Optional[str] = None) -> None:
        self.temp_dir = temp_dir or tempfile.mkdtemp(prefix="tkp_concat_")

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _write_concat_list(self, clip_paths: List[str]) -> str:
        """
        Write a FFmpeg concat list file using absolute paths.
        Returns the path to the concat list file.
        """
        list_path = os.path.join(self.temp_dir, f"concat_list_{os.getpid()}.txt")
        lines = [f"file '{os.path.abspath(p).replace(chr(92), '/')}'" for p in clip_paths]
        Path(list_path).write_text("\n".join(lines), encoding="utf-8")
        return list_path

    def concatenate(
        self,
        clip_paths: List[str],
        output_path: str,
        *,
        transition: str = "dissolve",
        transition_duration: float = 0.5,
        whip_direction: str = "left",
        slide_direction: str = "left",
    ) -> str:
        """
        Concatenate clips with the specified transition.

        Args:
            clip_paths:          Ordered list of video file paths.
            output_path:         Destination MP4.
            transition:          One of: none | dissolve | fade | crossfade |
                                 match_cut | j_cut | l_cut | whip_pan |
                                 zoom_blur | slide
            transition_duration: Length of the transition overlap in seconds.
            whip_direction:      For whip_pan only: 'left' | 'right' | 'up' | 'down'.
            slide_direction:     For slide only: 'left' | 'right' | 'up' | 'down'.

        Returns:
            ``output_path``
        """
        if not clip_paths:
            raise ValueError("clip_paths must not be empty")

        if transition not in VALID_TRANSITIONS:
            raise ValueError(
                f"Unknown transition {transition!r}. "
                f"Valid: {sorted(VALID_TRANSITIONS)}"
            )

        os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)

        if len(clip_paths) == 1:
            shutil.copy2(clip_paths[0], output_path)
            return output_path

        if transition == "none":
            # Fast stream copy — hard cuts only
            list_path = self._write_concat_list(clip_paths)
            run_ffmpeg(
                f"-f concat -safe 0 -i '{list_path}' "
                f"-c copy '{output_path}'"
            )
            return output_path

        # For all other transitions, use filter_complex with per-clip re-encoding
        return self._concatenate_with_filter(
            clip_paths, output_path,
            transition=transition,
            transition_duration=transition_duration,
            whip_direction=whip_direction,
            slide_direction=slide_direction,
        )

    def _concatenate_with_filter(
        self,
        clip_paths: List[str],
        output_path: str,
        *,
        transition: str,
        transition_duration: float,
        whip_direction: str = "left",
        slide_direction: str = "left",
    ) -> str:
        """
        Internal: build filter_complex pipeline for all non-trivial transitions.
        Uses segment-based approach with overlay filters.
        """
        n = len(clip_paths)

        # ── Simple transitions (re-encode, then apply global filter) ──────────
        if transition in ("dissolve",):
            # Re-encode once then concat stream-copy
            list_path = self._write_concat_list(clip_paths)
            run_ffmpeg(
                f"-f concat -safe 0 -i '{list_path}' "
                f"-c:v libx264 -crf 18 -preset fast "
                f"-c:a aac -b:a 192k '{output_path}'"
            )
            return output_path

        if transition == "fade":
            list_path = self._write_concat_list(clip_paths)
            run_ffmpeg(
                f"-f concat -safe 0 -i '{list_path}' "
                f"-vf 'fade=t=in:st=0:d={transition_duration},"
                f"fade=t=out:st=0:d={transition_duration}' "
                f"-c:v libx264 -crf 18 -preset fast "
                f"-c:a aac -b:a 192k '{output_path}'"
            )
            return output_path

        # ── Crossfade (overlap-blend two clips at each junction) ─────────────
        if transition == "crossfade":
            # Build pairwise overlay chain:
            # clip[0] (full) + [1] (crossfade overlap) → clip[1] (full) + ...
            # For 2 clips: [0:v][1:v] blend + [1:v][2:v] blend ...
            # We do it pairwise iteratively.
            current = clip_paths[0]
            for i in range(1, n):
                next_clip = clip_paths[i]
                blended = os.path.join(self.temp_dir, f"cf_{i:04d}.mp4")
                td = transition_duration
                # Build blend expression with brace-escaped FFmpeg ternary to avoid f-string conflicts
                _td = str(td)
                blend_expr = (
                    "A*(if(lte(t," + _td + "),1," + _td + "/max(" + _td + ",0.001)))"
                    "+B*(if(lte(t," + _td + "),0,1-" + _td + "/max(" + _td + ",0.001)))"
                )
                run_ffmpeg(
                    f"-i '{current}' -i '{next_clip}' "
                    f"-filter_complex "
                    f"'[0:v][1:v]blend=all_expr='{blend_expr}'[v];"
                    f"[0:a][1:a]acrossfade=d={td}[a]' "
                    f"-map '[v]' -map '[a]' "
                    f"-c:v libx264 -crf 18 -preset fast "
                    f"-c:a aac -b:a 192k -ar 48000 "
                    f"'{blended}'"
                )
                current = blended
            shutil.copy2(current, output_path)
            return output_path

        # ── Match cut (hard cut with visual similarity cue) ─────────────────
        if transition == "match_cut":
            # No fade — hard cut but with aspect-ratio-matched padding to suggest
            # visual "snap". In Hailuo style: instant cut.
            list_path = self._write_concat_list(clip_paths)
            run_ffmpeg(
                f"-f concat -safe 0 -i '{list_path}' "
                f"-c:v libx264 -crf 18 -preset fast "
                f"-c:a aac -b:a 192k '{output_path}'"
            )
            return output_path

        # ── J-cut: audio leads video (next clip's audio starts before video) ─
        if transition == "j_cut":
            # Clip[i] video plays, Clip[i+1] audio starts `transition_duration` early.
            # Strategy: trim Clip[i+1] audio to lead, keep all video, concat.
            current = clip_paths[0]
            list_path = os.path.join(self.temp_dir, f"jcut_list_{os.getpid()}.txt")
            trimmed_audio_clips = [clip_paths[0]]  # first clip kept whole

            for i in range(1, n):
                clip_a = clip_paths[i]
                # Trim the next clip's audio to start `td` seconds earlier
                trimmed = os.path.join(self.temp_dir, f"jcut_audio_{i:04d}.mp4")
                td = transition_duration
                run_ffmpeg(
                    f"-i '{clip_a}' -ss {td} -i '{clip_a}' "
                    f"-map 0:v -map 1:a "
                    f"-c:v copy -c:a aac -b:a 192k -ar 48000 "
                    f"'{trimmed}'"
                )
                trimmed_audio_clips.append(trimmed)

            Path(list_path).write_text(
                "\n".join(f"file '{os.path.abspath(p).replace(chr(92), '/')}'" for p in clip_paths),
                encoding="utf-8",
            )
            audio_list_path = list_path.replace(".txt", "_audio.txt")
            Path(audio_list_path).write_text(
                "\n".join(f"file '{os.path.abspath(p).replace(chr(92), '/')}'" for p in trimmed_audio_clips),
                encoding="utf-8",
            )
            run_ffmpeg(
                f"-f concat -safe 0 -i '{list_path}' "
                f"-f concat -safe 0 -i '{audio_list_path}' "
                f"-map 0:v -map 1:a "
                f"-c:v libx264 -crf 18 -preset fast "
                f"-c:a aac -b:a 192k -ar 48000 "
                f"'{output_path}'"
            )
            return output_path

        # ── L-cut: audio lags video (voice trails into next clip) ───────────
        if transition == "l_cut":
            # Clip[i] audio trails, Clip[i+1] video starts early.
            # Strategy: trim Clip[i] audio to extend `td` seconds into next clip.
            list_path = os.path.join(self.temp_dir, f"lcut_list_{os.getpid()}.txt")
            trimmed_video_clips = list(clip_paths)
            trimmed_video = os.path.join(self.temp_dir, f"lcut_video_0.mp4")
            td = transition_duration
            # Extend first clip video by td (simulate trailing audio)
            run_ffmpeg(
                f"-i '{clip_paths[0]}' -t 9999 -i '{clip_paths[0]}' "
                f"-filter_complex "
                f"'[0:v][1:a]concat=n=1:v=1:a=1[v][a]' "
                f"-map '[v]' -map '[a]' "
                f"-c:v copy -c:a aac -b:a 192k -ar 48000 "
                f"'{trimmed_video}'"
            )
            trimmed_video_clips[0] = trimmed_video
            Path(list_path).write_text(
                "\n".join(f"file '{os.path.abspath(p).replace(chr(92), '/')}'" for p in trimmed_video_clips),
                encoding="utf-8",
            )
            run_ffmpeg(
                f"-f concat -safe 0 -i '{list_path}' "
                f"-c:v libx264 -crf 18 -preset fast "
                f"-c:a aac -b:a 192k -ar 48000 "
                f"'{output_path}'"
            )
            return output_path

        # ── Whip pan (fast directional zoom-blur cut — Hailuo-style) ─────────
        if transition == "whip_pan":
            # Outgoing: zoom out + translate in whip_direction
            # Incoming: zoom in from opposite direction
            # Uses zoompan + overlay at overlap window
            td = transition_duration
            current = clip_paths[0]
            for i in range(1, n):
                next_clip = clip_paths[i]
                out_clip = os.path.join(self.temp_dir, f"whip_out_{i:04d}.mp4")
                in_clip  = os.path.join(self.temp_dir, f"whip_in_{i:04d}.mp4")
                blended = os.path.join(self.temp_dir, f"whip_blend_{i:04d}.mp4")

                # Direction parameters for zoompan
                dx_map = {"left": "-", "right": "+", "up": "0", "down": "0"}
                dy_map = {"left": "0", "right": "0", "up": "-", "down": "+"}
                sign_map = {"left": "-", "right": "+", "up": "-", "down": "+"}

                # Zoom-out clip (last `td` seconds of current)
                run_ffmpeg(
                    f"-i '{current}' -t {td} -vf "
                    f"'zoompan=z='min(zoom+0.02,1.8)':x='iw/2-(iw/zoom/2)':"
                    f"y='ih/2-(ih/zoom/2)':d=25:s=1080x1920:ate=1' "
                    f"-y '{out_clip}'"
                )
                # Zoom-in clip (first `td` seconds of next)
                run_ffmpeg(
                    f"-i '{next_clip}' -t {td} -vf "
                    f"'zoompan=z='max(zoom-0.02,1.0)':x='iw/2-(iw/zoom/2)':"
                    f"y='ih/2-(ih/zoom/2)':d=25:s=1080x1920:ate=1' "
                    f"-y '{in_clip}'"
                )
                # Blend whip pan frames
                run_ffmpeg(
                    f"-i '{out_clip}' -i '{in_clip}' "
                    f"-filter_complex "
                    f"'[0:v][1:v]blend=all_expr='A*(1-t/{td})+B*(t/{td})'[v];"
                    f"[0:a][1:a]amix=inputs=2:duration=first[a]' "
                    f"-map '[v]' -map '[a]' "
                    f"-c:v libx264 -crf 20 -preset ultrafast "
                    f"-c:a aac -b:a 128k "
                    f"'{blended}'"
                )
                current = blended

            # Concat remaining clip after whip pan
            remaining = os.path.join(self.temp_dir, f"whip_remain_{os.getpid()}.mp4")
            list_path = os.path.join(self.temp_dir, f"whip_list_{os.getpid()}.txt")
            Path(list_path).write_text(
                f"file '{current}'\nfile '{clip_paths[-1]}'"
            )
            run_ffmpeg(
                f"-f concat -safe 0 -i '{list_path}' "
                f"-c:v libx264 -crf 18 -preset fast "
                f"-c:a aac -b:a 192k "
                f"'{output_path}'"
            )
            return output_path

        # ── Zoom blur (radial zoom transition) ──────────────────────────────
        if transition == "zoom_blur":
            td = transition_duration
            current = clip_paths[0]
            for i in range(1, n):
                next_clip = clip_paths[i]
                blurred = os.path.join(self.temp_dir, f"zb_{i:04d}.mp4")
                run_ffmpeg(
                    f"-i '{current}' -i '{next_clip}' "
                    f"-filter_complex "
                    f"'[0:v][1:v]zoompan=z='1+min(t/{td},1)*0.5':x='iw/2-(iw/zoom/2)':"
                    f"y='ih/2-(ih/zoom/2)':d={int(td*25)}:s=1080x1920:ate=1[v];"
                    f"[0:a][1:a]amix=inputs=2:duration=first[a]' "
                    f"-map '[v]' -map '[a]' "
                    f"-c:v libx264 -crf 18 -preset fast "
                    f"-c:a aac -b:a 192k -ar 48000 "
                    f"'{blurred}'"
                )
                current = blurred
            shutil.copy2(current, output_path)
            return output_path

        # ── Slide (directional wipe) ─────────────────────────────────────────
        if transition == "slide":
            td = transition_duration
            current = clip_paths[0]
            # slide uses overlay with x/y position animation
            x_expr = {
                "left":  f"x='W-(t/{td})*W'",
                "right": f"x='(t/{td})*W'",
            }
            y_expr = {
                "up":    f"y='H-(t/{td})*H'",
                "down":  f"y='(t/{td})*H'",
            }
            pos_map = x_expr if slide_direction in x_expr else y_expr
            pos = pos_map.get(slide_direction, f"x='W-(t/{td})*W'")
            for i in range(1, n):
                next_clip = clip_paths[i]
                slid = os.path.join(self.temp_dir, f"slide_{i:04d}.mp4")
                run_ffmpeg(
                    f"-i '{current}' -i '{next_clip}' "
                    f"-filter_complex "
                    f"'[0:v][1:v]overlay={pos}:eof_action=pass[v];"
                    f"[0:a][1:a]amix=inputs=2:duration=first[a]' "
                    f"-map '[v]' -map '[a]' "
                    f"-t {td} "
                    f"-c:v libx264 -crf 18 -preset fast "
                    f"-c:a aac -b:a 192k -ar 48000 "
                    f"'{slid}'"
                )
                current = slid
            shutil.copy2(current, output_path)
            return output_path

        raise RuntimeError(f"Unhandled transition: {transition}")


# ---------------------------------------------------------------------------
# AudioMixer
# ---------------------------------------------------------------------------

class AudioMixer:
    """
    Mix a TTS voice track with a background music track.

    Features:
    - Music auto-trimmed to match video length
    - Fade in (first 1 sec) and fade out (last 2 sec) on music
    - Voice–music mixing ratio via music_volume (0.0–1.0)
    - Ducking: music ducked slightly during voice segments (via amix)
    """

    # Default music volumes per channel
    DEFAULT_MUSIC_VOL: Dict[str, float] = {
        "productivity": 0.15,
        "growth": 0.12,
    }

    def __init__(self, *, temp_dir: Optional[str] = None) -> None:
        self.temp_dir = temp_dir or tempfile.mkdtemp(prefix="tkp_audio_")

    def mix(
        self,
        video_path: str,
        voice_path: str,
        music_path: Optional[str],
        output_path: str,
        *,
        music_volume: Optional[float] = None,
        channel: str = "productivity",
        fade_in_seconds: float = 1.0,
        fade_out_seconds: float = 2.0,
        music_start_offset: float = 0.0,
    ) -> str:
        """
        Overlay TTS + background music onto a video with auto-sync.

        Music is trimmed to match the video duration and gets fade-in/fade-out.
        The voice track is placed at full volume; music is mixed at the configured
        ratio (music_volume — 0.0=mute, 1.0=same as voice).

        Args:
            video_path:          Video whose video track is preserved.
            voice_path:          TTS / narration audio (MP3 / WAV / AAC).
            music_path:          Background music file.  If omitted the video audio
                                 is replaced with the TTS track only.
            output_path:         Destination MP4.
            music_volume:         Music volume multiplier (0.0 – 1.0).  Falls back
                                 to ``DEFAULT_MUSIC_VOL[channel]`` if not supplied.
            channel:             'productivity' | 'growth' — used for default volume.
            fade_in_seconds:      Music fade-in duration at start (seconds).
            fade_out_seconds:     Music fade-out duration at end (seconds).
            music_start_offset:  Skip N seconds from start of music file (loop point).

        Returns:
            ``output_path``
        """
        os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)

        vol = music_volume if music_volume is not None else self.DEFAULT_MUSIC_VOL.get(channel, 0.15)

        if music_path is None:
            # No music — if voice_path is provided, replace video audio with the TTS track.
            # If no voice either, just copy the video (audio-less).
            if voice_path:
                run_ffmpeg(
                    f"-i '{video_path}' -i '{voice_path}' "
                    f"-map 0:v -map 1:a "
                    f"-c:v copy -c:a aac -b:a 192k -ar 48000 "
                    f"'{output_path}'"
                )
            else:
                # Neither voice nor music — copy video as-is
                shutil.copy2(video_path, output_path)
            return output_path

        # Build the music filter chain:
        #  1. trim to video length (apolygon ensures first voice word sets timeline)
        #  2. aformat=stereo to normalise
        #  3. fade in at start, fade out near end
        #  4. volume = music_volume
        music_filter = (
            f"[2:a]"
            f"atrim=0:9999,"          # allow long music (ffmpeg atrim is inclusive)
            f"asetpts=PTS-STARTPTS,"  # reset PTS so offset works
            f"volume={vol},"
            f"afade=t=in:st=0:d={fade_in_seconds},"
            f"afade=t=out:st=0:d={fade_out_seconds},"
            f"aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo"
            f"[music]"
        )

        run_ffmpeg(
            f"-i '{video_path}' -i '{voice_path}' -i '{music_path}' "
            f"-filter_complex "
            f"'{music_filter};"
            f"[1:a][music]amix=inputs=2:duration=first:dropout_transition=2,"
            f"aresample=48000[a]' "
            f"-map 0:v -map '[a]' "
            f"-c:v copy -c:a aac -b:a 192k -ar 48000 "
            f"'{output_path}'"
        )
        return output_path


# ---------------------------------------------------------------------------
# WatermarkApplicator
# ---------------------------------------------------------------------------

POSITIONS: Dict[str, str] = {
    "bottom-left":  "overlay={pad}:H-h-{pad}",
    "bottom-right": "overlay=W-w-{pad}:H-h-{pad}",
    "top-left":     "overlay={pad}:{pad}",
    "top-right":    "overlay=W-w-{pad}:{pad}",
    "center":       "overlay=(W-w)/2:(H-h)/2",
}


class WatermarkApplicator:
    """
    Overlay a PNG/SVG watermark (TKP logo) on a video.
    """

    def __init__(self) -> None:
        pass

    def apply(
        self,
        input_path: str,
        logo_path: str,
        output_path: str,
        *,
        position: str = "bottom-left",
        padding: int = 20,
        opacity: float = 0.10,
    ) -> str:
        """
        Apply a logo watermark.

        Args:
            input_path:   Source video.
            logo_path:    Watermark image (PNG with alpha preferred).
            output_path:  Destination MP4.
            position:     'bottom-left' | 'bottom-right' | 'top-left' |
                          'top-right' | 'center'
            padding:      Distance from the chosen edge (pixels).
            opacity:      Alpha multiplier applied to the logo (0.0 – 1.0).

        Returns:
            ``output_path``
        """
        os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)

        overlay_expr = POSITIONS.get(position, POSITIONS["bottom-left"]).format(pad=padding)

        run_ffmpeg(
            f"-i '{input_path}' -i '{logo_path}' "
            f"-filter_complex "
            f"'[1:v]format=rgba,colorchannelmixer=aa={opacity}[logo];"
            f"[0:v][logo]{overlay_expr}[out]' "
            f"-map '[out]' -map 0:a "
            f"-c:a copy "
            f"'{output_path}'"
        )
        return output_path


# ---------------------------------------------------------------------------
# PlatformExporter
# ---------------------------------------------------------------------------

# Default quality per platform (can be overridden via export(quality=...))
PLATFORM_QUALITY: Dict[str, str] = {
    "youtube":   "1080p",
    "tiktok":    "1080p",
    "instagram": "1080p",
    "linkedin":  "1080p",
}

# Default aspect ratio per platform
PLATFORM_ASPECT: Dict[str, str] = {
    "youtube":   "16:9",
    "tiktok":    "9:16",
    "instagram": "1:1",
    "linkedin":  "16:9",
}

PLATFORM_SETTINGS: Dict[str, Dict[str, Any]] = {
    "youtube":   {"audio_bitrate": "192k", "faststart": True},
    "tiktok":    {"audio_bitrate": "128k", "faststart": False},
    "instagram": {"audio_bitrate": "128k", "faststart": False},
    "linkedin":  {"audio_bitrate": "192k", "faststart": True},
}


class PlatformExporter:
    """
    Export a master video for a specific social platform with the correct
    codec settings, resolution, and optional metadata.

    Uses quality presets and aspect ratios from ffmpeg_presets.py.
    """

    def export(
        self,
        input_path: str,
        platform: str,
        output_path: str,
        *,
        quality: Optional[str] = None,
        aspect: Optional[str] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        speed: str = "fast",
        letterbox: bool = True,
    ) -> str:
        """
        Re-encode for a platform with platform-native quality and aspect ratio.

        Args:
            input_path:    Master video file.
            platform:      'youtube' | 'tiktok' | 'instagram' | 'linkedin'
            output_path:   Destination MP4.
            quality:       '720p' | '1080p' | '4k'.  Defaults to platform default.
            aspect:        '9:16' | '16:9' | '1:1' | '4:5'.  Defaults to platform default.
            title:         Video title embedded as metadata.
            description:   Video description embedded as metadata.
            speed:         x264 --preset (ultrafast … veryslow).
            letterbox:     True = pad bars; False = crop to fill.

        Returns:
            ``output_path``
        """
        platform_lower = platform.lower()
        if platform_lower not in PLATFORM_SETTINGS:
            raise ValueError(
                f"Unknown platform {platform!r}. "
                f"Choose from: {list(PLATFORM_SETTINGS.keys())}"
            )

        # Resolve quality and aspect — fall back to platform defaults
        q_name = quality or PLATFORM_QUALITY.get(platform_lower, DEFAULT_QUALITY)
        a_name = aspect   or PLATFORM_ASPECT.get(platform_lower, DEFAULT_ASPECT)

        params = get_encoding_params(q_name, a_name, speed=speed)
        s = PLATFORM_SETTINGS[platform_lower]

        os.makedirs(os.path.dirname(os.path.abspath(output_path)) or ".", exist_ok=True)

        # Build metadata args
        metadata_args = ""
        if title:
            metadata_args += f'-metadata title="{title}" '
        if description:
            desc = description[:5000]
            metadata_args += f'-metadata description="{desc}" '

        faststart_flag = "-movflags +faststart" if s["faststart"] else ""

        # Build video filter: scale+pad, then subtitles+watermark handled upstream
        vf = build_scale_vf(a_name, letterbox=letterbox)

        run_ffmpeg(
            f"-i '{input_path}' "
            f"{metadata_args}"
            f"-vf '{vf}' "
            f"-c:v libx264 {params['extra_video_args']} -preset {params['preset']} "
            f"-c:a aac -b:a {params['audio_bitrate']} -ar 48000 "
            f"{faststart_flag} "
            f"'{output_path}'"
        )
        return output_path


# ---------------------------------------------------------------------------
# VideoAssemblyLine — full orchestrator
# ---------------------------------------------------------------------------

DEFAULT_WATERMARK_LOGO: Dict[str, str] = {
    "productivity": "assets/logos/tkp-watermark-prod.svg",
    "growth":      "assets/logos/tkp-watermark-growth.svg",
}


class VideoAssemblyLine:
    """
    End-to-end video assembly pipeline with quality, aspect ratio, and
    intro/outro support.

    Usage::

        line = VideoAssemblyLine(channel="productivity", quality="1080p", aspect="9:16")
        result = line.assemble(
            video_clips=[{"path": "clip.mp4", "start": 5.0, "end": 12.3}],
            audio_path="tts.mp3",
            music_path="bg_music.mp3",
            subtitle_path=word_timings,
            output_basename="pw-001",
            intro=True,
            outro=True,
        )
        # result.master_file  → full-quality master
        # result.youtube_file → YouTube export
        # result.tiktok_file  → TikTok export

    Word timings (``subtitle_path``) format::

        [{"word": "...", "start": 0.0, "end": 0.5}, ...]

    Or pass a path to an existing .ASS / .SRT file as a string.
    """

    def __init__(
        self,
        channel: str = "productivity",
        *,
        quality: str = DEFAULT_QUALITY,
        aspect: str = DEFAULT_ASPECT,
        output_dir: Optional[str] = None,
        temp_dir: Optional[str] = None,
    ) -> None:
        self.channel   = channel
        self.quality   = quality
        self.aspect    = aspect
        self.output_dir = output_dir or os.path.join("output", channel)
        self.temp_dir   = temp_dir   or os.path.join(self.output_dir, "_temp")
        self.renderer   = SubtitleRenderer()

        # Resolve encoding params once
        self._enc_params = get_encoding_params(quality, aspect)

        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.temp_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # Public assemble()
    # ------------------------------------------------------------------

    def assemble(
        self,
        video_clips: List[Dict[str, Any]],
        audio_path: str,
        *,
        music_path: Optional[str] = None,
        subtitle_path: Optional[Union[str, List[Dict[str, Any]]]] = None,
        output_basename: str = "output",
        transition: str = "dissolve",
        transition_duration: float = 0.5,
        watermark_logo: Optional[str] = None,
        image_mode: bool = False,
        image_paths: Optional[List[str]] = None,
        duration_per_image: float = 3.0,
        # ── New parameters ───────────────────────────────────────────────
        intro: bool = False,
        outro: bool = False,
        music_volume: Optional[float] = None,
        music_fade_in: float = 1.0,
        music_fade_out: float = 2.0,
        subtitle_style: Optional[str] = None,
        watermark_position: str = "bottom-right",
        watermark_padding: int = 20,
        watermark_opacity: float = 0.10,
        quality: Optional[str] = None,
        aspect: Optional[str] = None,
        speed: str = "fast",
        letterbox: bool = True,
        # ── Motion Enhancement (TKP-86) ────────────────────────────────────
        motion_enhance: bool = False,
        motion_preset: str = "hailuo",
        motion_stabilize_first: bool = True,
        motion_from_fps: int = 24,
        motion_to_fps: int = 30,
    ) -> Dict[str, str]:
        """
        Run the full assembly pipeline synchronously.

        Accepts either ``video_clips`` (pre-generated clips) or ``image_mode=True``
        with ``image_paths`` (images → video → assembly).

        New in this version:
        - ``intro`` / ``outro``: prepend/append intro and outro clips
        - ``music_volume``: override default music level
        - ``music_fade_in`` / ``music_fade_out``: music fade durations
        - ``subtitle_style``: named style ('default', 'growth', 'subtle', 'top', 'center')
        - ``watermark_position``: 'bottom-right' (default) | 'bottom-left' | 'top-right' | ...
        - ``quality``: '720p' | '1080p' | '4k' (overrides constructor default)
        - ``aspect``: '9:16' | '16:9' | '1:1' | '4:5' (overrides constructor default)
        - ``speed``: x264 preset (ultrafast … veryslow)
        - ``letterbox``: True = pad bars; False = crop to fill

        Args:
            video_clips:         List of clip specs for trimming+concatenation.
                                 Each dict: ``{"path": str, "start": float, "end": float}``.
            audio_path:          TTS / narration audio (MP3).
            music_path:          Optional background music MP3.
            subtitle_path:        Word-timings list, .ASS path, or .SRT path.
            output_basename:     Base filename stem (no extension).
            transition:          'dissolve' | 'fade' | 'none'
            transition_duration: Seconds between clips.
            watermark_logo:      Path to logo file.  Defaults to TKP brand logo.
            image_mode:          Use ``image_paths`` instead of ``video_clips``.
            image_paths:         Ordered list of image paths (used when ``image_mode=True``).
            duration_per_image:  Seconds per image in image mode.
            intro:               Prepend intro clip (from assets/intro/).
            outro:               Append outro clip (from assets/outro/).
            music_volume:        Music volume (0.0–1.0).  Default: 0.15 (prod) / 0.12 (growth).
            music_fade_in:        Fade-in duration for background music (seconds).
            music_fade_out:       Fade-out duration for background music (seconds).
            subtitle_style:      Named subtitle style from SUBTITLE_STYLES.
            watermark_position:  Position for watermark overlay.
            watermark_padding:   Pixel distance from edge.
            watermark_opacity:   Logo opacity (0.0–1.0).
            quality:             Quality preset override.
            aspect:              Aspect ratio override.
            speed:               x264 --preset.
            letterbox:           True = letterbox bars; False = crop.
            motion_enhance:      Apply motion enhancement (stabilize + FPS interpolation) — TKP-86
            motion_preset:       'hailuo' (1080p 30fps stabilized) | 'standard' | 'upscale_only'
            motion_stabilize_first: Run stabilization before interpolation
            motion_from_fps:     Source FPS for interpolation (default 24)
            motion_to_fps:       Target FPS (default 30)

        Returns:
            Dict with keys: ``master_file``, ``youtube_file``, ``tiktok_file``,
            ``instagram_file``, ``linkedin_file``.
        """
        # Effective quality / aspect (instance default unless overridden)
        q_name = quality or self.quality
        a_name = aspect  or self.aspect
        enc_params = get_encoding_params(q_name, a_name, speed=speed)
        scale_vf = build_scale_vf(a_name, letterbox=letterbox)

        # ------------------------------------------------------------------
        # 1. Build the base video (clips or images)
        # ------------------------------------------------------------------
        if image_mode:
            if not image_paths:
                raise ValueError("image_mode=True requires image_paths")
            img_converter = ImageToVideoConverter(temp_dir=self.temp_dir)
            concat_path = os.path.join(self.temp_dir, f"{output_basename}_images.mp4")
            img_converter.image_sequence_to_video(
                image_paths,
                concat_path,
                duration_per_image=duration_per_image,
                transition=transition,
                transition_duration=transition_duration,
                scale_vf=scale_vf,
            )
        else:
            if not video_clips:
                raise ValueError("video_clips must not be empty (or use image_mode)")
            trim = VideoTrimmer(temp_dir=self.temp_dir)
            concat = VideoConcatinator(temp_dir=self.temp_dir)

            # Trim each clip
            trimmed: List[str] = []
            for clip in video_clips:
                t = trim.trim(
                    clip["path"],
                    clip["start"],
                    clip["end"],
                    scale_vf=scale_vf,
                )
                trimmed.append(t)

            # Concatenate
            concat_path = os.path.join(self.temp_dir, f"{output_basename}_concat.mp4")
            concat.concatenate(
                trimmed,
                concat_path,
                transition=transition,
                transition_duration=transition_duration,
            )

        # ------------------------------------------------------------------
        # 2. Mix audio (TTS + music with auto-sync)
        # ------------------------------------------------------------------
        mixer = AudioMixer(temp_dir=self.temp_dir)
        audio_mixed = os.path.join(self.temp_dir, f"{output_basename}_audio.mp4")

        if music_path and os.path.exists(music_path):
            mixer.mix(
                concat_path,
                audio_path,
                music_path,
                audio_mixed,
                music_volume=music_volume,
                channel=self.channel,
                fade_in_seconds=music_fade_in,
                fade_out_seconds=music_fade_out,
            )
        else:
            mixer.mix(
                concat_path,
                audio_path,
                music_path=None,
                output_path=audio_mixed,
                channel=self.channel,
            )

        # ------------------------------------------------------------------
        # 3. Burn subtitles
        # ------------------------------------------------------------------
        subtitled = os.path.join(self.output_dir, f"{output_basename}_subs.mp4")
        self._burn_subtitles(
            audio_mixed, subtitle_path, subtitled,
            subtitle_style=subtitle_style,
            aspect=a_name,
            letterbox=letterbox,
        )

        # ------------------------------------------------------------------
        # 4. Watermark
        # ------------------------------------------------------------------
        wm_path = os.path.join(self.output_dir, f"{output_basename}_wm.mp4")
        logo = watermark_logo or DEFAULT_WATERMARK_LOGO.get(self.channel)
        if logo and os.path.exists(logo):
            wm_applier = WatermarkApplicator()
            wm_applier.apply(
                subtitled, logo, wm_path,
                position=watermark_position,
                padding=watermark_padding,
                opacity=watermark_opacity,
            )
        else:
            shutil.copy2(subtitled, wm_path)

        # ------------------------------------------------------------------
        # 5. Intro / Outro wrap
        # ------------------------------------------------------------------
        wrapped = wm_path
        if intro or outro:
            io_mgr = IntroOutroManager(channel=self.channel)
            intro_outro_path = os.path.join(self.output_dir, f"{output_basename}_wrapped.mp4")
            io_mgr.wrap(
                wm_path,
                intro_outro_path,
                aspect=a_name,
            )
            wrapped = intro_outro_path

        # ------------------------------------------------------------------
        # 6. Motion Enhancement — TKP-86 (stabilize + interpolate + upscale)
        # ------------------------------------------------------------------
        export_input = wrapped
        if motion_enhance and ffmpeg_available():
            enhanced = os.path.join(self.temp_dir, f"{output_basename}_motion.mp4")
            enhancer = MotionEnhancer(preset=motion_preset)
            result = enhancer.full_pipeline(
                wrapped,
                enhanced,
                from_fps=motion_from_fps,
                to_fps=motion_to_fps,
                aspect=a_name,
                stabilize_first=motion_stabilize_first,
            )
            if result.success:
                export_input = enhanced
            else:
                # Fallback: use non-enhanced if motion processing fails
                export_input = wrapped

        # ------------------------------------------------------------------
        # 7. Platform exports
        # ------------------------------------------------------------------
        master_path = os.path.join(self.output_dir, f"{output_basename}_master.mp4")
        yt_path     = os.path.join(self.output_dir, f"{output_basename}_youtube.mp4")
        tiktok_path = os.path.join(self.output_dir, f"{output_basename}_tiktok.mp4")
        ig_path     = os.path.join(self.output_dir, f"{output_basename}_instagram.mp4")
        li_path     = os.path.join(self.output_dir, f"{output_basename}_linkedin.mp4")

        shutil.copy2(export_input, master_path)

        exporter = PlatformExporter()
        exporter.export(export_input, "youtube",   yt_path,
                        quality=q_name, aspect=a_name, speed=speed, letterbox=letterbox)
        exporter.export(export_input, "tiktok",    tiktok_path,
                        quality=q_name, aspect=a_name, speed=speed, letterbox=letterbox)
        exporter.export(export_input, "instagram", ig_path,
                        quality=q_name, aspect=a_name, speed=speed, letterbox=letterbox)
        exporter.export(export_input, "linkedin",  li_path,
                        quality=q_name, aspect=a_name, speed=speed, letterbox=letterbox)

        return {
            "master_file":    master_path,
            "youtube_file":   yt_path,
            "tiktok_file":    tiktok_path,
            "instagram_file": ig_path,
            "linkedin_file":  li_path,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _burn_subtitles(
        self,
        input_path: str,
        subtitle_path: Optional[Union[str, List[Dict[str, Any]]]],
        output_path: str,
        *,
        subtitle_style: Optional[str] = None,
        aspect: str = DEFAULT_ASPECT,
        letterbox: bool = True,
    ) -> None:
        """
        Render subtitle source to an .ASS file, then hard-burn with FFmpeg.

        Args:
            subtitle_path:  Word-timings list, .ASS path, or .SRT path.  None = skip.
            subtitle_style: Named style from SUBTITLE_STYLES.
            aspect:         Target aspect ratio (for subtitle positioning).
            letterbox:      True = letterbox bars present (subtitle stays at edge).
        """
        if subtitle_path is None:
            shutil.copy2(input_path, output_path)
            return

        # Auto-detect type
        if isinstance(subtitle_path, str):
            ass_source = subtitle_path
        else:
            # word timings list → generate .ASS
            cues = self.renderer.group_words(subtitle_path)
            ass_source = None  # will be created below
        # Default to channel-based style; explicit style= param overrides
        default_style = "growth" if self.channel == "growth" else "default"
        chosen_style = subtitle_style or default_style

        # On Windows, FFmpeg's libass cannot parse paths containing colons (e.g. C:\... or
        # C:/...).  Work around this by always copying the .ASS file to the CWD with a
        # short unique name, then referencing it with a colon-free relative path.
        import uuid as _uuid
        cwd_ass_name = f"_tkp_sub_{os.getpid()}_{_uuid.uuid4().hex[:8]}.ass"
        cwd_ass_path = os.path.join(os.getcwd(), cwd_ass_name)

        if ass_source is None:
            # Generate .ASS from word timings
            cues = self.renderer.group_words(subtitle_path)
            self.renderer.to_ass(cues, cwd_ass_path, style=chosen_style)
        else:
            shutil.copy2(ass_source, cwd_ass_path)

        try:
            scale_vf = build_scale_vf(aspect, letterbox=letterbox)
            # Use the CWD-relative ASS filename (no path, no colons)
            # FFmpeg on Windows will find it because CWD is implicitly the base.
            import re as _re
            dim_match = _re.search(r"([0-9]+):([0-9]+)", scale_vf)
            orig_size = f"{dim_match.group(1)}x{dim_match.group(2)}" if dim_match else "1080x1920"
            vf = f"'{scale_vf},ass={cwd_ass_name}:original_size={orig_size}'"

            run_ffmpeg(
                f"-i '{input_path}' -vf {vf} "
                f"-c:v libx264 -crf 18 -preset fast "
                f"-c:a copy "
                f"'{output_path}'"
            )
        finally:
            # Clean up CWD ASS file
            try:
                os.remove(cwd_ass_path)
            except OSError:
                pass

    # ------------------------------------------------------------------
    # Preview video (TKP-68)
    # ------------------------------------------------------------------

    def preview_video(
        self,
        scenes: List[Dict[str, Any]],
        output_basename: str = "preview",
        *,
        progress_callback=None,
        image_mode: bool = True,
        duration_per_image: float = 3.0,
        transition: str = "dissolve",
        watermark_logo: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Assemble a preview video from storyboard scenes.

        This is a streamlined version of :meth:`assemble` for rapid previews.
        It skips intro/outro and full platform exports, returning only the master
        preview file plus a scene-by-scene breakdown.

        Args:
            scenes: List of scene dicts. Each dict must have:
                - ``image_prompt``: str (used to generate or locate image)
                - ``duration``: float (seconds)
                - ``transition``: str (optional, default "dissolve")
                - ``script_segment``: str (optional, narration text)
                - ``shot_type``: str (optional)
                - ``camera_movement``: str (optional)
                Additionally, if ``image_path`` is present it will be used directly;
                otherwise a placeholder image is created.

            output_basename: Filename stem for the output.
            progress_callback: Callable[float, str] — called with (0.0–1.0, status_message).
                             Use this to drive a progress bar in the SaaS UI.
            image_mode: Always True for previews (images → video).
            duration_per_image: Seconds per scene (uses scene.duration if available).
            transition: 'dissolve' | 'fade' | 'wipe' | 'none'.
            watermark_logo: Optional logo path.

        Returns dict with keys:
            - ``preview_file``: str path to the assembled preview MP4
            - ``total_duration``: float total seconds
            - ``scene_count``: int number of scenes
            - ``scenes``: list of dicts with per-scene info (path, duration, transition)
            - ``ffmpeg_log``: str or None (last error if assembly failed)
        """
        import logging as _logging
        _logger = _logging.getLogger(__name__)

        def _report(progress: float, msg: str):
            if progress_callback:
                progress_callback(progress, msg)
            _logger.info(f"[Preview {int(progress*100)}%] {msg}")

        _report(0.05, "Starting preview assembly...")

        # ── Step 1: resolve per-scene images ────────────────────────────────
        scene_image_paths: list[str] = []
        scene_durations: list[float] = []
        scene_info: list[dict] = []

        for i, scene in enumerate(scenes):
            duration = scene.get("duration", duration_per_image)
            scene_durations.append(duration)

            image_path = scene.get("image_path")
            if image_path:
                scene_image_paths.append(image_path)
            else:
                # Generate a placeholder image for this scene
                placeholder_path = self._make_scene_placeholder(
                    scene.get("image_prompt", f"Scene {i+1}"),
                    scene.get("shot_type", "medium"),
                    scene.get("camera_movement", "static"),
                    i,
                )
                scene_image_paths.append(placeholder_path)

            scene_info.append({
                "scene_number": i + 1,
                "duration": duration,
                "transition": scene.get("transition", transition),
                "image_path": scene_image_paths[-1],
            })

        _report(0.15, f"Resolved {len(scene_image_paths)} scene images")

        # ── Step 2: assemble images → video ────────────────────────────────
        _report(0.20, "Assembling preview video...")

        # Convert each image to a clip with its specific duration, then concatenate
        import os as _os
        clip_paths: list[str] = []
        img_converter = ImageToVideoConverter(temp_dir=self.temp_dir)
        for i, (img_path, scene_dur) in enumerate(zip(scene_image_paths, scene_durations)):
            clip_out = _os.path.join(self.temp_dir, f"{output_basename}_clip_{i:04d}.mp4")
            img_converter.image_to_video(
                img_path, clip_out,
                duration=scene_dur,
                fps=30,
                crf=18,
                width=1080,
                height=1920,
                zoompan=False,
                scale_vf=build_scale_vf(self.aspect),
            )
            clip_paths.append(clip_out)
            _report(0.20 + 0.40 * (i / len(scene_image_paths)),
                    f"Converted scene {i+1}/{len(scene_image_paths)}")

        # Concatenate clips
        concat = VideoConcatinator(temp_dir=self.temp_dir)
        concat_path = _os.path.join(self.temp_dir, f"{output_basename}_images.mp4")
        concat.concatenate(clip_paths, concat_path, transition=transition)
        _report(0.70, "Image sequence assembled")

        # ── Step 3: optional watermark on preview ──────────────────────────
        preview_path = concat_path
        if watermark_logo:
            if _os.path.exists(watermark_logo):
                _report(0.80, "Applying watermark...")
                wm_applier = WatermarkApplicator()
                wm_path = _os.path.join(self.output_dir, f"{output_basename}_wm.mp4")
                wm_applier.apply(
                    concat_path, watermark_logo, wm_path,
                    position="bottom-right",
                    opacity=0.10,
                )
                preview_path = wm_path

        _report(0.90, "Finalizing preview...")

        # ── Step 4: finalize ────────────────────────────────────────────────
        final_preview = _os.path.join(self.output_dir, f"{output_basename}_preview.mp4")
        shutil.copy2(preview_path, final_preview)

        total_dur = sum(scene_durations)

        _report(1.0, f"Preview ready: {final_preview}")

        return {
            "preview_file": final_preview,
            "total_duration": total_dur,
            "scene_count": len(scenes),
            "scenes": scene_info,
            "ffmpeg_log": None,
        }

    def _make_scene_placeholder(
        self,
        prompt: str,
        shot_type: str,
        camera_movement: str,
        scene_index: int,
    ) -> str:
        """
        Create a placeholder image for a scene when no real image is available.
        Uses PIL to render a text label with scene metadata.
        """
        try:
            from PIL import Image, ImageDraw, ImageFont
        except ImportError:
            # PIL not available — return a dummy path
            import os
            dummy = os.path.join(self.temp_dir, f"scene_{scene_index+1}_placeholder.png")
            return dummy

        w, h = 1024, 1024
        color_base = (20 + (scene_index * 37) % 30, 30 + (scene_index * 19) % 20, 60)
        img = Image.new("RGB", (w, h), color_base)
        draw = ImageDraw.Draw(img)

        try:
            font = ImageFont.truetype("arial.ttf", 28)
        except Exception:
            font = ImageFont.load_default()

        label_lines = [
            f"SCENE {scene_index + 1}",
            f"Shot: {shot_type}",
            f"Movement: {camera_movement}",
            "",
            prompt[:80] + ("..." if len(prompt) > 80 else ""),
        ]

        y = 80
        for line in label_lines:
            draw.text((40, y), line, fill=(200, 200, 200), font=font)
            y += 40

        out_path = os.path.join(self.temp_dir, f"scene_{scene_index+1}_placeholder.png")
        img.save(out_path)
        return out_path# ---------------------------------------------------------------------------
# Standalone self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("video_assembler.py loaded.")
    ok = ffmpeg_available()
    print(f"FFmpeg available: {'YES' if ok else 'NO — install from https://ffmpeg.org'}")

    # Smoke-test SubtitleRenderer
    sr = SubtitleRenderer()
    timings = [
        {"word": "This",   "start": 0.0,  "end": 0.3},
        {"word": "is",     "start": 0.35, "end": 0.45},
        {"word": "a",      "start": 0.46, "end": 0.5},
        {"word": "test!",  "start": 0.52, "end": 0.9},
    ]
    cues = sr.group_words(timings)
    print(f"SubtitleRenderer: {len(cues)} cue(s) from {len(timings)} words")
    for c in cues:
        print(f"  [{sr._to_srt_time(c['start'])} → {sr._to_srt_time(c['end'])}] {c['text']}")

    with tempfile.TemporaryDirectory(prefix="tkp_test_") as tmp:
        ass_out = os.path.join(tmp, "test.ass")
        sr.to_ass(cues, ass_out)
        srt_out = os.path.join(tmp, "test.srt")
        sr.to_srt(cues, srt_out)
        print(f"Wrote: {ass_out}, {srt_out}")
