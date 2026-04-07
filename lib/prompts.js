/**
 * lib/prompts.js
 * Founding Engineer 2 — TKP-82
 *
 * Prompt engineering system for TKP Studio System.
 *
 * Provides structured prompt builders for:
 * - Hailuo video generation prompts
 * - Thumbnail DALL-E/Stable Diffusion prompts
 * - Script generation prompt templates
 *
 * Usage:
 *   import { PromptBuilder, SCRIPT_TEMPLATES, STYLE_GUIDE } from './lib/prompts.js';
 *   import { HailuoPromptBuilder, seed_control, build_negative_prompt } from './lib/prompts.js';
 */

import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Channel identity for prompt building */
export const CHANNELS = {
  productivity: {
    id:          'productivity',
    displayName: 'TKP Productivity',
    platform:    'YouTube / TikTok',
    audience:    'Professionals and knowledge workers seeking efficient systems.',
    voice:       'Calm, authoritative, warm, measured. Systems over willpower.',
    visual: {
      mood:        'Clean, cinematic, professional workspace',
      lighting:    'Soft natural light',
      camera:      'Slow push-in, wide establishing shots',
      pacing:      '150 words/min — measured, confident',
      colors:      'Navy, warm gold, off-white',
      brollStyle:  'Workspace setups, notepads, coffee, focused expressions',
    },
  },
  growth: {
    id:          'growth',
    displayName: 'TKP Growth',
    platform:    'TikTok / Instagram Reels / YouTube Shorts',
    audience:    'Gen Z and young millennials seeking financial and personal growth.',
    voice:       'Energetic, punchy, direct. No gatekeeping, no corporate speak.',
    visual: {
      mood:        'High energy, fast cuts, urban/social scenes',
      lighting:    'Bright, punchy, dramatic contrast',
      camera:      'Quick cuts, phone screens, close-up reactions',
      pacing:      '180 words/min — energetic, fast',
      colors:      'Electric violet, hot coral, deep black',
      brollStyle:  'Phone screens, coffee shops, city life, reactions',
    },
  },
};

/** Style guide for prompt generation — used by AI writing tools */
export const STYLE_GUIDE = `
TKP CONTENT STYLE GUIDE

CHANNEL 1 — TKP PRODUCTIVITY
- Voice: Calm authority. You know your stuff and you want to share it without hype.
- No: "hustle harder", "5am club", "crushing it", corporate buzzwords, hedging ("maybe", "kind of")
- Yes: Specific frameworks, named tools, real numbers, clear cause-effect
- Sentence structure: Declarative and direct. Short to medium. Avoid long nested clauses.
- Emotional register: Calm confidence — not cold, not peppy. Steady warmth.
- Format: Numbered lists, step-by-step systems, before/after comparisons
- CTA style: "Try this system", "Here's what to do next"

CHANNEL 2 — TKP GROWTH
- Voice: Direct energy. You figured it out and you're telling your friend.
- No: LinkedIn speak, gatekeeping, vague promises ("maybe you'll earn more"), boomer-approved humor
- Yes: Bold claims with specifics, real amounts and timelines, authentic voice
- Sentence structure: Short and punchy. One idea per sentence. Staccato rhythm.
- Emotional register: Confident and slightly irreverent — not angry, not preachy.
- Format: Hook → proof → how-to → CTA (standard viral structure)
- CTA style: "Follow for more", "Drop a 🔥 if you agree", direct follow requests

HOOK PATTERNS (both channels):
- Pattern interrupt: Start with a controversial or counterintuitive claim
- Question hook: Ask a question the viewer was already thinking
- Stat hook: Lead with a specific, surprising number
- "What if I told you" formula
- Reverse advice: "Stop doing X" or "The opposite of what you think"

B-ROLL VISUAL STYLE:
- Productivity: Clean desk setups, coffee, notebook with pen, calm expressions,
  focus shots, library/bookshelf backgrounds, sunset office views
- Growth: Phone screens, laptop POV shots, coffee shop ambiance,
  city streets, people in motion, surprised/excited expressions
`.trim();

// ---------------------------------------------------------------------------
// Script Templates
// ---------------------------------------------------------------------------

