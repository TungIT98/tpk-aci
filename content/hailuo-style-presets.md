# Hailuo Style Presets — TKP Video Studio

> 5 complete style presets for MiniMax-Hailuo-2.3 video generation.
> Each preset defines camera movements, color grading, music cues, and example scene applications.
> Used by `template_editor.py` and `ai_script_generator.py` to apply consistent visual language across all TKP content.

---

## Preset 1: Cinematic

**Best for:** Storytelling, emotional impact, personal development, before/after reveals, travel, documentary.
**Model note:** MiniMax-Hailuo-2.3 handles cinematic lighting well; use volumetric light descriptions for fog/haze effects.

### Camera Movements
| Type | Hailuo Prompt Addition | Use Case |
|---|---|---|
| Slow push-in | `slow zoom in, cinematic` | Emotional reveal, quote delivery, climax beat |
| Tracking pan | `tracking shot following [subject], steadicam smooth` | Walking scenes, lifestyle B-roll |
| Aerial drone | `aerial drone shot, wide landscape, cinematic widescreen` | Travel, transformation reveals, establishing |
| Slow pull-back | `slow zoom out revealing full scene` | Quote outro, transformation reveal |
| Static hold | `static shot locked frame, slow breathing movement` | Direct address, emotional monologues |

### Lighting Profile
- **Key light:** Motivated single source (window, desk lamp, sun) — never flat frontal
- **Fill:** Minimal to none — let shadows create depth
- **Backlight/Rim:** Essential for silhouette and separation shots
- **Color temperature:** Warm golden (3200–4500K) for reveals; cool blue (5600K+) for tension; shift within scenes
- **Volumetric effects:** `volumetric fog`, `lens flare`, `light rays through window`, `bokeh foreground`
- **Chiaroscuro:** High contrast single-source drama for tension scenes

### Color Grading (Prompt Additions)
- `golden hour warmth amber tones` — triumphant, warm, aspirational
- `cool blue tones cinematic` — tension, stress, conflict
- `desaturated slightly` — flashback, memory, melancholy
- `rich saturated warm tones` — lifestyle, food, comfort
- `high contrast cinematic color` — drama, intensity
- `clean bright color grade` — productivity, education, positive

### Music Cues
| Beat | Music Description |
|---|---|
| Hook / Pattern Interrupt | Sudden silence → single piano note → building tension |
| Emotional Peak | Cinematic orchestral swell, crescendo at key moment |
| Resolution / Reveal | Triumphant resolve — warm orchestral resolve or resolve-to-silence |
| Quote Delivery | Ambient piano underscore, very quiet, voice dominant |
| Montage B-Roll | Looped ambient instrumental, 60–80 BPM |
| CTA | Music fades to near-silence; warm direct address |

### Scene Application Examples

**Emotional story — climax beat:**
> Cinematic film still, slow zoom in, single dramatic key light from above, volumetric fog, deep shadows on face, warm breakthrough light, 4K movie quality, masterpiece best quality

**Before/after reveal:**
> Split-screen, left side desaturated cold tones, right side rich warm golden tones, smooth zoom in, cinematic lighting, aerial drone overhead, 4K movie quality, masterpiece

**Direct address / quote:**
> Person looking directly at camera, single warm key light, soft lens flare, cinematic letterbox, slow zoom in, golden hour warmth, 4K movie quality, masterpiece

---

## Preset 2: Anime / Cel-Shaded

**Best for:** Gen Z content, trend breakdowns, energy-driven hooks, fast-paced commentary, gaming culture.
**Model note:** MiniMax-Hailuo-2.3 interprets `Studio Ghibli inspired cel shaded` and `anime style` prompts consistently; combine with vibrant lighting for best results.

