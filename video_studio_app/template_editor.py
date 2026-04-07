"""
video_studio_app/template_editor.py
Founding Engineer — TKP Video Studio (TKP-61)

Template editor: load, edit scene order/timing/transitions, save templates as JSON.

Usage:
    from template_editor import TemplateEditor, Template, SceneSlot

    editor = TemplateEditor()
    template = editor.load_template("morning_routine")

    # Reorder scenes
    editor.reorder_scenes(template, [2, 0, 1, 3])

    # Adjust scene timing
    editor.set_scene_duration(template, scene_index=1, duration=8.0)

    # Set transition
    editor.set_scene_transition(template, scene_index=0, transition="fade")

    editor.save_template(template)
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Optional

from .config import BASE_DIR

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Transitions & Enums
# ---------------------------------------------------------------------------

class TransitionType(Enum):
    FADE = "fade"
    WIPE = "wipe"
    SLIDE = "slide"
    ZOOM = "zoom"
    DISSOLVE = "dissolve"
    NONE = "none"

    @classmethod
    def from_string(cls, s: str) -> "TransitionType":
        s = s.lower().strip().replace("_", "").replace("-", "")
        mapping = {
            "fade": cls.FADE,
            "wipe": cls.WIPE,
            "slide": cls.SLIDE,
            "zoom": cls.ZOOM,
            "dissolve": cls.DISSOLVE,
            "none": cls.NONE,
        }
        for key, val in mapping.items():
            if key in s:
                return val
        return cls.FADE


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class SceneSlot:
    """
    A scene slot within a template.
    Corresponds to one visual block in the final video.
    """
    id: str
    scene_number: int
    duration: float              # seconds
    transition: str = "fade"    # TransitionType value
    image_prompt_template: str = ""
    voiceover_template: str = ""
    text_overlay_template: str = ""
    broll_enabled: bool = False
    broll_keywords: list[str] = field(default_factory=list)
    shot_type: str = "medium"
    camera_movement: str = "static"
    music_volume: float = 1.0   # 0.0–1.0, relative volume for bg music during this scene
    music_fade_in: float = 0.0  # seconds
    music_fade_out: float = 0.0  # seconds

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "SceneSlot":
        return cls(**data)


@dataclass
class Template:
    """
    A video template: a named collection of SceneSlots plus metadata.
    """
    id: str
    name: str
    description: str = ""
    channel: str = "productivity_worker"
    default_duration: float = 60.0
    mood: str = "productivity"
    scenes: list[SceneSlot] = field(default_factory=list)
    default_transition: str = "fade"
    aspect_ratio: str = "9:16"
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "channel": self.channel,
            "default_duration": self.default_duration,
            "mood": self.mood,
            "default_transition": self.default_transition,
            "aspect_ratio": self.aspect_ratio,
            "tags": self.tags,
            "scenes": [s.to_dict() for s in self.scenes],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Template":
        scenes = [SceneSlot.from_dict(s) for s in data.get("scenes", [])]
        return cls(
            id=data["id"],
            name=data["name"],
            description=data.get("description", ""),
            channel=data.get("channel", "productivity_worker"),
            default_duration=data.get("default_duration", 60.0),
            mood=data.get("mood", "productivity"),
            scenes=scenes,
            default_transition=data.get("default_transition", "fade"),
            aspect_ratio=data.get("aspect_ratio", "9:16"),
            tags=data.get("tags", []),
        )

    def total_duration(self) -> float:
        return sum(s.duration for s in self.scenes)

    def scene_by_id(self, scene_id: str) -> Optional[SceneSlot]:
        for s in self.scenes:
            if s.id == scene_id:
                return s
        return None


# ---------------------------------------------------------------------------
# Editor
# ---------------------------------------------------------------------------

class TemplateEditor:
    """
    Load, edit, and save video templates.

    Templates are stored as JSON files under templates/ directory.
    """

    DEFAULT_TEMPLATE_DIR = BASE_DIR / "templates"

    # Default scene duration in seconds
    DEFAULT_SCENE_DURATION = 6.0

    def __init__(self, template_dir: Optional[Path | str] = None):
        self.template_dir = Path(template_dir or self.DEFAULT_TEMPLATE_DIR)
        self.template_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # I/O
    # ------------------------------------------------------------------

    def load_template(self, template_id_or_filename: str) -> Template:
        """
        Load a template by ID or filename.
        Searches templates/ for a matching .json file.

        Raises FileNotFoundError if not found.
        """
        # Try exact path first
        path = Path(template_id_or_filename)
        if not path.suffix:
            path = self.template_dir / f"{template_id_or_filename}.json"

        if not path.exists():
            # Try case-insensitive search
            for candidate in self.template_dir.glob("*.json"):
                if candidate.stem.lower() == template_id_or_filename.lower():
                    path = candidate
                    break

        if not path.exists():
            raise FileNotFoundError(
                f"Template '{template_id_or_filename}' not found in {self.template_dir}"
            )

        data = json.loads(path.read_text(encoding="utf-8"))
        logger.info(f"[TemplateEditor] Loaded template: {path.stem}")
        return Template.from_dict(data)

    def list_templates(self) -> list[str]:
        """Return all template IDs (filenames without .json)."""
        return [p.stem for p in self.template_dir.glob("*.json")]

    def save_template(self, template: Template, filename: Optional[str] = None) -> Path:
        """
        Save a template to a JSON file.
        Uses template.id as filename unless overridden.
        """
        path = self.template_dir / (filename or f"{template.id}.json")
        path.write_text(json.dumps(template.to_dict(), indent=2), encoding="utf-8")
        logger.info(f"[TemplateEditor] Saved template: {path.stem}")
        return path

    def delete_template(self, template_id: str) -> None:
        """Delete a template file by ID."""
        path = self.template_dir / f"{template_id}.json"
        if path.exists():
            path.unlink()
            logger.info(f"[TemplateEditor] Deleted template: {template_id}")

    # ------------------------------------------------------------------
    # Scene operations
    # ------------------------------------------------------------------

    def reorder_scenes(self, template: Template, new_order: list[int]) -> None:
        """
        Reorder scenes in a template.

        Args:
            template: Template to modify (mutated in place).
            new_order: List of original scene indices in the new desired order.
                       Must contain all current scene indices exactly once.
        """
        if len(new_order) != len(template.scenes):
            raise ValueError(
                f"new_order length ({len(new_order)}) must match "
                f"scene count ({len(template.scenes)})"
            )
        if set(new_order) != set(range(len(template.scenes))):
            raise ValueError("new_order must be a permutation of current scene indices")

        old_scenes = list(template.scenes)
        template.scenes = []
        for i, old_idx in enumerate(new_order):
            scene = old_scenes[old_idx]
            scene.scene_number = i + 1
            scene.id = f"{template.id}_scene_{i+1}"
            template.scenes.append(scene)

        logger.info(f"[TemplateEditor] Reordered scenes: {new_order}")

    def set_scene_duration(
        self, template: Template, scene_index: int, duration: float
    ) -> None:
        """Set the duration of a specific scene in seconds."""
        if not 0 <= scene_index < len(template.scenes):
            raise IndexError(f"scene_index {scene_index} out of range")
        if duration < 1.0:
            raise ValueError(f"duration must be >= 1.0 second, got {duration}")

        template.scenes[scene_index].duration = round(duration, 2)
        logger.info(
            f"[TemplateEditor] Scene {scene_index} duration → {duration}s"
        )

    def set_scene_transition(
        self, template: Template, scene_index: int, transition: str
    ) -> None:
        """Set the transition type for a specific scene."""
        if not 0 <= scene_index < len(template.scenes):
            raise IndexError(f"scene_index {scene_index} out of range")

        t = TransitionType.from_string(transition)
        template.scenes[scene_index].transition = t.value
        logger.info(
            f"[TemplateEditor] Scene {scene_index} transition → {t.value}"
        )

    def add_scene(
        self,
        template: Template,
        after_index: int = -1,
        *,
        duration: float = 6.0,
        transition: str = "fade",
    ) -> SceneSlot:
        """
        Add a new blank scene slot after the given index (-1 = append at end).
        Returns the new SceneSlot.
        """
        new_scene = SceneSlot(
            id=f"{template.id}_scene_{len(template.scenes) + 1}",
            scene_number=len(template.scenes) + 1,
            duration=duration,
            transition=transition,
        )

        if after_index == -1 or after_index >= len(template.scenes) - 1:
            template.scenes.append(new_scene)
        else:
            template.scenes.insert(after_index + 1, new_scene)

        # Re-number scenes
        for i, s in enumerate(template.scenes):
            s.scene_number = i + 1

        logger.info(f"[TemplateEditor] Added scene at index {after_index + 1}")
        return new_scene

    def remove_scene(self, template: Template, scene_index: int) -> SceneSlot:
        """Remove and return a scene at the given index."""
        if not 0 <= scene_index < len(template.scenes):
            raise IndexError(f"scene_index {scene_index} out of range")

        removed = template.scenes.pop(scene_index)
        # Re-number remaining scenes
        for i, s in enumerate(template.scenes):
            s.scene_number = i + 1

        logger.info(f"[TemplateEditor] Removed scene {scene_index} ({removed.id})")
        return removed

    def set_default_transition(self, template: Template, transition: str) -> None:
        """Set the default transition applied to all scenes without explicit transitions."""
        t = TransitionType.from_string(transition)
        template.default_transition = t.value
        for scene in template.scenes:
            if scene.transition == "none":
                scene.transition = t.value
        logger.info(f"[TemplateEditor] Default transition → {t.value}")

    # ------------------------------------------------------------------
    # Clone / duplicate
    # ------------------------------------------------------------------

    def clone_template(
        self,
        template: Template,
        new_id: str,
        new_name: str,
    ) -> Template:
        """
        Create a deep copy of a template with a new ID and name.
        All scene IDs are regenerated to avoid collisions.
        Returns the new Template (not saved — call save_template()).
        """
        new_scenes = []
        for i, scene in enumerate(template.scenes):
            new_scene = SceneSlot(
                id=f"{new_id}_scene_{i+1}",
                scene_number=i + 1,
                duration=scene.duration,
                transition=scene.transition,
                image_prompt_template=scene.image_prompt_template,
                voiceover_template=scene.voiceover_template,
                text_overlay_template=scene.text_overlay_template,
                broll_enabled=scene.broll_enabled,
                broll_keywords=list(scene.broll_keywords),
                shot_type=scene.shot_type,
                camera_movement=scene.camera_movement,
                music_volume=scene.music_volume,
                music_fade_in=scene.music_fade_in,
                music_fade_out=scene.music_fade_out,
            )
            new_scenes.append(new_scene)

        cloned = Template(
            id=new_id,
            name=new_name,
            description=template.description,
            channel=template.channel,
            default_duration=template.default_duration,
            mood=template.mood,
            scenes=new_scenes,
            default_transition=template.default_transition,
            aspect_ratio=template.aspect_ratio,
            tags=list(template.tags),
        )
        logger.info(f"[TemplateEditor] Cloned template '{template.name}' → '{new_name}' (id={new_id})")
        return cloned

    def save_as_new(
        self,
        template: Template,
        new_id: str,
        new_name: str,
    ) -> Path:
        """
        Clone a template and save it as a new template in one step.

        Convenience wrapper around clone_template() + save_template().
        All scene IDs are regenerated to avoid collisions.

        Returns the Path the new template was saved to.
        """
        cloned = self.clone_template(template, new_id, new_name)
        return self.save_template(cloned)

    # ------------------------------------------------------------------
    # Import / Export JSON
    # ------------------------------------------------------------------

    def export_template_json(self, template: Template) -> str:
        """
        Export a template to a JSON string.
        Useful for UI preview, clipboard copy, or saving to a custom location.
        """
        return json.dumps(template.to_dict(), indent=2)

    def import_template_json(self, json_str: str) -> Template:
        """
        Load a template from a JSON string.
        Validates that required fields are present.
        Raises ValueError if the JSON is invalid or missing required fields.
        """
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON: {exc}")

        if "id" not in data or "name" not in data:
            raise ValueError("Template JSON must have 'id' and 'name' fields")

        template = Template.from_dict(data)
        logger.info(f"[TemplateEditor] Imported template '{template.name}' (id={template.id})")
        return template

    def import_template_file(self, path: str | Path) -> Template:
        """
        Load a template from a JSON file (path can be absolute or relative).
        Does not require the file to be in the templates/ directory.
        """
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Template file not found: {path}")
        data = json.loads(path.read_text(encoding="utf-8"))
        return self.import_template_json(json.dumps(data))

    # ------------------------------------------------------------------
    # UI preview helpers
    # ------------------------------------------------------------------

    def get_scene_script_preview(self, template: Template, scene_index: int) -> str:
        """
        Return the voiceover/script text for a given scene.
        Returns the voiceover_template if set, else a placeholder string.
        """
        if not 0 <= scene_index < len(template.scenes):
            raise IndexError(f"scene_index {scene_index} out of range")
        scene = template.scenes[scene_index]
        if scene.voiceover_template:
            return scene.voiceover_template
        return f"[Scene {scene_index + 1} — voiceover not set]"

    def get_image_prompt_preview(self, template: Template, scene_index: int) -> str:
        """
        Return the image generation prompt for a given scene.
        Returns the image_prompt_template if set, else a placeholder.
        """
        if not 0 <= scene_index < len(template.scenes):
            raise IndexError(f"scene_index {scene_index} out of range")
        scene = template.scenes[scene_index]
        if scene.image_prompt_template:
            return scene.image_prompt_template
        return (
            f"[Scene {scene_index + 1}] "
            f"{scene.shot_type} shot, {scene.camera_movement} — "
            f"image prompt not set"
        )

    def get_all_scene_previews(self, template: Template) -> list[dict]:
        """
        Return a list of dicts with script and image-prompt preview for every scene.
        Useful for a real-time preview panel in the UI.
        """
        return [
            {
                "scene_number": i + 1,
                "scene_id": s.id,
                "duration": s.duration,
                "transition": s.transition,
                "shot_type": s.shot_type,
                "camera_movement": s.camera_movement,
                "voiceover": template.voiceover_template if hasattr(template, 'voiceover_template') else (
                    s.voiceover_template or f"[Scene {i+1} voiceover]"
                ),
                "image_prompt": s.image_prompt_template or f"[Scene {i+1} image prompt]",
                "text_overlay": s.text_overlay_template or "",
                "broll_enabled": s.broll_enabled,
            }
            for i, s in enumerate(template.scenes)
        ]

    def render_preview_text(self, template: Template) -> str:
        """
        Render a human-readable preview of the full template script/scene flow.
        Useful for the real-time script preview panel.
        """
        lines = [f"=== Template: {template.name} ({template.id}) ==="]
        lines.append(f"Channel: {template.channel} | Mood: {template.mood} | Aspect: {template.aspect_ratio}")
        lines.append(f"Total duration: {template.total_duration():.1f}s | Scenes: {len(template.scenes)}")
        lines.append("")
        for i, s in enumerate(template.scenes):
            lines.append(
                f"  Scene {i+1}. [{s.duration:.1f}s | {s.transition}] "
                f"{s.shot_type} | {s.camera_movement}"
            )
            vo = s.voiceover_template or "[no voiceover]"
            lines.append(f"    VO: {vo}")
            ip = s.image_prompt_template or "[no image prompt]"
            lines.append(f"    Image: {ip}")
            if s.text_overlay_template:
                lines.append(f"    Text: {s.text_overlay_template}")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Template factory
    # ------------------------------------------------------------------

    def create_template(
        self,
        template_id: str,
        name: str,
        num_scenes: int = 5,
        *,
        description: str = "",
        channel: str = "productivity_worker",
        mood: str = "productivity",
        default_duration: float = 60.0,
        scene_duration: float = 6.0,
        transition: str = "fade",
        aspect_ratio: str = "9:16",
    ) -> Template:
        """
        Create a new template with the given number of blank scene slots.

        Args:
            template_id: Unique identifier (used as filename).
            name: Human-readable name.
            num_scenes: Number of scene slots to create.
            description, channel, mood, default_duration, aspect_ratio: metadata.
            scene_duration: Default duration per scene.
            transition: Default transition type.

        Returns:
            The new Template object (not yet saved — call save_template()).
        """
        scenes = [
            SceneSlot(
                id=f"{template_id}_scene_{i+1}",
                scene_number=i + 1,
                duration=round(scene_duration, 2),
                transition=transition,
            )
            for i in range(num_scenes)
        ]

        template = Template(
            id=template_id,
            name=name,
            description=description,
            channel=channel,
            default_duration=default_duration,
            mood=mood,
            scenes=scenes,
            default_transition=transition,
            aspect_ratio=aspect_ratio,
            tags=[],
        )
        logger.info(f"[TemplateEditor] Created template '{name}' with {num_scenes} scenes")
        return template

    # ------------------------------------------------------------------
    # Apply template to storyboard
    # ------------------------------------------------------------------

    def apply_to_storyboard(self, template: Template, storyboard_scenes: list) -> list:
        """
        Apply template timing/transition/order to an existing storyboard scene list.

        Maps template scene slots onto storyboard scenes 1:1
        (trimming or padding storyboard scenes to match).

        Returns modified storyboard scenes (mutates input list in place).
        """
        sb_scenes = storyboard_scenes

        for i, slot in enumerate(template.scenes):
            if i < len(sb_scenes):
                sb_scenes[i].duration = slot.duration
                sb_scenes[i].transition = slot.transition
                sb_scenes[i].shot_type = slot.shot_type
                sb_scenes[i].camera_movement = slot.camera_movement
            else:
                logger.warning(
                    f"[TemplateEditor] Template has more scenes ({len(template.scenes)}) "
                    f"than storyboard ({len(sb_scenes)})"
                )

        return sb_scenes


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
    print("TemplateEditor — Self-Test")
    print("=" * 60)

    editor = TemplateEditor()

    # 1. Create a sample template
    print("\n[1] Creating sample template")
    t = editor.create_template(
        "test_morning_routine",
        name="Morning Routine Test",
        description="Test template for morning routine videos",
        num_scenes=4,
        scene_duration=6.0,
        mood="productivity",
        channel="productivity_worker",
    )
    print(f"    template id={t.id}, total_duration={t.total_duration()}s")
    assert len(t.scenes) == 4

    # 2. Save and reload
    print("\n[2] Save and reload")
    path = editor.save_template(t)
    t2 = editor.load_template("test_morning_routine")
    assert t2.id == t.id
    assert len(t2.scenes) == 4
    print(f"    Reloaded: {t2.name}, {len(t2.scenes)} scenes")

    # 3. Reorder scenes
    print("\n[3] Reorder scenes [3,0,1,2]")
    editor.reorder_scenes(t2, [3, 0, 1, 2])
    assert [s.id for s in t2.scenes] == [
        f"test_morning_routine_scene_{i}" for i in [4, 1, 2, 3]
    ]
    print("    Reorder verified")

    # 4. Set scene duration
    print("\n[4] Set scene durations")
    editor.set_scene_duration(t2, scene_index=0, duration=10.0)
    editor.set_scene_duration(t2, scene_index=1, duration=4.0)
    assert t2.scenes[0].duration == 10.0
    assert t2.scenes[1].duration == 4.0
    print(f"    Scene 0: {t2.scenes[0].duration}s, Scene 1: {t2.scenes[1].duration}s")

    # 5. Set transitions
    print("\n[5] Set transitions")
    editor.set_scene_transition(t2, scene_index=0, transition="wipe")
    editor.set_scene_transition(t2, scene_index=2, transition="zoom")
    assert t2.scenes[0].transition == "wipe"
    assert t2.scenes[2].transition == "zoom"
    print("    Transitions set: wipe, zoom")

    # 6. Add/remove scene
    print("\n[6] Add/remove scene")
    editor.add_scene(t2, after_index=1, duration=5.0, transition="dissolve")
    assert len(t2.scenes) == 5
    removed = editor.remove_scene(t2, scene_index=2)
    assert len(t2.scenes) == 4
    print(f"    Add/remove OK, removed: {removed.id}")

    # 7. Total duration
    print("\n[7] Total duration")
    total = t2.total_duration()
    print(f"    Total: {total}s")
    assert abs(total - 28.0) < 1.0  # ~10 + 6 + 6 + 6

    # 8. Save and reload again
    print("\n[8] Save/reload cycle")
    editor.save_template(t2)
    t3 = editor.load_template("test_morning_routine")
    assert len(t3.scenes) == 4
    print(f"    Final reload: {t3.name}, {len(t3.scenes)} scenes")

    # Cleanup
    editor.delete_template("test_morning_routine")
    print("\n[cleanup] Deleted test template")

    print("\n" + "=" * 60)
    print("All self-tests PASSED.")
    print("=" * 60)
    sys.exit(0)
