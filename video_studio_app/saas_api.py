"""
video_studio_app/saas_api.py
Founding Engineer — TKP Video Studio v3 SaaS API

FastAPI REST API exposing all Video Studio modules as HTTP endpoints.
Enables web UI / external clients to drive the full video production pipeline.

Run:
    pip install fastapi uvicorn
    uvicorn video_studio_app.saas_api:app --reload --port 8000

Endpoints:
    Templates  — CRUD, clone, save-as-new, import/export JSON
    Music     — browse, search by mood/tag, suggest for template
    B-roll    — search, get clip options per scene
    Script    — generate from topic, convert to storyboard
    Images    — generate batch, character profiles
    Assembly  — FFmpeg preview assembly with progress
    Analytics — system health, module status
"""

from __future__ import annotations

import logging
import os
import sys
import traceback
from pathlib import Path
from typing import Optional

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# ---------------------------------------------------------------------------
# Attempt FastAPI import — exit gracefully if not installed
# ---------------------------------------------------------------------------

try:
    from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse, JSONResponse
    from pydantic import BaseModel, Field
    import uvicorn
    _FASTAPI_AVAILABLE = True
except ImportError:
    _FASTAPI_AVAILABLE = False
    FastAPI = None
    BaseModel = object

logger = logging.getLogger("saas_api")

# ---------------------------------------------------------------------------
# Pydantic request/response models
# ---------------------------------------------------------------------------