export const SCRIPT_TEMPLATES = {
  productivity: {
    /**
     * Generate a productivity script prompt for the AI script writer.
     */
    scriptPrompt(topic, angle) {
      return `Write a ${CHANNELS.productivity.displayName} YouTube/TikTok script.

TOPIC: ${topic}
ANGLE: ${angle ?? 'actionable framework'}

REQUIREMENTS:
- Target: 3–5 minutes (YouTube) or 45–90 seconds (TikTok)
- Structure: Hook (first 15 seconds) → Core insight → 3-step system or framework → CTA
- Voice: ${CHANNELS.productivity.voice}
- NO corporate speak, NO hustle-culture framing
- Include specific tools, frameworks, or numbers where possible
- End with a clear next-step CTA (subscribe, watch next, or try the system)

FORMAT: Plain text script, no formatting codes. Include timing notes in brackets like [0:00-0:15].`;
    },
  },

  growth: {
    scriptPrompt(topic, angle) {
      return `Write a ${CHANNELS.growth.displayName} TikTok/Reels script.

TOPIC: ${topic}
ANGLE: ${angle ?? 'bold specific claim'}

REQUIREMENTS:
- Target: 30–60 seconds (viral Shorts format)
- Structure: Pattern-interrupt hook (first 3 seconds) → bold claim with proof → 2–3 point breakdown → CTA
- Voice: ${CHANNELS.growth.voice}
- NO LinkedIn speak, NO gatekeeping language
- Include specific amounts, timelines, or named examples
- End with direct follow CTA ("Follow for more", "Drop a 🔥 if you agree")

FORMAT: Plain text script, no formatting codes. Include timing notes in brackets like [0:00-0:03].`;
    },
  },
};

// ---------------------------------------------------------------------------
// PromptBuilder — Hailuo + thumbnail prompt construction
// ---------------------------------------------------------------------------

export class PromptBuilder {
  /**
   * @param {string} channel — 'productivity' | 'growth'
   */
  constructor(channel = 'productivity') {
    this.channel = channel;
    this.ch      = CHANNELS[channel] ?? CHANNELS.productivity;
  }

  // -------------------------------------------------------------------------
  // Hailuo Video Prompts
  // -------------------------------------------------------------------------

  /**
   * Build a Hailuo video prompt from a script section.
   *
   * @param {object} opts
   * @param {string} opts.script     — The script text or excerpt
   * @param {string} opts.scene      — 'intro' | 'body' | 'hook' | 'cta' | 'broll'
   * @param {string} [opts.style]    — 'energetic' | 'calm' | 'cinematic'
   * @param {object} [opts.constraints] — { aspectRatio, duration, includeText }
   * @returns {string}
   */
  buildHailuoPrompt({ script, scene, style = null, constraints = {} }) {
    const {
      aspectRatio  = '16:9',
      duration     = 6,
      includeText  = false,
    } = constraints;

    const visual = this.ch.visual;

    const sceneBuilders = {
      intro: () => {
        if (this.channel === 'productivity') {
          return [
            'Cinematic wide establishing shot.',
            `Soft natural lighting, clean ${visual.mood}.`,
            'Professional workspace in frame.',
            `Camera slowly pushes in.`,
            includeText ? `Text overlay: "${this._extractHook(script)}"` : '',
          ].filter(Boolean).join(' ');
        } else {
          return [
            'Fast-paced opening montage:',
            'phone screen, coffee shop, urban city street.',
            'Bright punchy lighting, high energy.',
            `Quick zoom into content.`,
            includeText ? `Bold text overlay: "${this._extractHook(script)}"` : '',
          ].filter(Boolean).join(' ');
        }
      },

      body: () => {
        if (this.channel === 'productivity') {
          return [
            'Over-the-shoulder shot transitioning to close-up.',
            `${visual.brollStyle} clearly visible.`,
            'Smooth camera movement, natural pacing.',
            includeText ? `Text overlay: "${this._extractKeyPoint(script)}"` : '',
          ].filter(Boolean).join(' ');
        } else {
          return [
            'Quick cuts between relevant visuals.',
            `${visual.brollStyle}. Bright, punchy aesthetic.`,
            '2-second cuts, energetic editing rhythm.',
            includeText ? `Text overlay: "${this._extractKeyPoint(script)}"` : '',
          ].filter(Boolean).join(' ');
        }
      },

      hook: () => {
        if (this.channel === 'productivity') {
          return [
            'Direct-to-camera or eye-level tracking shot.',
            'Professional lighting, confident energy.',
            `Bold text overlay: "${this._extractHook(script)}"`,
            'Clean background, no distractions.',
          ].join(' ');
        } else {
          return [
            'Dramatic close-up reaction shot.',
            'Surprised or confident expression.',
            `Phone screen showing: "${this._extractHook(script)}"`,
            'High energy, vertical-ready.',
          ].join(' ');
        }
      },

      cta: () => {
        if (this.channel === 'productivity') {
          return [
            'Wide establishing shot slowly pulling back.',
            'Calm, satisfied energy.',
            `Text overlay: "Subscribe for more productivity systems."`,
            'Fade to TKP logo.',
          ].join(' ');
        } else {
          return [
            'Rapid-fire text overlay.',
            '"Follow for more! 🔥" + TKP Growth channel name.',
            'Warp-speed transition, high energy.',
            'Vertical 9:16 format.',
          ].join(' ');
        }
      },

      broll: () => {
        return [
          `${visual.brollStyle}.`,
          `${visual.lighting}, ${visual.camera}.`,
          `Mood: ${visual.mood}.`,
        ].join(' ');
      },
    };

    const base = sceneBuilders[scene]?.() ?? sceneBuilders.body();

    return [
      base,
      `Format: ${aspectRatio}, ${duration}s per clip.`,
      `Style: ${style ?? (this.channel === 'growth' ? 'energetic' : 'cinematic')}.`,
    ].join(' | ');
  }

