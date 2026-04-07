"""
video_studio_app/ai_script_generator.py
Founding Engineer — TKP Video Studio (TKP-61)

AI-powered script generator: topic → structured video script with scene breakdown.
Uses OpenAI if OPENAI_API_KEY is set, falls back to keyword-based template.

Usage:
    from ai_script_generator import AIScriptGenerator, GeneratedScript

    gen = AIScriptGenerator()
    script = gen.generate("Why your morning routine is killing your productivity")

    print(script.topic)
    print(script.hook)
    for scene in script.scenes:
        print(scene["text"])
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# TKP-82 — Hailuo prompt builder helpers (mirrors lib/prompts.js HailuoPromptBuilder)
# ---------------------------------------------------------------------------

_HAILUO_CAMERA_MAP = {
    "pan_left":   "slow left pan, tracking left",
    "pan_right":  "slow right pan, tracking right",
    "tilt_up":    "low angle tilt up, rise to reveal",
    "tilt_down":  "high angle tilt down, descending angle",
    "zoom_in":    "slow zoom in, dolly in, approach",
    "zoom_out":   "slow zoom out, dolly out, pull back",
    "tracking":   "tracking shot, follow subject",
    "static":     "static shot, locked frame",
    "dolly_side": "side dolly, lateral tracking shot",
    "rack_focus": "rack focus, focus pull",
    "aerial":     "aerial view, drone shot, overhead",
    "pov":        "first person POV, subject POV",
    "handheld":   "subtle handheld, organic feel",
    "steadicam":  "steadicam smooth glide, floated tracking",
    # storyboard shot_type → camera key
    "wide":    "static shot, locked frame",
    "medium":  "tracking shot, follow subject",
    "closeup": "slow zoom in, dolly in",
    "POV":     "first person POV, subject POV",
}

_HAILUO_LIGHTING = {
    "natural":     "natural daylight, soft ambient light, realistic shadows",
    "studio":      "studio lighting, softbox key light, clean catchlights",
    "dramatic":    "dramatic chiaroscuro lighting, single hard key light, high contrast",
    "cinematic":   "cinematic lighting, volumetric fog glow, motivated sources",
    "golden_hour": "golden hour warmth, lens flare, long shadows, amber tones",
    "blue_hour":   "blue hour cool tones, twilight ambient, city lights background",
    "neon":        "neon glow, cyberpunk lights, colorful rim lighting",
    "warm_indoor": "warm tungsten interior, cozy lamp light, firelight flicker",
    "backlit":     "strong backlight silhouette, rim light separation",
}

_HAILUO_STYLES = {
    "cinematic": {
        "descriptor":  "cinematic film still, 4K movie quality, shallow depth of field, anamorphic lens",
        "motion":     "smooth camera movement, natural motion blur, cinematic pans",
        "composition":"rule-of-thirds composition, widescreen framing",
    },
    "anime": {
        "descriptor":  "anime art style, Studio Ghibli inspired, cel shaded, vibrant color palette",
        "motion":       "fluid animation, exaggerated expressions, dynamic angles",
        "composition":  "manga panel composition, expressive framing",
    },
    "realistic": {
        "descriptor":  "photorealistic, hyperdetail, 8K texture quality, natural skin texture",
        "motion":       "natural movement, realistic physics, authentic human motion",
        "composition":  "clean portrait composition, balanced negative space",
    },
    "abstract": {
        "descriptor":  "abstract digital art, surreal composition, dreamlike atmosphere",
        "motion":       "surreal motion, morphing shapes, ethereal float",
        "composition":  "asymmetrical composition, bold color blocks",
    },
    "documentary": {
        "descriptor":  "documentary photography style, candid realism, unposed natural moment",
        "motion":       "observational documentary camera, unhurried tracking",
        "composition":  "editorial documentary framing, environmental context",
    },
}

_HAILUO_NEGATIVE = (
    "blurry, out of focus, soft image, motion blur, "
    "distorted face, extra fingers, missing fingers, deformed hands, "
    "bad anatomy, disfigured, mutated, ugly, poorly drawn face, "
    "text overlay, watermark, logo, cropped, "
    "low resolution, pixelated, jpeg artifacts, compression artifacts, "
    "noise, grain, overexposed, underexposed, washed out colors, "
    "duplicate elements, floating objects, cloning artifacts, "
    "extra limbs, missing limbs, plastic skin, waxy skin, uncanny valley, "
    "(worst quality:1.3), (deformed:1.2), (blur:1.1)"
)


def _str(val: str | int | None) -> str:
    if val is None:
        return ""
    return str(val)


def _hailuo_seed(input_str: str) -> int:
    """Deterministic 32-bit seed from a string."""
    h = 0
    for ch in input_str:
        h = ((h << 5) - h) + ord(ch)
        h = h & 0xFFFFFFFF
    return abs(h) & 0xFFFFFFFF


def _infer_mood(heading: str) -> str:
    h = (heading or "").lower()
    if "hook" in h or "intro" in h:
        return "energetic, captivating, hook moment"
    if "cta" in h or "call" in h:
        return "inspiring, actionable, motivational close"
    if "reveal" in h or "result" in h:
        return "satisfying, impactful, revelation"
    if "mistake" in h or "wrong" in h:
        return "tense, dramatic, cautionary"
    return "engaging, dynamic, professional"


def _build_scene_prompt(
    scene: dict,
    topic: str,
    style: str = "cinematic",
    lighting: str = "cinematic",
    seed: int | None = None,
) -> dict:
    """
    Build a Hailuo-optimized image_prompt + negative_prompt for a single scene.
    Mirrors HailuoPromptBuilder.build_scene_prompt() from lib/prompts.js.
    """
    preset = _HAILUO_STYLES.get(style, _HAILUO_STYLES["cinematic"])

    # Resolve camera description
    shot_type = scene.get("shot_type", "medium")
    cam_move  = scene.get("camera_movement", "static")
    cam_key   = _HAILUO_CAMERA_MAP.get(shot_type) or _HAILUO_CAMERA_MAP.get(cam_move) or "static shot, locked frame"
    motion    = preset["motion"]

    # Build image_prompt parts
    subject = scene.get("visual_direction") or topic
    lighting_str = _HAILUO_LIGHTING.get(lighting, _HAILUO_LIGHTING["cinematic"])
    mood    = _infer_mood(scene.get("heading", ""))

    parts = [
        subject,
        preset["descriptor"],
        f"{cam_key}, {motion}",
        lighting_str,
    ]
    if mood:
        parts.append(mood)
    parts.extend([preset["composition"], "masterpiece, best quality, ultra detailed, 4K"])
    image_prompt = ", ".join(parts)

    return {
        "image_prompt":    image_prompt,
        "negative_prompt": _HAILUO_NEGATIVE,
    }


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class ScriptScene:
    """
    A single scene within a generated script.
    """
    scene_number: int
    duration: float           # seconds
    heading: str              # e.g. "Hook", "Point 1", "CTA"
    text: str                 # narration/voiceover text
    visual_direction: str     # what to show on screen
    shot_type: str = "medium"
    camera_movement: str = "static"
    text_overlay: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "scene_number": self.scene_number,
            "duration": self.duration,
            "heading": self.heading,
            "text": self.text,
            "visual_direction": self.visual_direction,
            "shot_type": self.shot_type,
            "camera_movement": self.camera_movement,
            "text_overlay": self.text_overlay,
        }


@dataclass
class GeneratedScript:
    """
    A complete generated video script with hook, body, and CTA.
    Compatible with StoryboardGenerator input.
    """
    topic: str
    hook: str
    cta: str
    target_duration: float   # seconds
    scenes: list[ScriptScene] = field(default_factory=list)
    channel: str = "productivity_worker"
    mood: str = "productivity"
    theme_category: str = "educational"

    def to_dict(self) -> dict:
        return {
            "topic": self.topic,
            "hook": self.hook,
            "cta": self.cta,
            "target_duration": self.target_duration,
            "channel": self.channel,
            "mood": self.mood,
            "theme_category": self.theme_category,
            "scenes": [s.to_dict() for s in self.scenes],
        }

    def full_script_text(self) -> str:
        """Return the concatenated narration text."""
        parts = [self.hook] + [s.text for s in self.scenes] + [self.cta]
        return "\n\n".join(parts)

    def to_storyboard_format(self, channel: str = "productivity_worker") -> dict:
        """
        Convert to a storyboard-compatible dict for StoryboardGenerator.
        """
        return {
            "channel": channel,
            "topic": self.topic,
            "duration_seconds": self.target_duration,
            "theme_category": self.theme_category,
            "sub_themes": [],
            "scenes": [
                {
                    "scene_number": i + 1,
                    "start_time": sum(s.duration for s in self.scenes[:i]),
                    "end_time": sum(s.duration for s in self.scenes[:i + 1]),
                    "duration": s.duration,
                    "script_segment": s.text,
                    "visual_direction": s.visual_direction,
                    "image_prompt": "",    # filled by StoryboardGenerator or apply_hailuo_prompts()
                    "negative_prompt": "",  # filled by StoryboardGenerator or apply_hailuo_prompts()
                    "shot_type": s.shot_type,
                    "camera_movement": s.camera_movement,
                    "text_overlay": s.text_overlay,
                }
                for i, s in enumerate(self.scenes)
            ],
        }

    def apply_hailuo_prompts(
        self,
        style: str = "cinematic",
        lighting: str = "cinematic",
        seed: str | int | None = None,
        channel: str = "productivity_worker",
    ) -> dict:
        """
        Apply Hailuo-optimized image prompts to the storyboard using Python's
        HailuoPromptBuilder logic (mirrors lib/prompts.js HailuoPromptBuilder).

        Populates ``image_prompt`` and ``negative_prompt`` for each scene,
        and adds ``seed_info`` when a seed is provided.

        Parameters
        ----------
        style : str
            Hailuo style preset: "cinematic" | "anime" | "realistic" | "abstract" | "documentary"
        lighting : str
            Lighting preset: "natural" | "studio" | "dramatic" | "cinematic" | "golden_hour" |
            "blue_hour" | "neon" | "warm_indoor" | "backlit"
        seed : str | int | None
            Base seed for reproducible generations. Each scene gets seed + scene_index.
            Pass None to skip seed injection.
        channel : str
            Channel identifier (affects mood inference per scene heading).

        Returns
        -------
        dict
            Same shape as ``to_storyboard_format()`` but with all ``image_prompt``,
            ``negative_prompt``, and ``seed_info`` fields populated.

        Example
        -------
        >>> script = AIScriptGenerator().generate("Why mornings matter")
        >>> storyboard = script.apply_hailuo_prompts(seed="morning-2026", style="cinematic")
        >>> for scene in storyboard["scenes"]:
        ...     print(scene["image_prompt"][:80])
        """
        sb = self.to_storyboard_format(channel=channel)

        for i, scene in enumerate(sb["scenes"]):
            resolved_seed = None
            if seed is not None:
                # deterministic per-scene seed: base + index
                effective = _hailuo_seed(_str(seed)) + i
                resolved_seed = effective & 0xFFFFFFFF

            sp = _build_scene_prompt(
                scene=scene,
                topic=self.topic,
                style=style,
                lighting=lighting,
                seed=resolved_seed,
            )
            scene["image_prompt"]    = sp["image_prompt"]
            scene["negative_prompt"] = sp["negative_prompt"]
            if resolved_seed is not None:
                scene["seed_info"] = {
                    "seed":         resolved_seed,
                    "seed_string":  str(resolved_seed),
                    "variation":    i,
                    "reproducible": i == 0,
                }

        return sb


# ---------------------------------------------------------------------------
# Keyword-based script templates
# ---------------------------------------------------------------------------

_SCRIPT_TEMPLATES = {
    "how_to": {
        "hook": "Here's how to {topic_action} and why it changes everything.",
        "cta": "Try {topic_action} for 30 days and let me know in the comments.",
        "structure": [
            ("Why you're doing it wrong", "medium", "static"),
            ("Step 1: {step1}", "closeup", "zoom_in"),
            ("Step 2: {step2}", "medium", "slide_left"),
            ("Step 3: {step3}", "closeup", "zoom_in"),
            ("The result", "wide", "fade_in"),
        ],
    },
    "listicle": {
        "hook": "Here are {num_points} things about {topic} nobody tells you.",
        "cta": "Follow for more — and drop a comment with your favorite tip.",
        "structure": [
            ("Point 1", "medium", "static"),
            ("Point 2", "closeup", "zoom_in"),
            ("Point 3", "medium", "slide_left"),
            ("Point 4", "closeup", "zoom_in"),
            ("Point 5", "wide", "fade_out"),
        ],
    },
    "motivational": {
        "hook": "Stop {topic_negative}. Here's why — and what to do instead.",
        "cta": "Save this. Share it with someone who needs to hear it.",
        "structure": [
            ("The truth", "closeup", "static"),
            ("Why it matters", "medium", "zoom_in"),
            ("What to do", "medium", "static"),
            ("Your moment", "closeup", "fade_in"),
        ],
    },
    "educational": {
        "hook": "What nobody tells you about {topic} — until now.",
        "cta": "Follow for more insights like this. Comment your thoughts below.",
        "structure": [
            ("The common belief", "medium", "static"),
            ("The real reason", "closeup", "zoom_in"),
            ("The evidence", "wide", "slide_left"),
            ("What this means for you", "medium", "static"),
        ],
    },
    "finance": {
        "hook": "I break down {topic} so you can start making real money.",
        "cta": "Follow for more financial breakdowns. Not financial advice.",
        "structure": [
            ("The problem", "medium", "static"),
            ("The math", "closeup", "zoom_in"),
            ("The strategy", "medium", "slide_left"),
            ("The result", "wide", "fade_in"),
        ],
    },
}


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------

class AIScriptGenerator:
    """
    AI-powered script generator.

    Uses OpenAI Chat Completions if OPENAI_API_KEY is set.
    Falls back to keyword-based templates when no API key is available.

    Parameters
    ----------
    channel : str
        "productivity_worker" or "gen_z_success"
    """

    DEFAULT_DURATION = 60.0   # seconds

    def __init__(self, channel: str = "productivity_worker"):
        self.channel = channel
        self._openai_key = os.getenv("OPENAI_API_KEY", "")
        self._openai_model = os.getenv("OPENAI_MODEL", "gpt-4o")
        self._use_ai = bool(self._openai_key)

        logger.info(
            f"AIScriptGenerator initialized: channel={channel}, "
            f"ai={'OpenAI ' + self._openai_model if self._use_ai else 'template fallback'}"
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(
        self,
        topic: str,
        target_duration: float = 60.0,
        num_scenes: int = 5,
    ) -> GeneratedScript:
        """
        Generate a full video script from a topic string.

        Parameters
        ----------
        topic : str
            Video topic/title (e.g. "Why Your Morning Routine Is Killing You")
        target_duration : float
            Target video duration in seconds.
        num_scenes : int
            Approximate number of scenes. Not strict when using AI.

        Returns
        -------
        GeneratedScript
        """
        if self._use_ai:
            return self._generate_ai(topic, target_duration, num_scenes)
        return self._generate_template(topic, target_duration, num_scenes)

    def generate_with_ai_fallback(
        self,
        topic: str,
        target_duration: float = 60.0,
        num_scenes: int = 5,
    ) -> GeneratedScript:
        """
        Generate using AI, falling back to template on error.
        """
        try:
            return self._generate_ai(topic, target_duration, num_scenes)
        except Exception as exc:
            logger.warning(f"[AIScriptGenerator] AI generation failed ({exc}), falling back to template")
            return self._generate_template(topic, target_duration, num_scenes)

    # ------------------------------------------------------------------
    # OpenAI generation
    # ------------------------------------------------------------------

    def _generate_ai(
        self,
        topic: str,
        target_duration: float,
        num_scenes: int,
    ) -> GeneratedScript:
        """
        Generate script using OpenAI Chat Completions.
        """
        system_prompt = (
            "You are an expert TikTok/Shorts video scriptwriter.\n"
            "Write engaging, high-retention video scripts optimized for short-form video.\n"
            "Output ONLY valid JSON with this structure:\n"
            "{\n"
            '  "hook": "string (first 3 seconds, grab attention)",\n'
            '  "cta": "string (call to action)",\n'
            '  "scenes": [\n'
            '    {\n'
            '      "scene_number": 1,\n'
            '      "heading": "string",\n'
            '      "text": "string (narration, 1-3 sentences)",\n'
            '      "visual_direction": "string (what to show on screen)",\n'
            '      "shot_type": "wide|medium|closeup|aerial|POV",\n'
            '      "camera_movement": "static|zoom_in|zoom_out|pan_left|pan_right|fade_in|fade_out|slide"\n'
            '    }\n'
            "  ],\n"
            '  "theme_category": "how_to|listicle|motivational|educational|finance|career|lifestyle"\n'
            "}\n"
            "Use 4-6 scenes. Keep each narration segment under 30 words for short-form pacing."
        )

        user_prompt = (
            f"Write a {int(target_duration)} second video script for:\n"
            f"Topic: {topic}\n"
            f"Target duration: {int(target_duration)} seconds\n"
            f"Channel: {self.channel}\n\n"
            "Focus on: hook-first, value delivery in first 5 seconds, clear CTA at end.\n"
            "Make it engaging and authentic — no clickbait without substance."
        )

        payload = json.dumps({
            "model": self._openai_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.8,
            "max_tokens": 800,
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {self._openai_key}",
                "Content-Type": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
        except urllib.error.URLError as exc:
            raise RuntimeError(f"OpenAI API call failed: {exc}")

        raw = data["choices"][0]["message"]["content"]

        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
        raw = re.sub(r"\s*```$", "", raw.strip())

        parsed = json.loads(raw)
        return self._parse_ai_response(topic, parsed, target_duration)

    def _parse_ai_response(
        self,
        topic: str,
        parsed: dict,
        target_duration: float,
    ) -> GeneratedScript:
        """Parse AI JSON response into a GeneratedScript."""
        scenes = []
        for s in parsed.get("scenes", []):
            scenes.append(ScriptScene(
                scene_number=s.get("scene_number", len(scenes) + 1),
                duration=round(target_duration / len(parsed.get("scenes", [1])), 2),
                heading=s.get("heading", ""),
                text=s.get("text", ""),
                visual_direction=s.get("visual_direction", ""),
                shot_type=s.get("shot_type", "medium"),
                camera_movement=s.get("camera_movement", "static"),
                text_overlay=s.get("text_overlay"),
            ))

        return GeneratedScript(
            topic=topic,
            hook=parsed.get("hook", ""),
            cta=parsed.get("cta", ""),
            target_duration=target_duration,
            scenes=scenes,
            channel=self.channel,
            theme_category=parsed.get("theme_category", "educational"),
        )

    # ------------------------------------------------------------------
    # Template fallback
    # ------------------------------------------------------------------

    def _generate_template(
        self,
        topic: str,
        target_duration: float,
        num_scenes: int,
    ) -> GeneratedScript:
        """
        Generate script using keyword-based templates.
        Used when no OpenAI key is available.
        """
        # Determine template type
        topic_lower = topic.lower()
        if any(k in topic_lower for k in ["how to", "guide", "steps", "way to"]):
            template_type = "how_to"
        elif any(k in topic_lower for k in ["top ", "best ", "list of", "5 ", "10 "]):
            template_type = "listicle"
        elif any(k in topic_lower for k in ["motivation", "don't quit", "keep going"]):
            template_type = "motivational"
        elif any(k in topic_lower for k in ["money", "salary", "invest", "budget", "finance"]):
            template_type = "finance"
        else:
            template_type = "educational"

        template = _SCRIPT_TEMPLATES[template_type]

        # Extract topic action (verb or key phrase)
        topic_action = self._extract_action(topic, template_type)

        # Build hook and CTA with topic substitution
        hook = template["hook"].format(topic_action=topic_action, topic=topic, num_points=5)
        cta = template["cta"].format(topic_action=topic_action, topic=topic)

        # Build scenes from template structure
        structure = template["structure"]
        # Adjust scene count if needed
        while len(structure) < num_scenes:
            # Repeat middle structure items
            base = structure[1:-1]
            structure = [structure[0]] + base + base + [structure[-1]]

        scene_duration = target_duration / min(len(structure), num_scenes)
        scenes: list[ScriptScene] = []

        topic_words = topic.split()[:3]
        topic_phrase = " ".join(topic_words)

        for i, (heading, shot, movement) in enumerate(structure[:num_scenes]):
            heading_filled = heading.format(step1="prepare", step2="execute", step3="review")
            heading_filled = heading_filled.format(topic=topic_phrase)

            # Narration template
            narration = self._template_narration(
                template_type, heading, topic, topic_action, i, len(structure)
            )

            scenes.append(ScriptScene(
                scene_number=i + 1,
                duration=round(scene_duration, 2),
                heading=heading_filled,
                text=narration,
                visual_direction=f"{shot} shot: {topic_phrase}",
                shot_type=shot,
                camera_movement=movement,
            ))

        return GeneratedScript(
            topic=topic,
            hook=hook,
            cta=cta,
            target_duration=target_duration,
            scenes=scenes,
            channel=self.channel,
            mood=self._infer_mood(template_type),
            theme_category=template_type,
        )

    def _template_narration(
        self,
        template_type: str,
        heading: str,
        topic: str,
        topic_action: str,
        scene_index: int,
        total: int,
    ) -> str:
        """Generate placeholder narration text based on template type."""
        narrations = {
            "how_to": [
                f"Here's the problem with {topic_action} — most people get it completely wrong.",
                "Step one: stop doing what you've been doing and try this instead.",
                "Step two is where most people give up — but not you.",
                "Step three is the secret nobody talks about.",
                f"Apply this and {topic_action} will become second nature.",
            ],
            "listicle": [
                f"Thing number one about {topic} that will blow your mind.",
                f"Thing number two — most people never figure this out.",
                f"Here's point three — this one changes everything.",
                f"Point four is counterintuitive but incredibly powerful.",
                f"Number five — the one nobody expects. Save this for later.",
            ],
            "motivational": [
                f"Stop {topic_action}. Right now. Here's why.",
                "The truth is uncomfortable but necessary.",
                "What you're doing isn't working. Here's the fix.",
                "This is your moment. Don't waste it.",
                "Take action now. Your future self will thank you.",
            ],
            "educational": [
                f"What nobody tells you about {topic} — until now.",
                "The common belief is wrong. Here's why.",
                "The real reason this matters is simpler than you think.",
                "Here's the evidence — study after study confirms it.",
                "Apply this principle and your results will speak for themselves.",
            ],
            "finance": [
                f"Let's break down {topic_action} so it actually makes sense.",
                "The numbers don't lie — here's the reality.",
                "Most people get this wrong. Here's the correct approach.",
                "This strategy works. Here's how to implement it.",
                "Start today. The compound effect is real.",
            ],
        }
        key = template_type if template_type in narrations else "educational"
        idx = min(scene_index, len(narrations[key]) - 1)
        return narrations[key][idx]

    def _extract_action(self, topic: str, template_type: str) -> str:
        """Extract the key action phrase from a topic."""
        topic_lower = topic.lower()
        if template_type == "how_to":
            for phrase in ["how to", "ways to", "steps to"]:
                if phrase in topic_lower:
                    idx = topic_lower.find(phrase)
                    rest = topic[idx:].split()
                    if len(rest) >= 2:
                        return " ".join(rest[:4])
            return topic[:40]
        return topic[:30]

    def _infer_mood(self, template_type: str) -> str:
        """Infer music mood from script template type."""
        mood_map = {
            "how_to": "productivity",
            "listicle": "upbeat",
            "motivational": "growth",
            "educational": "calm",
            "finance": "growth",
        }
        return mood_map.get(template_type, "productivity")

    # ------------------------------------------------------------------
    # StoryboardGenerator integration
    # ------------------------------------------------------------------

    def generate_storyboard(
        self,
        topic: str,
        target_duration: float = 60.0,
        num_scenes: int = 5,
    ) -> "Storyboard":
        """
        Generate a full Storyboard from a topic string.

        This runs the complete pipeline:
          1. Generate a script (AI or template fallback)
          2. Convert script to storyboard format
          3. Run StoryboardGenerator to produce scene image prompts

        Parameters
        ----------
        topic : str
            Video topic/title.
        target_duration : float
            Target video duration in seconds.
        num_scenes : int
            Approximate number of scenes.

        Returns
        -------
        Storyboard
            A fully-populated Storyboard from storyboard_generator.py.
        """
        # Import here to avoid circular dependency
        try:
            from .storyboard_generator import StoryboardGenerator
        except ImportError:
            from storyboard_generator import StoryboardGenerator

        # Generate the script
        script = self.generate(topic, target_duration=target_duration, num_scenes=num_scenes)

        # Convert to storyboard-compatible dict
        sb_data = script.to_storyboard_format(channel=self.channel)

        # Run StoryboardGenerator for full scene breakdown + image prompts
        sb_gen = StoryboardGenerator(channel=self.channel, mock=True)
        storyboard = sb_gen.generate_storyboard(
            script=script.full_script_text(),
            topic=topic,
            duration_seconds=target_duration,
            num_scenes=num_scenes,
        )

        logger.info(
            f"[AIScriptGenerator] Storyboard generated: {storyboard.total_scenes} scenes, "
            f"channel={self.channel}"
        )
        return storyboard


# ---------------------------------------------------------------------------
# CLI / self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s",
    )

    print("=" * 60)
    print("AIScriptGenerator — Self-Test")
    print("=" * 60)

    gen = AIScriptGenerator(channel="productivity_worker")

    # Test with template fallback (no OpenAI key needed)
    print("\n[1] Template fallback — how-to topic")
    script = gen.generate("How to double your productivity in 30 days")
    print(f"    hook: {script.hook}")
    print(f"    cta: {script.cta}")
    print(f"    scenes: {len(script.scenes)}")
    for s in script.scenes:
        print(f"      [{s.scene_number}] {s.heading}: {s.text[:50]}...")

    print("\n[2] Template fallback — listicle topic")
    script = gen.generate("Top 5 habits of highly successful people", target_duration=45.0)
    print(f"    hook: {script.hook}")
    print(f"    theme_category: {script.theme_category}")

    print("\n[3] Template fallback — motivational topic")
    script = gen.generate("Why you should never give up on your dreams")
    print(f"    hook: {script.hook}")
    print(f"    theme_category: {script.theme_category}")

    print("\n[4] Full script text")
    script = gen.generate("Why your morning routine is killing your productivity")
    full = script.full_script_text()
    print(f"    Length: {len(full)} chars")
    assert len(full) > 50

    print("\n[5] Storyboard format export")
    sb_fmt = script.to_storyboard_format()
    print(f"    keys: {list(sb_fmt.keys())}")
    assert "scenes" in sb_fmt
    assert "channel" in sb_fmt

    print("\n[6] Mood inference")
    print(f"    educational: {gen._infer_mood('educational')}")
    print(f"    listicle: {gen._infer_mood('listicle')}")
    print(f"    motivational: {gen._infer_mood('motivational')}")

    print("\n[7] Channel init")
    gen2 = AIScriptGenerator(channel="gen_z_success")
    script2 = gen2.generate("Why Gen Z is so stressed about money")
    print(f"    hook: {script2.hook}")
    print(f"    mood: {script2.mood}")

    # Test AI mode if key available
    if os.getenv("OPENAI_API_KEY"):
        print("\n[AI] OpenAI generation")
        script_ai = gen.generate_with_ai_fallback(
            "Why your morning routine is killing your productivity",
            target_duration=60.0,
        )
        print(f"    hook: {script_ai.hook}")
        print(f"    scenes: {len(script_ai.scenes)}")
        print(f"    theme_category: {script_ai.theme_category}")
    else:
        print("\n[AI] Skipped — OPENAI_API_KEY not set (template fallback used)")

    # TKP-82: Hailuo prompt integration test
    print("\n[TKP-82] apply_hailuo_prompts() — Hailuo-optimized storyboard")
    script_h = gen.generate("Why your morning routine is killing your productivity")
    sb_h = script_h.apply_hailuo_prompts(
        seed="morning-prod-2026",
        style="cinematic",
        lighting="golden_hour",
    )
    assert len(sb_h["scenes"]) > 0, "scenes must not be empty"
    for sc in sb_h["scenes"]:
        assert sc["image_prompt"],    "image_prompt must be filled"
        assert sc["negative_prompt"], "negative_prompt must be filled"
        assert sc["seed_info"]["seed_string"], "seed_info must have seed_string"
        assert sc["seed_info"]["reproducible"] == (sc["scene_number"] == 1), \
            "only scene 1 should be reproducible"
    print(f"    {len(sb_h['scenes'])} scenes with Hailuo prompts — all fields populated ✅")
    print(f"    Scene 1 prompt: {sb_h['scenes'][0]['image_prompt'][:80]}...")

    print("\n[TKP-82] Style variants")
    for style in ("anime", "realistic", "documentary"):
        sb_s = script_h.apply_hailuo_prompts(style=style, lighting="dramatic")
        assert sb_s["scenes"][0]["image_prompt"], f"image_prompt must be filled for style={style}"
        print(f"    style={style}: ✅")

    print("\n[TKP-82] No-seed mode")
    sb_no_seed = script_h.apply_hailuo_prompts(seed=None)
    assert sb_no_seed["scenes"][0].get("seed_info") is None, "seed_info should be absent when seed=None"
    print("    seed=None: seed_info absent as expected ✅")

    print("\n" + "=" * 60)
    print("All self-tests PASSED.")
    print("=" * 60)
    sys.exit(0)