### Camera Movements
| Type | Hailuo Prompt Addition | Use Case |
|---|---|---|
| Dynamic zoom in | `dynamic fluid animation, zoom in with energy` | Aha moment, revelation, punchline |
| Low angle tilt up | `exaggerated perspective low angle tilt up` | Achievement, empowerment beat |
| POV tracking | `pov tracking shot, anime character running` | Adventure, fast-paced Gen Z content |
| Static dramatic | `static shot locked frame, bold composition` | Direct address CTA, Gen Z hook |
| Fast cuts | `2-second cuts, energetic movement` | Lifestyle montage, reaction faces |

### Lighting Profile
- **Primary:** Neon glow and cyberpunk lighting (`neon glow`, `cyberpunk lights`, `glowing screen`) — core anime aesthetic
- **Secondary:** Warm cozy lamp for Ghibli-style scenes (`warm tungsten firelight flicker`)
- **Accent:** Lens flare on glowing elements (`lens flare on neon glow`)
- **Atmosphere:** `fog`, `steam`, `sparkle effects` for magical/energy moments
- **Color burst:** `vibrant colors`, `high saturation`, `bold color palette` — anime is maximally colorful

### Color Grading (Prompt Additions)
- `neon glow cyberpunk lights` — tech, trends, Gen Z energy
- `warm golden hour anime tones` — cozy study, comfort moments
- `vibrant cel shaded` — high energy scenes
- `pastel soft anime tones` — calm moments, reflection
- `high contrast bold anime colors` — action, drama, achievement
- `magic sparkle effects` — transformation, revelation

### Music Cues
| Beat | Music Description |
|---|---|
| Hook / Pattern Interrupt | Hyperpop or electronic beat drop, fast tempo 140–160 BPM |
| Trend Breakdown | Meme audio clip woven in, ironic undertone |
| Achievement / Empowerment | Anime-style triumphant J-pop or K-pop beat |
| Cozy / Study Scene | Lo-fi anime study beats, soft and warm |
| CTA | Energetic pop beat, short 8-bar loop |

### Scene Application Examples

**Gen Z reaction hook:**
> Anime character with exaggerated surprised expression, phone screen glowing, Studio Ghibli inspired cel shaded vibrant, neon glow cyberpunk lights, dramatic close-up reaction shot, rule-of-thirds, masterpiece

**Anime achievement moment:**
> Anime character standing proudly in front of glowing holographic upward graph, Studio Ghibli inspired cel shaded, exaggerated perspective low angle tilt up, neon glow, bold asymmetrical composition, masterpiece

**Cozy anime study scene:**
> Anime style cozy bedroom study corner, character at desk with laptop warm lamp, Studio Ghibli inspired cel shaded warm tones, subtle handheld intimate feel, warm tungsten interior firelight flicker, rule-of-thirds, masterpiece

---

## Preset 3: Realistic / Documentary

**Best for:** Education, expert content, authentic testimonials, real-world proof, how-to tutorials.
**Model note:** MiniMax-Hailuo-2.3 excels at natural lighting — lean into `photorealistic`, `natural daylight`, `documentary photography` for the most convincing results.

### Camera Movements
| Type | Hailuo Prompt Addition | Use Case |
|---|---|---|
| Observational handheld | `observational handheld subtle feel, documentary` | Candid moments, authentic reactions |
| Clean static | `static shot locked frame, clean composition` | Expert explainer, instruction |
| Overhead flat-lay | `aerial overhead view, overhead flat-lay` | Product shots, setup reveals, food |
| POV tracking | `pov tracking shot, first-person perspective` | How-to steps, real-world application |
| Slow zoom | `slow zoom in, documentary photography` | Evidence reveal, result close-up |

### Lighting Profile
- **Primary:** Natural daylight — window light, overcast softbox effect
- **Secondary:** Phone/screen glow for authenticity moments
- **Style:** `unposed natural moment`, `documentary photography`, `observational`
- **Avoid:** Harsh artificial light, studio strobe, dramatic chiaroscuro
- **Tone:** Warm and approachable (education), cool and credible (expert), warm and authentic (lifestyle)