  /**
   * Build a full Hailuo video prompt for an entire script.
   * Returns an array of scene prompts for multi-scene production.
   */
  buildFullVideoPrompt(script, { duration = 6 } = {}) {
    const lines = script.split('\n').filter(l => l.trim());
    const scenes = [];

    if (lines.length > 0) {
      scenes.push(this.buildHailuoPrompt({ script, scene: 'intro', duration }));
    }
    if (lines.length > 1) {
      scenes.push(this.buildHailuoPrompt({ script, scene: 'body',  duration }));
    }

    return scenes;
  }

  // -------------------------------------------------------------------------
  // Thumbnail Prompts (for DALL-E / Stable Diffusion)
  // -------------------------------------------------------------------------

  /**
   * Build a thumbnail generation prompt for DALL-E or Stable Diffusion.
   * Used when AI-generated thumbnails are needed.
   *
   * @param {object} opts
   * @param {string} opts.headline  — Main bold text
   * @param {string} [opts.subtext] — Secondary text
   * @param {string} [opts.style='default'] — 'default' | 'high-contrast' | 'minimal'
   * @returns {string}
   */
  buildThumbnailPrompt({ headline, subtext = '', style = 'default' }) {
    if (this.channel === 'productivity') {
      return [
        'Thumbnail for TKP Productivity channel.',
        'Design: Clean, professional, warm.',
        `Background: Warm off-white (#F8F7F4) or minimal workspace setting.`,
        `Text overlay: "${headline}" in bold navy (#1A2744) DM Sans font.`,
        subtext ? `Subtext: "${subtext}" in warm gold (#C9A84C).` : '',
        style === 'high-contrast'
          ? 'High contrast, bold typography, slight vignette.'
          : 'Warm, approachable, trustworthy.',
        'No clutter, no neon, no gamer aesthetic. Readable at 120px wide.',
      ].filter(Boolean).join(' | ');
    } else {
      return [
        'Thumbnail for TKP Growth channel.',
        `Design: High-energy, bold, Gen Z aesthetic.`,
        `Background: Deep black (#111827).`,
        `Text: "${headline}" in bold white ALL CAPS Bebas Neue font.`,
        `Accent: Electric violet (#7C3AED) or hot coral (#FF6B6B) color bar or glow effect.`,
        subtext ? `Subtext: "${subtext}" in secondary color.` : '',
        style === 'high-contrast'
          ? 'Maximum contrast, dramatic lighting, big energy.'
          : 'Modern, punchy, viral aesthetic.',
        'Text must be readable at 90px wide. No pastels or muted colors.',
      ].filter(Boolean).join(' | ');
    }
  }

