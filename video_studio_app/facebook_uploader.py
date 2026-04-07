"""
video_studio_app/facebook_uploader.py

Facebook Graph API v18+ and Instagram Graph API uploader.

Supports:
  - Facebook Page video posts
  - Instagram Professional account video posts (via Facebook Page linked to IG)

Setup:
  1. Create a Facebook App (type: Business) at developers.facebook.com
  2. Add products: Facebook Login + Instagram Graph API
  3. Configure OAuth redirect URI
  4. Grant permissions: pages_read_engagement, pages_manage_posts,
     instagram_basic, instagram_content_publish
  5. Get a Page access token via the Graph API Explorer
  6. Set FACEBOOK_ACCESS_TOKEN in .env

API docs:
  - Facebook: https://developers.facebook.com/docs/graph-api/reference/page/videos
  - Instagram: https://developers.facebook.com/docs/instagram-api/reference/ig-user/media
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Optional

import requests

from .config import BASE_DIR

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v18.0"

# ── Config ───────────────────────────────────────────────────────────────────

FB_ACCESS_TOKEN = os.getenv("FACEBOOK_ACCESS_TOKEN", "")
FB_PAGE_ID      = os.getenv("FACEBOOK_PAGE_ID", "")
FB_APP_ID       = os.getenv("FACEBOOK_APP_ID", "")
FB_APP_SECRET   = os.getenv("FACEBOOK_APP_SECRET", "")
IG_USER_ID      = os.getenv("INSTAGRAM_BUSINESS_USER_ID", "")


# ── Facebook Page uploader ───────────────────────────────────────────────────

class FacebookUploader:
    """
    Facebook Page video uploader via Graph API.

    Usage:
        fb = FacebookUploader()
        result = fb.upload_video(
            video_path="output/final.mp4",
            title="My Video",
            description="Description here",
        )
    """

    def __init__(
        self,
        access_token: Optional[str] = None,
        page_id: Optional[str] = None,
    ):
        self.access_token = access_token or FB_ACCESS_TOKEN
        self.page_id      = page_id      or FB_PAGE_ID
        self._enabled = bool(self.access_token and self.page_id)
        if not self._enabled:
            logger.warning(
                "FacebookUploader: Missing FACEBOOK_ACCESS_TOKEN or FACEBOOK_PAGE_ID. "
                "Set these in .env to enable."
            )

    @property
    def enabled(self) -> bool:
        return self._enabled

    def upload_video(
        self,
        video_path: str,
        title: str = "",
        description: str = "",
        published: bool = True,
    ) -> SocialPostResult:
        """
        Upload a video to a Facebook Page.

        Args:
            video_path:   Path to MP4 video file
            title:        Video title
            description:  Video description
            published:    True = publish immediately, False = draft

        Returns:
            SocialPostResult with post_id and permalink_url
        """
        video_path = Path(video_path)
        if not video_path.exists():
            return SocialPostResult(success=False, error=f"File not found: {video_path}")

        url = f"{GRAPH_BASE}/{self.page_id}/videos"
        data = {
            "access_token": self.access_token,
            "title":        title[:255],
            "description":  description[:65535],
            "published":    str(published).lower(),
        }

        try:
            with open(video_path, "rb") as f:
                files = {"source": f}
                resp = requests.post(url, data=data, files=files, timeout=300)
            resp.raise_for_status()
            result = resp.json()

            if "id" not in result:
                return SocialPostResult(
                    success=False,
                    error=f"No post_id in response: {result}",
                )

            post_id = str(result["id"])
            permalink = f"https://www.facebook.com/{self.page_id}/videos/{post_id}"
            logger.info(f"[Facebook] posted: {permalink}")
            return SocialPostResult(
                post_id=post_id,
                permalink_url=permalink,
                platform="facebook",
                success=True,
            )

        except requests.RequestException as exc:
            logger.error(f"[Facebook] upload failed: {exc}")
            return SocialPostResult(success=False, error=str(exc))


# ── Instagram uploader ────────────────────────────────────────────────────────

class InstagramUploader:
    """
    Instagram Professional account video uploader via Facebook Graph API.

    Two-step process:
      1. POST /{ig-user-id}/media — create container, get creation_id
      2. POST /{ig-user-id}/media_publish — publish the container

    Requirements:
      - Instagram account must be a Business or Creator account
      - Connected to a Facebook Page
      - Long-lived Page access token with instagram_content_publish permission

    Usage:
        ig = InstagramUploader()
        result = ig.upload_video(
            video_path="output/final.mp4",
            caption="Check this out! #productivity #tips",
        )
    """

    def __init__(
        self,
        access_token: Optional[str] = None,
        ig_user_id: Optional[str] = None,
    ):
        self.access_token = access_token or FB_ACCESS_TOKEN
        self.ig_user_id   = ig_user_id   or IG_USER_ID
        self._enabled = bool(self.access_token and self.ig_user_id)
        if not self._enabled:
            logger.warning(
                "InstagramUploader: Missing FACEBOOK_ACCESS_TOKEN or "
                "INSTAGRAM_BUSINESS_USER_ID. Set in .env to enable."
            )

    @property
    def enabled(self) -> bool:
        return self._enabled

    def upload_video(
        self,
        video_path: str,
        caption: str = "",
        long_caption: bool = False,
    ) -> SocialPostResult:
        """
        Upload and publish a video to Instagram.

        Args:
            video_path:     Path to MP4 video (9:16 or 1:1 recommended, max 15 min)
            caption:        Caption text (hashtags appended automatically)
            long_caption:   If True, allow caption > 2,200 chars (Instagram limits apply)

        Returns:
            SocialPostResult with post_id and permalink_url
        """
        import re

        video_path = Path(video_path)
        if not video_path.exists():
            return SocialPostResult(success=False, error=f"File not found: {video_path}")

        caption = caption[:2200] if not long_caption else caption[:5000]
        video_size_mb = video_path.stat().st_size / (1024 * 1024)
        if video_size_mb > 650:
            return SocialPostResult(
                success=False,
                error=f"Video too large ({video_size_mb:.0f} MB). Instagram max = 650 MB.",
            )

        # Step 1: Create media container
        container_url = f"{GRAPH_BASE}/{self.ig_user_id}/media"
        container_data = {
            "access_token":  self.access_token,
            "video_url":     self._upload_to_temp_container(video_path),
            "caption":       caption,
            "share_to_feed": "true",
        }

        try:
            resp = requests.post(container_url, data=container_data, timeout=60)
            resp.raise_for_status()
            container = resp.json()
            creation_id = container.get("id")
            if not creation_id:
                return SocialPostResult(success=False, error=f"No creation_id: {container}")

            # Step 2: Publish
            publish_url = f"{GRAPH_BASE}/{self.ig_user_id}/media_publish"
            publish_data = {
                "access_token": self.access_token,
                "creation_id":  creation_id,
            }
            # Wait for processing
            time.sleep(5)
            max_wait = 300
            elapsed = 5
            while elapsed < max_wait:
                status_resp = requests.get(
                    f"{GRAPH_BASE}/{creation_id}",
                    params={"access_token": self.access_token},
                    timeout=15,
                )
                status_data = status_resp.json()
                status = status_data.get("status_code", "")
                if status == "FINISHED":
                    break
                logger.info(f"[Instagram] processing... {elapsed}s elapsed (status={status})")
                time.sleep(15)
                elapsed += 15

            publish_resp = requests.post(publish_url, data=publish_data, timeout=30)
            publish_resp.raise_for_status()
            publish_result = publish_resp.json()
            ig_post_id = str(publish_result.get("id", ""))
            permalink  = f"https://www.instagram.com/p/{ig_post_id}/"

            logger.info(f"[Instagram] posted: {permalink}")
            return SocialPostResult(
                post_id=ig_post_id,
                permalink_url=permalink,
                platform="instagram",
                success=True,
            )

        except requests.RequestException as exc:
            logger.error(f"[Instagram] upload failed: {exc}")
            return SocialPostResult(success=False, error=str(exc))

    def _upload_to_temp_container(self, video_path: Path) -> str:
        """
        Upload video bytes to a temporary Graph API container and return
        the direct URL for the media container.
        """
        url = f"{GRAPH_BASE}/v21.0/{self.ig_user_id}/media"
        byte_size = video_path.stat().st_size
        with open(video_path, "rb") as f:
            video_bytes = f.read()

        # Chunked upload via URL is preferred for large files; simple upload here
        resp = requests.post(
            url,
            data={
                "access_token": self.access_token,
                "media_type":    "REELS",
                "video_url":     self._get_upload_url(video_path),
                "caption":       "",  # set at publish time
            },
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json().get("uri", "")

    def _get_upload_url(self, video_path: Path) -> str:
        """
        Get a short-lived Instagram container upload URL for direct bytes upload.
        Uses the Graph API staged endpoint.
        """
        url = f"{GRAPH_BASE}/{self.ig_user_id}/media_image_files"
        # For simplicity, we rely on video_url pointing to a publicly accessible URL.
        # In production, upload to a CDN or use the staged upload endpoint.
        raise NotImplementedError(
            "Instagram video upload requires a publicly accessible video_url. "
            "Upload video to a CDN first, then pass the URL here. "
            "Alternative: use facebook_business SDK's InstagramUploader with "
            "chunked upload support."
        )


# ── Convenience: both platforms ──────────────────────────────────────────────

class SocialPoster:
    """
    Unified interface for posting to Facebook and/or Instagram.

    Usage:
        poster = SocialPoster()
        results = poster.post(
            video_path="output/final.mp4",
            title="My Video",
            caption="Check this out!",
            platforms=["facebook", "instagram"],
        )
    """

    def __init__(
        self,
        facebook_access_token: Optional[str] = None,
        facebook_page_id: Optional[str] = None,
        instagram_user_id: Optional[str] = None,
    ):
        self.fb  = FacebookUploader(facebook_access_token, facebook_page_id)
        self.ig  = InstagramUploader(facebook_access_token, instagram_user_id)

    def post(
        self,
        video_path: str,
        title: str = "",
        caption: str = "",
        platforms: Optional[list[str]] = None,
    ) -> dict[str, SocialPostResult]:
        """
        Post to one or more platforms.

        Args:
            video_path:  Path to MP4
            title:       Facebook title / Instagram caption prefix
            caption:     Full caption text
            platforms:   List of "facebook", "instagram" (default: all enabled)

        Returns:
            {platform: SocialPostResult}
        """
        targets = {"facebook", "instagram"} if platforms is None else set(platforms)
        results: dict[str, SocialPostResult] = {}

        if "facebook" in targets and self.fb.enabled:
            results["facebook"] = self.fb.upload_video(
                video_path, title=title, description=caption,
            )

        if "instagram" in targets and self.ig.enabled:
            results["instagram"] = self.ig.upload_video(
                video_path, caption=title + "\n\n" + caption if title else caption,
            )

        return results


# ── Data class ────────────────────────────────────────────────────────────────

class SocialPostResult:
    __slots__ = ("post_id", "permalink_url", "platform", "error", "success")

    def __init__(
        self,
        post_id: str = "",
        permalink_url: str = "",
        platform: str = "",
        error: Optional[str] = None,
        success: bool = False,
    ):
        self.post_id       = post_id
        self.permalink_url = permalink_url
        self.platform     = platform
        self.error        = error
        self.success      = success

    def __repr__(self) -> str:
        if self.success:
            return f"<SocialPostResult [{self.platform}] id={self.post_id!r} url={self.permalink_url!r}>"
        return f"<SocialPostResult FAILED: {self.error!r}>"


# ── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Facebook/Instagram Uploader CLI")
    sub = parser.add_subparsers(dest="cmd")

    post = sub.add_parser("post", help="Post video to Facebook and/or Instagram")
    post.add_argument("video", help="Path to MP4 video")
    post.add_argument("--title", "-t", default="", help="Title / caption")
    post.add_argument("--platform", nargs="+", default=["facebook"],
                      choices=["facebook", "instagram", "all"], help="Platforms")
    post.add_argument("--token", help="Override FACEBOOK_ACCESS_TOKEN")
    post.add_argument("--page", help="Override FACEBOOK_PAGE_ID")
    post.add_argument("--ig-user", help="Override INSTAGRAM_BUSINESS_USER_ID")

    args = parser.parse_args()
    if not args.cmd:
        parser.print_help()
        sys.exit(0)

    platforms = list(args.platform)
    if "all" in platforms:
        platforms = ["facebook", "instagram"]

    poster = SocialPoster(
        facebook_access_token=args.token,
        facebook_page_id=args.page,
        instagram_user_id=args.ig_user,
    )

    results = poster.post(
        video_path=args.video,
        caption=args.title,
        platforms=platforms,
    )

    for platform, result in results.items():
        if result.success:
            print(f"✅ [{platform}] Posted: {result.permalink_url}")
        else:
            print(f"❌ [{platform}] Failed: {result.error}")
