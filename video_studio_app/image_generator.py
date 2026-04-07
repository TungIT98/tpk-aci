"""
video_studio_app/image_generator.py
Founding Engineer — TKP Video Studio (TKP-54)

Image generation pipeline: Stable Diffusion / MiniMax / Mock → images for video scenes.
Character consistency system via LoRA placeholders.
Batch processing for multiple scenes.

Usage:
    from image_generator import ImageGenerator, GenerationOptions, CharacterProfile

    gen = ImageGenerator(provider="mock")          # try SD first, fallback to mock
    gen = ImageGenerator(provider="stable_diffusion", sd_model_path="/path/to/sd")

    # Single image
    result = gen.generate("a person working at a clean minimalist desk, morning light")
    print(result.local_path)

    # Batch — multiple scenes
    from storyboard_generator import StoryboardGenerator
    sb_gen = StoryboardGenerator(channel="productivity_worker", mock=True)
    storyboard = sb_gen.generate_storyboard(script, topic, duration_seconds=60)

    batch_results = gen.generate_batch(
        scenes=storyboard.scenes,
        output_dir="output/scenes",
    )

    # Character consistency (LoRA placeholder)
    profile = CharacterProfile(name="Alex", description="young professional, warm smile")
    results = gen.generate_with_character(profile, prompts=["office scene", "coffee shop"])

    # Self-test
    python image_generator.py
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Optional

from .config import (
    BASE_DIR,
    OUTPUT_DIR,
    ASSETS_DIR,
    IMAGE_PROVIDER,
    SD_MODEL_PATH,
    MINIMAX_API_KEY,
    MOCK_MODE,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums & Dataclasses
# ---------------------------------------------------------------------------

class ImageProvider(Enum):
    STABLE_DIFFUSION = "stable_diffusion"
    MINIMAX = "minimax"
    MOCK = "mock"


class ImageFormat(Enum):
    PNG = "png"
    JPG = "jpg"
    WEBP = "webp"


@dataclass
class GenerationOptions:
    """Options for a single image generation call."""
    width: int = 1024
    height: int = 1024
    steps: int = 25
    cfg_scale: float = 7.5
    seed: Optional[int] = None
    style: str = "cinematic"          # passed to SD style preset / aesthetic tag
    negative_prompt: str = (
        "low quality, blurry, watermark, text overlay, ui elements, "
        "cartoon, anime, 3d render, distorted face, deformed hands, "
        "oversaturated, noise, compression artifacts"
    )
    output_format: ImageFormat = ImageFormat.PNG
    output_dir: Optional[str] = None  # defaults to OUTPUT_DIR / images


@dataclass
class CharacterProfile:
    """
    Character identity for visual consistency across scenes.
    LoRA-based consistency is a PLACEHOLDER — real implementation requires
    training a LoRA on reference images and loading it at inference time.
    """
    name: str
    description: str                          # e.g. "young professional, warm smile, short hair"
    lora_path: Optional[str] = None           # path to .safetensors LoRA weights (placeholder)
    reference_image_paths: list[str] = field(default_factory=list)
    style: str = "cinematic"
    seed: Optional[int] = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "CharacterProfile":
        return cls(**data)

    def save(self, path: str | Path) -> None:
        Path(path).write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "CharacterProfile":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))


@dataclass
class ImageResult:
    """Result of a single image generation call."""
    success: bool
    local_path: Optional[str] = None
    url: Optional[str] = None
    prompt: str = ""
    negative_prompt: str = ""
    seed: Optional[int] = None
    width: int = 0
    height: int = 0
    provider: str = ""
    error: Optional[str] = None
    generation_time_seconds: float = 0.0
    character_profile_name: Optional[str] = None   # for consistency tracking

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class BatchResult:
    """Result of a batch image generation call."""
    total: int
    succeeded: int
    failed: int
    results: list[ImageResult] = field(default_factory=list)
    total_time_seconds: float = 0.0
    errors: list[str] = field(default_factory=list)

    @property
    def success_rate(self) -> float:
        return self.succeeded / self.total if self.total > 0 else 0.0

    def to_dict(self) -> dict:
        return {
            "total": self.total,
            "succeeded": self.succeeded,
            "failed": self.failed,
            "success_rate": round(self.success_rate, 3),
            "total_time_seconds": round(self.total_time_seconds, 3),
            "errors": self.errors,
            "results": [r.to_dict() for r in self.results],
        }

    def save(self, path: str | Path) -> None:
        Path(path).write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Main Generator
# ---------------------------------------------------------------------------

class ImageGenerator:
    """
    Image generation engine with pluggable providers.

    Providers (tried in order if not explicitly specified):
      1. Stable Diffusion — local ComfyUI / diffusers (if SD_MODEL_PATH set)
      2. MiniMax image API (if MINIMAX_API_KEY set)
      3. Mock — returns placeholder ImageResults without calling any API

    Parameters
    ----------
    provider : str
        One of "stable_diffusion", "minimax", "mock", or "auto" (default).
        "auto" tries SD first, then MiniMax, then mock.
    sd_model_path : str, optional
        Override SD_MODEL_PATH from config.
    sd_compvis_path : str, optional
        Path to a Stable Diffusion weights .ckpt file (for simple local runner).
    mock : bool
        Force mock mode regardless of config. Default False.
    """

    DEFAULT_WIDTH, DEFAULT_HEIGHT = 1024, 1024

    def __init__(
        self,
        provider: str = "auto",
        sd_model_path: Optional[str] = None,
        sd_compvis_path: Optional[str] = None,
        *,
        mock: bool = False,
    ):
        self._mock = mock or MOCK_MODE

        if provider == "auto":
            self._provider = self._detect_provider()
        else:
            self._provider = ImageProvider(provider)

        self._sd_model_path = sd_model_path or SD_MODEL_PATH
        self._sd_compvis_path = sd_compvis_path
        self._character_cache: dict[str, CharacterProfile] = {}

        logger.info(
            f"ImageGenerator initialized: provider={self._provider.value}, "
            f"sd_model_path={self._sd_model_path!r}, mock={self._mock}"
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(
        self,
        prompt: str,
        options: Optional[GenerationOptions] = None,
        character: Optional[CharacterProfile] = None,
    ) -> ImageResult:
        """
        Generate a single image from a text prompt.

        Parameters
        ----------
        prompt : str
            Main image generation prompt (Stable Diffusion / MiniMax style).
        options : GenerationOptions, optional
            Generation parameters.
        character : CharacterProfile, optional
            Character to maintain visual consistency (LoRA placeholder).

        Returns
        -------
        ImageResult
        """
        options = options or GenerationOptions()
        start = time.monotonic()

        effective_prompt = self._apply_character(prompt, character)

        try:
            if self._provider == ImageProvider.STABLE_DIFFUSION:
                result = self._sd_generate(effective_prompt, options, character)
            elif self._provider == ImageProvider.MINIMAX:
                result = self._minimax_generate(effective_prompt, options, character)
            else:
                result = self._mock_generate(effective_prompt, options, character)

            result.generation_time_seconds = time.monotonic() - start
            return result

        except Exception as exc:
            logger.error(f"Image generation failed: {exc}")
            return ImageResult(
                success=False,
                prompt=prompt,
                provider=self._provider.value,
                error=str(exc),
                generation_time_seconds=time.monotonic() - start,
            )

    def generate_batch(
        self,
        prompts: list[str],
        options: Optional[GenerationOptions] = None,
        characters: Optional[list[Optional[CharacterProfile]]] = None,
        output_dir: Optional[str] = None,
    ) -> BatchResult:
        """
        Generate multiple images in sequence (not parallelized — use
        generate_batch_parallel for GPU parallelization).

        Parameters
        ----------
        prompts : list[str]
            List of generation prompts (one per image).
        options : GenerationOptions, optional
            Base options applied to all generations.
        characters : list[Optional[CharacterProfile]], optional
            Per-prompt character profiles (must match len(prompts)).
        output_dir : str, optional
            Directory to save images. Defaults to OUTPUT_DIR / images.

        Returns
        -------
        BatchResult
        """
        options = options or GenerationOptions()
        if output_dir:
            options.output_dir = output_dir
        out_dir = Path(options.output_dir or str(OUTPUT_DIR / "images"))
        out_dir.mkdir(parents=True, exist_ok=True)

        t0 = time.monotonic()
        results: list[ImageResult] = []
        errors: list[str] = []

        chars = characters or [None] * len(prompts)
        if len(chars) != len(prompts):
            raise ValueError("prompts and characters must have the same length")

        for i, (prompt, char) in enumerate(zip(prompts, chars)):
            logger.info(f"[Batch {i+1}/{len(prompts)}] Generating: {prompt[:60]!r}...")
            result = self.generate(prompt, options=options, character=char)
            results.append(result)
            if not result.success:
                errors.append(f"Scene {i+1}: {result.error or 'unknown error'}")

            # Save image if successful (mock writes a placeholder file)
            if result.success and result.local_path:
                logger.info(f"  → Saved: {result.local_path}")

        elapsed = time.monotonic() - t0
        succeeded = sum(1 for r in results if r.success)

        return BatchResult(
            total=len(prompts),
            succeeded=succeeded,
            failed=len(prompts) - succeeded,
            results=results,
            total_time_seconds=elapsed,
            errors=errors,
        )

    def generate_batch_parallel(
        self,
        prompts: list[str],
        options: Optional[GenerationOptions] = None,
        characters: Optional[list[Optional[CharacterProfile]]] = None,
        output_dir: Optional[str] = None,
        max_concurrent: int = 2,
    ) -> BatchResult:
        """
        Generate multiple images with limited concurrency.
        Uses threading for I/O-bound mock/remote API calls.

        Note: Real SD GPU inference is typically single-batch — parallelization
        within a single GPU process does not apply. For multi-GPU setups,
        distribute across process boundaries instead.

        Parameters
        ----------
        max_concurrent : int
            Maximum concurrent API calls. Default 2. Increase for stateless APIs.
        """
        import concurrent.futures

        options = options or GenerationOptions()
        if output_dir:
            options.output_dir = output_dir

        t0 = time.monotonic()
        results: list[ImageResult] = []
        errors: list[str] = []

        chars = characters or [None] * len(prompts)

        def _gen_one(args: tuple[int, str, Optional[CharacterProfile]]) -> ImageResult:
            i, prompt, char = args
            return self.generate(prompt, options=options, character=char)

        with concurrent.futures.ThreadPoolExecutor(max_workers=max_concurrent) as exc:
            futures = {
                exc.submit(_gen_one, (i, p, c)): i
                for i, (p, c) in enumerate(zip(prompts, chars))
            }
            for future in concurrent.futures.as_completed(futures):
                idx = futures[future]
                try:
                    result = future.result()
                    results.append(result)
                    if not result.success:
                        errors.append(f"Scene {idx+1}: {result.error or 'unknown error'}")
                except Exception as exc:
                    errors.append(f"Scene {idx+1}: {exc}")
                    results.append(ImageResult(success=False, prompt=prompts[idx], error=str(exc)))

        # Sort back into original order
        results.sort(key=lambda r: prompts.index(r.prompt) if r.prompt in prompts else -1)
        succeeded = sum(1 for r in results if r.success)

        return BatchResult(
            total=len(prompts),
            succeeded=succeeded,
            failed=len(prompts) - succeeded,
            results=results,
            total_time_seconds=time.monotonic() - t0,
            errors=errors,
        )

    # ------------------------------------------------------------------
    # Storyboard integration
    # ------------------------------------------------------------------

    def generate_from_storyboard(
        self,
        scenes: list,
        output_dir: Optional[str] = None,
        character: Optional[CharacterProfile] = None,
    ) -> BatchResult:
        """
        Generate images for all scenes in a Storyboard (from storyboard_generator.py).

        Parameters
        ----------
        scenes : list[Scene]
            List of Scene objects from StoryboardGenerator. Each scene must have
            `image_prompt` and optionally `negative_prompt` attributes.
        output_dir : str, optional
            Output directory for images.
        character : CharacterProfile, optional
            Apply character consistency across all scenes.

        Returns
        -------
        BatchResult
        """
        prompts = []
        chars = []
        for scene in scenes:
            prompt = getattr(scene, "image_prompt", "") or getattr(scene, "prompt", "")
            if not prompt:
                logger.warning(f"Scene {getattr(scene, 'scene_number', '?')} has no image_prompt — skipping")
                continue
            prompts.append(prompt)
            chars.append(character)

        if not prompts:
            return BatchResult(total=0, succeeded=0, failed=0)

        # Per-scene negative prompts
        options = GenerationOptions()
        if output_dir:
            options.output_dir = output_dir

        # Override negative prompt per-scene by generating individually
        results: list[ImageResult] = []
        out = Path(options.output_dir or str(OUTPUT_DIR / "images"))
        out.mkdir(parents=True, exist_ok=True)

        t0 = time.monotonic()
        errors = []
        for i, (scene, char) in enumerate(zip(scenes, chars)):
            if not hasattr(scene, "image_prompt") or not scene.image_prompt:
                continue

            opts = GenerationOptions(
                negative_prompt=getattr(scene, "negative_prompt", options.negative_prompt),
                output_dir=str(out),
            )
            result = self.generate(scene.image_prompt, options=opts, character=char)
            results.append(result)
            if not result.success:
                errors.append(f"Scene {i+1}: {result.error or 'unknown'}")

        succeeded = sum(1 for r in results if r.success)
        return BatchResult(
            total=len(results),
            succeeded=succeeded,
            failed=len(results) - succeeded,
            results=results,
            total_time_seconds=time.monotonic() - t0,
            errors=errors,
        )

    # ------------------------------------------------------------------
    # Character / LoRA (placeholder)
    # ------------------------------------------------------------------

    def register_character(self, profile: CharacterProfile) -> str:
        """
        Register a character profile for consistency across scenes.
        Returns the character's assigned ID.
        """
        char_id = str(uuid.uuid4())[:8]
        self._character_cache[char_id] = profile
        logger.info(f"Registered character: {profile.name} (id={char_id})")
        return char_id

    def get_character(self, char_id: str) -> Optional[CharacterProfile]:
        return self._character_cache.get(char_id)

    def list_characters(self) -> dict[str, CharacterProfile]:
        return dict(self._character_cache)

    # ------------------------------------------------------------------
    # Provider internals
    # ------------------------------------------------------------------

    def _detect_provider(self) -> ImageProvider:
        if self._mock:
            return ImageProvider.MOCK
        if SD_MODEL_PATH:
            return ImageProvider.STABLE_DIFFUSION
        if MINIMAX_API_KEY:
            return ImageProvider.MINIMAX
        logger.warning("No image provider detected — falling back to MOCK")
        return ImageProvider.MOCK

    def _apply_character(
        self,
        prompt: str,
        character: Optional[CharacterProfile],
    ) -> str:
        """
        Inject character identity into the prompt.
        Real implementation: load LoRA weights at inference time.
        Placeholder: append character description as weighted prompt tokens.
        """
        if not character:
            return prompt
        # Placeholder: inject description as (more) prompt tokens
        # Real SD+LoRA approach: pass lora_path to SD pipeline, or use
        #   prompt = f"({character.description})++ + {prompt}"
        enhanced = f"{prompt}, {character.description} [character consistency: {character.name}]"
        logger.debug(f"[LoRA placeholder] Enhanced prompt: {enhanced[:80]!r}")
        return enhanced

    def _sd_generate(
        self,
        prompt: str,
        options: GenerationOptions,
        character: Optional[CharacterProfile],
    ) -> ImageResult:
        """
        Generate image via local Stable Diffusion (diffusers or ComfyUI).

        Placeholder implementation — real integration requires:
          1. diffusers Pipelines: StableDiffusionImg2ImgPipeline or TextToImagePipeline
          2. LoRA loading: pipe.load_lora_weights(lora_path)
          3. ComfyUI REST API: POST to ComfyUI /prompt endpoint

        Raises NotImplementedError until a real SD setup is detected.
        """
        # Try diffusers first (local Python)
        try:
            import torch
            from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler

            model_path = self._sd_model_path or "runwayml/stable-diffusion-v1-5"
            pipe = StableDiffusionPipeline.from_pretrained(
                model_path,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                safety_checker=None,
            )
            if torch.cuda.is_available():
                pipe = pipe.to("cuda")

            # Apply LoRA if provided (placeholder — real impl needs weight loading)
            if character and character.lora_path:
                pipe.load_lora_weights(character.lora_path)

            scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
            pipe.scheduler = scheduler

            seed = options.seed or int.from_bytes(uuid.uuid4().bytes, "big") % 2**32
            generator = torch.Generator(device="cuda" if torch.cuda.is_available() else "cpu").manual_seed(seed)

            img = pipe(
                prompt,
                negative_prompt=options.negative_prompt,
                width=options.width,
                height=options.height,
                num_inference_steps=options.steps,
                guidance_scale=options.cfg_scale,
                generator=generator,
            ).images[0]

            out_path = self._save_image(img, options, character)
            return ImageResult(
                success=True,
                local_path=out_path,
                prompt=prompt,
                negative_prompt=options.negative_prompt,
                seed=seed,
                width=options.width,
                height=options.height,
                provider=ImageProvider.STABLE_DIFFUSION.value,
                character_profile_name=character.name if character else None,
            )
        except ImportError:
            pass                     # diffusers not installed — try ComfyUI
        except Exception as exc:
            logger.warning(f"diffusers SD failed: {exc}")

        # Try ComfyUI REST API (if available)
        try:
            return self._comfyui_generate(prompt, options, character)
        except Exception as exc:
            logger.warning(f"ComfyUI SD failed: {exc}")

        # No SD available
        raise NotImplementedError(
            "Stable Diffusion is not configured. "
            "Set SD_MODEL_PATH env var or install diffusers, or use --provider=mock"
        )

    def _comfyui_generate(
        self,
        prompt: str,
        options: GenerationOptions,
        character: Optional[CharacterProfile],
    ) -> ImageResult:
        """
        Generate image via local ComfyUI REST API.

        Requires ComfyUI running at http://localhost:8188 (or COMFYUI_URL env var).
        Implements the standard /prompt endpoint with TextToImage KSampler workflow.
        """
        import os
        import urllib.request
        import urllib.error

        comfy_url = os.getenv("COMFYUI_URL", "http://localhost:8188")

        workflow = {
            "1": {                          # LoadImage node — not used for text2img
                "class_type": "CheckpointLoaderSimple",
                "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"},
            },
            "2": {
                "class_type": "CLIPTextEncode",
                "inputs": {"text": prompt, "clip": ["1", 0]},
            },
            "3": {
                "class_type": "CLIPTextEncode",
                "inputs": {"text": options.negative_prompt, "clip": ["1", 0]},
            },
            "4": {
                "class_type": "KSampler",
                "inputs": {
                    "seed": options.seed or 0,
                    "steps": options.steps,
                    "cfg": options.cfg_scale,
                    "sampler_name": "dpmpp_2m",
                    "scheduler": "normal",
                    "positive": ["2", 0],
                    "negative": ["3", 0],
                    "model": ["1", 0],
                },
            },
            "5": {
                "class_type": "EmptyLatentImage",
                "inputs": {"width": options.width, "height": options.height, "batch_size": 1},
            },
            "6": {
                "class_type": "VAEDecode",
                "inputs": {"samples": ["4", 0], "vae": ["1", 2]},
            },
            "7": {
                "class_type": "SaveImage",
                "inputs": {"filename_prefix": "video_studio", "images": ["6", 0]},
            },
        }

        req_data = json.dumps({"prompt": workflow}).encode("utf-8")
        req = urllib.request.Request(
            f"{comfy_url}/prompt",
            data=req_data,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                result_data = json.loads(resp.read())
                prompt_id = result_data.get("prompt_id")
                logger.info(f"ComfyUI prompt queued: {prompt_id}")
        except urllib.error.URLError as exc:
            raise RuntimeError(f"ComfyUI not reachable at {comfy_url}: {exc}")

        # Poll for completion
        history_url = f"{comfy_url}/history/{prompt_id}"
        for _ in range(60):          # up to 60 * 2s = 120s
            time.sleep(2)
            try:
                with urllib.request.urlopen(history_url, timeout=10) as resp:
                    history = json.loads(resp.read())
                    if prompt_id in history:
                        outputs = history[prompt_id].get("outputs", {})
                        for node_id, node_out in outputs.items():
                            if "images" in node_out:
                                # Download first image
                                img_data = node_out["images"][0]
                                img_req = urllib.request.Request(
                                    f"{comfy_url}/view?filename={img_data['filename']}&subfolder={img_data.get('subfolder', '')}"
                                )
                                with urllib.request.urlopen(img_req, timeout=30) as img_resp:
                                    from PIL import Image
                                    import io
                                    img = Image.open(io.BytesIO(img_resp.read()))
                                    out_path = self._save_image(img, options, character)
                                    return ImageResult(
                                        success=True,
                                        local_path=out_path,
                                        prompt=prompt,
                                        negative_prompt=options.negative_prompt,
                                        seed=options.seed,
                                        width=options.width,
                                        height=options.height,
                                        provider=ImageProvider.STABLE_DIFFUSION.value,
                                        character_profile_name=character.name if character else None,
                                    )
            except Exception:
                pass

        raise RuntimeError(f"ComfyUI generation timed out for prompt_id={prompt_id}")

    def _minimax_generate(
        self,
        prompt: str,
        options: GenerationOptions,
        character: Optional[CharacterProfile],
    ) -> ImageResult:
        """
        Generate image via MiniMax image API.

        Real implementation pending — MiniMax image_generation endpoint.
        Raise NotImplementedError until credentials are active.
        """
        if not MINIMAX_API_KEY:
            raise NotImplementedError(
                "MiniMax API key not set. Set MINIMAX_API_KEY env var or use --provider=mock"
            )

        import urllib.request
        import urllib.error

        # TODO: Replace with real MiniMax image API endpoint once billing is active
        # Expected: POST /v1/image_generation with { model, prompt, num_images }
        # MiniMax image-01 model: https://api.minimax.io/v1/image_generation
        raise NotImplementedError(
            "MiniMax image generation not yet wired. "
            "Use --provider=mock or --provider=stable_diffusion for testing."
        )

    def _mock_generate(
        self,
        prompt: str,
        options: GenerationOptions,
        character: Optional[CharacterProfile],
    ) -> ImageResult:
        """Mock image generation — creates a placeholder PNG with the prompt baked in."""
        logger.info(f"[MOCK] generate(prompt={prompt[:60]!r})")

        out_path = self._save_image_placeholder(prompt, options, character)
        seed = options.seed or 42

        return ImageResult(
            success=True,
            local_path=out_path,
            prompt=prompt,
            negative_prompt=options.negative_prompt,
            seed=seed,
            width=options.width,
            height=options.height,
            provider=ImageProvider.MOCK.value,
            character_profile_name=character.name if character else None,
        )

    # ------------------------------------------------------------------
    # Image saving utilities
    # ------------------------------------------------------------------

    def _save_image(
        self,
        img,
        options: GenerationOptions,
        character: Optional[CharacterProfile],
    ) -> str:
        """Save a PIL Image to disk. Returns the local path."""
        out_dir = Path(options.output_dir or str(OUTPUT_DIR / "images"))
        out_dir.mkdir(parents=True, exist_ok=True)

        filename = self._make_filename(prompt=img.prompt if hasattr(img, "prompt") else "", options=options)
        ext = options.output_format.value
        if ext == "jpg":
            ext = "jpeg"
        filepath = out_dir / f"{filename}.{ext}"
        img.save(str(filepath), quality=95)
        return str(filepath)

    def _save_image_placeholder(
        self,
        prompt: str,
        options: GenerationOptions,
        character: Optional[CharacterProfile],
    ) -> str:
        """Create a placeholder PNG with a text label (for mock / testing)."""
        try:
            from PIL import Image, ImageDraw, ImageFont
        except ImportError:
            logger.warning("PIL not available — returning no path")
            return str(OUTPUT_DIR / "images" / "mock_placeholder.png")

        w, h = options.width, options.height
        color = (20 + hash(prompt) % 20, 30 + hash(prompt) % 15, 50 + hash(prompt) % 20)

        img = Image.new("RGB", (w, h), color)
        draw = ImageDraw.Draw(img)

        # Truncate prompt to fit
        label = f"[MOCK IMAGE]\n{prompt[:80]}"
        if character:
            label += f"\nCharacter: {character.name}"

        try:
            font = ImageFont.truetype("arial.ttf", 24)
        except Exception:
            font = ImageFont.load_default()

        # Word-wrap the label
        max_chars_per_line = int(w / 10)
        lines = []
        words = label.split()
        line = ""
        for word in words:
            test = (line + " " + word).strip()
            if len(test) > max_chars_per_line:
                lines.append(line)
                line = word
            else:
                line = test
        lines.append(line)

        y = h // 3
        for l in lines:
            draw.text((20, y), l, fill=(200, 200, 200), font=font)
            y += 32

        out_dir = Path(options.output_dir or str(OUTPUT_DIR / "images"))
        out_dir.mkdir(parents=True, exist_ok=True)

        filename = self._make_filename(prompt=prompt, options=options)
        filepath = out_dir / f"{filename}.png"
        img.save(str(filepath))
        return str(filepath)

    @staticmethod
    def _make_filename(prompt: str, options: GenerationOptions) -> str:
        """Generate a sanitized filename from a prompt and options."""
        sanitized = "".join(c if c.isalnum() or c in (" ", "-", "_") else "_" for c in prompt[:40])
        sanitized = sanitized.strip().replace(" ", "_") or "img"
        seed_suffix = options.seed if options.seed else hash(prompt) % 10000
        return f"{sanitized}_{seed_suffix}"


# ---------------------------------------------------------------------------
# CLI / self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import os
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s",
    )

    print("=" * 60)
    print("ImageGenerator — Self-Test")
    print("=" * 60)

    # 1. Mock mode
    print("\n[1] Mock mode (no API needed)")
    gen = ImageGenerator(provider="mock")
    result = gen.generate(
        "a person working at a clean minimalist desk, morning light, cinematic",
        options=GenerationOptions(width=512, height=512),
    )
    print(f"    success={result.success}, path={result.local_path}, seed={result.seed}")
    assert result.success, "Mock generation failed"

    # 2. Character profile + mock
    print("\n[2] Character consistency (LoRA placeholder)")
    alex = CharacterProfile(
        name="Alex",
        description="young professional, warm smile, short dark hair, casual business attire",
        seed=12345,
    )
    char_id = gen.register_character(alex)
    r1 = gen.generate("office scene", character=alex)
    r2 = gen.generate("coffee shop scene", character=alex)
    print(f"    char_id={char_id}, r1_path={r1.local_path}, r2_path={r2.local_path}")
    assert r1.character_profile_name == "Alex"
    assert r2.character_profile_name == "Alex"

    # 3. Batch generation
    print("\n[3] Batch generation (5 prompts)")
    prompts = [
        "establishing wide shot: city skyline at golden hour",
        "medium shot: person walking in modern office corridor",
        "closeup: hands typing on laptop keyboard",
        "over-shoulder: person reading a book in a cafe",
        "closeup: person smiling at the camera, warm bokeh background",
    ]
    batch = gen.generate_batch(
        prompts,
        options=GenerationOptions(width=512, height=512),
    )
    print(f"    total={batch.total}, succeeded={batch.succeeded}, "
          f"failed={batch.failed}, time={batch.total_time_seconds:.1f}s")
    assert batch.succeeded == batch.total, f"Some batch items failed: {batch.errors}"

    # 4. Storyboard integration (uses Scene dataclass from storyboard_generator)
    print("\n[4] Storyboard integration")
    try:
        from storyboard_generator import StoryboardGenerator, Scene

        # Create mock scenes directly
        scenes = [
            Scene(
                scene_number=1,
                start_time=0.0,
                end_time=6.0,
                duration=6.0,
                script_segment="Your morning routine is secretly destroying your productivity.",
                visual_direction="Establishing wide shot: morning desk setup, golden light",
                image_prompt="wide establishing shot: clean minimalist desk with laptop and coffee, golden morning light, cinematic",
                negative_prompt="cluttered desk, dark room, low quality",
                shot_type="wide establishing",
                camera_movement="fade_in",
            ),
            Scene(
                scene_number=2,
                start_time=6.0,
                end_time=12.0,
                duration=6.0,
                script_segment="Most people wake up and immediately check their phone.",
                visual_direction="Medium shot: person reaching for phone on nightstand",
                image_prompt="medium shot: person reaching for smartphone on nightstand, morning light, cinematic",
                negative_prompt="low quality, blurry",
                shot_type="medium",
                camera_movement="static",
            ),
        ]

        batch2 = gen.generate_from_storyboard(scenes)
        print(f"    total={batch2.total}, succeeded={batch2.succeeded}, "
              f"failed={batch2.failed}, time={batch2.total_time_seconds:.1f}s")
        assert batch2.succeeded == batch2.total, f"Storyboard batch had failures: {batch2.errors}"
    except ImportError as exc:
        print(f"    Skipped (storyboard_generator not importable): {exc}")

    # 5. Provider auto-detection
    print("\n[5] Provider auto-detection")
    auto_gen = ImageGenerator(provider="auto")
    print(f"    Detected provider: {auto_gen._provider.value}")

    # 6. GenerationOptions
    print("\n[6] GenerationOptions serialization")
    opts = GenerationOptions(width=768, height=768, seed=999, style="3d render")
    opts_dict = asdict(opts)
    print(f"    opts keys: {list(opts_dict.keys())}")

    # 7. BatchResult serialization
    print("\n[7] BatchResult serialization")
    result_json = json.dumps(batch.to_dict(), indent=2)
    print(f"    JSON keys: {list(json.loads(result_json).keys())}")

    # 8. CharacterProfile save/load
    print("\n[8] CharacterProfile save/load")
    tmp_path = str(BASE_DIR / "temp" / "test_character.json")
    alex.save(tmp_path)
    loaded = CharacterProfile.load(tmp_path)
    assert loaded.name == alex.name
    assert loaded.description == alex.description
    print(f"    Saved and loaded: {loaded.name}")

    print("\n" + "=" * 60)
    print("All self-tests PASSED.")
    print("=" * 60)
    sys.exit(0)