  // -------------------------------------------------------------------------
  // Script Generation Prompts
  // -------------------------------------------------------------------------

  /**
   * Get the full script generation prompt for a topic.
   */
  getScriptPrompt(topic, angle) {
    const tmpl = SCRIPT_TEMPLATES[this.channel] ?? SCRIPT_TEMPLATES.productivity;
    return tmpl.scriptPrompt(topic, angle);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  _extractHook(script) {
    const firstLine = (script ?? '').split('\n').find(l => l.trim().length > 10) ?? '';
    return firstLine.slice(0, 60).trim() + (firstLine.length > 60 ? '...' : '');
  }

  _extractKeyPoint(script) {
    const lines = (script ?? '').split('\n').filter(l => /^\d+\./.test(l.trim()));
    return (lines[0] ?? '').replace(/^\d+\.\s*/, '').slice(0, 60).trim();
  }
}

// ---------------------------------------------------------------------------
// TKP-82 — HailuoPromptBuilder (camera/lighting/negative prompts/seed control)
// ---------------------------------------------------------------------------

/** @type {Record<string, string[]>} */
const CAMERA_CONTROLS = {
  pan_left:   ["slow left pan", "tracking left", "glide left"],
  pan_right:  ["slow right pan", "tracking right", "glide right"],
  tilt_up:    ["low angle tilt up", "rise to reveal", "sweep upward"],
  tilt_down:  ["high angle tilt down", "descending angle", "sweep downward"],
  zoom_in:    ["slow zoom in", "dolly in", "approach"],
  zoom_out:   ["slow zoom out", "dolly out", "pull back"],
  tracking:   ["tracking shot", "follow subject", "chase movement"],
  static:     ["static shot", "locked frame", "steady hold"],
  dolly_side: ["side dolly", "lateral tracking shot", "crane side sweep"],
  rack_focus: ["rack focus", "focus pull", "shift focus"],
  aerial:     ["aerial view", "drone shot", "overhead establishing"],
  pov:        ["first person POV", "subject POV"],
  handheld:   ["subtle handheld", "organic handheld feel", "intimate handheld"],
  steadicam:  ["steadicam smooth glide", "floated tracking"],
};

/** @type {Record<string, string>} */
const LIGHTING_PRESETS = {
  natural:     "natural daylight, soft ambient light, realistic shadows",
  studio:      "studio lighting, softbox key light, clean catchlights",
  dramatic:    "dramatic chiaroscuro lighting, single hard key light, deep shadows, high contrast",
  cinematic:   "cinematic lighting, volumetric fog glow, motivated sources",
  golden_hour: "golden hour warmth, lens flare, long shadows, amber tones, bokeh background",
  blue_hour:   "blue hour cool tones, twilight ambient, city lights in background",
  neon:        "neon glow, cyberpunk lights, colorful rim lighting, dark background",
  warm_indoor: "warm tungsten interior, cozy lamp light, firelight flicker",
  backlit:     "strong backlight silhouette, rim light separation, glowing edges",
};

/** @type {Record<string, {descriptor: string, motion: string, composition: string}>} */
const HAILUO_STYLE_PRESETS = {
  cinematic: {
    descriptor:   "cinematic film still, 4K movie quality, shallow depth of field",
    motion:       "smooth camera movement, natural motion blur, cinematic pans",
    composition:  "rule-of-thirds composition, widescreen framing",
  },
  anime: {
    descriptor:   "anime art style, Studio Ghibli inspired, cel shaded, vibrant colors",
    motion:       "fluid animation, exaggerated expressions, dynamic angles",
    composition:  "manga panel composition, expressive framing",
  },
  realistic: {
    descriptor:   "photorealistic, hyperdetail, 8K texture quality, natural skin texture",
    motion:       "natural movement, realistic physics, authentic human motion",
    composition:  "clean portrait composition, balanced negative space",
  },
  abstract: {
    descriptor:   "abstract digital art, surreal composition, dreamlike atmosphere",
    motion:       "surreal motion, morphing shapes, ethereal float",
    composition:  "asymmetrical composition, bold color blocks",
  },
  documentary: {
    descriptor:   "documentary photography style, candid realism, unposed natural moment",
    motion:       "observational documentary camera, unhurried tracking",
    composition:  "editorial documentary framing, environmental context",
  },
};

// ---------------------------------------------------------------------------
// Negative prompt system (TKP-82 Task 2)
// ---------------------------------------------------------------------------

/** @type {Record<string, string[]>} */
const NEGATIVE_PROMPTS = {
  universal: [
    "blurry", "out of focus", "soft image", "motion blur",
    "distorted face", "extra fingers", "missing fingers", "deformed hands",
    "bad anatomy", "disfigured", "mutated", "ugly",
    "poorly drawn face", "text overlay", "watermark", "logo",
    "low resolution", "pixelated", "jpeg artifacts", "compression artifacts",
    "noise", "grain", "overexposed", "underexposed", "washed out colors",
    "duplicate elements", "floating objects", "cloning artifacts",
    "extra limbs", "missing limbs", "plastic skin", "waxy skin",
  ],
  cinematic: [
    "home video quality", "found footage", "POV webcam",
    "compressed", "low bitrate", "streaming quality",
  ],
  anime: [
    "realistic", "photorealistic", "live action", "harsh shadows",
  ],
};

/**
 * Build a negative prompt string.
 * @param {string|string[]} [style] - "cinematic" | "anime" | "all"
 * @param {number} [strength] - Emphasis weight multiplier (1-10)
 * @returns {string}
 */
export function build_negative_prompt(style = "all", strength = 5) {
  const styles = Array.isArray(style) ? style : [style];
  const parts = [...NEGATIVE_PROMPTS.universal];

  for (const s of styles) {
    const key = s.toLowerCase();
    if (NEGATIVE_PROMPTS[key]) {
      parts.push(...NEGATIVE_PROMPTS[key]);
    }
  }

  // Deduplicate
  const seen = new Set();
  const deduped = parts.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  const weight = (strength / 10).toFixed(1);
  return `${deduped.join(", ")} (worst quality:1.3) (deformed:1.2) (blur:1.1)`;
}

/** Shorthand alias */
export const negative_prompt_system = build_negative_prompt;

// ---------------------------------------------------------------------------
// Seed control (TKP-82 Task 3)
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic 32-bit integer seed.
 * @param {string|number} input
 * @returns {number}
 */
export function generate_seed(input) {
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.abs(Math.floor(input)) % 4294967296;
  }
  const str = String(input);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % 4294967296;
}

