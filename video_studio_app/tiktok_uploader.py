"""
video_studio_app/tiktok_uploader.py

TikTok Creator API v2 integration for automated video posting.

API docs: https://developers.tiktok.com/doc/tiktok-api-v2-video-upload

Requirements:
  1. TikTok Creator app approved at developers.tiktok.com
  2. OAuth flow completed (see scripts/oauth-tiktok.js)
  3. .env vars: TIKTOK_ACCESS_TOKEN, TIKTOK_REFRESH_TOKEN,
                TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET

Note: TikTok Creator API requires app review before production use.
  Until approved, use the Node.js lib/upload/tiktok.js for the OAuth
  flow, then set tokens in .env so this module can post videos.

Fallback: If API is not approved, videos can be posted manually or via
  the TikTok Ads API (for paid promotion) — not covered here.
"""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

from .config import BASE_DIR

logger = logging.getLogger(__name__)

BASE_URL = "https://open.tiktokapis.com/v2"
TOKEN_URL = f"{BASE_URL}/oauth/token/"
UPLOAD_INIT_URL = f"{BASE_URL}/video/upload/init/"
PUBLISH_URL = f"{BASE_URL}/video/publish/"

# Env var names (TikTok Creator API uses these keys)
TK_ACCESS_TOKEN  = os.getenv("TIKTOK_ACCESS_TOKEN", "")
TK_REFRESH_TOKEN = os.getenv("TIKTOK_REFRESH_TOKEN", "")
TK_CLIENT_KEY    = os.getenv("TIKTOK_CLIENT_KEY", "")
TK_CLIENT_SECRET = os.getenv("TIKTOK_CLIENT_SECRET", "")


