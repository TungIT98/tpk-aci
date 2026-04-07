"""
video_studio_app/elevenlabs_client.py

ElevenLabs v1 API integration for high-quality voice synthesis.

API docs: https://api.elevenlabs.io/docs
Free tier: 10,000 characters/month.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
import urllib.parse
import urllib.error
import hashlib
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .config import ELEVENLABS_API_KEY, TEMP_DIR

logger = logging.getLogger(__name__)

BASE_URL = "https://api.elevenlabs.io/v1"

# Well-known voice IDs (ElevenLabs defaults)
BUILTIN_VOICES = {
    "rachel":  "21m00Tcm4TlvDq8ikWAM",   # Rachel — warm female
    "antoni":  "7VCyFzG9VBe6YSToNzBj",   # Antoni — deep male
    "elli":    "MF82m1x2LUnciLkV0sE9",    # Elli — young female
    "josh":    "TXhiOe2OHW5bGrHep5Eq",    # Josh — middle male
    "arnold":  "V3MoMpNHp2MmvScmz2kS",    # Arnold — authoritative male
    "dani":    "pFZP5JQG7iQjIimS37i9",    # Dani — upbeat female
    "glimmer": "z5UAaJjjhBjZVig11Nq",    # Glimmer — soft female
    "fire":    "U4pWvLTEDegPyBasscth",    # Fire — deep male
}

DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"


class ElevenLabsClient:
    """
    ElevenLabs text-to-speech client with mock fallback.

    Usage:
        client = ElevenLabsClient()
        result = client.generate_voice("Hello world", voice_id="rachel")
        print(result.local_path)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = BASE_URL,
    ):
        self.api_key = api_key or ELEVENLABS_API_KEY
        self.base_url = base_url
        self._enabled = bool(self.api_key)
        if not self._enabled:
            logger.warning(
                "ElevenLabsClient: No API key set. "
                "Running in MOCK mode. Set ELEVENLABS_API_KEY to enable."
            )

    @property
    def enabled(self) -> bool:
        return self._enabled

    # ── Voice generation ─────────────────────────────────────────────────────

    def generate_voice(
        self,
        text: str,
        voice_id: str = DEFAULT_VOICE_ID,
        output_path: Optional[str] = None,
        model_id: str = "eleven_monolingual_v1",
        stability: float = 0.5,
        similarity_boost: float = 0.75,
    ) -> VoiceResult:
        """
        Convert text to speech via ElevenLabs API.

        Args:
            text:         Input text (max ~5,000 chars per request)
            voice_id:     ElevenLabs voice ID or a key from BUILTIN_VOICES
            output_path:  Local path to save MP3. Auto-generated if None.
            model_id:     Model to use (eleven_monolingual_v1 or eleven_multilingual_v1)
            stability:    Voice stability 0–1 (lower = more varied)
            similarity_boost: 0–1

        Returns:
            VoiceResult with local_path on success
        """
        if not self._enabled:
            return self._mock_result(text, output_path)

        # Resolve named voice
        vid = BUILTIN_VOICES.get(voice_id, voice_id)

        if output_path is None:
            key = hashlib.sha1(f"{vid}:{text[:40]}".encode()).hexdigest()[:12]
            output_path = str(TEMP_DIR / f"voice_{key}.mp3")

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        payload = json.dumps({
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
            },
        }).encode("utf-8")

        url = f"{self.base_url}/text-to-speech/{vid}"
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                output_path.write_bytes(resp.read())
            duration = self._estimate_duration(text)
            logger.info(f"[ElevenLabs] saved → {output_path}")
            return VoiceResult(
                local_path=str(output_path),
                duration_seconds=duration,
                voice_id=vid,
                success=True,
            )
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            logger.error(f"[ElevenLabs] HTTP {exc.code}: {body}")
            return VoiceResult(success=False, error=f"HTTP {exc.code}: {body}")
        except Exception as exc:
            logger.error(f"[ElevenLabs] error: {exc}")
            return VoiceResult(success=False, error=str(exc))

    def get_available_voices(self) -> list[VoiceInfo]:
        """Return list of voices from the ElevenLabs voice library."""
        if not self._enabled:
            return self._mock_voices()

        url = f"{self.base_url}/voices"
        req = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
            return [
                VoiceInfo(
                    voice_id=v["voice_id"],
                    name=v["name"],
                    category=v.get("category", "professional"),
                    preview_url=v.get("preview_url"),
                    labels=v.get("labels", {}),
                )
                for v in data.get("voices", [])
            ]
        except Exception as exc:
            logger.warning(f"[ElevenLabs] get_voices failed: {exc}")
            return self._mock_voices()

    # ── Mock helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _mock_result(text: str, output_path: Optional[str]) -> VoiceResult:
        logger.info(f"[ElevenLabs MOCK] generate_voice(text={text[:40]!r}...)")
        path = Path(output_path or TEMP_DIR / "voice_mock.mp3")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"")
        return VoiceResult(
            local_path=str(path),
            duration_seconds=max(1.0, len(text) / 10),
            voice_id=DEFAULT_VOICE_ID,
            success=True,
        )

    @staticmethod
    def _mock_voices() -> list[VoiceInfo]:
        return [
            VoiceInfo(voice_id=v, name=name, category="builtin", preview_url=None)
            for name, v in BUILTIN_VOICES.items()
        ]

    def preview_voice(
        self,
        voice_id: str = DEFAULT_VOICE_ID,
        preview_text: str = "Hi! This is a voice preview from ElevenLabs.",
    ) -> VoiceResult:
        """
        Generate a short audio preview for a given voice.

        Args:
            voice_id:     Voice ID to preview (or key from BUILTIN_VOICES)
            preview_text: Short text to synthesize (max ~150 chars recommended)

        Returns:
            VoiceResult with local_path to the preview MP3
        """
        return self.generate_voice(
            text=preview_text,
            voice_id=voice_id,
            output_path=str(TEMP_DIR / f"preview_{voice_id[:8]}.mp3"),
        )

    @staticmethod
    def _estimate_duration(text: str) -> float:
        # ~150 words/min at normal speed ≈ 13 chars/sec
        return max(1.0, len(text) / 13)


