"""
video_studio_app/storyboard_generator.py
Content Director — TKP Video Studio

Storyboard generation: script → scene breakdown → Stable Diffusion image prompts.
Theme/topic categorization system for TKP channels.

Usage:
    from storyboard_generator import StoryboardGenerator, Scene, ThemeCategory

    gen = StoryboardGenerator(channel="productivity_worker")
    storyboard = gen.generate_storyboard(
        script="In this video, you'll learn why your morning routine...",
        topic="Why Your Morning Routine Is Killing You",
        duration_seconds=60,
    )
    for scene in storyboard.scenes:
        print(scene.image_prompt)

    # Or step-by-step:
    scenes = gen.split_into_scenes(script, num_scenes=5)
    prompts = gen.generate_image_prompts(scenes)
    categories = gen.categorize_theme("morning productivity", "productivity_worker")
"""

from __future__ import annotations

import json
import re
import math
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Optional
from pathlib import Path

# ---------------------------------------------------------------------------
# Theme / Channel config
# ---------------------------------------------------------------------------

CHANNELS = {
    "productivity_worker": {
        "id": "productivity_worker",
        "label": "TKP Productivity",
        "aspect_ratio": "16:9",
        "topics": [
            "time management", "deep work", "burnout", "deadlines",
            "calendar blocking", "task fatigue", "remote work", "meetings",
            "focus", "work-life balance", "morning routine", "evening routine",
            "habits", "procrastination", "productivity systems",
        ],
        "visual_keywords": [
            "clean desk", "laptop", "notebook", "coffee", "calendar",
            "whiteboard", "timer", "checklist", "natural light", "minimalist office",
        ],
        "aesthetic": "clean minimalist, soft natural light, warm office tones, 4K cinematic",
    },
    "gen_z_success": {
        "id": "gen_z_success",
        "label": "TKP Growth",
        "aspect_ratio": "9:16",
        "topics": [
            "side hustle", "networking", "salary negotiation", "first job",
            "career growth", "LinkedIn", "personal brand", "freelancing",
            "passive income", "budgeting", "investing 101", " Gen Z finance",
            "roommate hacks", "city living", "graduation", "internship",
        ],
        "visual_keywords": [
            "city skyline", "laptop cafe", "smartphone", "coffee shop",
            "notion app", "sticky notes", "vision board", "graduation cap",
            "modern apartment", "co-working space",
        ],
        "aesthetic": "vibrant urban, golden hour, cinematic lifestyle, 4K",
    },
}


class ThemeCategory(Enum):
    MOTIVATIONAL = "motivational"
    EDUCATIONAL = "educational"
    HOW_TO = "how_to"
    LISTICLE = "listicle"
    PERSONAL_STORY = "personal_story"
    TREND_REACTION = "trend_reaction"
    FINANCE = "finance"
    CAREER = "career"
    LIFESTYLE = "lifestyle"
    UNKNOWN = "unknown"


@dataclass
class Scene:
    """A single storyboard scene."""
    scene_number: int
    start_time: float          # seconds
    end_time: float            # seconds
    duration: float            # seconds
    script_segment: str         # VO/narration for this scene
    visual_direction: str      # What to show on screen
    image_prompt: str           # Stable Diffusion prompt
    negative_prompt: str        # SD negative prompt
    shot_type: str             # wide, medium, closeup, pov, aerial
    camera_movement: str       # static, pan_left, zoom_in, etc.
    text_overlay: Optional[str] = None   # On-screen text/captions
    motion_indicator: Optional[str] = None  # "swoosh", "fade", "slide"

    def to_dict(self) -> dict:
        return asdict(self)

    @property
    def midpoint_time(self) -> float:
        return (self.start_time + self.end_time) / 2


