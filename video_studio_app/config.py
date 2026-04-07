"""
video_studio_app/config.py
Settings and configuration for the Video Studio Tool.
"""

import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
ASSETS_DIR = BASE_DIR / "assets"
TEMP_DIR = BASE_DIR / "temp"

# Create dirs on import
OUTPUT_DIR.mkdir(exist_ok=True)
ASSETS_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

# ── MiniMax API ──────────────────────────────────────────────────────────────
MINIMAX_BASE_URL = os.getenv("MINIMAX_BASE_URL", "https://api.minimax.io")
# ANTHROPIC_TOKEN_KEY is the actual key name in .env (used for all MiniMax endpoints)
MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY") or os.getenv("ANTHROPIC_TOKEN_KEY", "")
MINIMAX_GROUP_ID = os.getenv("MINIMAX_GROUP_ID", "")

# ── Image Generation ──────────────────────────────────────────────────────────
IMAGE_PROVIDER = os.getenv("IMAGE_PROVIDER", "minimax")  # "minimax" | "stable_diffusion" | "mock"
SD_MODEL_PATH = os.getenv("SD_MODEL_PATH", "")  # Local ComfyUI / Stable Diffusion weights path

# ── TTS / Voice ───────────────────────────────────────────────────────────────
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "minimax")  # "minimax" | "elevenlabs" | "sapi"
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")

# ── Stock Footage ─────────────────────────────────────────────────────────────
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
PIXABAY_API_KEY = os.getenv("PIXABAY_API_KEY", "")

# ── Upload ─────────────────────────────────────────────────────────────────────
TIKTOK_SESSION_COOKIES = os.getenv("TIKTOK_SESSION_COOKIES", "")
YOUTUBE_CLIENT_SECRETS = os.getenv("YOUTUBE_CLIENT_SECRETS", "")   # path or inline JSON
YOUTUBE_REFRESH_TOKEN  = os.getenv("YOUTUBE_REFRESH_TOKEN", "")

# ── Facebook / Instagram Graph API ────────────────────────────────────────────
FACEBOOK_ACCESS_TOKEN        = os.getenv("FACEBOOK_ACCESS_TOKEN", "")
FACEBOOK_PAGE_ID             = os.getenv("FACEBOOK_PAGE_ID", "")
FACEBOOK_APP_ID              = os.getenv("FACEBOOK_APP_ID", "")
FACEBOOK_APP_SECRET          = os.getenv("FACEBOOK_APP_SECRET", "")
INSTAGRAM_BUSINESS_USER_ID   = os.getenv("INSTAGRAM_BUSINESS_USER_ID", "")

# ── Video Settings ───────────────────────────────────────────────────────────
DEFAULT_FPS = 30
DEFAULT_RESOLUTION = (1080, 1920)  # 9:16 vertical (TikTok / Shorts)
DEFAULT_CODEC = "libx264"
DEFAULT_AUDIO_BITRATE = "128k"
DEFAULT_VIDEO_BITRATE = "4M"

# ── FFmpeg ───────────────────────────────────────────────────────────────────
FFMPEG_PATH = os.getenv("FFMPEG_PATH", "ffmpeg")  # Assumes ffmpeg on PATH
FFPROBE_PATH = os.getenv("FFPROBE_PATH", "ffprobe")

# ── Logging ─────────────────────────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FILE = BASE_DIR / "video_studio.log"

# ── Mock / Dev Mode ─────────────────────────────────────────────────────────
MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() in ("true", "1", "yes")