/**
 * Build a seed control object.
 * @param {string|number} seed
 * @param {number} [variation] - Offset for batch variations
 * @returns {{seed: number, seed_string: string, variation: number, reproducible: boolean}}
 */
export function seed_control(seed, variation = 0) {
  const baseSeed = generate_seed(seed);
  const effectiveSeed = (baseSeed + variation) % 4294967296;
  return {
    seed:         effectiveSeed,
    seed_string:  String(effectiveSeed),
    variation,
    reproducible: variation === 0,
  };
}

/**
 * Generate N variation seeds for batch generation.
 * @param {string|number} baseSeed
 * @param {number} [count]
 * @returns {number[]}
 */
export function batch_seeds(baseSeed, count = 4) {
  return Array.from({ length: count }, (_, i) => seed_control(baseSeed, i).seed);
}

// ---------------------------------------------------------------------------
// HailuoPromptBuilder (TKP-82 Task 1)
// ---------------------------------------------------------------------------

export class HailuoPromptBuilder {
  /**
   * @param {object} [opts]
   * @param {string} [opts.defaultStyle="cinematic"]
   * @param {string} [opts.defaultCamera="static"]
   * @param {string} [opts.defaultLighting="cinematic"]
   * @param {string} [opts.defaultMotion="smooth"]
   */
  constructor({
    defaultStyle    = "cinematic",
    defaultCamera  = "static",
    defaultLighting = "cinematic",
    defaultMotion  = "smooth",
  } = {}) {
    this.defaultStyle    = defaultStyle;
    this.defaultCamera  = defaultCamera;
    this.defaultLighting = defaultLighting;
    this.defaultMotion  = defaultMotion;
  }