@dataclass
class Storyboard:
    """Complete storyboard for a video."""
    channel: str
    topic: str
    duration_seconds: float
    theme_category: ThemeCategory
    sub_themes: list[str]
    scenes: list[Scene] = field(default_factory=list)
    total_scenes: int = 0

    def to_dict(self) -> dict:
        return {
            "channel": self.channel,
            "topic": self.topic,
            "duration_seconds": self.duration_seconds,
            "theme_category": self.theme_category.value,
            "sub_themes": self.sub_themes,
            "total_scenes": len(self.scenes),
            "scenes": [s.to_dict() for s in self.scenes],
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    def save(self, path: str | Path) -> None:
        Path(path).write_text(self.to_json(), encoding="utf-8")


# ---------------------------------------------------------------------------
# Main Generator
# ---------------------------------------------------------------------------

class StoryboardGenerator:
    """
    Converts a script + topic into a full storyboard with scene breakdowns
    and Stable Diffusion image prompts.

    Parameters
    ----------
    channel : str
        One of "productivity_worker" or "gen_z_success".
    mock : bool
        If True, uses keyword-substitution placeholders instead of calling
        an external AI model. Default True.
    api_url : str, optional
        MiniMax / OpenAI endpoint for enhanced prompt generation.
    api_key : str, optional
        API key for enhanced generation.
    """

    DEFAULT_SCENE_DURATION = 6.0   # seconds per scene
    MIN_SCENE_DURATION     = 3.0
    MAX_SCENE_DURATION     = 12.0

    def __init__(
        self,
        channel: str = "productivity_worker",
        *,
        mock: bool = True,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        if channel not in CHANNELS:
            raise ValueError(f"Unknown channel: {channel}. Must be one of {list(CHANNELS)}")
        self.channel = channel
        self.channel_config = CHANNELS[channel]
        self.mock = mock
        self.api_url = api_url
        self.api_key = api_key

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate_storyboard(
        self,
        script: str,
        topic: str,
        duration_seconds: float = 60.0,
        num_scenes: Optional[int] = None,
    ) -> Storyboard:
        """
        Full pipeline: script + topic → Storyboard object.

        Parameters
        ----------
        script : str
            Full video script / narration text.
        topic : str
            Video topic/title.
        duration_seconds : float
            Target video duration. Default 60s.
        num_scenes : int, optional
            Override scene count. Auto-calculated from duration if omitted.

        Returns
        -------
        Storyboard
        """
        theme_category, sub_themes = self.categorize_theme(topic)

        if num_scenes is None:
            num_scenes = self._estimate_scene_count(duration_seconds)

        scenes = self.split_into_scenes(script, num_scenes=num_scenes, duration_seconds=duration_seconds)
        self._enrich_scene_prompts(scenes, topic)

        storyboard = Storyboard(
            channel=self.channel,
            topic=topic,
            duration_seconds=duration_seconds,
            theme_category=theme_category,
            sub_themes=sub_themes,
            scenes=scenes,
            total_scenes=len(scenes),
        )
        return storyboard

    def split_into_scenes(
        self,
        script: str,
        *,
        num_scenes: int = 5,
        duration_seconds: float = 60.0,
    ) -> list[Scene]:
        """
        Split a script into scenes with timing, shot types, and visual direction.

        Uses mock heuristic when self.mock=True; calls AI model when False.
        """
        if self.mock:
            return self._mock_split(script, num_scenes=num_scenes, duration_seconds=duration_seconds)
        return self._ai_split(script, num_scenes=num_scenes, duration_seconds=duration_seconds)

    def generate_image_prompts(self, scenes: list[Scene], topic: str) -> list[Scene]:
        """
        Generate Stable Diffusion prompts for each scene.
        Mutates scenes in-place and returns the list.
        """
        if self.mock:
            return self._mock_prompts(scenes, topic)
        return self._ai_prompts(scenes, topic)

    def categorize_theme(self, topic: str, channel: Optional[str] = None) -> tuple[ThemeCategory, list[str]]:
        """
        Classify a topic into a ThemeCategory and extract sub-themes.

        Returns (ThemeCategory, list_of_sub_theme_strings).
        """
        channel = channel or self.channel
        cfg = CHANNELS.get(channel, CHANNELS["productivity_worker"])
        topic_lower = topic.lower()

        sub_themes: list[str] = []

        # Match keywords → category
        if any(k in topic_lower for k in ["how to", "guide", "tutorial", "steps", "way to"]):
            category = ThemeCategory.HOW_TO
        elif any(k in topic_lower for k in ["why you", "reasons", "secret", "truth about", "mistake"]):
            category = ThemeCategory.EDUCATIONAL
        elif any(k in topic_lower for k in ["my ", "i ", "i'm ", "my journey", "story"]):
            category = ThemeCategory.PERSONAL_STORY
        elif any(k in topic_lower for k in ["top ", "best ", "5 ", "10 ", "list of"]):
            category = ThemeCategory.LISTICLE
        elif any(k in topic_lower for k in [
            "money", "salary", "budget", "invest", "save", "finance", "income", "raise"
        ]):
            category = ThemeCategory.FINANCE
        elif any(k in topic_lower for k in [
            "career", "job", "interview", "promotion", "networking", "resume", "hustle"
        ]):
            category = ThemeCategory.CAREER
        elif any(k in topic_lower for k in ["motivation", "don't quit", "keep going", "you got this"]):
            category = ThemeCategory.MOTIVATIONAL
        elif any(k in topic_lower for k in ["lifestyle", "room", "apartment", "vlog"]):
            category = ThemeCategory.LIFESTYLE
        else:
            category = ThemeCategory.UNKNOWN

        # Sub-theme extraction from known topic lists
        for kw in cfg["topics"]:
            if kw in topic_lower:
                sub_themes.append(kw)

        # Default sub-theme if nothing matched
        if not sub_themes:
            sub_themes = self._infer_sub_themes(topic)

        return category, sub_themes

    # ------------------------------------------------------------------
    # Scene splitting — mock heuristic
    # ------------------------------------------------------------------

    def _estimate_scene_count(self, duration_seconds: float) -> int:
        # Target ~6s per scene; clamp between 4 and 12 scenes
        n = max(4, min(12, round(duration_seconds / self.DEFAULT_SCENE_DURATION)))
        return n

    def _mock_split(
        self,
        script: str,
        *,
        num_scenes: int,
        duration_seconds: float,
    ) -> list[Scene]:
        """Heuristic scene split: equal-duration slices, sentence-aware boundaries."""
        # Split script into sentences / clause chunks
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', script) if s.strip()]
        if len(sentences) < num_scenes:
            # Pad by splitting each sentence further on commas
            chunks: list[str] = []
            for s in sentences:
                parts = re.split(r'(?<=,)\s+', s)
                chunks.extend(parts if parts else [s])
            sentences = chunks if chunks else sentences

        total_words = len(script.split())
        scenes: list[Scene] = []

        # Distribute sentences across scenes round-robin
        per_scene = math.ceil(len(sentences) / num_scenes)
        for i in range(num_scenes):
            start_idx = i * per_scene
            end_idx   = min(start_idx + per_scene, len(sentences))
            segment   = " ".join(sentences[start_idx:end_idx])

            scene_dur = duration_seconds / num_scenes
            scene_dur = max(self.MIN_SCENE_DURATION, min(self.MAX_SCENE_DURATION, scene_dur))

            start_t = i * scene_dur
            end_t   = start_t + scene_dur

            shot_type = self._assign_shot_type(i, num_scenes)
            movement  = self._assign_movement(i, num_scenes)
            visual_dir = self._mock_visual_direction(segment, i, num_scenes)
            text_overlay = self._mock_text_overlay(segment, i, num_scenes)

            scenes.append(Scene(
                scene_number=i + 1,
                start_time=round(start_t, 2),
                end_time=round(end_t, 2),
                duration=round(scene_dur, 2),
                script_segment=segment,
                visual_direction=visual_dir,
                image_prompt="",        # filled by _enrich_scene_prompts
                negative_prompt="",      # filled by _enrich_scene_prompts
                shot_type=shot_type,
                camera_movement=movement,
                text_overlay=text_overlay,
            ))

        return scenes

    def _assign_shot_type(self, index: int, total: int) -> str:
        """Vary shot types across the story arc: opener → body → closer."""
        if index == 0:
            return "wide establishing"
        if index == total - 1:
            return "closeup"
        # Middle scenes: alternate between medium and closeup
        return "medium" if index % 2 == 1 else "closeup"

    def _assign_movement(self, index: int, total: int) -> str:
        if index == 0:
            return "fade_in"
        if index == total - 1:
            return "fade_out"
        return "static"

    def _mock_visual_direction(self, segment: str, index: int, total: int) -> str:
        cfg = CHANNELS[self.channel]
        visual_kws = cfg["visual_keywords"]
        aesthetic   = cfg["aesthetic"]

        topic_words = segment.split()[:3]
        topic_str   = " ".join(topic_words)

        if index == 0:
            return f"Establishing wide shot: {topic_str}. {aesthetic}"
        if index == total - 1:
            return f"Closeup emotional shot: person reacting to '{topic_str}'. {aesthetic}"
        return f"Medium shot: {topic_str} with {visual_kws[index % len(visual_kws)]} in frame. {aesthetic}"

    def _mock_text_overlay(self, segment: str, index: int, total: int) -> Optional[str]:
        # First and last scenes get on-screen text; body scenes vary
        if index == 0:
            # Pull the hook / key phrase from the segment
            words = segment.split()
            return " ".join(words[:6]) + ("..." if len(words) > 6 else "")
        if index == total - 1:
            return "Follow for more →"
        if index % 2 == 0 and len(segment) > 10:
            words = segment.split()
            return " ".join(words[:4]) + "..."
        return None

    # ------------------------------------------------------------------
    # Image prompt enrichment — mock
    # ------------------------------------------------------------------

    def _enrich_scene_prompts(self, scenes: list[Scene], topic: str) -> None:
        if self.mock:
            self._mock_prompts(scenes, topic)
        else:
            self._ai_prompts(scenes, topic)

    def _mock_prompts(self, scenes: list[Scene], topic: str) -> list[Scene]:
        cfg = CHANNELS[self.channel]
        aesthetic = cfg["aesthetic"]

        for scene in scenes:
            visual_lower = scene.visual_direction.lower()

            # Build a Stable Diffusion prompt from the visual direction
            sd_base = scene.visual_direction
            # Inject channel aesthetic + quality tags
            prompt_parts = [
                sd_base,
                aesthetic,
                "high quality", "detailed", "cinematic lighting",
                "4K", "sharp focus",
                "no text", "no watermark", "no ui elements",
            ]
            scene.image_prompt = ", ".join(prompt_parts)

            scene.negative_prompt = (
                "low quality, blurry, watermark, text overlay, ui elements, "
                "cartoon, anime, 3d render, distorted face, deformed hands, "
                "oversaturated, noise, compression artifacts"
            )

        return scenes

    # ------------------------------------------------------------------
    # AI-enhanced variants (placeholder — swap in MiniMax/OpenAI call)
    # ------------------------------------------------------------------

    def _ai_split(
        self,
        script: str,
        *,
        num_scenes: int,
        duration_seconds: float,
    ) -> list[Scene]:
        """
        AI-powered scene split using MiniMax M2 model.
        Replace this method body with actual API call when ready.
        """
        # TODO(minimax): Replace with real MiniMax / OpenAI call
        # Example structure:
        #
        # response = openai.ChatCompletion.create(
        #     model="gpt-4o",
        #     messages=[
        #         {"role": "system", "content": "You are a storyboard writer..."},
        #         {"role": "user",   "content": f"Split this script into {num_scenes} scenes:\n{script}"},
        #     ],
        # )
        # parsed = json.loads(response["choices"][0]["message"]["content"])
        # return [Scene(**s) for s in parsed["scenes"]]

        raise NotImplementedError(
            "AI scene splitting not yet wired. Set mock=True or implement _ai_split."
        )

    def _ai_prompts(self, scenes: list[Scene], topic: str) -> list[Scene]:
        """
        AI-enhanced Stable Diffusion prompt generation.
        Replace with MiniMax VL model call when ready.
        """
        raise NotImplementedError(
            "AI prompt generation not yet wired. Set mock=True or implement _ai_prompts."
        )

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    def _infer_sub_themes(self, topic: str) -> list[str]:
        """Fallback sub-theme extraction using simple keyword matching."""
        topic_lower = topic.lower()
        inferred: list[str] = []
        for cfg in CHANNELS.values():
            for kw in cfg["topics"]:
                if kw in topic_lower:
                    inferred.append(kw)
        return list(dict.fromkeys(inferred))[:5]   # dedupe, cap at 5

    def export_for_pipeline(self, storyboard: Storyboard) -> dict:
        """
        Export storyboard in the format expected by video-pipeline.js.
        Returns a dict compatible with lib/video-pipeline.js scene input format.
        """
        return {
            "channel": storyboard.channel,
            "topic": storyboard.topic,
            "duration": storyboard.duration_seconds,
            "theme_category": storyboard.theme_category.value,
            "sub_themes": storyboard.sub_themes,
            "scenes": [
                {
                    "scene_number": s.scene_number,
                    "start_time": s.start_time,
                    "end_time": s.end_time,
                    "duration": s.duration,
                    "script_segment": s.script_segment,
                    "image_prompt": s.image_prompt,
                    "negative_prompt": s.negative_prompt,
                    "shot_type": s.shot_type,
                    "camera_movement": s.camera_movement,
                    "text_overlay": s.text_overlay,
                }
                for s in storyboard.scenes
            ],
        }


# ---------------------------------------------------------------------------
# CLI / self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    print("=" * 60)
    print("StoryboardGenerator — Self-Test (mock mode)")
    print("=" * 60)

    sample_script = (
        "Your morning routine is secretly destroying your productivity. "
        "Most people wake up and immediately check their phone. "
        "The blue light suppresses melatonin for up to 90 minutes. "
        "Instead, start with 10 minutes of silence. "
        "No phone. No screens. Just you and your thoughts. "
        "Then write down your top three tasks for the day. "
        "This simple switch can reclaim up to two hours of deep focus time. "
        "Try it for 30 days and track your energy levels. "
        "The difference will shock you."
    )

    for channel in ["productivity_worker", "gen_z_success"]:
        print(f"\n--- Channel: {channel} ---")
        gen = StoryboardGenerator(channel=channel, mock=True)
        sb  = gen.generate_storyboard(
            script=sample_script,
            topic="Why Your Morning Routine Is Killing Your Productivity",
            duration_seconds=60,
        )
        print(f"Theme: {sb.theme_category.value}")
        print(f"Sub-themes: {sb.sub_themes}")
        print(f"Scenes: {sb.total_scenes}")
        print()
        for scene in sb.scenes:
            print(f"  Scene {scene.scene_number} [{scene.start_time}s – {scene.end_time}s] "
                  f"({scene.duration}s) — {scene.shot_type}")
            print(f"    VO: {scene.script_segment[:80]}")
            print(f"    Image: {scene.image_prompt[:100]}")
            if scene.text_overlay:
                print(f"    Text: {scene.text_overlay}")
            print()

        # Pipeline export test
        pipeline_output = gen.export_for_pipeline(sb)
        print(f"  Pipeline export keys: {list(pipeline_output.keys())}")

    print("Self-test PASSED.")
    sys.exit(0)
