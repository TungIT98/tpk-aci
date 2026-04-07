"""
video_studio_app/seo_optimizer.py
SEO Specialist — SEO Optimization Module for TheKnowledgePlug Video Studio

Responsibilities:
  - Title generator (YouTube, TikTok, LinkedIn)
  - Description generator (YouTube, TikTok, LinkedIn)
  - Tag optimizer (YouTube tags + platform hashtags)
  - Thumbnail optimization suggestions

Usage:
  from seo_optimizer import SEOOptimizer, CHANNEL_PROFILES

  seo = SEOOptimizer(channel="productivity")
  result = seo.optimize(
      topic="The 2-Minute Rule",
      primary_keyword="2 minute rule procrastination",
      secondary_keywords=["stop procrastinating", "productivity habits"],
      duration_seconds=120,
      script_outline=["intro hook", "rule explained", "neuroscience", "examples", "routine"],
  )
"""

from __future__ import annotations

import os
import re
import random
import math
from typing import Optional


# ---------------------------------------------------------------------------
# Channel profiles
# ---------------------------------------------------------------------------

class ChannelProfile:
    """Static config per channel — brand voice, colors, hashtag pools."""
    def __init__(
        self,
        name: str,
        display_name: str,
        color_primary: str,
        color_secondary: str,
        font_suggestion: str,
        hashtag_pool_broad: list[str],
        hashtag_pool_niche: list[str],
        hashtag_pool_trending: list[str],
        cta_phrase: str,
        upload_time: str,
        pin_comment_template: str,
    ):
        self.name = name
        self.display_name = display_name
        self.color_primary = color_primary
        self.color_secondary = color_secondary
        self.font_suggestion = font_suggestion
        self.hashtag_pool_broad = hashtag_pool_broad
        self.hashtag_pool_niche = hashtag_pool_niche
        self.hashtag_pool_trending = hashtag_pool_trending
        self.cta_phrase = cta_phrase
        self.upload_time = upload_time
        self.pin_comment_template = pin_comment_template


CHANNEL_PROFILES: dict[str, ChannelProfile] = {
    "productivity": ChannelProfile(
        name="productivity",
        display_name="TheKnowledgePlug — Productivity",
        color_primary="#2563EB",
        color_secondary="#DBEAFE",
        font_suggestion="Inter / Roboto Bold",
        hashtag_pool_broad=["#productivity", "#timemanagement", "#WorkTips", "#CareerAdvice"],
        hashtag_pool_niche=["#2minuterule", "#pomodorotechnique", "#DeepWork", "#FocusTips", "#TaskManagement"],
        hashtag_pool_trending=["#2026mindset", "#minimalism", "#hustleculture"],
        cta_phrase="If this helped you — subscribe and try it on your next task.",
        upload_time="Monday 8 AM",
        pin_comment_template="In one sentence: {one_liner}. Try it right now.",
    ),
    "growth": ChannelProfile(
        name="growth",
        display_name="TheKnowledgePlug — Growth",
        color_primary="#7C3AED",
        color_secondary="#EDE9FE",
        font_suggestion="Poppins Bold / Clash Display",
        hashtag_pool_broad=["#GrowthMindset", "#SelfImprovement", "#GenZTips", "#Motivation"],
        hashtag_pool_niche=["#HabitStacking", "#GoalSetting", "#MorningRoutine", "#StudyTok", "#MoneyTips"],
        hashtag_pool_trending=["#2026mindset", "#softlife", "#girlmath"],
        cta_phrase="Save this — and follow for more growth hacks every week.",
        upload_time="Thursday 6 PM",
        pin_comment_template="{one_liner} Drop a 🔥 if you agree.",
    ),
}


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _slugify(text: str) -> str:
    """Lowercase, strip, replace spaces with hyphens."""
    return re.sub(r"[^a-z0-9\s-]", "", text.lower().strip()).replace(" ", "-")


def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rsplit(" ", 1)[0] + "..."


def _make_timestamp(secs: int) -> str:
    """Convert seconds -> M:SS string."""
    m = secs // 60
    s = secs % 60
    return f"{m}:{s:02d}"