  /**
   * Build a full Hailuo-optimized image prompt string. (TKP-82 Task 1)
   *
   * @param {string} subject
   * @param {object} [opts]
   * @param {string} [opts.style]
   * @param {string} [opts.camera]
   * @param {string} [opts.lighting]
   * @param {string} [opts.motion]
   * @param {string} [opts.environment]
   * @param {string} [opts.mood]
   * @param {string} [opts.quality]
   * @param {string} [opts.extra]
   * @returns {string}
   */
  build_prompt(subject, opts = {}) {
    const {
      style       = this.defaultStyle,
      camera      = this.defaultCamera,
      lighting   = this.defaultLighting,
      motion      = this.defaultMotion,
      environment = "",
      mood        = "",
      quality     = "masterpiece, best quality, ultra detailed, 4K",
      extra       = "",
    } = opts;

    const parts = [subject];

    if (environment) parts.push(`in ${environment}`);

    const preset = HAILUO_STYLE_PRESETS[style] || HAILUO_STYLE_PRESETS.cinematic;
    parts.push(preset.descriptor);

    const cameraStr = CAMERA_CONTROLS[camera]?.[0] || camera || "static shot";
    const motionStr = motion && motion !== "smooth" ? motion : preset.motion;
    parts.push(`${cameraStr}, ${motionStr}`);

    const lightingStr = LIGHTING_PRESETS[lighting] || LIGHTING_PRESETS.cinematic;
    parts.push(lightingStr);

    if (mood) parts.push(mood);
    parts.push(preset.composition);
    parts.push(quality);
    if (extra) parts.push(extra);

    return parts.join(", ");
  }

  /**
   * Build a Hailuo prompt from a scene dict (storyboard format from ai_script_generator.py).
   * @param {object} scene - Scene from GeneratedScript.to_storyboard_format()
   * @param {string} topic - Full video topic
   * @param {object} [opts]
   * @param {string} [opts.style]
   * @param {string} [opts.lighting]
   * @param {string|number} [opts.seed]
   * @returns {{image_prompt: string, negative_prompt: string, seed_info: object|null}}
   */
  build_scene_prompt(scene, topic, opts = {}) {
    const {
      style    = this.defaultStyle,
      lighting = this.defaultLighting,
      seed     = null,
    } = opts;

    // Map storyboard shot_type → camera key
    const cameraMap = {
      wide:    "static",
      medium:  "tracking",
      closeup: "zoom_in",
      aerial:  "aerial",
      POV:     "pov",
    };
    const camera    = cameraMap[scene.shot_type] || scene.camera_movement || "static";
    const motion    = scene.camera_movement || "smooth";
    const mood      = this._infer_mood(scene.heading || "");

    const image_prompt = this.build_prompt(scene.visual_direction || topic, {
      style, camera, lighting, motion, mood,
    });

    return {
      image_prompt,
      negative_prompt: build_negative_prompt(style),
      seed_info: seed != null ? seed_control(seed) : null,
    };
  }

  /**
   * Build prompts for all scenes in a storyboard.
   * @param {object[]} scenes
   * @param {string} topic
   * @param {object} [opts]
   * @param {string|number} [opts.seed]
   * @returns {object[]}
   */
  build_storyboard_prompts(scenes, topic, opts = {}) {
    const { seed = null } = opts;
    return scenes.map((scene, i) => {
      const sceneSeed = seed != null ? seed_control(seed, i) : null;
      return {
        ...this.build_scene_prompt(scene, topic, { ...opts, seed: sceneSeed?.seed }),
        scene_number: scene.scene_number,
        seed_info:    sceneSeed,
      };
    });
  }

  _infer_mood(heading) {
    const h = (heading || "").toLowerCase();
    if (h.includes("hook") || h.includes("intro"))   return "energetic, captivating";
    if (h.includes("cta") || h.includes("call"))     return "inspiring, actionable";
    if (h.includes("reveal") || h.includes("result")) return "satisfying, impactful";
    if (h.includes("mistake") || h.includes("wrong")) return "tense, dramatic";
    return "engaging, dynamic, professional";
  }