### Color Grading (Prompt Additions)
- `natural daylight` — authentic outdoor/window lit scenes
- `photorealistic hyperdetail 8K texture quality` — close-up product or face shots
- `warm tungsten cozy lamp light` — authentic late-night work, cozy lifestyle
- `blue hour cool tones` — late-night authenticity, hustle energy
- `documentary photography unposed` — credibility beats, testimonials
- `editorial clean composition` — professional education content

### Music Cues
| Beat | Music Description |
|---|---|
| Expert Explain | Ambient underscore, electronic minimal — voice dominant |
| Tutorial Steps | Upbeat acoustic, clean electronic, 100–120 BPM |
| Authentic / Candid | Near silence — let ambient room sound breathe |
| Evidence / Proof | Confident bass or beat, credibility underscore |
| CTA | Warm friendly acoustic, community-building feel |

### Scene Application Examples

**Real expert explainer:**
> Expert speaking directly to camera, clean modern office, natural daylight from large window, photorealistic hyperdetail 8K quality, static shot locked frame, natural movement, clean professional composition, masterpiece

**Authentic late-night hustle:**
> Candid shot of young person working late at laptop in small apartment, fairy lights and lamp as only light source, photorealistic hyperdetail 8K texture quality, documentary photography unposed, subtle handheld intimate feel, warm tungsten cozy lamp light firelight flicker, environmental context framing, masterpiece

**Real before/after evidence:**
> Split-screen learner progress: left side confused/messy notes, right side mastery/organized diagrams, overhead aerial view, photorealistic documentary photography, natural daylight, editorial documentary framing, masterpiece

---

## Preset 4: Abstract / Creative

**Best for:** Visual interest, metaphor scenes, concept visualization, artistic expression, abstract B-roll.
**Model note:** MiniMax-Hailuo-2.3 handles surreal and abstract prompts well; use `surreal motion`, `morphing shapes`, and `ethereal` for creative sequences.

### Camera Movements
| Type | Hailuo Prompt Addition | Use Case |
|---|---|---|
| Morphing zoom | `surreal motion morphing shapes, zoom in fluid` | Concept transition, transformation metaphor |
| Float/drift | `ethereal floating movement, dreamlike drift` | Abstract B-roll, reflective moments |
| Rack focus | `rack focus between layers, parallax effect` | Concept visualization, layered meaning |
| Orbital | `orbital camera movement, rotating around subject` | Product reveal, concept centerpiece |
| Handheld float | `subtle floating handheld, dreamlike quality` | Reflective, emotional, abstract B-roll |

### Lighting Profile
- **Primary:** Glowing elements, light rays, volumetric beams
- **Style:** `ethereal glow`, `floating light particles`, `bioluminescent`, `holographic`
- **Color:** Soft pastels, glowing neons, iridescent tones, high contrast against dark
- **Atmosphere:** `fog`, `mist`, `particle effects`, `light beams`, `aurora`

### Color Grading (Prompt Additions)
- `ethereal glow soft pastels` — dreamlike, reflective
- `bioluminescent glowing` — abstract life/metaphor
- `holographic light beams` — concept visualization
- `dark background with single glowing focal point` — mystery, revelation
- `aurora borealis tones` — awe, wonder, big-picture thinking
- `glowing particle effects` — magic, idea, insight moment

### Music Cues
| Beat | Music Description |
|---|---|
| Concept Visualization | Ambient drone or atmospheric pad, reverb-heavy |
| Metaphor Scene | Melodic underscore, emotional depth |
| Revelation / Insight | Sparse piano or single instrument swell |
| Abstract B-Roll | Electronic ambient, texture soundscape |
| Transition | Near silence with single atmospheric tone |

### Scene Application Examples

**Transformation metaphor:**
> Abstract morphing scene: chaos messy desk transforming into organized glowing workspace, ethereal floating particles, surreal motion, bioluminescent light beams connecting elements, dark background, cinematic 4K, masterpiece

**Concept visualization (compound growth):**
> Abstract holographic 3D graph growing from floor to ceiling, glowing light beams, aurora borealis tones, floating particles, ethereal atmosphere, dark cinematic background, 4K movie quality, masterpiece