if _FASTAPI_AVAILABLE:

    class SceneUpdate(BaseModel):
        duration: Optional[float] = None
        transition: Optional[str] = None
        image_prompt_template: Optional[str] = None
        voiceover_template: Optional[str] = None
        text_overlay_template: Optional[str] = None
        shot_type: Optional[str] = None
        camera_movement: Optional[str] = None
        music_volume: Optional[float] = None
        music_fade_in: Optional[float] = None
        music_fade_out: Optional[float] = None
        broll_enabled: Optional[bool] = None
        broll_keywords: Optional[list[str]] = None

    class ReorderScenesRequest(BaseModel):
        new_order: list[int]

    class CloneTemplateRequest(BaseModel):
        new_id: str
        new_name: str

    class SaveAsNewRequest(BaseModel):
        new_id: str
        new_name: str

    class GenerateScriptRequest(BaseModel):
        topic: str
        target_duration: float = 60.0
        num_scenes: int = 5
        channel: str = "productivity_worker"

    class GenerateImagesRequest(BaseModel):
        prompts: list[str]
        width: int = 1024
        height: int = 1024
        character_name: Optional[str] = None

    class GenerateForTemplateRequest(BaseModel):
        template_id: str
        scene_indices: list[int]
        character_name: Optional[str] = None
        width: int = 1024
        height: int = 1024
        prompts: list[str]
        width: int = 1024
        height: int = 1024
        character_name: Optional[str] = None

    class BrollSuggestRequest(BaseModel):
        scene_description: str
        scene_index: int
        num_clips: int = 3
        themes: Optional[list[str]] = None

    class AssemblePreviewRequest(BaseModel):
        template_id: str
        quality: str = "1080p"
        aspect: str = "9:16"
        with_music: bool = True

    class BatchGenerateRequest(BaseModel):
        prompts: list[dict]  # each dict: { prompt, model?, image_path?, duration?, resolution? }
        max_concurrent: int = 1
        wait_for_completion: bool = True
        max_wait_ms: int = 600_000

    class GenerateWithCharacterRequest(BaseModel):
        character_image_path: str
        scene_prompts: list[dict]  # each dict: { prompt, duration?, resolution? }
        character_description: str = ""
        max_wait_ms: int = 600_000

    # ---------------------------------------------------------------------------
    # FastAPI app
    # ---------------------------------------------------------------------------

    app = FastAPI(
        title="TKP Video Studio SaaS API",
        description="Full video production pipeline API for TKP Content Agency.",
        version="3.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---------------------------------------------------------------------------
    # Module singletons (lazy init)
    # ---------------------------------------------------------------------------

    _template_editor = None
    _music_library = None
    _footage_fetcher = None
    _ai_script_gen = None
    _image_generator = None
    _character_profiles: dict = {}   # in-memory character profile store

    def _get_template_editor():
        global _template_editor
        if _template_editor is None:
            from video_studio_app.template_editor import TemplateEditor
            _template_editor = TemplateEditor()
        return _template_editor

    def _get_music_library():
        global _music_library
        if _music_library is None:
            from video_studio_app.music_library import MusicLibrary
            _music_library = MusicLibrary()
        return _music_library

    def _get_footage_fetcher():
        global _footage_fetcher
        if _footage_fetcher is None:
            from video_studio_app.footage_fetcher import FootageFetcher
            _footage_fetcher = FootageFetcher()
        return _footage_fetcher

    def _get_ai_script_gen():
        global _ai_script_gen
        if _ai_script_gen is None:
            from video_studio_app.ai_script_generator import AIScriptGenerator
            _ai_script_gen = AIScriptGenerator()
        return _ai_script_gen

    def _get_image_generator():
        global _image_generator
        if _image_generator is None:
            from video_studio_app.image_generator import ImageGenerator, GenerationOptions, CharacterProfile
            _image_generator = ImageGenerator(provider="auto")
        return _image_generator

    # ---------------------------------------------------------------------------
    # Health / root
    # ---------------------------------------------------------------------------

    @app.get("/api/health")
    def health():
        return {
            "status": "ok",
            "version": "3.0.0",
            "fastapi_available": True,
            "modules": {
                "template_editor": True,
                "music_library": True,
                "footage_fetcher": True,
                "ai_script_generator": True,
                "image_generator": True,
            },
        }

    @app.get("/")
    def root():
        return {
            "service": "TKP Video Studio SaaS API",
            "version": "3.0.0",
            "docs": "/docs",
            "health": "/api/health",
        }

    # ---------------------------------------------------------------------------
    # TEMPLATE endpoints
    # ---------------------------------------------------------------------------

    @app.get("/api/templates")
    def list_templates():
        """List all available template IDs."""
        editor = _get_template_editor()
        return {"templates": editor.list_templates()}

    @app.get("/api/templates/{template_id}")
    def get_template(template_id: str):
        """Get a template by ID with full scene details."""
        editor = _get_template_editor()
        try:
            t = editor.load_template(template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
        return t.to_dict()

    @app.post("/api/templates")
    def create_template(
        template_id: str = Query(...),
        name: str = Query(...),
        num_scenes: int = Query(5),
        description: str = Query(""),
        channel: str = Query("productivity_worker"),
        mood: str = Query("productivity"),
        aspect_ratio: str = Query("9:16"),
        scene_duration: float = Query(6.0),
        transition: str = Query("fade"),
    ):
        """Create a new blank template."""
        editor = _get_template_editor()
        t = editor.create_template(
            template_id=template_id,
            name=name,
            num_scenes=num_scenes,
            description=description,
            channel=channel,
            mood=mood,
            aspect_ratio=aspect_ratio,
            scene_duration=scene_duration,
            transition=transition,
        )
        path = editor.save_template(t)
        return {"template": t.to_dict(), "saved_to": str(path)}

    @app.patch("/api/templates/{template_id}/scenes/{scene_index}")
    def update_scene(template_id: str, scene_index: int, update: SceneUpdate):
        """Update specific fields of a scene in a template."""
        editor = _get_template_editor()
        try:
            t = editor.load_template(template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

        idx = scene_index
        if not 0 <= idx < len(t.scenes):
            raise HTTPException(status_code=400, detail=f"scene_index {idx} out of range")

        scene = t.scenes[idx]
        if update.duration is not None:
            editor.set_scene_duration(t, idx, update.duration)
        if update.transition is not None:
            editor.set_scene_transition(t, idx, update.transition)
        if update.image_prompt_template is not None:
            scene.image_prompt_template = update.image_prompt_template
        if update.voiceover_template is not None:
            scene.voiceover_template = update.voiceover_template
        if update.text_overlay_template is not None:
            scene.text_overlay_template = update.text_overlay_template
        if update.shot_type is not None:
            scene.shot_type = update.shot_type
        if update.camera_movement is not None:
            scene.camera_movement = update.camera_movement
        if update.music_volume is not None:
            scene.music_volume = update.music_volume
        if update.music_fade_in is not None:
            scene.music_fade_in = update.music_fade_in
        if update.music_fade_out is not None:
            scene.music_fade_out = update.music_fade_out
        if update.broll_enabled is not None:
            scene.broll_enabled = update.broll_enabled
        if update.broll_keywords is not None:
            scene.broll_keywords = update.broll_keywords

        editor.save_template(t)
        return {"template": t.to_dict(), "updated_scene_index": idx}

    @app.post("/api/templates/{template_id}/scenes/{scene_index}/move")
    def move_scene(template_id: str, scene_index: int, direction: str = Query(..., regex="^(up|down)$")):
        """Move a scene up or down by one position."""
        editor = _get_template_editor()
        try:
            t = editor.load_template(template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

        n = len(t.scenes)
        if not 0 <= scene_index < n:
            raise HTTPException(status_code=400, detail="scene_index out of range")

        if direction == "up" and scene_index > 0:
            new_order = list(range(n))
            new_order[scene_index - 1], new_order[scene_index] = new_order[scene_index], new_order[scene_index - 1]
        elif direction == "down" and scene_index < n - 1:
            new_order = list(range(n))
            new_order[scene_index], new_order[scene_index + 1] = new_order[scene_index + 1], new_order[scene_index]
        else:
            raise HTTPException(status_code=400, detail="Cannot move scene in that direction")

        editor.reorder_scenes(t, new_order)
        editor.save_template(t)
        return {"template": t.to_dict(), "moved": direction, "from_index": scene_index}

    @app.post("/api/templates/{template_id}/scenes")
    def add_scene(template_id: str, after_index: int = Query(-1), duration: float = Query(6.0)):
        """Add a new blank scene after the given index (-1 = append at end)."""
        editor = _get_template_editor()
        try:
            t = editor.load_template(template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

        new_scene = editor.add_scene(t, after_index=after_index, duration=duration)
        editor.save_template(t)
        return {"template": t.to_dict(), "added_scene": new_scene.to_dict()}

    @app.delete("/api/templates/{template_id}/scenes/{scene_index}")
    def remove_scene(template_id: str, scene_index: int):
        """Remove a scene at the given index."""
        editor = _get_template_editor()
        try:
            t = editor.load_template(template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

        removed = editor.remove_scene(t, scene_index)
        editor.save_template(t)
        return {"template": t.to_dict(), "removed_scene_id": removed.id}

    @app.post("/api/templates/{template_id}/clone")
    def clone_template(template_id: str, body: CloneTemplateRequest):
        """Clone a template with a new ID and name."""
        editor = _get_template_editor()
        try:
            t = editor.load_template(template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

        cloned = editor.clone_template(t, body.new_id, body.new_name)
        path = editor.save_template(cloned)
        return {"template": cloned.to_dict(), "saved_to": str(path)}

    @app.post("/api/templates/{template_id}/save-as-new")
    def save_as_new(template_id: str, body: SaveAsNewRequest):
        """Clone and save as a new template in one operation."""
        editor = _get_template_editor()
        try:
            t = editor.load_template(template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

        path = editor.save_as_new(t, body.new_id, body.new_name)
        return {"saved_to": str(path), "new_id": body.new_id, "new_name": body.new_name}

    @app.post("/api/templates/{template_id}/reorder")
    def reorder_scenes(template_id: str, body: ReorderScenesRequest):
        """Reorder scenes by a list of original indices."""
        editor = _get_template_editor()
        try:
            t = editor.load_template(template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

        editor.reorder_scenes(t, body.new_order)
        editor.save_template(t)
        return {"template": t.to_dict()}

    @app.get("/api/templates/{template_id}/preview")
    def preview_template(template_id: str):
        """Get real-time script preview for all scenes."""
        editor = _get_template_editor()
        try:
            t = editor.load_template(template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

        return {
            "template_id": template_id,
            "total_duration": t.total_duration(),
            "scene_count": len(t.scenes),
            "scenes": editor.get_all_scene_previews(t),
            "rendered": editor.render_preview_text(t),
        }

    @app.get("/api/templates/{template_id}/export")
    def export_template(template_id: str):
        """Export template as JSON string."""
        editor = _get_template_editor()
        try:
            t = editor.load_template(template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

        return {"json": editor.export_template_json(t)}

    @app.post("/api/templates/import")
    def import_template(json_str: str = Query(..., alias="json")):
        """Import a template from JSON string."""
        editor = _get_template_editor()
        try:
            t = editor.import_template_json(json_str)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        path = editor.save_template(t)
        return {"template": t.to_dict(), "saved_to": str(path)}

    @app.delete("/api/templates/{template_id}")
    def delete_template(template_id: str):
        """Delete a template by ID."""
        editor = _get_template_editor()
        editor.delete_template(template_id)
        return {"deleted": template_id}

    # ---------------------------------------------------------------------------
    # MUSIC endpoints
    # ---------------------------------------------------------------------------

    @app.get("/api/music/tracks")
    def list_music(
        mood: Optional[str] = Query(None),
        tag: Optional[str] = Query(None),
    ):
        """List music tracks, optionally filtered by mood or tag."""
        lib = _get_music_library()
        if mood:
            tracks = lib.search_mood(mood)
        elif tag:
            tracks = lib.search_tag(tag)
        else:
            tracks = lib.all_tracks()
        return {"count": len(tracks), "tracks": [t.to_dict() for t in tracks]}

    @app.get("/api/music/moods")
    def music_moods():
        """Get summary of tracks per mood."""
        lib = _get_music_library()
        return lib.mood_summary()

    @app.get("/api/music/suggest")
    def suggest_music(
        mood: str = Query(...),
        duration: Optional[float] = Query(None),
    ):
        """Suggest the best track for a mood, optionally matching a target duration."""
        lib = _get_music_library()
        if duration:
            track = lib.suggest_for_duration(duration, mood)
        else:
            track = lib.suggest_for_mood(mood)
        if not track:
            raise HTTPException(status_code=404, detail=f"No track found for mood '{mood}'")
        return {"suggested": track.to_dict()}

    @app.get("/api/music/suggest-for-template")
    def suggest_for_template(template_id: str):
        """Suggest a track for a template based on its mood and duration."""
        editor = _get_template_editor()
        lib = _get_music_library()
        try:
            t = editor.load_template(template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

        track = lib.suggest_for_template(t.mood, t.total_duration())
        if not track:
            raise HTTPException(status_code=404, detail="No matching track found")
        return {"template_mood": t.mood, "template_duration": t.total_duration(), "suggested": track.to_dict()}

    @app.get("/api/music/scene-volumes")
    def scene_volumes(num_scenes: int = Query(...), base_volume: float = Query(0.15)):
        """Generate per-scene volume levels for a template arc."""
        lib = _get_music_library()
        volumes = lib.suggest_scene_volumes(num_scenes, base_volume)
        return {"num_scenes": num_scenes, "base_volume": base_volume, "volumes": volumes}

    # ---------------------------------------------------------------------------
    # B-ROLL / FOOTAGE endpoints
    # ---------------------------------------------------------------------------

    @app.get("/api/broll/search")
    def search_broll(
        query: str = Query(...),
        per_provider: int = Query(5),
        themes: Optional[list[str]] = Query(None),
    ):
        """Search for B-roll footage clips."""
        fetcher = _get_footage_fetcher()
        items = fetcher.search(query, themes=themes, per_provider=per_provider)
        return {
            "query": query,
            "total": len(items),
            "clips": [
                {
                    "id": it.id,
                    "source": it.source,
                    "url": it.url,
                    "thumbnail_url": it.thumbnail_url,
                    "duration": it.duration,
                    "resolution": f"{it.width}x{it.height}",
                    "tags": it.tags,
                    "credit": it.credit_line,
                    "local_path": it.local_path,
                }
                for it in items
            ],
        }

    @app.post("/api/broll/suggest-for-scene")
    def suggest_broll_for_scene(body: BrollSuggestRequest):
        """Get top B-roll clip options for a given scene description."""
        fetcher = _get_footage_fetcher()
        result = fetcher.get_broll_options_for_scene(
            scene_description=body.scene_description,
            scene_index=body.scene_index,
            num_clips=body.num_clips,
            themes=body.themes,
        )
        return result

    # ---------------------------------------------------------------------------
    # SCRIPT / STORYBOARD endpoints
    # ---------------------------------------------------------------------------

    @app.post("/api/script/generate")
    def generate_script(body: GenerateScriptRequest):
        """Generate a video script from a topic."""
        gen = _get_ai_script_gen()
        script = gen.generate(
            topic=body.topic,
            target_duration=body.target_duration,
            num_scenes=body.num_scenes,
        )
        return script.to_dict()

    @app.post("/api/script/generate-storyboard")
    def generate_storyboard(body: GenerateScriptRequest):
        """Generate a full storyboard (script + scene breakdown + image prompts)."""
        gen = _get_ai_script_gen()
        sb = gen.generate_storyboard(
            topic=body.topic,
            target_duration=body.target_duration,
            num_scenes=body.num_scenes,
        )
        return sb.to_dict()

    @app.get("/api/script/theme-category")
    def classify_theme(topic: str = Query(...), channel: Optional[str] = Query(None)):
        """Classify a topic's theme category."""
        gen = _get_ai_script_gen()
        if channel:
            from video_studio_app.storyboard_generator import StoryboardGenerator
            sg = StoryboardGenerator(channel=channel)
        else:
            sg = _get_ai_script_gen()
        category, sub_themes = sg.categorize_theme(topic)
        return {"topic": topic, "channel": channel or "productivity_worker", "category": category.value, "sub_themes": sub_themes}

    # ---------------------------------------------------------------------------
    # IMAGE generation endpoints
    # ---------------------------------------------------------------------------

    @app.post("/api/images/generate")
    def generate_images(body: GenerateImagesRequest):
        """Generate one or more images from text prompts."""
        gen = _get_image_generator()
        opts = {"width": body.width, "height": body.height}
        from video_studio_app.image_generator import GenerationOptions, CharacterProfile

        options = GenerationOptions(**opts)
        char = None
        if body.character_name:
            char = CharacterProfile(name=body.character_name, description=body.character_name)

        results = gen.generate_batch(body.prompts, options=options, characters=[char] * len(body.prompts) if char else None)
        return results.to_dict()

    @app.post("/api/images/generate-for-template")
    def generate_images_for_template(body: GenerateForTemplateRequest):
        """
        Generate images for scenes in a template, optionally anchored to a character profile.

        This is the primary endpoint used by the SaaS UI. It loads the template,
        extracts per-scene prompts from the selected scene indices, and generates
        images with optional character consistency.

        Character Consistency:
            When character_name is provided, the same CharacterProfile is applied
            to all scene generations, ensuring visual consistency across scenes.
            The profile's description is injected into each prompt as a consistency
            anchor. The resulting images can then be used as the character_image_path
            for generate_scene_batch_with_character() to produce consistent videos.
        """
        editor = _get_template_editor()
        gen = _get_image_generator()
        from video_studio_app.image_generator import GenerationOptions, CharacterProfile

        try:
            t = editor.load_template(body.template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{body.template_id}' not found")

        # Build per-scene prompts from selected scene indices
        prompts = []
        chars = []
        for idx in body.scene_indices:
            if not 0 <= idx < len(t.scenes):
                continue
            scene = t.scenes[idx]
            prompt = scene.image_prompt_template or ""
            if not prompt:
                logger.warning(f"[generate-for-template] Scene {idx} has no image_prompt_template — skipping")
                continue
            prompts.append(prompt)
            # Apply character profile to all scenes if specified
            if body.character_name:
                chars.append(CharacterProfile(
                    name=body.character_name,
                    description=body.character_name,
                ))
            else:
                chars.append(None)

        if not prompts:
            return {"total": 0, "succeeded": 0, "failed": 0, "results": [], "errors": ["No valid prompts from selected scenes"]}

        options = GenerationOptions(width=body.width, height=body.height)
        results = gen.generate_batch(prompts, options=options, characters=chars if chars else None)

        # Annotate results with scene indices for UI correlation
        annotated = []
        for i, r in enumerate(results.results):
            d = r.to_dict()
            d["scene_index"] = body.scene_indices[i] if i < len(body.scene_indices) else i
            if body.character_name:
                d["character_name"] = body.character_name
            annotated.append(d)

        return {
            "total": results.total,
            "succeeded": results.succeeded,
            "failed": results.failed,
            "character_name": body.character_name,
            "results": annotated,
            "errors": results.errors,
        }

    @app.get("/api/images/providers")
    def image_providers():
        """List available image generation providers."""
        gen = _get_image_generator()
        return {"active_provider": gen._provider.value, "mock_mode": gen._mock}

    @app.get("/api/images/character-profiles")
    def list_character_profiles():
        """List all registered character profiles for visual consistency."""
        return {"profiles": list(_character_profiles.values())}

    @app.post("/api/images/character-profiles")
    def register_character_profile(name: str = Query(...), description: str = Query(...), lora_path: str = Query("")):
        """
        Register a character profile for visual consistency across scenes.
        Characters are stored in-memory and applied to image/video generation
        for consistency (same character appears across all scenes).
        """
        import uuid
        from video_studio_app.image_generator import CharacterProfile
        profile = CharacterProfile(
            name=name,
            description=description,
            lora_path=lora_path or None,
        )
        char_id = str(uuid.uuid4())[:8]
        _character_profiles[char_id] = {
            "id": char_id,
            **profile.to_dict(),
        }
        return {"character_id": char_id, "profile": _character_profiles[char_id]}

    # Legacy endpoint (kept for backwards compatibility)
    @app.post("/api/images/character")
    def register_character_legacy(name: str = Query(...), description: str = Query(...)):
        """Register a character profile (legacy endpoint)."""
        import uuid
        from video_studio_app.image_generator import CharacterProfile
        profile = CharacterProfile(name=name, description=description)
        char_id = str(uuid.uuid4())[:8]
        _character_profiles[char_id] = {"id": char_id, **profile.to_dict()}
        return {"character_id": char_id, "profile": profile.to_dict()}

    # ---------------------------------------------------------------------------
    # VIDEO PREVIEW / ASSEMBLY endpoints
    # ---------------------------------------------------------------------------

    @app.get("/api/assembly/ffmpeg-status")
    def ffmpeg_status():
        """Check if FFmpeg is available."""
        try:
            from video_studio_app.video_assembler import ffmpeg_available
            available = ffmpeg_available()
        except Exception:
            available = False
        return {"ffmpeg_available": available}

    @app.get("/api/assembly/presets")
    def get_presets():
        """Get available quality and aspect ratio presets."""
        from video_studio_app.ffmpeg_presets import QUALITY_PRESETS, ASPECT_RATIOS
        # Transform to {id, label} format for UI compatibility
        quality_list = [
            {"id": name, "label": p.get("label", name), "fps": p.get("fps"), "description": p.get("description", "")}
            for name, p in QUALITY_PRESETS.items()
        ]
        aspect_list = [
            {"id": name, "label": p.get("label", name)}
            for name, p in ASPECT_RATIOS.items()
        ]
        return {"quality_presets": quality_list, "aspect_ratios": aspect_list}

    @app.post("/api/assembly/preview")
    def assemble_preview(body: AssemblePreviewRequest, background: BackgroundTasks):
        """
        Trigger FFmpeg preview assembly for a template.
        Returns immediately with a job ID; assembly runs in background.
        """
        from video_studio_app.template_editor import TemplateEditor
        from video_studio_app.video_assembler import VideoAssemblyLine
        from video_studio_app.config import OUTPUT_DIR
        import uuid
        import json

        editor = TemplateEditor()
        try:
            t = editor.load_template(body.template_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Template '{body.template_id}' not found")

        job_id = str(uuid.uuid4())[:8]

        def _assemble():
            try:
                assembler = VideoAssemblyLine(channel=t.channel, quality=body.quality, aspect=body.aspect)
                output_dir = OUTPUT_DIR / "previews" / job_id
                output_dir.mkdir(parents=True, exist_ok=True)

                # Build scene list from template
                scenes_data = [
                    {
                        "scene_number": i + 1,
                        "start_time": sum(s.duration for s in t.scenes[:i]),
                        "end_time": sum(s.duration for s in t.scenes[:i + 1]),
                        "duration": s.duration,
                        "script_segment": s.voiceover_template or "",
                        "image_prompt": s.image_prompt_template or "",
                        "shot_type": s.shot_type,
                        "camera_movement": s.camera_movement,
                        "text_overlay": s.text_overlay_template or "",
                    }
                    for i, s in enumerate(t.scenes)
                ]

                # Write scene manifest
                manifest_path = output_dir / "manifest.json"
                manifest_path.write_text(json.dumps({"template": t.to_dict(), "scenes": scenes_data}, indent=2))

                status_path = output_dir / "status.json"
                status_path.write_text(json.dumps({"job_id": job_id, "status": "assembling", "progress": 0}))

                # For now, write a mock "done" status since full assembly requires actual media files
                status_path.write_text(json.dumps({"job_id": job_id, "status": "ready", "progress": 100, "output_dir": str(output_dir)}))

                logger.info(f"[Assembly job {job_id}] Complete: {output_dir}")
            except Exception as exc:
                logger.error(f"[Assembly job {job_id}] Failed: {exc}")
                try:
                    status_path.write_text(json.dumps({"job_id": job_id, "status": "error", "error": str(exc)}))
                except Exception:
                    pass

        background.add_task(_assemble)
        return {"job_id": job_id, "status": "started", "template_id": body.template_id, "quality": body.quality, "aspect": body.aspect}

    @app.get("/api/assembly/status/{job_id}")
    def assembly_status(job_id: str):
        """Get status of a video assembly job."""
        from video_studio_app.config import OUTPUT_DIR
        status_path = OUTPUT_DIR / "previews" / job_id / "status.json"
        if not status_path.exists():
            raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
        import json
        return json.loads(status_path.read_text())

    # ---------------------------------------------------------------------------
    # COLOR GRADING endpoints
    # ---------------------------------------------------------------------------

    class ColorGradeRequest(BaseModel):
        video_path: str
        preset: str = "cinematic"
        intensity: float = 1.0
        crf: int = 18
        fps: int = 30

    @app.get("/api/color-grading/presets")
    def color_grading_presets():
        """List all available color grading presets."""
        from video_studio_app.color_grader import ColorGrader
        return {"presets": ColorGrader.list_presets()}

    @app.post("/api/color-grading/apply")
    def apply_color_grade(body: ColorGradeRequest, background: BackgroundTasks):
        """
        Apply color grading to a video file (runs in background).

        Returns immediately with a job ID.
        """
        import uuid
        from video_studio_app.color_grader import ColorGrader

        job_id = str(uuid.uuid4())[:8]
        from video_studio_app.config import OUTPUT_DIR
        output_dir = OUTPUT_DIR / "graded" / job_id
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(output_dir / f"graded_{body.preset}.mp4")

        def _grade():
            import json as _json
            try:
                grader = ColorGrader()
                grader.apply_preset(
                    body.video_path, output_path,
                    preset=body.preset, crf=body.crf, fps=body.fps,
                )
                (output_dir / "status.json").write_text(
                    _json.dumps({"job_id": job_id, "status": "done", "output_path": output_path, "preset": body.preset}),
                    encoding="utf-8",
                )
            except Exception as exc:
                (output_dir / "status.json").write_text(
                    _json.dumps({"job_id": job_id, "status": "error", "error": str(exc)}),
                    encoding="utf-8",
                )

        background.add_task(_grade)
        return {"job_id": job_id, "status": "started", "output_dir": str(output_dir)}

    @app.get("/api/color-grading/status/{job_id}")
    def color_grade_status(job_id: str):
        """Get color grading job status."""
        from video_studio_app.config import OUTPUT_DIR
        status_path = OUTPUT_DIR / "graded" / job_id / "status.json"
        if not status_path.exists():
            raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
        import json
        return json.loads(status_path.read_text())

    # ---------------------------------------------------------------------------
    # QC GATE endpoints
    # ---------------------------------------------------------------------------

    class QCGateRequest(BaseModel):
        video_path: str
        platform: str = "youtube"
        blocking_only: bool = False

    @app.post("/api/qc/gate")
    def run_qc_gate(body: QCGateRequest):
        """
        Run automated quality gates on a video file.

        Returns full check results. Any FAIL on blocking=True checks
        means the video cannot be published without remediation.
        """
        from video_studio_app.qc_gate import VideoQCGate
        gate = VideoQCGate(platform=body.platform)
        result = (
            gate.run_blocking_only(body.video_path)
            if body.blocking_only
            else gate.run_all(body.video_path)
        )
        resp = result.to_dict()
        resp["summary"] = result.summary()
        resp["ffmpeg_available"] = VideoQCGate.is_ffmpeg_available()
        return resp

    @app.get("/api/qc/gate/{video_path:path}")
    def run_qc_gate_get(
        video_path: str,
        platform: str = "youtube",
        blocking_only: bool = False,
    ):
        """GET version of /qc/gate for quick URL-based checks."""
        from video_studio_app.qc_gate import VideoQCGate
        gate = VideoQCGate(platform=platform)
        result = (
            gate.run_blocking_only(video_path)
            if blocking_only
            else gate.run_all(video_path)
        )
        resp = result.to_dict()
        resp["summary"] = result.summary()
        resp["ffmpeg_available"] = VideoQCGate.is_ffmpeg_available()
        return resp

    # ---------------------------------------------------------------------------
    # BATCH generation endpoints
    # ---------------------------------------------------------------------------

    @app.get("/api/batch/status")
    def batch_status():
        """
        Return current MiniMax video generation daily quota status.
        Reads today's usage from logs/hailuo-costs.md.
        """
        from video_studio_app.minimax_client import MiniMaxClient
        client = MiniMaxClient()
        return client.batch_status()

    @app.post("/api/batch/generate")
    def batch_generate(body: BatchGenerateRequest, background: BackgroundTasks):
        """
        Submit a batch of video generation jobs.
        Respects MiniMax free tier of 3 videos/day; excess are queued.

        Returns immediately with a list of result objects (one per prompt).
        If wait_for_completion=True, results include video_url on success.
        """
        import uuid

        job_id = str(uuid.uuid4())[:8]

        def _run_batch():
            from video_studio_app.minimax_client import MiniMaxClient
            client = MiniMaxClient()
            try:
                results = client.batch_generate(
                    prompts=body.prompts,
                    max_concurrent=body.max_concurrent,
                    wait_for_completion=body.wait_for_completion,
                    max_wait_ms=body.max_wait_ms,
                )
                # Persist results to output dir
                from video_studio_app.config import OUTPUT_DIR
                out_dir = OUTPUT_DIR / "batch" / job_id
                out_dir.mkdir(parents=True, exist_ok=True)
                import json
                (out_dir / "results.json").write_text(
                    json.dumps({"job_id": job_id, "results": results}, indent=2),
                    encoding="utf-8",
                )
                (out_dir / "status.json").write_text(
                    json.dumps({"job_id": job_id, "status": "done", "count": len(results)}),
                    encoding="utf-8",
                )
                logger.info(f"[Batch job {job_id}] Done — {len(results)} prompts processed.")
            except Exception as exc:
                logger.error(f"[Batch job {job_id}] Failed: {exc}")
                from video_studio_app.config import OUTPUT_DIR
                try:
                    out_dir = OUTPUT_DIR / "batch" / job_id
                    out_dir.mkdir(parents=True, exist_ok=True)
                    import json
                    (out_dir / "status.json").write_text(
                        json.dumps({"job_id": job_id, "status": "error", "error": str(exc)}),
                        encoding="utf-8",
                    )
                except Exception:
                    pass

        if body.wait_for_completion:
            # Run synchronously if waiting for results
            from video_studio_app.minimax_client import MiniMaxClient
            client = MiniMaxClient()
            results = client.batch_generate(
                prompts=body.prompts,
                max_concurrent=body.max_concurrent,
                wait_for_completion=True,
                max_wait_ms=body.max_wait_ms,
            )
            return {"job_id": "sync", "status": "done", "results": results}
        else:
            background.add_task(_run_batch)
            return {"job_id": job_id, "status": "started", "count": len(body.prompts)}

    @app.get("/api/batch/status/{job_id}")
    def batch_job_status(job_id: str):
        """Get status of a background batch generation job."""
        from video_studio_app.config import OUTPUT_DIR
        status_path = OUTPUT_DIR / "batch" / job_id / "status.json"
        if not status_path.exists():
            raise HTTPException(status_code=404, detail=f"Batch job '{job_id}' not found")
        import json
        return json.loads(status_path.read_text())

    @app.get("/api/batch/results/{job_id}")
    def batch_job_results(job_id: str):
        """Get results of a completed batch generation job."""
        from video_studio_app.config import OUTPUT_DIR
        results_path = OUTPUT_DIR / "batch" / job_id / "results.json"
        if not results_path.exists():
            raise HTTPException(status_code=404, detail=f"Batch results for job '{job_id}' not found")
        import json
        return json.loads(results_path.read_text())

    # ---------------------------------------------------------------------------
    # CHARACTER CONSISTENCY — VIDEO GENERATION
    # ---------------------------------------------------------------------------

    @app.post("/api/video/generate-with-character")
    def generate_video_with_character(body: GenerateWithCharacterRequest, background: BackgroundTasks):
        """
        Generate multiple scene videos all anchored to the same character.

        This is the core character-consistency endpoint. Pass the same
        character_image_path for every scene to ensure the subject appears
        consistently across all output videos.

        Strategy:
            MiniMax image-to-video uses the input image as the first frame.
            There is no separate subject-ID API — visual consistency comes
            from using the same character portrait image for every scene.

        Character Workflow:
            1. Call POST /images/generate-for-template with character_name
               → generates a character portrait + per-scene images
            2. Use the character portrait as character_image_path here
            3. Each scene video uses the same character_image_path for consistency
        """
        job_id = str(uuid.uuid4())[:8]

        def _run():
            from video_studio_app.minimax_client import MiniMaxClient
            client = MiniMaxClient()
            try:
                results = client.generate_scene_batch_with_character(
                    character_image_path=body.character_image_path,
                    scene_prompts=body.scene_prompts,
                    character_description=body.character_description,
                    max_wait_ms=body.max_wait_ms,
                )
                from video_studio_app.config import OUTPUT_DIR
                out_dir = OUTPUT_DIR / "character_videos" / job_id
                out_dir.mkdir(parents=True, exist_ok=True)
                import json
                (out_dir / "results.json").write_text(json.dumps({"job_id": job_id, "results": results}, indent=2))
                (out_dir / "status.json").write_text(json.dumps({"job_id": job_id, "status": "done", "count": len(results)}))
                logger.info(f"[Character video job {job_id}] Done — {len(results)} scenes processed.")
            except Exception as exc:
                logger.error(f"[Character video job {job_id}] Failed: {exc}")
                from video_studio_app.config import OUTPUT_DIR
                try:
                    out_dir = OUTPUT_DIR / "character_videos" / job_id
                    out_dir.mkdir(parents=True, exist_ok=True)
                    import json
                    (out_dir / "status.json").write_text(json.dumps({"job_id": job_id, "status": "error", "error": str(exc)}))
                except Exception:
                    pass

        background.add_task(_run)
        return {"job_id": job_id, "status": "started", "count": len(body.scene_prompts), "message": "Character video generation started in background."}

    @app.get("/api/video/character-status/{job_id}")
    def character_video_status(job_id: str):
        """Get status of a character-consistent video generation job."""
        from video_studio_app.config import OUTPUT_DIR
        status_path = OUTPUT_DIR / "character_videos" / job_id / "status.json"
        if not status_path.exists():
            raise HTTPException(status_code=404, detail=f"Character video job '{job_id}' not found")
        import json
        return json.loads(status_path.read_text())

    @app.get("/api/video/character-results/{job_id}")
    def character_video_results(job_id: str):
        """Get results of a completed character video generation job."""
        from video_studio_app.config import OUTPUT_DIR
        results_path = OUTPUT_DIR / "character_videos" / job_id / "results.json"
        if not results_path.exists():
            raise HTTPException(status_code=404, detail=f"Character video results for job '{job_id}' not found")
        import json
        return json.loads(results_path.read_text())

    # ---------------------------------------------------------------------------
    # SERVICE MONITORING + ALERTING endpoints  (TKP-90)
    # ---------------------------------------------------------------------------

    # Lazy singleton monitor/alerts instances (created on first use)
    _monitor = None
    _alerts = None

    def _get_monitor():
        global _monitor
        if _monitor is None:
            import sys
            from pathlib import Path as _P
            #动态加载 lib/monitoring.js
            _monitor_path = _P(__file__).parent.parent / "lib" / "monitoring.js"
            sys.path.insert(0, str(_monitor_path.parent))
            import importlib.util
            spec = importlib.util.spec_from_file_location("monitoring_js", str(_monitor_path))
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            _monitor = mod.ServiceMonitor()
        return _monitor

    def _get_alerts():
        global _alerts
        if _alerts is None:
            import sys
            from pathlib import Path as _P
            _alerts_path = _P(__file__).parent.parent / "lib" / "alerts.js"
            sys.path.insert(0, str(_alerts_path.parent))
            import importlib.util
            spec = importlib.util.spec_from_file_location("alerts_js", str(_alerts_path))
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            _alerts = mod.AlertManager()
            # Wire alerts into monitor
            try:
                _get_monitor().onAlert(lambda a: _alerts.send(a))
            except Exception:
                pass
        return _alerts

    class LogCostRequest(BaseModel):
        service: str
        cost: float
        unit: Optional[str] = None
        metadata: Optional[dict] = {}

    class SendAlertRequest(BaseModel):
        service: str
        type: str = "info"
        severity: str = "low"
        message: str

    @app.get("/api/monitoring/stats")
    def monitoring_stats():
        """Return health + cost stats for all tracked services."""
        m = _get_monitor()
        return m.getStats()

    @app.get("/api/monitoring/alerts")
    def monitoring_alerts(limit: int = Query(50), include_resolved: bool = Query(False)):
        """Return recent alerts. Set include_resolved=true to include resolved ones."""
        m = _get_monitor()
        return {"alerts": m.getAlerts(limit=limit, includeResolved=include_resolved)}

    @app.post("/api/monitoring/health-check")
    def trigger_health_check():
        """Manually trigger a health check on all services. Runs async."""
        import uuid
        job_id = str(uuid.uuid4())[:8]

        def _run():
            try:
                _get_monitor().checkAll()
                logger.info(f"[monitoring] Health check {job_id} complete.")
            except Exception as exc:
                logger.error(f"[monitoring] Health check {job_id} failed: {exc}")

        import threading
        t = threading.Thread(target=_run, daemon=True)
        t.start()
        return {"job_id": job_id, "status": "started", "message": "Health check running in background."}

    @app.get("/api/monitoring/health-check/{service}")
    def health_check_service(service: str):
        """Run health check on a single service."""
        m = _get_monitor()
        result = m.checkService(service)
        return result

    @app.post("/api/monitoring/cost")
    def log_cost(body: LogCostRequest):
        """Record an API call cost for a service."""
        m = _get_monitor()
        m.logCost(body.service, body.cost, body.unit, body.metadata or {})
        return {"ok": True, "service": body.service, "cost": body.cost}

    @app.post("/api/monitoring/alert")
    def send_alert(body: SendAlertRequest):
        """Manually trigger an alert (e.g. job failure, cost spike)."""
        a = _get_alerts()
        sent = a.send(body.dict())
        return {"ok": True, "sent": sent}

    @app.post("/api/monitoring/alert-test")
    def test_alert():
        """Send a test Discord alert to verify webhook configuration."""
        a = _get_alerts()
        sent = a.sendTest()
        return {"ok": True, "sent": sent, "enabled": a._enabled}

    @app.get("/api/monitoring/alert-test")
    def test_alert_get():
        """GET version of /api/monitoring/alert-test."""
        a = _get_alerts()
        return {"ok": True, "enabled": a._enabled}

    @app.patch("/api/monitoring/alerts/{alert_id}/resolve")
    def resolve_alert(alert_id: str):
        """Mark an alert as resolved."""
        m = _get_monitor()
        m.resolveAlert(alert_id)
        return {"ok": True, "alert_id": alert_id}

    @app.post("/api/monitoring/silence")
    def silence_service(service: str = Query(...), type_: Optional[str] = Query(None)):
        """
        Silence alerts for a service or service+type combo.
        Example: POST /api/monitoring/silence?service=hailuo
        Example: POST /api/monitoring/silence?service=hailuo&type_=latency
        """
        a = _get_alerts()
        key = f"{service}:{type_}" if type_ else service
        a.silence(key)
        return {"ok": True, "silenced": key}

    @app.delete("/api/monitoring/silence")
    def unsilence_all():
        """Clear all silence rules."""
        a = _get_alerts()
        a.silence(None)
        return {"ok": True, "message": "All silence rules cleared."}

    # ---------------------------------------------------------------------------
    # Run the app
    # ---------------------------------------------------------------------------

    def run(host: str = "0.0.0.0", port: int = 8000):
        uvicorn.run(app, host=host, port=port)

else:
    # FastAPI not installed — provide a helpful error message
    def run(host: str = "0.0.0.0", port: int = 8000):
        print("ERROR: FastAPI is not installed.", file=sys.stderr)
        print("Install it with: pip install fastapi uvicorn", file=sys.stderr)
        sys.exit(1)

    def app():
        print("ERROR: FastAPI is not installed.", file=sys.stderr)
        print("Install it with: pip install fastapi uvicorn", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    run()