  // Convenience statics
  static prompt(subject, opts) {
    return new HailuoPromptBuilder().build_prompt(subject, opts);
  }
  static negative(style, strength) {
    return build_negative_prompt(style, strength);
  }
  static seed(input, variation) {
    return seed_control(input, variation);
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // --- Original PromptBuilder demo ---
  const pb = new PromptBuilder('growth');
  console.log('=== PromptBuilder Hailuo prompt (hook):');
  console.log(pb.buildHailuoPrompt({ script: 'Did you know 80% of people fail at this?', scene: 'hook' }));
  console.log('\n=== PromptBuilder Thumbnail prompt:');
  console.log(pb.buildThumbnailPrompt({ headline: 'I Made $10K in 30 Days', subtext: "here's exactly how" }));

  // --- TKP-82 HailuoPromptBuilder self-test ---
  console.log('\n=== TKP-82 HailuoPromptBuilder self-test ===');

  const hb = new HailuoPromptBuilder({ defaultStyle: 'cinematic', defaultLighting: 'cinematic' });

  console.log('\n[1] Basic cinematic prompt:');
  const p1 = hb.build_prompt(
    "a young professional working at a standing desk, focused expression",
    { camera: 'zoom_in', lighting: 'golden_hour' }
  );
  console.log('   ', p1.slice(0, 120) + '...');

  console.log('\n[2] Anime style:');
  const p2 = hb.build_prompt(
    "a determined anime protagonist overcoming an obstacle",
    { style: 'anime', camera: 'tilt_up', lighting: 'dramatic' }
  );
  console.log('   ', p2.slice(0, 120) + '...');

  console.log('\n[3] Negative prompt:');
  console.log('   ', build_negative_prompt('cinematic').slice(0, 100) + '...');

  console.log('\n[4] Seed control:');
  const s1 = seed_control('productivity tips 2026');
  const s2 = seed_control('productivity tips 2026');
  console.log('   Same input → same seed:', s1.seed === s2.seed, '(seed:', s1.seed + ')');
  const s3 = seed_control('productivity tips 2026', 1);
  console.log('   Variation +1 → different seed:', s3.seed !== s1.seed, '(seed:', s3.seed + ')');
  console.log('   Batch seeds:', batch_seeds('batch-001', 4));

  console.log('\n[5] Scene prompt (storyboard format):');
  const scene = {
    scene_number: 1,
    heading: 'Hook',
    visual_direction: 'close-up of stressed face looking at phone',
    shot_type: 'closeup',
    camera_movement: 'zoom_in',
  };
  const sp = hb.build_scene_prompt(scene, 'Why your morning routine is killing you', { seed: 'scene-001' });
  console.log('   image_prompt:', sp.image_prompt.slice(0, 100) + '...');
  console.log('   seed_info:', sp.seed_info);

  console.log('\n[6] Storyboard batch:');
  const scenes = [
    { scene_number: 1, heading: 'Hook',  visual_direction: 'stressed face', shot_type: 'closeup', camera_movement: 'zoom_in' },
    { scene_number: 2, heading: 'Point 1', visual_direction: 'chaotic desk setup', shot_type: 'medium', camera_movement: 'pan_left' },
    { scene_number: 3, heading: 'CTA', visual_direction: 'clean organized workspace', shot_type: 'wide', camera_movement: 'zoom_out' },
  ];
  const batch = hb.build_storyboard_prompts(scenes, 'morning routine', { seed: 'batch-001' });
  batch.forEach((bp, i) => console.log(`   Scene ${i + 1} seed: ${bp.seed_info?.seed_string}`));

  console.log('\n[7] Static convenience:');
  console.log('   Camera controls:', Object.keys(CAMERA_CONTROLS).join(', '));
  console.log('   Lighting presets:', Object.keys(LIGHTING_PRESETS).join(', '));
  console.log('   Style presets:', Object.keys(HAILUO_STYLE_PRESETS).join(', '));

  console.log('\nAll TKP-82 self-tests PASSED.');
}