# ── Data classes ────────────────────────────────────────────────────────────

class VoiceResult:
    __slots__ = ("local_path", "duration_seconds", "voice_id", "error", "success")

    def __init__(
        self,
        local_path: Optional[str] = None,
        duration_seconds: float = 0.0,
        voice_id: str = "",
        error: Optional[str] = None,
        success: bool = False,
    ):
        self.local_path = local_path
        self.duration_seconds = duration_seconds
        self.voice_id = voice_id
        self.error = error
        self.success = success

    def __repr__(self) -> str:
        if self.success:
            return f"<VoiceResult success path={self.local_path!r}>"
        return f"<VoiceResult FAILED: {self.error!r}>"


@dataclass
class VoiceInfo:
    voice_id: str
    name: str
    category: str = "professional"
    preview_url: Optional[str] = None
    labels: dict = field(default_factory=dict)


# ── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="ElevenLabs TTS CLI")
    sub = parser.add_subparsers(dest="cmd")

    gen = sub.add_parser("generate", help="Generate voice audio")
    gen.add_argument("text", help="Text to synthesize")
    gen.add_argument("--voice", "-v", default="rachel",
                     help=f"Voice name or ID (default: rachel). Available: {list(BUILTIN_VOICES)}")
    gen.add_argument("--output", "-o", help="Output MP3 path")
    gen.add_argument("--list-voices", action="store_true", help="List available voices")

    preview = sub.add_parser("preview", help="Generate and play a voice preview clip")
    preview.add_argument("--voice", "-v", default="rachel",
                         help=f"Voice name or ID (default: rachel)")
    preview.add_argument("--text", "-t",
                         default="Hi! This is a voice preview from ElevenLabs.",
                         help="Preview text (keep short)")

    args = parser.parse_args()
    if not args.cmd:
        parser.print_help()
        sys.exit(0)

    client = ElevenLabsClient()

    if args.list_voices:
        print("Available voices:")
        for v in client.get_available_voices():
            preview_col = f"  Preview: {v.preview_url}" if v.preview_url else ""
            print(f"  {v.voice_id}  {v.name}  [{v.category}]{preview_col}")
        sys.exit(0)

    if args.cmd == "preview":
        result = client.preview_voice(voice_id=args.voice, preview_text=args.text)
        if result.success:
            print(f"✅ Preview saved: {result.local_path}")
            print(f"   Duration: {result.duration_seconds:.1f}s")
        else:
            print(f"❌ Failed: {result.error}")

    if args.cmd == "generate":
        result = client.generate_voice(args.text, voice_id=args.voice, output_path=args.output)
        if result.success:
            print(f"✅ Saved: {result.local_path}")
            print(f"   Duration: {result.duration_seconds:.1f}s")
        else:
            print(f"❌ Failed: {result.error}")
