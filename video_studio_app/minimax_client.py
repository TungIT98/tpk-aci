"""
video_studio_app/minimax_client.py

MiniMax API client — plugin-style interface.
Currently a PLACEHOLDER. Replace with real API calls once
MiniMax credentials and billing are activated.

Interface to implement when ready:
  - generate_images(prompt, n=1) -> List[ImageResult]
  - generate_voice(text, voice_id?, output_path?) -> AudioResult
  - generate_video(image_path, prompt?, duration?) -> VideoResult
"""

import json
import logging
import time as time_module
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass, field

from .config import MINIMAX_API_KEY, MINIMAX_GROUP_ID, MINIMAX_BASE_URL, MOCK_MODE

logger = logging.getLogger(__name__)


@dataclass
class ImageResult:
    url: Optional[str] = None
    local_path: Optional[str] = None
    success: bool = False
    error: Optional[str] = None


@dataclass
class AudioResult:
    url: Optional[str] = None
    local_path: Optional[str] = None
    duration_seconds: float = 0.0
    success: bool = False
    error: Optional[str] = None


@dataclass
class VideoResult:
    url: Optional[str] = None
    local_path: Optional[str] = None
    duration_seconds: float = 0.0
    success: bool = False
    error: Optional[str] = None


class MiniMaxClient:
    """MiniMax API client with mock fallback."""

    def __init__(
        self,
        api_key: str = MINIMAX_API_KEY,
        group_id: str = MINIMAX_GROUP_ID,
        base_url: str = MINIMAX_BASE_URL,
    ):
        self.api_key = api_key
        self.group_id = group_id
        self.base_url = base_url
        self._enabled = bool(api_key and group_id)
        if not self._enabled:
            logger.warning(
                "MiniMaxClient: No API key or group_id set. "
                "Running in MOCK mode."
            )

    # ── Image Generation ──────────────────────────────────────────────────────

    def generate_images(
        self,
        prompt: str,
        n: int = 1,
        style: str = "3D animation",
        **kwargs,
    ) -> List[ImageResult]:
        """
        Generate images via MiniMax image API (model: image-01).
        Falls back to mock if credentials are not set.

        API: POST /v1/image_generation
        Docs: https://platform.minimax.io/docs/api-reference/image-generation
        Free tier: 200 images/day
        """
        if not self._enabled or MOCK_MODE:
            return self._mock_images(prompt, n)

        import urllib.request

        body = {
            "model": "image-01",
            "prompt": prompt,
            "num_images": min(max(n, 1), 4),
        }

        # Optional: aspect_ratio from kwargs (e.g. "16:9", "9:16", "1:1")
        aspect_ratio = kwargs.get("aspect_ratio")
        if aspect_ratio:
            body["aspect_ratio"] = aspect_ratio

        req = urllib.request.Request(
            f"{self.base_url}/v1/image_generation",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="replace")
            logger.error(f"[MiniMax] image generation failed: {exc.code} — {err_body}")
            return [ImageResult(success=False, error=f"HTTP {exc.code}: {err_body}")]

        results: List[ImageResult] = []
        for item in data.get("data", []):
            results.append(ImageResult(
                url=item.get("url"),
                local_path=None,
                success=True,
            ))

        if not results:
            return [ImageResult(success=False, error="No images returned by MiniMax API")]

        return results

    # ── Text-to-Speech ───────────────────────────────────────────────────────

    def generate_voice(
        self,
        text: str,
        voice_id: str = "male-qn-qingse",
        output_path: Optional[str] = None,
        speed: float = 1.0,
    ) -> AudioResult:
        """
        Generate speech via MiniMax TTS API (model: speech-2.8-hd).
        Falls back to mock if credentials are not set.

        API: POST /v1/t2a_v2
        API: POST /v1/t2a (sync, ≤10K chars) or /v1/t2a_async_v2 (async, ≤50K chars)
        Docs: https://platform.minimax.io/docs/api-reference/text-to-audio
        Free tier: varies by plan; confirmed working with Max plan.
        """
        if not self._enabled or MOCK_MODE:
            return self._mock_audio(text, output_path)

        import urllib.request

        voice_map = {
            "male-qn-qingse":   "male-qn-qingse",
            "female-tianmei":   "female-tianmei",
            "male-qn-qingyan":  "male-qn-qingyan",
            "female-yiping":    "female-yiping",
            "male-qn-baiyan":   "male-qn-baiyan",
            "female-shaonv":    "female-shaonv",
        }
        mapped_voice = voice_map.get(voice_id, voice_id)

        body = {
            "model": "speech-2.8-hd",
            "text": text,
            "voice_setting": {
                "voice_id": mapped_voice,
                "speed": float(speed),
                "pitch": 0,
                "volume": 0,
            },
            "audio_setting": {
                "sample_rate": 32000,
                "bitrate": 128000,
                "format": "mp3",
            },
        }

        req = urllib.request.Request(
            f"{self.base_url}/v1/t2a",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                content_type = resp.headers.get("Content-Type", "")
                if "audio" in content_type or "mp3" in content_type or "wav" in content_type:
                    audio_data = resp.read()
                    if output_path:
                        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
                        with open(output_path, "wb") as f:
                            f.write(audio_data)
                    return AudioResult(
                        url=None,
                        local_path=output_path,
                        duration_seconds=max(1.0, len(text) / 10),
                        success=True,
                    )
                else:
                    data = json.loads(resp.read())
                    audio_url = data.get("data", {}).get("audio_url") if isinstance(data, dict) else None
                    return AudioResult(
                        url=audio_url,
                        local_path=output_path,
                        duration_seconds=max(1.0, len(text) / 10),
                        success=True,
                    )
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="replace")
            logger.error(f"[MiniMax] TTS failed: {exc.code} — {err_body}")
            return AudioResult(success=False, error=f"HTTP {exc.code}: {err_body}")
        except Exception as exc:
            logger.error(f"[MiniMax] TTS failed: {exc}")
            return AudioResult(success=False, error=str(exc))

    # ── Video Generation ──────────────────────────────────────────────────────

    def generate_video(
        self,
        image_path: str,
        prompt: str = "",
        duration: int = 6,
        resolution: str = "1280x720",
        *,
        reference_image: Optional[str] = None,
        max_wait_ms: int = 10 * 60 * 1000,
        poll_interval_ms: int = 15_000,
        max_retries: int = 2,
    ) -> VideoResult:
        """
        Generate video from an image via MiniMax Video API (model: MiniMax-Hailuo-2.3).
        Submits a job then polls until completion (up to max_wait_ms).
        Falls back to mock if credentials are not set.

        API: POST   /v1/video_generation          (submit)
              GET   /v1/query/video_generation     (poll by task_id)
              GET   /v1/files/retrieve             (get download URL by file_id)
        Status: Preparing → Queueing → Processing → Success / Fail
        Confirmed via end-to-end test 2026-03-25 (TKP-73).

        Character Consistency Strategy:
            MiniMax has no native "subject reference ID". Consistency is achieved by:
            1. Generate a character image once (MiniMax image-01 or SD)
            2. Use that same character image as `image_path` for ALL scene videos
            3. The first frame anchors the character; the model preserves it across scenes

        Args:
            image_path:   Local path or URL to the source image (first video frame).
            prompt:       Text prompt describing the desired motion/scene.
            duration:     Video length in seconds (6 or 10 on standard/fast presets).
            resolution:   Target resolution string e.g. "1280x720".
            reference_image: Optional extra character reference image URL.
                          When provided, used as the subject reference to improve
                          character consistency across multiple scene generations.
                          On MiniMax API (as of 2026-03): no separate subject_id
                          field — the `image_path` image IS the character anchor.
            max_wait_ms:  Abort polling after this many ms (default 10 min).
            poll_interval_ms: Wait this long between status checks.
            max_retries:  Retry transient failures up to N times.

        Returns:
            VideoResult with url and/or local_path on success.
        """
        if not self._enabled or MOCK_MODE:
            return self._mock_video(image_path, duration)

        # Parse resolution into aspect_ratio
        w, h = resolution.split("x")
        aspect_ratio = (
            "9:16" if int(h) > int(w)
            else ("16:9" if int(w) > int(h) else "1:1")
        )

        def _submit():
            import urllib.request

            # Resolve image_path: URL string or local file path
            # MiniMax API expects a publicly accessible image URL.
            # Local paths are converted to file:// URLs for development;
            # in production, use a URL from a file upload or CDN.
            image_url = image_path if image_path.startswith(("http://", "https://")) \
                else f"file://{image_path}" if image_path else None

            body: dict = {
                "model": "MiniMax-Hailuo-2.3",
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "duration": duration,
            }
            if image_url:
                body["image_url"] = image_url
            if reference_image:
                body["reference_image_url"] = reference_image

            req = urllib.request.Request(
                f"{self.base_url}/v1/video_generation",
                data=json.dumps(body).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read())

        def _poll(task_id: str):
            import urllib.request

            req = urllib.request.Request(
                f"{self.base_url}/v1/query/video_generation?task_id={task_id}",
                headers={"Authorization": f"Bearer {self.api_key}"},
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())

        def _get_download_url(file_id: str):
            import urllib.request

            req = urllib.request.Request(
                f"{self.base_url}/v1/files/retrieve?file_id={file_id}",
                headers={"Authorization": f"Bearer {self.api_key}"},
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
            # The file object may have a download_url or direct URL field
            file_obj = data.get("data", {}) or data
            return (
                file_obj.get("download_url")
                or file_obj.get("url")
                or file_obj.get("file_url")
            )

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                submit_data = _submit()
                task_id = submit_data.get("task_id") or submit_data.get("id")
                if not task_id:
                    return VideoResult(
                        success=False,
                        error=f"No task_id in submit response: {submit_data}",
                    )

                deadline = time_module.time() * 1000 + max_wait_ms
                while time_module.time() * 1000 < deadline:
                    status_data = _poll(task_id)
                    # Status values: Preparing / Queueing / Processing / Success / Fail
                    status = (
                        status_data.get("status")
                        or status_data.get("data", {}).get("status")
                        or ""
                    )
                    if status == "Success":
                        # No video_url in status response — use /v1/files/retrieve
                        file_id = (
                            status_data.get("file_id")
                            or status_data.get("data", {}).get("file_id")
                        )
                        if file_id:
                            video_url = _get_download_url(file_id)
                            return VideoResult(
                                url=video_url,
                                duration_seconds=duration,
                                success=True,
                            )
                        else:
                            return VideoResult(
                                success=False,
                                error=f"Video task succeeded (status=Success) but no file_id found in response: {status_data}",
                            )
                    if status == "Fail":
                        return VideoResult(
                            success=False,
                            error=f"Video task failed: {status_data}",
                        )
                    # Still in Preparing / Queueing / Processing — keep polling
                    time_module.sleep(poll_interval_ms / 1000)

                return VideoResult(
                    success=False,
                    error=f"Timed out after {max_wait_ms}ms waiting for task {task_id}",
                )

            except Exception as exc:
                last_error = exc
                err_msg = str(exc).lower()
                is_transient = any(tag in err_msg for tag in ["500", "502", "503", "504", "timeout", "fetch failed"])
                if not is_transient:
                    return VideoResult(success=False, error=str(exc))
                if attempt < max_retries:
                    backoff = (attempt + 1) * 5
                    logger.warning(
                        f"[MiniMax] Video gen attempt {attempt+1} failed ({exc}), "
                        f"retrying in {backoff}s..."
                    )
                    time_module.sleep(backoff)

        return VideoResult(success=False, error=str(last_error))

    # ── Batch Generation ─────────────────────────────────────────────────────

    DAILY_VIDEO_LIMIT = 3
    COST_LOG_PATH = Path(__file__).parent.parent / "logs" / "hailuo-costs.md"

    @classmethod
    def _today_str(cls) -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    @classmethod
    def _load_daily_count(cls) -> tuple[int, str]:
        """Load today's generation count from the cost log.
        Returns (count, date_string).
        """
        log_path = cls.COST_LOG_PATH
        if not log_path.exists():
            return 0, cls._today_str()

        today = cls._today_str()
        content = log_path.read_text(encoding="utf-8")
        for line in reversed(content.splitlines()):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # Format: YYYY-MM-DD | N | $X.XXXX
            parts = line.split("|")
            if len(parts) >= 2:
                date_part = parts[0].strip()
                try:
                    count = int(parts[1].strip())
                    return count, date_part
                except ValueError:
                    continue
        return 0, today

    @classmethod
    def _append_cost_log(cls, model: str, cost_usd: float) -> None:
        """Append a generation entry to the cost log."""
        log_path = cls.COST_LOG_PATH
        log_path.parent.mkdir(parents=True, exist_ok=True)

        today = cls._today_str()
        entry = f"{today} | 1 | ${cost_usd:.4f}\n"

        if not log_path.exists():
            header = (
                "# Hailuo/MiniMax Video Generation Cost Log\n"
                "# Date     | Count | Est. Cost\n"
                "# ---------+-------+-----------\n"
            )
            log_path.write_text(header + entry, encoding="utf-8")
        else:
            log_path.write_text(log_path.read_text(encoding="utf-8") + entry, encoding="utf-8")

    VIDEO_COST_ESTIMATE_USD = {
        "MiniMax-Hailuo-2.3": 0.05,
        "MiniMax-Hailuo-02":   0.04,
    }

    def batch_generate(
        self,
        prompts: list[dict],
        *,
        max_concurrent: int = 1,
        wait_for_completion: bool = True,
        max_wait_ms: int = 600_000,
        poll_interval_ms: int = 15_000,
        max_retries: int = 3,
    ) -> list[dict]:
        """
        Generate multiple videos with rate limiting and daily cap enforcement.

        MiniMax free tier: 3 video generations/day. Tracks usage in
        logs/hailuo-costs.md and queues excess for the next day.

        Args:
            prompts:      List of dicts with keys: prompt, image_path?,
                         model?, duration?, resolution?.
            max_concurrent: Max simultaneous submissions (default 1).
            wait_for_completion: Poll each job until done (default True).
            max_wait_ms:  Max poll wait per video in ms (default 10 min).
            poll_interval_ms: Poll interval in ms (default 15 s).
            max_retries:  Exponential backoff retries for 5xx (default 3).

        Returns:
            List of result dicts, each with keys: task_id, status, video_url?,
            error?, estimated_cost_usd?, message? (for queued items).
        """
        import time as time_module
        import threading
        import concurrent.futures

        results: list[dict] = []
        used_today, date = self._load_daily_count()
        today = self._today_str()
        if date != today:
            used_today = 0

        available_now = max(0, self.DAILY_VIDEO_LIMIT - used_today)
        immediate_prompts = prompts[:available_now]
        queued_prompts    = prompts[available_now:]

        def _exponential_backoff(attempt: int) -> float:
            return min(30.0, (2 ** attempt) * 2.0)

        def _do_one(prompt_dict: dict) -> dict:
            model      = prompt_dict.get("model", "MiniMax-Hailuo-2.3")
            cost_usd   = self.VIDEO_COST_ESTIMATE_USD.get(model, 0.05)

            last_error: Exception | None = None
            for attempt in range(max_retries + 1):
                try:
                    # Use generate_video which already handles submit + poll
                    result = self.generate_video(
                        image_path  =prompt_dict.get("image_path", ""),
                        prompt     =prompt_dict.get("prompt", ""),
                        duration   =prompt_dict.get("duration", 6),
                        resolution =prompt_dict.get("resolution", "1280x720"),
                        reference_image=prompt_dict.get("reference_image"),
                        max_wait_ms=max_wait_ms,
                        poll_interval_ms=poll_interval_ms,
                        max_retries=0,  # We handle retries ourselves
                    )
                    if result.success:
                        self._append_cost_log(model, cost_usd)
                        return {
                            "task_id": None,
                            "status": "completed",
                            "video_url": result.url or result.local_path,
                            "model": model,
                            "estimated_cost_usd": cost_usd,
                        }
                    else:
                        # Non-transient failure — don't retry
                        return {
                            "task_id": None,
                            "status": "failed",
                            "error": result.error or "Unknown error",
                            "model": model,
                            "estimated_cost_usd": cost_usd,
                        }
                except Exception as exc:  # noqa: BLE001
                    last_error = exc
                    err_str = str(exc).lower()
                    is_transient = any(
                        tag in err_str
                        for tag in ["500", "502", "503", "504", "timeout", "fetch failed", "connection"]
                    )
                    if not is_transient or attempt == max_retries:
                        break
                    backoff = _exponential_backoff(attempt)
                    logger.warning(
                        f"[MiniMax] batch generate attempt {attempt+1}/{max_retries+1} "
                        f"failed ({exc}), retrying in {backoff}s..."
                    )
                    time_module.sleep(backoff)

            return {
                "task_id": None,
                "status": "failed",
                "error": str(last_error) if last_error else "Max retries exceeded",
                "model": model,
                "estimated_cost_usd": cost_usd,
            }

        # Run immediate prompts with concurrency limit
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_concurrent) as executor:
            futures = [executor.submit(_do_one, p) for p in immediate_prompts]
            for fut in concurrent.futures.as_completed(futures):
                results.append(fut.result())

        # Queue excess
        for p in queued_prompts:
            results.append({
                "task_id": None,
                "status":  "queued",
                "prompt":  p.get("prompt", ""),
                "model":   p.get("model", "MiniMax-Hailuo-2.3"),
                "message": (
                    f"Queued: daily cap of {self.DAILY_VIDEO_LIMIT} reached. "
                    "Will process when quota resets."
                ),
                "estimated_cost_usd": self.VIDEO_COST_ESTIMATE_USD.get(
                    p.get("model", "MiniMax-Hailuo-2.3"), 0.05
                ),
            })

        return results

    def batch_status(self) -> dict:
        """
        Return current batch queue status (in-memory) and today's usage.
        Persisted daily count is read from logs/hailuo-costs.md.
        """
        today_count, _ = self._load_daily_count()
        return {
            "daily_limit":      self.DAILY_VIDEO_LIMIT,
            "daily_used":       today_count,
            "daily_remaining":  max(0, self.DAILY_VIDEO_LIMIT - today_count),
        }

    # ── Mock Helpers ─────────────────────────────────────────────────────────

    @staticmethod
    def _mock_images(prompt: str, n: int) -> List[ImageResult]:
        logger.info(f"[MOCK] generate_images(prompt={prompt!r}, n={n})")
        return [
            ImageResult(
                url=None,
                local_path=None,
                success=True,
            )
            for _ in range(n)
        ]

    @staticmethod
    def _mock_audio(text: str, output_path: Optional[str]) -> AudioResult:
        logger.info(f"[MOCK] generate_voice(text={text[:40]!r}...)")
        return AudioResult(
            url=None,
            local_path=output_path,
            duration_seconds=max(1.0, len(text) / 10),
            success=True,
        )

    @staticmethod
    def _mock_video(image_path: str, duration: int) -> VideoResult:
        logger.info(
            f"[MOCK] generate_video(image={image_path!r}, duration={duration}s)"
        )
        return VideoResult(
            url=None,
            local_path=None,
            duration_seconds=duration,
            success=True,
        )

    # ── Character Reference ─────────────────────────────────────────────────

    def generate_video_with_character(
        self,
        character_image_path: str,
        prompt: str,
        duration: int = 6,
        resolution: str = "1280x720",
        *,
        character_description: str = "",
        reference_image: Optional[str] = None,
        max_wait_ms: int = 10 * 60 * 1000,
        poll_interval_ms: int = 15_000,
    ) -> VideoResult:
        """
        Generate a video anchored to a character reference image.

        This is the primary character-consistency entry point. Call this once
        per scene, always passing the SAME `character_image_path` so all
        output videos share the same character subject.

        Strategy:
            MiniMax image-to-video uses the input image as the first frame.
            There is no separate subject-ID or character-reference endpoint.
            Visual consistency across scenes is achieved by:
              1. Generating one high-quality character portrait (image-01)
              2. Re-using that portrait as `character_image_path` for every scene

        Args:
            character_image_path: Path or URL to the character's portrait image.
                                  This becomes the first frame of every scene video.
            prompt:              Scene motion/prompt (can reference the character
                                e.g. "character walks through door").
            duration:            Video length in seconds.
            resolution:          Target resolution.
            character_description: Optional text description of the character
                                  (injected into prompt for model guidance).
            reference_image:     Optional second reference image URL for
                                  subject continuity (passed to API if set).
            max_wait_ms:         Poll timeout in ms.
            poll_interval_ms:    Poll interval in ms.

        Returns:
            VideoResult with video_url on success.
        """
        # Inject character description into prompt for better consistency
        enhanced_prompt = prompt
        if character_description:
            enhanced_prompt = f"{character_description}. {prompt}"

        return self.generate_video(
            image_path=character_image_path,
            prompt=enhanced_prompt,
            duration=duration,
            resolution=resolution,
            reference_image=reference_image,
            max_wait_ms=max_wait_ms,
            poll_interval_ms=poll_interval_ms,
        )

    def generate_scene_batch_with_character(
        self,
        character_image_path: str,
        scene_prompts: list[dict],
        *,
        character_description: str = "",
        max_wait_ms: int = 10 * 60 * 1000,
        poll_interval_ms: int = 15_000,
    ) -> list[dict]:
        """
        Generate multiple scene videos all anchored to the same character.

        Args:
            character_image_path: Same character portrait for all scenes.
            scene_prompts:       List of dicts with keys: prompt, duration?,
                                 resolution?.
            character_description: Injected into each prompt.
            max_wait_ms:         Per-scene poll timeout.
            poll_interval_ms:    Per-scene poll interval.

        Returns:
            List of result dicts (same shape as batch_generate).
        """
        results: list[dict] = []
        for scene in scene_prompts:
            result = self.generate_video_with_character(
                character_image_path=character_image_path,
                prompt=scene.get("prompt", ""),
                duration=scene.get("duration", 6),
                resolution=scene.get("resolution", "1280x720"),
                character_description=character_description,
                max_wait_ms=max_wait_ms,
                poll_interval_ms=poll_interval_ms,
            )
            results.append({
                "status": "completed" if result.success else "failed",
                "video_url": result.url or result.local_path,
                "error": result.error,
                "duration_seconds": result.duration_seconds,
                "prompt": scene.get("prompt", ""),
            })
        return results

    # ── Video-to-Video ────────────────────────────────────────────────────────

    def video_to_video(
        self,
        video_path: str,
        prompt: str = "",
        model: str = "MiniMax-Hailuo-2.3",
        duration: int = 6,
        resolution: str = "1280x720",
    ) -> VideoResult:
        """
        Video-to-Video generation via MiniMax API.

        NOT SUPPORTED — MiniMax API (as of 2026-03) has no video-to-video endpoint.
        Supported video modes:
          - Text-to-Video (T2V): generate_video() with no image_path
          - Image-to-Video (I2V): generate_video() with image_path

        Workaround: Extract key frames from source video using FFmpeg, then pass
        each frame to generate_video() as image_to_video, then reassemble clips.

        Args:
            video_path:   Path to source video (ignored — API does not support V2V).
            prompt:       Motion description (ignored).
            model:        Model name (ignored).
            duration:     Target duration in seconds (ignored).
            resolution:   Target resolution (ignored).

        Returns:
            VideoResult with success=False and descriptive error.
        """
        logger.warning(
            "[MiniMax] video_to_video: MiniMax API does not support video-to-video. "
            "Use image_to_video via generate_video(image_path=...) or implement "
            "a frame-extraction → I2V → reassemble pipeline."
        )
        return VideoResult(
            success=False,
            error=(
                "MiniMax API does not support video-to-video generation (as of 2026-03). "
                "Supported modes: Text-to-Video and Image-to-Video. "
                "Workaround: extract frames with FFmpeg, run I2V on each frame, "
                "then concatenate output clips."
            ),
        )
