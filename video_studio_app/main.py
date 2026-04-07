"""
video_studio_app/main.py

Video Studio orchestrator — ties all modules together.

Usage:
    python -m video_studio_app.main --script <script_file> [--output <dir>]

Pipeline stages:
  1. Parse / generate storyboard from script
  2. Generate images for each scene
  3. Fetch stock footage for each scene
  4. Assemble scenes into video (images + footage + audio)
  5. Generate voice-over audio
  6. Add subtitles / captions
  7. Optimize for upload (title, description, tags, thumbnail)
  8. Upload to platforms (TikTok, YouTube, etc.)
  9. Track performance
"""

import argparse
import logging
import sys
from pathlib import Path

from .config import LOG_LEVEL, LOG_FILE, OUTPUT_DIR, MOCK_MODE
from . import minimax_client, config

# Module-level logger
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("video_studio")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="TKP Video Studio — Automated video production pipeline"
    )
    parser.add_argument(
        "--script",
        type=Path,
        required=True,
        help="Path to script file (plain text, one scene per --- separator)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_DIR,
        help="Output directory (default: ./output)",
    )
    parser.add_argument(
        "--skip-upload",
        action="store_true",
        help="Skip upload stage (generate video only)",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Force mock mode (no real API calls)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Set log level to DEBUG",
    )
    return parser.parse_args()


def run_pipeline(args: argparse.Namespace) -> None:
    """
    Full pipeline:
    storyboard → images → footage → audio → assembly → subtitles → SEO → upload
    """
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.mock:
        config.MOCK_MODE = True
        logger.info("Mock mode forced ON")

    logger.info(f"Pipeline starting — script: {args.script}")
    logger.info(f"Mock mode: {MOCK_MODE}")

    # ── Stage 1: Storyboard ──────────────────────────────────────────────────
    logger.info("[1/8] Generating storyboard from script...")
    try:
        from .storyboard_generator import StoryboardGenerator

        sb_gen = StoryboardGenerator()
        storyboard = sb_gen.generate_from_script(args.script.read_text(encoding="utf-8"))
        logger.info(f"  → {len(storyboard.scenes)} scenes generated")
    except ImportError as exc:
        logger.error(f"storyboard_generator.py not found: {exc}")
        raise

    # ── Stage 2: Images ──────────────────────────────────────────────────────
    logger.info("[2/8] Generating images for each scene...")
    try:
        from .image_generator import ImageGenerator
        from .minimax_client import MiniMaxClient

        img_gen = ImageGenerator(mmc=MiniMaxClient())
        for scene in storyboard.scenes:
            scene.images = img_gen.generate_for_scene(scene, output_dir / "images")
        logger.info("  → Images generated")
    except ImportError as exc:
        logger.warning(f"image_generator.py not ready: {exc} — skipping")

    # ── Stage 3: Stock Footage ───────────────────────────────────────────────
    logger.info("[3/8] Fetching stock footage...")
    try:
        from .footage_fetcher import FootageFetcher

        fetcher = FootageFetcher()
        for scene in storyboard.scenes:
            scene.footage = fetcher.search_for_scene(scene, output_dir / "footage")
        logger.info("  → Footage fetched")
    except ImportError as exc:
        logger.warning(f"footage_fetcher.py not ready: {exc} — skipping")

    # ── Stage 4: TTS Voice-over ─────────────────────────────────────────────
    logger.info("[4/8] Generating voice-over audio...")
    try:
        from .minimax_client import MiniMaxClient

        mmc = MiniMaxClient()
        for scene in storyboard.scenes:
            result = mmc.generate_voice(
                scene.narration or scene.script,
                output_path=str(output_dir / "audio" / f"scene_{scene.number:03d}.mp3"),
            )
            scene.audio_path = result.local_path
        logger.info("  → Audio generated")
    except Exception as exc:
        logger.warning(f"TTS generation failed: {exc} — skipping")

    # ── Stage 5: Video Assembly ─────────────────────────────────────────────
    logger.info("[5/8] Assembling video scenes...")
    try:
        from .video_assembler import VideoAssembler

        assembler = VideoAssembler()
        video_path = assembler.assemble(
            storyboard,
            output_path=output_dir / "video" / "final.mp4",
        )
        logger.info(f"  → Video assembled: {video_path}")
    except ImportError as exc:
        logger.error(f"video_assembler.py required: {exc}")
        raise

    # ── Stage 6: Subtitles ───────────────────────────────────────────────────
    logger.info("[6/8] Adding subtitles...")
    try:
        from .video_assembler import VideoAssembler

        assembler = VideoAssembler()
        subtitled_path = assembler.add_subtitles(video_path, output_dir / "video")
        logger.info(f"  → Subtitles added: {subtitled_path}")
    except Exception as exc:
        logger.warning(f"Subtitles failed: {exc} — using original")

    # ── Stage 7: SEO Optimization ───────────────────────────────────────────
    logger.info("[7/8] Generating SEO metadata...")
    try:
        from .seo_optimizer import SEOOptimizer

        seo = SEOOptimizer()
        meta = seo.optimize(storyboard)
        meta_path = output_dir / "seo_metadata.json"
        import json
        meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False))
        logger.info(f"  → SEO metadata: {meta_path}")
    except ImportError as exc:
        logger.warning(f"seo_optimizer.py not ready: {exc}")

    # ── Stage 8: Upload ──────────────────────────────────────────────────────
    if not args.skip_upload:
        logger.info("[8/8] Uploading to platforms...")
        try:
            from .upload_tracker import UploadTracker

            tracker = UploadTracker()
            results = tracker.upload_video(subtitled_path or video_path, meta)
            logger.info(f"  → Upload results: {results}")
        except ImportError as exc:
            logger.warning(f"upload_tracker.py not ready: {exc}")
    else:
        logger.info("[8/8] Upload skipped (--skip-upload)")

    logger.info("Pipeline complete.")


def main() -> None:
    args = parse_args()
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if not args.script.exists():
        logger.error(f"Script file not found: {args.script}")
        sys.exit(1)

    try:
        run_pipeline(args)
    except Exception as exc:
        logger.exception(f"Pipeline failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
