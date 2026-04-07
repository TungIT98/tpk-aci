"""
video_studio_app/youtube_uploader.py

YouTube Data API v3 upload via google-api-python-client + oauth2client.

Setup required:
1. Create a YouTube Data API v3 project at console.cloud.google.com
2. Enable YouTube Data API v3
3. Create OAuth 2.0 credentials (Desktop app type)
4. Save client_secrets.json next to this file OR set YOUTUBE_CLIENT_SECRETS_JSON env var
5. First run: authenticate via browser (token stored in youtube_token.json)

API quota: 10,000 units/day free; each upload = ~1,500 units.
Docs: https://developers.google.com/youtube/v3/docs
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional

from .config import YOUTUBE_CLIENT_SECRETS, YOUTUBE_REFRESH_TOKEN, BASE_DIR

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
TOKEN_PATH = BASE_DIR / "youtube_token.json"
RETRIES = 3
CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB chunks


class YouTubeUploader:
    """
    YouTube video uploader using YouTube Data API v3.

    Supports:
    - OAuth 2.0 token refresh
    - Resumable uploads (large file support)
    - Custom title, description, tags, thumbnail
    - Privacy setting (public/unlisted/private)

    Usage:
        uploader = YouTubeUploader()
        result = uploader.upload_video(
            "output/final.mp4",
            title="My Video Title",
            description="Video description",
            tags=["productivity", "tips"],
        )
        print(result.video_id, result.url)
    """

    def __init__(
        self,
        client_secrets: Optional[str] = None,
        token_path: Optional[Path] = None,
    ):
        self._creds = None
        self._youtube = None

        # Resolve client secrets source
        secrets_raw = client_secrets or YOUTUBE_CLIENT_SECRETS
        if secrets_raw and secrets_raw.startswith("{"):
            # Inline JSON
            self._secrets = json.loads(secrets_raw)
        else:
            # Treat as path to client_secrets.json
            secrets_path = Path(secrets_raw) if secrets_raw else BASE_DIR / "client_secrets.json"
            self._secrets = None
            if secrets_path.exists():
                self._secrets = json.loads(secrets_path.read_text())

        self._token_path = token_path or TOKEN_PATH

        if self._secrets is None:
            logger.warning(
                "YouTubeUploader: No client_secrets found. "
                "Set YOUTUBE_CLIENT_SECRETS (JSON string or file path) or "
                "place client_secrets.json next to this file."
            )

    @property
    def enabled(self) -> bool:
        return self._secrets is not None

    # ── Public API ────────────────────────────────────────────────────────────

    def upload_video(
        self,
        video_path: str,
        title: str,
        description: str = "",
        tags: Optional[list[str]] = None,
        thumbnail_path: Optional[str] = None,
        category_id: str = "22",  # People & Blogs
        privacy_status: str = "private",
        duration: Optional[int] = None,
    ) -> YouTubeResult:
        """
        Upload a video to YouTube.

        Args:
            video_path:       Path to the MP4 video file
            title:            Video title (max 100 chars)
            description:      Video description
            tags:             List of tag strings
            thumbnail_path:   Optional path to thumbnail image
            category_id:      YouTube category ID (default: 22 People & Blogs)
            privacy_status:  "public" | "unlisted" | "private"
            duration:         Video duration in seconds (used for polling)

        Returns:
            YouTubeResult with video_id, url, thumbnail_url on success
        """
        import googleapiclient.discovery
        import googleapiclient.errors
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request

        video_path = Path(video_path)
        if not video_path.exists():
            return YouTubeResult(success=False, error=f"File not found: {video_path}")

        self._ensure_credentials()
        if self._creds is None:
            return YouTubeResult(success=False, error="No OAuth credentials — run manual auth first")

        youtube = googleapiclient.discovery.build(
            "youtube", "v3",
            credentials=self._creds,
            cache_discovery=False,
        )

        body = {
            "snippet": {
                "title": title[:100],
                "description": description,
                "tags": (tags or [])[:500],
                "categoryId": category_id,
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": False,
            },
        }

        try:
            # Initiate resumable upload
            insert_request = youtube.videos().insert(
                part="snippet,status",
                body=body,
                media_body=googleapiclient.discovery.MediaUpload(
                    video_path,
                    chunksize=CHUNK_SIZE,
                    resumable=True,
                ),
            )

            result = insert_request.execute()
            video_id = result["id"]
            video_url = f"https://youtu.be/{video_id}"

            # Set custom thumbnail if provided
            thumbnail_url = None
            if thumbnail_path and Path(thumbnail_path).exists():
                try:
                    youtube.thumbnails().set(
                        videoId=video_id,
                        media_body=googleapiclient.discovery.MediaUpload(thumbnail_path),
                    ).execute()
                    thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
                except Exception as exc:
                    logger.warning(f"[YouTube] thumbnail set failed: {exc}")

            logger.info(f"[YouTube] uploaded: {video_url}")
            return YouTubeResult(
                video_id=video_id,
                url=video_url,
                thumbnail_url=thumbnail_url,
                privacy_status=privacy_status,
                success=True,
            )

        except googleapiclient.errors.HttpError as exc:
            logger.error(f"[YouTube] upload HTTP error: {exc}")
            return YouTubeResult(success=False, error=str(exc))
        except Exception as exc:
            logger.error(f"[YouTube] upload failed: {exc}")
            return YouTubeResult(success=False, error=str(exc))

    # ── OAuth flow ────────────────────────────────────────────────────────────

    def _ensure_credentials(self) -> None:
        """Load or refresh OAuth credentials."""
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from google.oauth2.lib import store

        if self._secrets is None:
            return

        creds = None
        if self._token_path.exists():
            creds = Credentials.from_authorized_user_info(
                json.loads(self._token_path.read_text()),
                SCOPES,
            )

        if creds and creds.valid:
            self._creds = creds
            return

        # Refresh if expired
        if creds and creds.expired and creds.refresh_token:
            for attempt in range(RETRIES):
                try:
                    creds.refresh(Request())
                    self._token_path.write_text(creds.to_json())
                    self._creds = creds
                    return
                except Exception as exc:
                    logger.warning(f"[YouTube] token refresh attempt {attempt+1} failed: {exc}")
                    time.sleep(2 ** attempt)

        # Need to run manual auth — write instructions
        if not self._token_path.exists():
            logger.warning(
                "[YouTube] No stored token. Run this uploader once interactively to authorize.\n"
                "  python -c \"from video_studio_app.youtube_uploader import YouTubeUploader; "
                "YouTubeUploader()._interactive_auth()\""
            )

    def _interactive_auth(self) -> None:
        """Run the OAuth consent flow and save the token. Call this once manually."""
        from google_auth_oauthlib.flow import InstalledAppFlow

        if self._secrets is None:
            raise RuntimeError("No client_secrets available for OAuth flow")

        flow = InstalledAppFlow.from_client_config(self._secrets, SCOPES)
        self._creds = flow.run_local_server(port=0)
        self._token_path.write_text(self._creds.to_json())
        logger.info(f"[YouTube] Token saved to {self._token_path}")


# ── Data classes ─────────────────────────────────────────────────────────────

class YouTubeResult:
    __slots__ = ("video_id", "url", "thumbnail_url", "privacy_status", "error", "success")

    def __init__(
        self,
        video_id: str = "",
        url: str = "",
        thumbnail_url: Optional[str] = None,
        privacy_status: str = "private",
        error: Optional[str] = None,
        success: bool = False,
    ):
        self.video_id = video_id
        self.url = url
        self.thumbnail_url = thumbnail_url
        self.privacy_status = privacy_status
        self.error = error
        self.success = success

    def __repr__(self) -> str:
        if self.success:
            return f"<YouTubeResult id={self.video_id!r} url={self.url!r}>"
        return f"<YouTubeResult FAILED: {self.error!r}>"


# ── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="YouTube Uploader CLI")
    sub = parser.add_subparsers(dest="cmd")

    up = sub.add_parser("upload", help="Upload video to YouTube")
    up.add_argument("video", help="Path to video file")
    up.add_argument("--title", "-t", required=True, help="Video title")
    up.add_argument("--description", "-d", default="", help="Video description")
    up.add_argument("--tags", nargs="+", default=[], help="Tags")
    up.add_argument("--privacy", "-p", default="private",
                    choices=["public", "unlisted", "private"], help="Privacy status")
    up.add_argument("--thumbnail", help="Thumbnail image path")
    up.add_argument("--auth", action="store_true", help="Run OAuth consent flow first")

    args = parser.parse_args()
    if not args.cmd:
        parser.print_help()
        sys.exit(0)

    uploader = YouTubeUploader()

    if args.auth:
        uploader._interactive_auth()
        print("✅ Authorization complete. Token saved.")
        sys.exit(0)

    result = uploader.upload_video(
        video_path=args.video,
        title=args.title,
        description=args.description,
        tags=args.tags,
        privacy_status=args.privacy,
        thumbnail_path=args.thumbnail,
    )

    if result.success:
        print(f"✅ Uploaded: {result.url}")
    else:
        print(f"❌ Failed: {result.error}")
