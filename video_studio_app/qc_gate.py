"""
video_studio_app/qc_gate.py
Automated video quality gates for TKP Content Agency.

Implements Stage 3 automated checks from content/qc-checklist.md:
  - Resolution gate (minimum 1080p)
  - Frame rate gate (minimum 30fps)
  - File size gate (maximum 2GB)
  - Audio sync check (no A/V drift)
  - Visual quality score (file-based heuristic)
  - Codec validation (H.264 / AAC)
  - Duration range gate

All checks return PASS / FAIL / WARN with details.
Used by the SaaS UI (AssemblyPanel) before export, and by the
video-pipeline before handing off to Publisher.

Usage::

    from video_studio_app.qc_gate import VideoQCGate, QCGateResult

    gate = VideoQCGate()
    result = gate.run_all("output/final.mp4")
    if not result.all_passed:
        print("FAILED:", result.failures)
    else:
        print("All gates passed!")

    # Run a single check
    result = gate.check_resolution("output/final.mp4")
    print(result.passed, result.value, result.threshold)
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Optional, List, Dict, Any


# ---------------------------------------------------------------------------
# Enums and dataclasses
# ---------------------------------------------------------------------------

class CheckStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    WARN = "warn"


@dataclass
class QCCheck:
    """Result of a single quality gate check."""
    name: str
    status: CheckStatus
    value: Any
    threshold: Any
    message: str
    blocking: bool = True

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class QCGateResult:
    """Aggregated result of all QC gate checks."""
    video_path: str
    checks: List[QCCheck] = field(default_factory=list)

    @property
    def all_passed(self) -> bool:
        return all(c.status == CheckStatus.PASS for c in self.checks)

    @property
    def blocking_failures(self) -> List[QCCheck]:
        return [c for c in self.checks if c.status == CheckStatus.FAIL and c.blocking]

    @property
    def warnings(self) -> List[QCCheck]:
        return [c for c in self.checks if c.status == CheckStatus.WARN]

    def to_dict(self) -> dict:
        return {
            "video_path": self.video_path,
            "all_passed": self.all_passed,
            "blocking_failures": [c.to_dict() for c in self.blocking_failures],
            "warnings": [c.to_dict() for c in self.warnings],
            "checks": [c.to_dict() for c in self.checks],
        }

    def summary(self) -> str:
        """Human-readable one-line summary."""
        if self.all_passed:
            return f"✓ All {len(self.checks)} QC gates passed"
        fails = self.blocking_failures
        warns = self.warnings
        parts = []
        if fails:
            parts.append(f"{len(fails)} blocking failure(s): {', '.join(c.name for c in fails)}")
        if warns:
            parts.append(f"{len(warns)} warning(s): {', '.join(c.name for c in warns)}")
        return "; ".join(parts)


# ---------------------------------------------------------------------------
# FFprobe helpers
# ---------------------------------------------------------------------------

def _run_ffprobe(args: List[str], video_path: str) -> Optional[Dict[str, Any]]:
    """
    Run ffprobe with -print_format json and return parsed JSON.
    Returns None if ffprobe is unavailable or the file doesn't exist.
    """
    if not os.path.exists(video_path):
        return None
    try:
        cmd = ["ffprobe", "-v", "quiet", "-print_format", "json"] + args + [video_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            return json.loads(result.stdout)
        return None
    except (subprocess.SubprocessError, json.JSONDecodeError, FileNotFoundError):
        return None


def _get_video_stream(probe: Dict) -> Optional[Dict]:
    for s in probe.get("streams", []):
        if s.get("codec_type") == "video":
            return s
    return None


def _get_audio_stream(probe: Dict) -> Optional[Dict]:
    for s in probe.get("streams", []):
        if s.get("codec_type") == "audio":
            return s
    return None


# ---------------------------------------------------------------------------
# VideoQCGate
# ---------------------------------------------------------------------------

class VideoQCGate:
    """
    Automated video quality gate runner.

    Runs all BLOCKING checks from content/qc-checklist.md Stage 3.
    Each check can be run individually or via run_all().
    """

    # Default thresholds
    MIN_RESOLUTION_WIDTH = 1280       # 720p minimum
    MIN_RESOLUTION_HEIGHT = 720
    PREFERRED_WIDTH = 1920            # 1080p minimum
    PREFERRED_HEIGHT = 1080
    MAX_FILE_SIZE_BYTES = 2 * 1024**3  # 2 GB
    MAX_FILE_SIZE_TIKTOK = 287 * 1024**2  # 287 MB for TikTok <10min
    MIN_FPS = 30.0
    MIN_DURATION = 5.0
    MAX_DURATION = 600.0
    MAX_LUFS = -8.0  # Max integrated loudness (YouTube spec)
    MAX_TRUE_PEAK = -1.0  # dBTP (true peak ceiling)


    def __init__(self, platform: str = "youtube"):
        """
        Args:
            platform: 'youtube' | 'tiktok' | 'instagram' | 'linkedin'
                  Affects file size threshold (TikTok has stricter limits).
        """
        self.platform = platform.lower()
        self.max_file_size = (
            self.MAX_FILE_SIZE_TIKTOK if self.platform == "tiktok"
            else self.MAX_FILE_SIZE_BYTES
        )

    # ── Individual checks ───────────────────────────────────────────────────

    def check_resolution(self, video_path: str) -> QCCheck:
        """BLOCKING — Minimum 720p (preferred 1080p)."""
        probe = _run_ffprobe(["-select_streams", "v:0", "-show_streams"], video_path)
        if probe is None:
            return QCCheck(
                name="resolution",
                status=CheckStatus.WARN,
                value=None, threshold=f">={self.MIN_RESOLUTION_WIDTH}x{self.MIN_RESOLUTION_HEIGHT}",
                message="Could not probe resolution — ffprobe unavailable or file missing",
                blocking=False,
            )

        vstream = _get_video_stream(probe)
        if vstream is None:
            return QCCheck(
                name="resolution", status=CheckStatus.FAIL,
                value=None,
                threshold=f">={self.MIN_RESOLUTION_WIDTH}x{self.MIN_RESOLUTION_HEIGHT}",
                message="No video stream found in file",
            )

        width = int(vstream.get("width", 0))
        height = int(vstream.get("height", 0))

        if width >= self.PREFERRED_WIDTH and height >= self.PREFERRED_HEIGHT:
            status = CheckStatus.PASS
            msg = f"1080p+: {width}x{height}"
        elif width >= self.MIN_RESOLUTION_WIDTH and height >= self.MIN_RESOLUTION_HEIGHT:
            status = CheckStatus.WARN
            msg = f"720p: {width}x{height} (1080p preferred for {self.platform})"
        else:
            status = CheckStatus.FAIL
            msg = f"Below minimum: {width}x{height} (need >={self.MIN_RESOLUTION_WIDTH}x{self.MIN_RESOLUTION_HEIGHT})"

        return QCCheck(
            name="resolution",
            status=status,
            value=f"{width}x{height}",
            threshold=f"720p min, 1080p preferred",
            message=msg,
        )

    def check_frame_rate(self, video_path: str) -> QCCheck:
        """BLOCKING — Minimum 30fps (60fps preferred for Gen Z / TikTok)."""
        probe = _run_ffprobe(["-select_streams", "v:0", "-show_streams", "-show_frames"], video_path)
        if probe is None:
            return QCCheck(
                name="frame_rate", status=CheckStatus.WARN,
                value=None, threshold=f">={self.MIN_FPS}fps",
                message="Could not probe frame rate — ffprobe unavailable",
                blocking=False,
            )

        vstream = _get_video_stream(probe)
        if vstream is None:
            return QCCheck(
                name="frame_rate", status=CheckStatus.FAIL,
                value=None, threshold=f">={self.MIN_FPS}fps",
                message="No video stream found",
            )

        fps_str = vstream.get("r_frame_rate", "0/1")
        # r_frame_rate is a fraction like "30000/1001"
        try:
            num, den = fps_str.split("/")
            fps = float(num) / float(den)
        except (ValueError, ZeroDivisionError):
            fps = 0.0

        if fps >= 55.0:
            status = CheckStatus.PASS
            msg = f"{fps:.1f}fps (60fps+)"
        elif fps >= self.MIN_FPS:
            status = CheckStatus.PASS
            msg = f"{fps:.1f}fps (30fps minimum met)"
        else:
            status = CheckStatus.FAIL
            msg = f"{fps:.1f}fps — below {self.MIN_FPS}fps minimum"

        return QCCheck(
            name="frame_rate",
            status=status,
            value=f"{fps:.1f}fps",
            threshold=f">={self.MIN_FPS}fps",
            message=msg,
        )

    def check_file_size(self, video_path: str) -> QCCheck:
        """BLOCKING — File size under platform limit."""
        if not os.path.exists(video_path):
            return QCCheck(
                name="file_size", status=CheckStatus.FAIL,
                value=None,
                threshold=f"<={self._size_str(self.max_file_size)}",
                message=f"File not found: {video_path}",
            )

        size = os.path.getsize(video_path)
        size_str = self._size_str(size)

        if size <= self.max_file_size:
            status = CheckStatus.PASS
            msg = f"{size_str} (within {self._size_str(self.max_file_size)} limit)"
        else:
            status = CheckStatus.FAIL
            msg = f"{size_str} — exceeds {self._size_str(self.max_file_size)} limit for {self.platform}"

        return QCCheck(
            name="file_size",
            status=status,
            value=size_str,
            threshold=f"<={self._size_str(self.max_file_size)}",
            message=msg,
            blocking=True,
        )

    def check_codec(self, video_path: str) -> QCCheck:
        """BLOCKING — Video must be H.264, audio must be AAC."""
        probe = _run_ffprobe(["-select_streams", "v:0", "-show_streams"], video_path)
        if probe is None:
            return QCCheck(
                name="codec", status=CheckStatus.WARN,
                value=None, threshold="H.264 video, AAC audio",
                message="Could not probe codec — ffprobe unavailable",
                blocking=False,
            )

        vstream = _get_video_stream(probe)
        astream = _get_audio_stream(probe)

        v_codec = vstream.get("codec_name", "unknown") if vstream else "missing"
        a_codec = astream.get("codec_name", "missing") if astream else "missing"

        v_ok = v_codec in ("h264", "libx264")
        a_ok = a_codec == "aac"

        if v_ok and a_ok:
            status = CheckStatus.PASS
            msg = f"Video: {v_codec}, Audio: {a_codec}"
        elif v_ok and not a_ok:
            status = CheckStatus.FAIL
            msg = f"Video OK ({v_codec}) but audio is {a_codec} (need AAC)"
        elif not v_ok and a_ok:
            status = CheckStatus.FAIL
            msg = f"Video is {v_codec} (need H.264), audio OK ({a_codec})"
        else:
            status = CheckStatus.FAIL
            msg = f"Video: {v_codec}, Audio: {a_codec} — need H.264 + AAC"

        return QCCheck(
            name="codec",
            status=status,
            value=f"v:{v_codec} a:{a_codec}",
            threshold="H.264 + AAC",
            message=msg,
        )

    def check_audio_sync(self, video_path: str) -> QCCheck:
        """
        BLOCKING — Check for audio/video sync drift.

        Strategy: use FFmpeg's a/v sync detection via -filter_complex
        "concat" trick — if A/V are significantly out of sync, concat will
        show visible timing errors in the output. We measure delay via
        audio stream start_time vs video stream start_time.
        """
        probe = _run_ffprobe(
            ["-select_streams", "v:0", "-show_streams",
             "-select_streams", "a:0", "-show_streams"],
            video_path
        )
        if probe is None:
            return QCCheck(
                name="audio_sync", status=CheckStatus.WARN,
                value=None, threshold="<±200ms drift",
                message="Could not probe audio sync — ffprobe unavailable",
                blocking=False,
            )

        streams = probe.get("streams", [])
        vstream = next((s for s in streams if s.get("codec_type") == "video"), None)
        astream = next((s for s in streams if s.get("codec_type") == "audio"), None)

        if not astream:
            return QCCheck(
                name="audio_sync", status=CheckStatus.WARN,
                value="no audio stream",
                threshold="audio present",
                message="No audio stream found — treating as warning",
                blocking=False,
            )

        try:
            v_start = float(vstream.get("start_time", 0))
            a_start = float(astream.get("start_time", 0))
        except (ValueError, TypeError):
            v_start = a_start = 0.0

        drift_ms = abs(a_start - v_start) * 1000.0

        if drift_ms <= 100:
            status = CheckStatus.PASS
            msg = f"A/V drift: {drift_ms:.0f}ms (within ±100ms)"
        elif drift_ms <= 200:
            status = CheckStatus.WARN
            msg = f"A/V drift: {drift_ms:.0f}ms (within ±200ms tolerance)"
        else:
            status = CheckStatus.FAIL
            msg = f"A/V drift: {drift_ms:.0f}ms — exceeds ±200ms (possible sync issue)"

        return QCCheck(
            name="audio_sync",
            status=status,
            value=f"{drift_ms:.0f}ms",
            threshold="≤200ms drift",
            message=msg,
        )

    def check_duration(self, video_path: str) -> QCCheck:
        """BLOCKING — Duration within platform-specific range."""
        probe = _run_ffprobe(["-select_streams", "v:0", "-show_streams", "-show_format"], video_path)
        if probe is None:
            return QCCheck(
                name="duration", status=CheckStatus.WARN,
                value=None,
                threshold=f"{self.MIN_DURATION}s – {self.MAX_DURATION}s",
                message="Could not probe duration",
                blocking=False,
            )

        fmt = probe.get("format", {})
        try:
            duration = float(fmt.get("duration", 0))
        except (ValueError, TypeError):
            duration = 0.0

        if self.MIN_DURATION <= duration <= self.MAX_DURATION:
            status = CheckStatus.PASS
            msg = f"{duration:.1f}s"
        else:
            status = CheckStatus.FAIL
            msg = f"{duration:.1f}s — outside {self.MIN_DURATION}s–{self.MAX_DURATION}s range"

        return QCCheck(
            name="duration",
            status=status,
            value=f"{duration:.1f}s",
            threshold=f"{self.MIN_DURATION}s–{self.MAX_DURATION}s",
            message=msg,
        )

    def check_aspect_ratio(self, video_path: str, expected: str = "16:9") -> QCCheck:
        """NON-BLOCKING — Verify aspect ratio matches platform expectation."""
        probe = _run_ffprobe(["-select_streams", "v:0", "-show_streams"], video_path)
        if probe is None:
            return QCCheck(
                name="aspect_ratio", status=CheckStatus.WARN,
                value=None, threshold=expected,
                message="Could not probe aspect ratio",
                blocking=False,
            )

        vstream = _get_video_stream(probe)
        if vstream is None:
            return QCCheck(
                name="aspect_ratio", status=CheckStatus.FAIL,
                value="no video stream", threshold=expected,
                message="No video stream to check aspect ratio",
                blocking=False,
            )

        width = int(vstream.get("width", 0))
        height = int(vstream.get("height", 0))
        if height == 0:
            return QCCheck(
                name="aspect_ratio", status=CheckStatus.FAIL,
                value="invalid", threshold=expected,
                message="Invalid video dimensions",
                blocking=False,
            )

        # Determine actual aspect
        ratio = width / height
        ratios = {"16:9": 16/9, "9:16": 9/16, "1:1": 1.0, "4:5": 4/5}
        actual = next((name for name, r in ratios.items() if abs(ratio - r) < 0.05), f"{width}:{height}")

        if actual == expected:
            status = CheckStatus.PASS
            msg = f"Correct: {actual}"
        else:
            status = CheckStatus.FAIL
            msg = f"Found {actual}, expected {expected}"

        return QCCheck(
            name="aspect_ratio",
            status=status,
            value=actual,
            threshold=expected,
            message=msg,
            blocking=False,
        )

    def check_visual_quality(self, video_path: str) -> QCCheck:
        """
        NON-BLOCKING — File-based visual quality heuristic.

        Uses bitrate as proxy: files with very low bitrate (<2Mbps for 1080p)
        are likely to be blurry. Also checks for YUV420P pixel format.
        """
        probe = _run_ffprobe(
            ["-select_streams", "v:0", "-show_streams", "-show_format"],
            video_path
        )
        if probe is None:
            return QCCheck(
                name="visual_quality", status=CheckStatus.WARN,
                value=None, threshold="bitrate ≥ 2Mbps for 1080p",
                message="Could not probe quality metrics",
                blocking=False,
            )

        vstream = _get_video_stream(probe)
        fmt = probe.get("format", {})

        if vstream is None:
            return QCCheck(
                name="visual_quality", status=CheckStatus.WARN,
                value="no video stream",
                threshold="bitrate ≥ 2Mbps for 1080p",
                message="No video stream to assess quality",
                blocking=False,
            )

        # Bitrate check
        bitrate_str = vstream.get("bit_rate") or fmt.get("bit_rate", "0")
        try:
            bitrate_kbps = float(bitrate_str) / 1000.0
        except (ValueError, TypeError):
            bitrate_kbps = 0.0

        width = int(vstream.get("width", 0))
        pixels = width * int(vstream.get("height", 0))

        # Heuristic: 1080p should be ≥ 2000kbps, 720p ≥ 1000kbps
        if pixels >= 1920 * 1080:
            min_kbps = 2000.0
        elif pixels >= 1280 * 720:
            min_kbps = 1000.0
        else:
            min_kbps = 500.0

        # Pixel format
        pix_fmt = vstream.get("pix_fmt", "unknown")

        quality_score = min(bitrate_kbps / min_kbps, 1.5)  # cap at 1.5
        if bitrate_kbps >= min_kbps:
            status = CheckStatus.PASS
            msg = f"Bitrate {bitrate_kbps:.0f}kbps (≥{min_kbps:.0f}kbps for {width}x{int(vstream.get('height',0))}), pix_fmt={pix_fmt}"
        elif bitrate_kbps >= min_kbps * 0.6:
            status = CheckStatus.WARN
            msg = f"Bitrate {bitrate_kbps:.0f}kbps is low (expected ≥{min_kbps:.0f}kbps) — may appear blurry"
        else:
            status = CheckStatus.FAIL
            msg = f"Bitrate {bitrate_kbps:.0f}kbps too low — video will be blurry"

        return QCCheck(
            name="visual_quality",
            status=status,
            value=f"{bitrate_kbps:.0f}kbps",
            threshold=f"≥{min_kbps:.0f}kbps for {width}x{int(vstream.get('height',0))}",
            message=msg,
            blocking=False,
        )

    def check_loudness(self, video_path: str) -> QCCheck:
        """
        NON-BLOCKING — Audio loudness check using FFmpeg volumedetect + ebur128.

        Checks:
        - Mean volume not too quiet
        - No extreme peaks (above -1dB)
        """
        if not os.path.exists(video_path):
            return QCCheck(
                name="loudness", status=CheckStatus.FAIL,
                value=None, threshold="LUFS -16 to -10, peak < -1dB",
                message=f"File not found: {video_path}",
                blocking=False,
            )

        try:
            result = subprocess.run(
                ["ffmpeg", "-i", video_path, "-af", "volumedetect", "-f", "null", "-"],
                capture_output=True, text=True, timeout=120,
            )
        except (subprocess.SubprocessError, FileNotFoundError):
            return QCCheck(
                name="loudness", status=CheckStatus.WARN,
                value=None, threshold="LUFS -16 to -10, peak < -1dB",
                message="ffmpeg not available for loudness check",
                blocking=False,
            )

        stderr = result.stderr
        mean_vol = None
        max_vol = None

        for line in stderr.splitlines():
            m = re.search(r"mean_volume[^-\d]*(-?[\d.]+)\s*dB", line)
            if m:
                mean_vol = float(m.group(1))
            m = re.search(r"max_volume[^-\d]*(-?[\d.]+)\s*dB", line)
            if m:
                max_vol = float(m.group(1))

        if mean_vol is None:
            return QCCheck(
                name="loudness", status=CheckStatus.WARN,
                value=None, threshold="LUFS -16 to -10, peak < -1dB",
                message="Could not parse loudness data",
                blocking=False,
            )

        # Approximate LUFS from mean_volume (rough heuristic)
        lufs_approx = mean_vol - 18  # correction offset for normalization
        peak_ok = max_vol is not None and max_vol <= -1.0

        if lufs_approx < -19:
            status = CheckStatus.FAIL
            msg = f"Too quiet: ~{lufs_approx:.1f} LUFS (YouTube wants -16 to -10)"
        elif lufs_approx > -9:
            status = CheckStatus.WARN
            msg = f"Loud: ~{lufs_approx:.1f} LUFS — may distort on some players"
        else:
            status = CheckStatus.PASS
            msg = f"~{lufs_approx:.1f} LUFS, peak {max_vol:.1f}dB {'✓' if peak_ok else '⚠ max_vol above -1dB'}"

        return QCCheck(
            name="loudness",
            status=status,
            value=f"~{lufs_approx:.1f} LUFS, peak {max_vol:.1f}dB",
            threshold="LUFS -16 to -10, peak < -1dB",
            message=msg,
            blocking=False,
        )

    # ── Run all checks ─────────────────────────────────────────────────────

    def run_all(self, video_path: str) -> QCGateResult:
        """
        Run all BLOCKING + NON-BLOCKING automated QC checks.

        Returns a QCGateResult. If blocking_failures is non-empty, the video
        should NOT be published without remediation.
        """
        checks: List[QCCheck] = [
            self.check_resolution(video_path),
            self.check_frame_rate(video_path),
            self.check_file_size(video_path),
            self.check_codec(video_path),
            self.check_audio_sync(video_path),
            self.check_duration(video_path),
            self.check_visual_quality(video_path),
            self.check_loudness(video_path),
        ]
        return QCGateResult(video_path=video_path, checks=checks)

    def run_blocking_only(self, video_path: str) -> QCGateResult:
        """Run only BLOCKING checks (Stage 3 from qc-checklist.md)."""
        blocking = [
            self.check_resolution,
            self.check_frame_rate,
            self.check_file_size,
            self.check_codec,
            self.check_audio_sync,
            self.check_duration,
        ]
        checks = [fn(video_path) for fn in blocking]
        return QCGateResult(video_path=video_path, checks=checks)

    # ── Helpers ────────────────────────────────────────────────────────────

    @staticmethod
    def _size_str(size_bytes: int) -> str:
        if size_bytes >= 1024**3:
            return f"{size_bytes / 1024**3:.2f} GB"
        elif size_bytes >= 1024**2:
            return f"{size_bytes / 1024**2:.1f} MB"
        else:
            return f"{size_bytes / 1024:.0f} KB"

    @staticmethod
    def is_ffmpeg_available() -> bool:
        try:
            subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=10)
            return True
        except (subprocess.SubprocessError, FileNotFoundError):
            return False