**Idea/insight moment:**
> Close-up of glowing lightbulb moment, ethereal soft white glow, floating particles of light, dark moody background, subtle rack focus from face to lightbulb, dreamy cinematic, masterpiece

---

## Preset 5: Documentary / Journalism

**Best for:** Real news, industry analysis, investigative content, cultural commentary, expert interviews.
**Model note:** MiniMax-Hailuo-2.3 renders `documentary photography` and `investigative journalism` aesthetics well; emphasize `real environment`, `real lighting`, `authentic`.

### Camera Movements
| Type | Hailuo Prompt Addition | Use Case |
|---|---|---|
| Observational static | `observational camera, documentary still, locked frame` | Interview subject, expert testimony |
| Walking tracking | `tracking shot following subject walking, documentary` | Field reporting, real-world context |
| Close-up evidence | `macro close-up, evidentiary detail, documentary` | Document proof, key evidence reveal |
| Wide establishing | `wide establishing shot, environmental documentary` | Setting the scene, context |
| Two-shot | `two-person conversation over desk, documentary` | Interview, debate, discussion |

### Lighting Profile
- **Primary:** Real-environment motivated — office overhead, window, street light
- **Avoid:** Any artificial studio look
- **Style:** `real environment`, `authentic lighting`, `investigative journalism`
- **Tone:** Cool/neutral (credibility), warm (human interest), harsh (accountability)

### Color Grading (Prompt Additions)
- `documentary photography unposed natural moment` — authenticity
- `investigative journalism cool tones` — serious investigative content
- `warm human interest tones` — emotional human stories
- `harsh single overhead light` — accountability, tension, confrontation
- `natural environmental lighting` — real-world context
- `clean professional news studio` — formal journalism framing

### Music Cues
| Beat | Music Description |
|---|---|
| News/Investigative | No music — let story carry weight |
| Human Interest | Sparse emotional piano, one instrument |
| Expert Interview | Near-silence with ambient room tone |
| Evidence Reveal | Low bass tension underscore, 2-bar loop |
| Context B-Roll | Documentary field audio ambience |

### Scene Application Examples

**Investigative interview:**
> Subject speaking directly to camera in their real workspace, natural window light, documentary photography unposed natural moment, observational camera locked frame, real environment visible in background, investigative journalism cool tones, clean composition, masterpiece

**Field reporting context:**
> Wide establishing shot of urban street, person walking through frame, tracking documentary shot, natural street light and ambient environment, real people in background, journalistic framing, 4K documentary quality, masterpiece

**Evidence/proof reveal:**
> Macro close-up of document, email, or screen with evidence visible, harsh overhead investigative light, evidentiary detail documentary photography, clean unlit background, 4K documentary, masterpiece

---

## FFmpeg Quality Presets (TKP-80 Integration)

Apply these FFmpeg encoding parameters based on the style preset used:

| Style Preset | Resolution | Bitrate | Audio | Color Profile |
|---|---|---|---|---|
| Cinematic | 1920×1080 | 8 Mbps | AAC 192k | Rec.709, warm grade |
| Anime | 1920×1080 | 10 Mbps | AAC 192k | Vibrant, high saturation |
| Realistic | 1920×1080 | 6 Mbps | AAC 128k | Natural, neutral grade |
| Abstract | 1920×1080 | 8 Mbps | AAC 192k | Cinematic dark grade |
| Documentary | 1920×1080 | 6 Mbps | AAC 160k | Log to Rec.709 flat |

**Platform-specific overrides:**
- TikTok: crop to 1080×1920, max 60s, H.264
- YouTube Shorts: 1080×1920, max 60s, H.264, fast start
- YouTube: 1920×1080, no duration limit, H.264/H.265, fast start
- Instagram Reels: 1080×1920, max 90s, H.264

---

*Built for TKP Video Studio — TKP-83*
*Companion: `content/hailuo-prompt-library.md` (100+ prompts), `video_studio_app/templates/` (17 updated templates)*