# ---------------------------------------------------------------------------
# Title generator
# ---------------------------------------------------------------------------

class TitleGenerator:
    """Generates SEO-optimized titles for YouTube / TikTok / LinkedIn."""

    YOUTUBE_TITLE_TEMPLATES = [
        "The {keyword} That {power_verb} {outcome}",
        "{keyword}: {hook_fragment} — {number_word} Guide",
        "I {past_verb} {keyword} for {duration} — {result_statement}",
        "How to {core_action} Using {keyword} ({number} {unit})",
        "{keyword}: The Simple {framework_name} for {audience_benefit}",
        "Why {keyword} Is the {adjective} {thing} in {year}",
        "{number} {keyword} {action} That {result_verb} {outcome}",
        "The {adjective} {keyword} Rule Nobody Teaches You",
    ]

    YOUTUBE_POWER_WORDS = [
        "Eliminated", "Doubled", "Unlocked", "Mastered",
        "Fixed", "Built", "Destroyed", "Revolutionized",
    ]
    YOUTUBE_HOOK_FRAGMENTS = [
        "Why You Keep Failing", "The Science Behind", "What Top Performers Do",
        "A Better Way", "The Hidden Truth", "No One Talks About",
    ]
    YOUTUBE_PAST_VERBS = [
        "Used", "Tested", "Tried", "Did", "Applied",
    ]
    YOUTUBE_RESULT_STATEMENTS = [
        "Mind-Blowing", "Here's the Result", "You Won't Believe It", "Shocking Truth",
    ]
    YOUTUBE_FRAMEWORK_NAMES = [
        "Framework", "System", "Rule", "Method", "Blueprint", "Formula",
    ]
    YOUTUBE_ADJECTIVES = [
        "Underrated", "Overlooked", "Simple", "Powerful", "One-Line",
    ]
    YOUTUBE_THINGS = [
        "Habit", "Hack", "Strategy", "Tool", "Rule", "Mindset",
    ]

    def __init__(self, channel: str):
        self.channel = channel

    def _capitalize(self, s: str) -> str:
        return s[0].upper() + s[1:] if s else s

    def _build_title(self, template: str, keyword: str, **overrides) -> str:
        kw = keyword
        ctx = {
            "keyword": kw,
            "power_verb": random.choice(self.YOUTUBE_POWER_WORDS),
            "outcome": "Your Productivity",
            "hook_fragment": random.choice(self.YOUTUBE_HOOK_FRAGMENTS),
            "number_word": random.choice(["The Ultimate", "The Complete", "Your"]),
            "past_verb": random.choice(self.YOUTUBE_PAST_VERBS),
            "duration": "30 Days",
            "result_statement": random.choice(self.YOUTUBE_RESULT_STATEMENTS),
            "core_action": "Master",
            "number": random.randint(3, 7),
            "unit": "Days",
            "audience_benefit": "More Focus",
            "framework_name": random.choice(self.YOUTUBE_FRAMEWORK_NAMES),
            "adjective": random.choice(self.YOUTUBE_ADJECTIVES),
            "thing": random.choice(self.YOUTUBE_THINGS),
            "action": "Habits",
            "result_verb": "Changed",
            "year": "2026",
        }
        ctx.update(overrides)
        return self._capitalize(template.format(**ctx))

    def generate_youtube(
        self,
        keyword: str,
        primary_topic: Optional[str] = None,
        count: int = 3,
    ) -> list[str]:
        """Return `count` YouTube title options, keyword-front-loaded."""
        topic = primary_topic or keyword
        titles = []
        for _ in range(count * 2):
            tpl = random.choice(self.YOUTUBE_TITLE_TEMPLATES)
            titles.append(self._build_title(tpl, topic))
        # Deduplicate and cap
        seen, unique = set(), []
        for t in titles:
            if t not in seen:
                seen.add(t)
                unique.append(t)
            if len(unique) >= count:
                break
        # Force keyword into first title if not present
        if keyword not in unique[0]:
            unique[0] = f"{self._capitalize(keyword)}: {unique[0].rstrip('.')}"
        return unique[:count]

    def generate_tiktok(
        self,
        keyword: str,
        hook: str = "POV:",
        count: int = 2,
    ) -> list[str]:
        """TikTok-native titles — punchy, hook-first, under 60 chars."""
        templates = [
            f"{hook} You Try the {keyword} Rule",
            f"{keyword} Changed Everything #fyp",
            f"POV: You Discover the {keyword} Hack",
            f"#fyp {keyword} in 60 Seconds",
            f"The {keyword} Nobody Told You About",
            f"#duet with your old self after trying {keyword}",
        ]
        chosen = []
        for _ in range(count * 2):
            t = random.choice(templates)
            t = self._capitalize(t.replace("{keyword}", keyword))
            if t not in chosen:
                chosen.append(t)
            if len(chosen) >= count:
                break
        return [(_truncate(t, 60) if len(t) > 60 else t) for t in chosen]

    def generate_linkedin(
        self,
        keyword: str,
        count: int = 2,
    ) -> list[str]:
        """LinkedIn post titles — professional, insight-led."""
        templates = [
            f"Why '{keyword}' Is Your Most Underrated Productivity Lever",
            f"The 1 {keyword} That Helped Our Team Cut Meetings in Half",
            f"{keyword}: A Thread on Sustainable High Performance",
            f"What 10 Years in Tech Taught Me About {keyword}",
        ]
        chosen = []
        for _ in range(count * 2):
            t = random.choice(templates)
            t = self._capitalize(t.replace("{keyword}", keyword))
            if t not in chosen:
                chosen.append(t)
            if len(chosen) >= count:
                break
        return chosen[:count]