class TikTokUploader:
    """
    TikTok Creator API v2 uploader.

    Usage:
        uploader = TikTokUploader()
        result = uploader.upload_video(
            video_path="output/final.mp4",
            title="Check this out! #fyp #productivity",
            description="Tips that changed my workflow",
        )
        print(result.post_id, result.share_url)
    """

    def __init__(
        self,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        client_key: Optional[str] = None,
        client_secret: Optional[str] = None,
    ):
        self.access_token  = access_token  or TK_ACCESS_TOKEN
        self.refresh_token  = refresh_token or TK_REFRESH_TOKEN
        self.client_key     = client_key    or TK_CLIENT_KEY
        self.client_secret  = client_secret or TK_CLIENT_SECRET
        self._enabled = bool(self.access_token or self.refresh_token)
        if not self._enabled:
            logger.warning(
                "TikTokUploader: No credentials found. "
                "Set TIKTOK_ACCESS_TOKEN / TIKTOK_REFRESH_TOKEN in .env, "
                "or run `node scripts/oauth-tiktok.js` to complete OAuth."
            )

    @property
    def enabled(self) -> bool:
        return self._enabled

    # ── Upload flow ──────────────────────────────────────────────────────────

    def upload_video(
        self,
        video_path: str,
        title: str = "",
        description: str = "",
        tags: Optional[list[str]] = None,
        post_mode: str = "NOW",
    ) -> TikTokResult:
        """
        Upload and publish a video to TikTok.

        Args:
            video_path:   Path to MP4 video (max 287.6 MB, recommended < 60s for best reach)
            title:        Video caption (up to 2,200 chars, includes hashtags)
            description:  Additional description text (appended to title if empty)
            tags:         Hashtag list (e.g. ["productivity", "tips"])
            post_mode:    "NOW" to publish immediately, "SCHEDULE" if scheduling (requires extra params)

        Returns:
            TikTokResult with post_id and share_url on success
        """
        import urllib.request
        import urllib.parse
        import urllib.error

        video_path = Path(video_path)
        if not video_path.exists():
            return TikTokResult(success=False, error=f"File not found: {video_path}")

        # Resolve access token (refresh if needed)
        token = self._resolve_token()
        if not token:
            return TikTokResult(
                success=False,
                error="No valid TikTok access token. Complete OAuth at scripts/oauth-tiktok.js",
            )

        caption = (title or description)[:2200]

        try:
            # Step 1: Init upload
            init_req = urllib.request.Request(
                UPLOAD_INIT_URL,
                data=json.dumps({"upload_type": "upload", "source": "FILE_UPLOAD"}).encode(),
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(init_req, timeout=30) as resp:
                init_data = json.loads(resp.read())
            upload_url  = init_data["upload_url"]
            upload_id   = init_data["upload_id"]

            # Step 2: POST video bytes to TikTok's signed upload URL
            video_bytes = video_path.read_bytes()
            upload_req = urllib.request.Request(
                upload_url,
                data=video_bytes,
                headers={"Content-Type": "video/mp4"},
                method="POST",
            )
            with urllib.request.urlopen(upload_req, timeout=120) as resp:
                if resp.status not in (200, 201, 204):
                    return TikTokResult(
                        success=False,
                        error=f"Video upload failed: HTTP {resp.status}",
                    )

            # Step 3: Publish
            publish_payload = {
                "upload_id": upload_id,
                "caption": caption,
                "post_mode": post_mode,
            }
            if tags:
                publish_payload["hashtag_strings"] = [t.strip().lstrip("#") for t in tags[:30]]

            publish_req = urllib.request.Request(
                PUBLISH_URL,
                data=json.dumps(publish_payload).encode(),
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(publish_req, timeout=30) as resp:
                publish_data = json.loads(resp.read())

            post_id   = publish_data.get("video_id", "")
            share_url = f"https://www.tiktok.com/@yourpage/video/{post_id}"
            logger.info(f"[TikTok] posted: {share_url}")
            return TikTokResult(post_id=post_id, share_url=share_url, success=True)

        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            logger.error(f"[TikTok] HTTP {exc.code}: {body}")
            # Try token refresh on 401
            if exc.code == 401:
                self._force_refresh()
            return TikTokResult(success=False, error=f"HTTP {exc.code}: {body}")
        except Exception as exc:
            logger.error(f"[TikTok] upload failed: {exc}")
            return TikTokResult(success=False, error=str(exc))

    # ── Token management ─────────────────────────────────────────────────────

    def _resolve_token(self) -> Optional[str]:
        """Return a valid access token, refreshing if expired."""
        if self.access_token:
            return self.access_token
        return self._do_refresh()[0] if self._do_refresh() else None

    def _do_refresh(self) -> Optional[dict]:
        """Attempt to refresh the access token. Returns (access_token,) or None."""
        import urllib.request
        import urllib.parse

        if not (self.refresh_token and self.client_key and self.client_secret):
            return None

        data = urllib.parse.urlencode({
            "client_key":    self.client_key,
            "client_secret": self.client_secret,
            "grant_type":    "refresh_token",
            "refresh_token": self.refresh_token,
        }).encode()

        req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                token_data = json.loads(resp.read())
            self.access_token  = token_data.get("access_token", "")
            self.refresh_token = token_data.get("refresh_token", self.refresh_token)
            self._enabled = True
            # Persist to .env
            self._save_tokens()
            return token_data
        except Exception as exc:
            logger.error(f"[TikTok] token refresh failed: {exc}")
            return None

    def _force_refresh(self) -> None:
        """Force a token refresh on next call."""
        self.access_token = ""

    def _save_tokens(self) -> None:
        """Save updated tokens back to .env."""
        env_path = BASE_DIR.parent / ".env"
        if not env_path.exists():
            return
        lines = env_path.read_text(encoding="utf-8").splitlines()
        updated = {}
        for line in lines:
            if "=" not in line:
                updated[line] = None
                continue
            k, v = line.split("=", 1)
            updated[k.strip()] = v.strip()
        updated["TIKTOK_ACCESS_TOKEN"]  = self.access_token
        updated["TIKTOK_REFRESH_TOKEN"] = self.refresh_token
        env_path.write_text(
            "\n".join(f"{k}={v}" for k, v in updated.items()) + "\n",
            encoding="utf-8",
        )
        logger.info("[TikTok] tokens updated in .env")

    # ── OAuth helpers ────────────────────────────────────────────────────────

    def get_auth_url(self, redirect_uri: str, state: str = "tkp-upload") -> str:
        """
        Build the TikTok OAuth authorization URL.

        Args:
            redirect_uri: Must match the URI registered in your TikTok app settings
            state:       CSRF state token

        Returns:
            URL to direct the operator to for manual authorization
        """
        scopes = ["video.upload", "video.publish", "video.manage", "user.info.basic"]
        params = urllib.parse.urlencode({
            "client_key":    self.client_key,
            "redirect_uri":  redirect_uri,
            "scope":         ",".join(scopes),
            "response_type": "code",
            "state":         state,
        })
        return f"https://www.tiktok.com/v2/auth/authorize/?{params}"


# ── Data classes ─────────────────────────────────────────────────────────────

class TikTokResult:
    __slots__ = ("post_id", "share_url", "error", "success")

    def __init__(
        self,
        post_id: str = "",
        share_url: str = "",
        error: Optional[str] = None,
        success: bool = False,
    ):
        self.post_id  = post_id
        self.share_url = share_url
        self.error    = error
        self.success  = success

    def __repr__(self) -> str:
        if self.success:
            return f"<TikTokResult post_id={self.post_id!r} url={self.share_url!r}>"
        return f"<TikTokResult FAILED: {self.error!r}>"


# ── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    import urllib.parse

    parser = argparse.ArgumentParser(description="TikTok Uploader CLI")
    sub = parser.add_subparsers(dest="cmd")

    up = sub.add_parser("upload", help="Upload video to TikTok")
    up.add_argument("video", help="Path to MP4 video")
    up.add_argument("--title", "-t", default="", help="Caption / title")
    up.add_argument("--tags", nargs="+", default=[], help="Hashtags (no # needed)")

    args = parser.parse_args()
    if not args.cmd:
        parser.print_help()
        sys.exit(0)

    uploader = TikTokUploader()
    result = uploader.upload_video(args.video, title=args.title, tags=args.tags)

    if result.success:
        print(f"✅ Posted: {result.share_url}")
    else:
        print(f"❌ Failed: {result.error}")
        if "credentials" in result.error.lower():
            print("\nRun OAuth setup first:")
            print("  node scripts/oauth-tiktok.js --url")
            print("  # Then: node scripts/oauth-tiktok.js <code>")