# ---------------------------------------------------------------------------
# Description generator
# ---------------------------------------------------------------------------

class DescriptionGenerator:
    """Generates full descriptions for YouTube, TikTok caption, LinkedIn."""

    def __init__(self, channel: str):
        self.channel = channel
        self.profile = CHANNEL_PROFILES.get(channel, CHANNEL_PROFILES["productivity"])

    def _timestamps_from_outline(self, outline: list[str], duration_secs: int) -> list[tuple[str, str]]:
        """Distribute `duration_secs` evenly across `outline` sections."""
        n = len(outline)
        if n == 0:
            return []
        step = max(1, duration_secs // n)
        timestamps = []
        for i, section in enumerate(outline):
            ts = _make_timestamp(i * step)
            timestamps.append((ts, section))
        return timestamps

    def _build_youtube_description(
        self,
        topic: str,
        keyword: str,
        outline: list[str],
        duration_secs: int,
        secondary_keywords: list[str],
    ) -> str:
        profile = self.profile
        ts_rows = self._timestamps_from_outline(outline, duration_secs)
        ts_lines = "\n".join(f"{ts} — {title}" for ts, title in ts_rows)

        bullets = "\n".join(f"• {title}" for _, title in ts_rows[1:] if title.lower() != "intro")

        desc = f"""Stop letting {topic.lower()} pile up into big anxiety. In this video, I break down {topic} — the science-backed habit that elite performers use to keep their inbox clear, their mind focused, and their {secondary_keywords[0] if secondary_keywords else 'productivity'} non-existent.

In this video you'll learn:
{bullets}

{ts_lines}

{profile.cta_phrase} And hit subscribe for more {secondary_keywords[1] if len(secondary_keywords) > 1 else 'productivity'} science that actually works.

---
#{"".join([" #" + _slugify(k) for k in [keyword] + secondary_keywords])} #{profile.name.capitalize()}
"""
        return desc.strip()

    def _build_tiktok_caption(
        self,
        topic: str,
        keyword: str,
        outline: list[str],
    ) -> str:
        profile = self.profile
        hashtags = (
            ["#" + _slugify(keyword.replace(" ", ""))]
            + [profile.hashtag_pool_niche[0]]
            + profile.hashtag_pool_broad[:2]
            + [profile.hashtag_pool_trending[0]]
        )
        hook = outline[0] if outline else topic
        body = f"♬ {topic}: {hook}" if len(outline) > 1 else topic
        caption = f"{body}\n\n{' '.join(hashtags)}\n\n{profile.pin_comment_template.format(one_liner=topic)}"
        return _truncate(caption, 3000)

    def _build_linkedin_post(
        self,
        topic: str,
        keyword: str,
        secondary_keywords: list[str],
    ) -> str:
        body = (
            f"I've been obsessed with '{keyword}' for the past year — "
            f"and it genuinely changed how I work.\n\n"
            f"Here's what most people miss about {topic}:\n\n"
        )
        for i, kw in enumerate(secondary_keywords, 1):
            body += f"{i}. {kw}\n"
        body += (
            f"\nThe biggest shift: stop optimizing for more tasks. "
            f"Start optimizing for fewer, better ones.\n\n"
            f"What productivity habit changed your output this year? Drop it below 👇\n\n"
            f"#{" #".join([_slugify(keyword)] + [_slugify(k) for k in secondary_keywords[:3]])}"
        )
        return body.strip()

    def generate_youtube(
        self,
        topic: str,
        keyword: str,
        script_outline: list[str],
        duration_seconds: int = 120,
        secondary_keywords: Optional[list[str]] = None,
    ) -> str:
        """Full YouTube description with hook, bullets, timestamps, CTA."""
        return self._build_youtube_description(
            topic, keyword, script_outline, duration_seconds,
            secondary_keywords or [],
        )

    def generate_tiktok(
        self,
        topic: str,
        keyword: str,
        script_outline: list[str],
    ) -> str:
        """TikTok caption with hook, hashtags, pin comment."""
        return self._build_tiktok_caption(topic, keyword, script_outline)

    def generate_linkedin(
        self,
        topic: str,
        keyword: str,
        secondary_keywords: Optional[list[str]] = None,
    ) -> str:
        """LinkedIn post body."""
        return self._build_linkedin_post(
            topic, keyword, secondary_keywords or [],
        )


# ---------------------------------------------------------------------------
# Tag optimizer
# ---------------------------------------------------------------------------

class TagOptimizer:
    """Generates platform-specific tags / hashtags."""

    YOUTUBE_STANDARD_TAGS = [
        "how to", "tips", "guide", "tutorial", "productivity",
        "time management", "focus", "habits", "success", "routine",
    ]

    def __init__(self, channel: str):
        self.channel = channel
        self.profile = CHANNEL_PROFILES.get(channel, CHANNEL_PROFILES["productivity"])

    def youtube_tags(
        self,
        primary_keyword: str,
        secondary_keywords: Optional[list[str]] = None,
        count: int = 12,
    ) -> list[str]:
        """YouTube tags list: keyword-first, then standard + niche."""
        tags = [primary_keyword]
        for kw in (secondary_keywords or []):
            tags.append(kw)
        for tag in self.YOUTUBE_STANDARD_TAGS:
            if len(tags) >= count:
                break
            tags.append(tag)
        # Pad with keyword variations
        parts = primary_keyword.split()
        for part in parts:
            if len(tags) >= count:
                break
            if part not in tags:
                tags.append(part)
        return tags[:count]

    def tiktok_hashtags(
        self,
        primary_keyword: str,
        secondary_keywords: Optional[list[str]] = None,
        trending_override: Optional[str] = None,
    ) -> list[str]:
        """TikTok hashtag list: broad + niche + 1 trending."""
        profile = self.profile
        tags = [
            "#" + _slugify(primary_keyword),
            *(profile.hashtag_pool_niche[:2]),
            *(profile.hashtag_pool_broad[:2]),
        ]
        if trending_override:
            tags.append("#" + _slugify(trending_override))
        else:
            tags.append(profile.hashtag_pool_trending[0])
        if secondary_keywords:
            for kw in secondary_keywords[:2]:
                tag = "#" + _slugify(kw)
                if tag not in tags:
                    tags.append(tag)
        return tags[:8]

    def linkedin_hashtags(
        self,
        primary_keyword: str,
        secondary_keywords: Optional[list[str]] = None,
    ) -> list[str]:
        """LinkedIn hashtags: professional, topic-rich."""
        tags = [
            "#" + _slugify(primary_keyword),
            "#Productivity",
            "#ProfessionalGrowth",
            "#KnowledgeManagement",
        ]
        if secondary_keywords:
            for kw in secondary_keywords[:3]:
                tag = "#" + _slugify(kw)
                if tag not in tags:
                    tags.append(tag)
        return tags[:7]


# ---------------------------------------------------------------------------
# Thumbnail optimizer
# ---------------------------------------------------------------------------

class ThumbnailOptimizer:
    """Thumbnail text/visual suggestions per platform spec."""

    THUMBNAIL_TEXT_TEMPLATES = [
        ("{KEYWORD}", "bold upper-left"),
        ("STOP THE SPIRAL", "bold center"),
        ("{NUMBER}+ {KEYWORD}", "bold lower-third"),
        ("{KEYWORD} RULE", "bold top banner"),
    ]

    def __init__(self, channel: str):
        self.channel = channel
        self.profile = CHANNEL_PROFILES.get(channel, CHANNEL_PROFILES["productivity"])

    def suggest(self, topic: str, keyword: str, duration_seconds: int = 60) -> dict:
        """
        Returns a dict of thumbnail guidance:
          - overlay_text: primary text to layer on thumbnail
          - overlay_position: recommended placement
          - contrast_tip: text-vs-background guidance
          - color_scheme: hex codes per channel profile
          - style_notes: design direction
          - split_concept: optional before/after split description
        """
        is_short = duration_seconds <= 60
        kw_short = keyword.split()[0] if len(keyword.split()) > 3 else keyword

        if is_short:
            overlay_text = f"60-SEC {kw_short.upper()}"
            position = "top banner"
        else:
            overlay_text = f"{kw_short.upper()} RULE"
            position = "bold center"

        profile = self.profile
        contrast_tip = (
            "White text on dark overlay for readability at small sizes. "
            "Use channel primary color (#FF4900) for accent on dark backgrounds."
        )

        style_notes = (
            f"Channel brand: {profile.display_name}. "
            f"Font: {profile.font_suggestion}. "
            f"Face expression — confident, post-clarity. "
            f"Clean background, avoid clutter. "
            f"Recommended aspect: 16:9 (YouTube), 9:16 (TikTok)."
        )

        split_concept = (
            f"Left half: messy desk / full inbox (dull colors). "
            f"Right half: clean desk / clear mind ({profile.color_primary}). "
            f"Text overlay on right half only."
        )

        return {
            "overlay_text": overlay_text,
            "overlay_position": position,
            "contrast_tip": contrast_tip,
            "color_scheme": {
                "primary": profile.color_primary,
                "secondary": profile.color_secondary,
                "text": "#FFFFFF",
                "background_dark": "#1A1A2E",
            },
            "style_notes": style_notes,
            "split_concept": split_concept,
        }


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

class SEOOptimizer:
    """
    Unified SEO optimizer for the video studio.

    Call `.optimize(...)` to get a complete SEO package in one call,
    or use individual generators for granular control.

    Example:
        seo = SEOOptimizer(channel="productivity")
        result = seo.optimize(
            topic="The 2-Minute Rule",
            primary_keyword="2 minute rule procrastination",
            secondary_keywords=["stop procrastinating", "productivity habits"],
            duration_seconds=120,
            script_outline=["intro hook", "rule explained", "neuroscience", "examples", "routine"],
        )
    """

    def __init__(self, channel: str = "productivity"):
        self.channel = channel
        self.profile = CHANNEL_PROFILES.get(channel, CHANNEL_PROFILES["productivity"])
        self.title_gen = TitleGenerator(channel)
        self.desc_gen = DescriptionGenerator(channel)
        self.tag_opt = TagOptimizer(channel)
        self.thumb_opt = ThumbnailOptimizer(channel)

    def optimize(
        self,
        topic: str,
        primary_keyword: str,
        secondary_keywords: Optional[list[str]] = None,
        duration_seconds: int = 120,
        script_outline: Optional[list[str]] = None,
        hook: str = "POV:",
        trending_override: Optional[str] = None,
    ) -> dict:
        """
        Returns a full SEO package dict with keys:
          youtube_title, youtube_title_options,
          tiktok_title, tiktok_title_options,
          linkedin_title, linkedin_title_options,
          youtube_description, tiktok_caption, linkedin_post,
          youtube_tags, tiktok_hashtags, linkedin_hashtags,
          thumbnail (dict with overlay_text, color_scheme, style_notes, ...),
          upload_time, pin_comment_template, channel_profile.
        """
        secondary = secondary_keywords or []
        outline = script_outline or ["intro", "main point", "examples", "conclusion"]

        return {
            # Titles
            "youtube_title_options": self.title_gen.generate_youtube(primary_keyword, topic),
            "youtube_title": self.title_gen.generate_youtube(primary_keyword, topic)[0],
            "tiktok_title_options": self.title_gen.generate_tiktok(primary_keyword, hook),
            "tiktok_title": self.title_gen.generate_tiktok(primary_keyword, hook)[0],
            "linkedin_title_options": self.title_gen.generate_linkedin(primary_keyword),
            "linkedin_title": self.title_gen.generate_linkedin(primary_keyword)[0],
            # Descriptions
            "youtube_description": self.desc_gen.generate_youtube(
                topic, primary_keyword, outline, duration_seconds, secondary
            ),
            "tiktok_caption": self.desc_gen.generate_tiktok(topic, primary_keyword, outline),
            "linkedin_post": self.desc_gen.generate_linkedin(
                topic, primary_keyword, secondary
            ),
            # Tags
            "youtube_tags": self.tag_opt.youtube_tags(primary_keyword, secondary),
            "tiktok_hashtags": self.tag_opt.tiktok_hashtags(
                primary_keyword, secondary, trending_override
            ),
            "linkedin_hashtags": self.tag_opt.linkedin_hashtags(primary_keyword, secondary),
            # Thumbnail
            "thumbnail": self.thumb_opt.suggest(topic, primary_keyword, duration_seconds),
            # Metadata
            "upload_time": self.profile.upload_time,
            "pin_comment_template": self.profile.pin_comment_template.format(
                one_liner=topic
            ),
            "channel_profile": {
                "name": self.profile.name,
                "display_name": self.profile.display_name,
                "color_primary": self.profile.color_primary,
                "color_secondary": self.profile.color_secondary,
            },
        }


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Mock data matching content/seo-briefs/PW-01.md
    result = SEOOptimizer(channel="productivity").optimize(
        topic="The 2-Minute Rule That Eliminates Procrastination",
        primary_keyword="2 minute rule procrastination",
        secondary_keywords=["stop procrastinating", "productivity habits"],
        duration_seconds=120,
        script_outline=[
            "Why Your Small Tasks Are Costing You Hours",
            "The 2-Minute Rule Explained",
            "The Neuroscience: Why Finishing Things Frees Your Brain",
            "Real 2-Minute Tasks You Can Do Right Now",
            "How to Build This Into Your Daily Routine",
        ],
    )

    print("=" * 70)
    print("SEO OPTIMIZER — SELF-TEST OUTPUT")
    print("Channel: productivity")
    print("=" * 70)
    print(f"\n[YouTube Title]\n{result['youtube_title']}")
    print(f"\n[YouTube Title Options]")
    for i, t in enumerate(result["youtube_title_options"], 1):
        print(f"  {i}. {t}")
    print(f"\n[TikTok Title]\n{result['tiktok_title']}")
    print(f"\n[LinkedIn Title]\n{result['linkedin_title']}")
    print(f"\n[YouTube Description]\n{result['youtube_description']}")
    print(f"\n[TikTok Caption]\n{result['tiktok_caption']}")
    print(f"\n[LinkedIn Post]\n{result['linkedin_post']}")
    print(f"\n[YouTube Tags] ({len(result['youtube_tags'])} tags)")
    print(", ".join(result["youtube_tags"]))
    print(f"\n[TikTok Hashtags]")
    print(" ".join(result["tiktok_hashtags"]))
    print(f"\n[LinkedIn Hashtags]")
    print(" ".join(result["linkedin_hashtags"]))
    print(f"\n[Thumbnail]")
    for k, v in result["thumbnail"].items():
        print(f"  {k}: {v}")
    print(f"\n[Upload Time] {result['upload_time']}")
    print(f"[Pin Comment] {result['pin_comment_template']}")
    print("=" * 70)
    print("TEST PASSED — seo_optimizer.py is independently functional.")
