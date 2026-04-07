# Hailuo Prompt Library — TKP Video Studio (TKP-82)

> 100+ Hailuo-optimized image-to-video prompts for TKP content channels.
> Each prompt includes DO / DON'T examples and works with `lib/prompts.js` `HailuoPromptBuilder`.
>
> **Usage:**
> ```js
> import { HailuoPromptBuilder } from '../lib/prompts.js';
> const hb = new HailuoPromptBuilder({ defaultStyle: 'cinematic' });
> const { image_prompt, negative_prompt } = hb.build_scene_prompt(scene, topic);
> ```
>
> ```python
> from ai_script_generator import AIScriptGenerator
> script = AIScriptGenerator().generate("Your topic")
> sb = script.apply_hailuo_prompts(style="cinematic", seed="your-seed")
> ```

---

## Contents

1. [Productivity — Cinematic](#1-productivity--cinematic)
2. [Productivity — Anime](#2-productivity--anime)
3. [Productivity — Realistic](#3-productivity--realistic)
4. [Growth — Cinematic](#4-growth--cinematic)
5. [Growth — Anime](#5-growth--anime)
6. [Growth — Realistic](#6-growth--realistic)
7. [Education — Cinematic](#7-education--cinematic)
8. [Education — Anime](#8-education--anime)
9. [Education — Realistic](#9-education--realistic)
10. [Entertainment — Cinematic](#10-entertainment--cinematic)
11. [Entertainment — Anime](#11-entertainment--anime)
12. [Entertainment — Realistic](#12-entertainment--realistic)
13. [Hook / CTA Scenes](#13-hook--cta-scenes)
14. [Transition / B-Roll Scenes](#14-transition--b-roll-scenes)
15. [Seed Reference for Batch Generation](#15-seed-reference-for-batch-generation)

---

## How to Read This Library

Each entry follows this structure:

```
### [ID] Scene Heading

**Prompt:** The full Hailuo-optimized prompt string
**Camera:** Recommended camera control
**Lighting:** Recommended lighting preset
**Mood:** Mood keywords

DO ✅
- Things that work well with this prompt

DON'T ❌
- Common mistakes to avoid
```

**Camera shorthand:**
- `static` → pan_left, pan_right, tilt_up, tilt_down, zoom_in, zoom_out, tracking, aerial, pov, handheld, steadicam, dolly_side, rack_focus

**Lighting shorthand:**
- `natural`, `studio`, `dramatic`, `cinematic`, `golden_hour`, `blue_hour`, `neon`, `warm_indoor`, `backlit`

---

## 1. Productivity — Cinematic

### P-C001 Hook: The Wrong Way

**Prompt:** A frustrated professional staring at a chaotic overflowing inbox, dim overhead fluorescent lighting, cinematic film still, 4K movie quality, shallow depth of field, static shot locked frame, natural daylight from side window, rule-of-thirds composition, masterpiece best quality
**Camera:** `static` / `zoom_in`
**Lighting:** `dramatic`
**Mood:** Tense, cautionary, pattern interrupt

DO ✅
- Realistic messy desk / inbox visible
- Natural frustrated expression
- Side window or overhead fluorescent

DON'T ❌
- Cartoon or stylized version of chaos
- Too dark —看不清 face
- Green screen background

---

### P-C002 Point 1: The Framework Reveal

**Prompt:** Clean minimalist workspace with a glowing digital notepad showing a numbered framework, cinematic film still, 4K movie quality, shallow depth of field, zoom in slowly, cinematic lighting motivated sources, rule-of-thirds composition, masterpiece best quality ultra detailed
**Camera:** `zoom_in`
**Lighting:** `cinematic`
**Mood:** Clear, instructive, authoritative

DO ✅
- Glowing digital screen / notepad visible
- Clean modern workspace
- Numbered steps visible

DON'T ❌
- Text too small to read
- Cluttered background
- No focal element

---

### P-C003 Point 2: Before / After Comparison

**Prompt:** Split-screen of chaotic desk vs clean organized desk, overhead aerial view, documentary photography style candid realism, unposed natural moment, smooth camera movement, natural daylight, editorial documentary framing, masterpiece best quality
**Camera:** `aerial`
**Lighting:** `natural`
**Mood:** Satisfying, impactful, revelatory

DO ✅
- Clear visual split
- Both sides well-lit
- Labels or context clear

DON'T ❌
- Overhead too high — lose detail
- Uneven lighting on two sides
- Too much visual clutter

---

### P-C004 Point 3: Action Shot

**Prompt:** Over-the-shoulder shot of hands checking off items on a physical checklist with a pen, bokeh background of organized shelf, cinematic film still, 4K movie quality, shallow depth of field, slow zoom in, warm tungsten interior cozy lamp light, rule-of-thirds composition, masterpiece best quality
**Camera:** `zoom_in`
**Lighting:** `warm_indoor`
**Mood:** Satisfying, accomplished

DO ✅
- Hands and checklist in focus
- Background softly blurred
- Pen or checkmark visible

DON'T ❌
- Background too sharp
- Hands blurred
- Checklist text unreadable

---

### P-C005 B-Roll: Morning Routine Montage

**Prompt:** Smooth tracking shot gliding past a perfectly prepared workspace: coffee cup, notebook, laptop, and morning light streaming through window, cinematic film still, 4K movie quality, shallow depth of field, slow dolly side movement, golden hour warmth lens flare amber tones bokeh, rule-of-thirds composition, masterpiece best quality
**Camera:** `dolly_side` / `steadicam`
**Lighting:** `golden_hour`
**Mood:** Calm, aspirational, productive energy

DO ✅
- Workspace fully prepared and clean
- Golden hour window light visible
- Smooth continuous camera movement

DON'T ❌
- Camera jerk or stop-start movement
- Cluttered or half-prepared workspace
- Harsh artificial lighting

---

### P-C006 Point 4: Social Proof / Stat Visual

**Prompt:** Close-up of a glowing laptop screen displaying a growth chart with upward arrow, reflections on glasses of a focused professional, cinematic film still, 4K movie quality, shallow depth of field, tilt up slowly, cinematic lighting volumetric fog glow, rule-of-thirds composition, masterpiece best quality ultra detailed
**Camera:** `tilt_up`
**Lighting:** `cinematic`
**Mood:** Impressive, data-driven, credible

DO ✅
- Chart clearly visible
- Person's reflection adds human element
- Dramatic upward trend visible

DON'T ❌
- Screen glare too bright
- Chart text too small
- Generic stock photo look

---

### P-C007 CTA: Subscribe / Follow

**Prompt:** Confident presenter looking directly at camera in bright modern home studio, warm white background, clean professional look, cinematic film still, 4K movie quality, static shot locked frame, studio lighting softbox key light clean catchlights, rule-of-thirds composition, masterpiece best quality
**Camera:** `static`
**Lighting:** `studio`
**Mood:** Warm, inviting, action-ready

DO ✅
- Direct eye contact with camera
- Clean uncluttered background
- Warm inviting expression

DON'T ❌
- Looking off-camera
- Distracting background elements
- Harsh unflattering lighting

---

## 2. Productivity — Anime

### P-A001 Hook: Dramatic Revelation

**Prompt:** Anime style determined protagonist staring at a chaotic glowing digital to-do list, Studio Ghibli inspired cel shaded vibrant colors, dramatic close-up reaction shot, exaggerated anime expressions, Studio Ghibli lighting motivated sources, rule-of-thirds composition, masterpiece best quality
**Camera:** `zoom_in` / `tilt_up`
**Lighting:** `dramatic`
**Mood:** Dramatic tension, anime energy

DO ✅
- Anime character with strong expression
- Glowing digital elements
- Bold dramatic framing

DON'T ❌
- Realistic photo mixed with anime
- Too many visual elements
- Unclear focal point

---

### P-A002 Point 1: Energy Boost

**Prompt:** Anime character energetically crossing off items on a floating holographic checklist, Studio Ghibli inspired cel shaded vibrant color palette, dynamic fluid animation movement, exaggerated perspective low angle tilt up, neon glow cyberpunk lights in background, bold asymmetrical composition, masterpiece best quality
**Camera:** `tilt_up` / `zoom_in`
**Lighting:** `neon`
**Mood:** Energetic, punchy, Gen-Z anime aesthetic

DO ✅
- Checklist items clearly numbered
- Energetic pose and expression
- Neon / cyberpunk background contrast

DON'T ❌
- Background too busy to read checklist
- Character expression too neutral
- Static pose when energy calls for movement

---

### P-A003 Point 2: Transformation

**Prompt:** Anime scene showing a character's messy cluttered room morphing into a clean organized space with magical sparkle effects, Studio Ghibli inspired cel shaded, surreal motion morphing shapes ethereal float, warm golden hour light transformation, rule-of-thirds composition, masterpiece best quality
**Camera:** `zoom_out` / `static`
**Lighting:** `golden_hour`
**Mood:** Satisfying, magical, transformation energy

DO ✅
- Clear before/after visual
- Sparkle or transformation effects
- Expressive anime character reaction

DON'T ❌
- Transformation too fast to follow
- Background too cluttered
- Color palette clash

---

### P-A004 B-Roll: Cozy Study Setup

**Prompt:** Anime style cozy bedroom study corner: character at desk with laptop warm lamp light steaming coffee and books stacked, Studio Ghibli inspired cel shaded warm tones, subtle handheld intimate handheld feel, warm tungsten interior firelight flicker, rule-of-thirds composition, masterpiece best quality
**Camera:** `handheld` / `static`
**Lighting:** `warm_indoor`
**Mood:** Cozy, aspirational, study motivation

DO ✅
- Warm inviting color palette
- Character visibly focused and content
- Recognizable study setup

DON'T ❌
- Too dark看不清 details
- Cluttered beyond cozy
- Unnatural anime proportions

---

### P-A005 CTA: Anime Energy Call to Action

**Prompt:** Anime character pointing directly at camera with energetic confident expression, bold text overlay space, Studio Ghibli inspired cel shaded vibrant, static shot locked frame, bright punchy lighting high energy, rule-of-thirds composition, masterpiece best quality
**Camera:** `static`
**Lighting:** `studio`
**Mood:** Energetic, direct, follow-now energy

DO ✅
- Direct to-camera energy
- Clear space for text overlay
- Bold vibrant colors

DON'T ❌
- Character looking away
- Background competing with character
- Expression too calm for CTA energy

---

## 3. Productivity — Realistic

### P-R001 Hook: Raw Realism

**Prompt:** Candid close-up of tired eyes looking at a phone screen glowing in a dark bedroom at 2am, photorealistic hyperdetail 8K texture quality natural skin texture, documentary photography style unposed natural moment, observational handheld subtle handheld feel, blue hour cool tones twilight ambient, environmental documentary framing, masterpiece best quality
**Camera:** `handheld` / `closeup`
**Lighting:** `blue_hour`
**Mood:** Relatable, raw, pattern interrupt

DO ✅
- Real candid emotion
- Phone screen glow as key light
- Dark moody atmosphere

DON'T ❌
- Overly lit like a studio shoot
- Model-looking obviously posed
- Too many visible makeup / retouching

---

### P-R002 Point 1: The System

**Prompt:** Over-the-shoulder shot of hands organizing a physical planner with colored markers, photorealistic hyperdetail 8K texture quality, natural movement realistic physics authentic human motion, warm natural daylight from window, clean portrait composition balanced negative space, masterpiece best quality ultra detailed
**Camera:** `tracking`
**Lighting:** `natural`
**Mood:** Instructive, hands-on, practical

DO ✅
- Hands clearly visible and natural
- Planner and markers identifiable
- Natural daylight from window

DON'T ❌
- Background too busy
- Hands in unnatural pose
- Overhead artificial lighting

---

### P-R003 Point 2: Real Results

**Prompt:** Close-up of a journal with handwritten notes and a pen beside a morning coffee, photorealistic hyperdetail 8K texture quality natural skin texture, static shot locked frame, golden hour warmth lens flare amber tones bokeh, clean minimal composition, masterpiece best quality
**Camera:** `static`
**Lighting:** `golden_hour`
**Mood:** Satisfying, grounded, real-world

DO ✅
- Journal pages clearly show writing
- Coffee adds lifestyle context
- Warm morning light

DON'T ❌
- Journal text too small
- Background distracting
- Too styled / staged-looking

---

### P-R004 B-Roll: Time-Lapse Setup

**Prompt:** Time-lapse style overhead aerial view of a productive work desk being set up from messy to clean, photorealistic documentary photography, natural daylight overhead, observational documentary camera, environmental context framing, masterpiece best quality
**Camera:** `aerial`
**Lighting:** `natural`
**Mood:** Satisfying, montage-ready, visual transformation

DO ✅
- Overhead angle clearly shows workspace
- Natural consistent lighting throughout
- Start and end states both clear

DON'T ❌
- Too many objects moving simultaneously
- Poor overhead lighting
- Camera shake

---

## 4. Growth — Cinematic

### G-C001 Hook: Bold Claim

**Prompt:** Bold close-up reaction shot of a surprised confident young person looking at a glowing phone screen showing a financial figure, cinematic film still 4K movie quality, dramatic chiaroscuro lighting single hard key light, cinematic letterbox widescreen framing, masterpiece best quality ultra detailed
**Camera:** `zoom_in`
**Lighting:** `dramatic`
**Mood:** Surprising, bold, pattern interrupt

DO ✅
- Clear phone screen with specific number/figure
- Expression shows genuine surprise
- Dramatic side lighting

DON'T ❌
- Phone screen unreadable due to glare
- Neutral expression
- Flat front-facing lighting

---

### G-C002 Point 1: The Strategy

**Prompt:** Dynamic tracking shot following a person walking through a city street while looking at a mapping app on their phone, cinematic film still 4K movie quality, natural motion blur, urban ambient lighting, rule-of-thirds composition with phone in third, masterpiece best quality
**Camera:** `tracking`
**Lighting:** `natural`
**Mood:** Forward-moving, on-the-go energy

DO ✅
- Clear urban context
- Phone screen visible and relevant
- Smooth continuous movement

DON'T ❌
- Too fast — phone unreadable
- Unclear urban context
- Phone visible but nothing on screen

---

### G-C003 Point 2: The Pivot Moment

**Prompt:** Dramatic silhouette of a person standing at a crossroads city intersection at blue hour, city lights glowing behind, cinematic film still 4K quality, strong backlight silhouette rim light separation dark foreground glowing edges, aerial drone view angle, masterpiece best quality
**Camera:** `aerial` / `tracking`
**Lighting:** `backlit`
**Mood:** Pivotal, decision moment, cinematic

DO ✅
- Strong silhouette contrast
- City lights visible behind
- Clear decision / crossroads metaphor

DON'T ❌
- Silhouette too dark
- Background not visible
- Person blending into background

---

### G-C004 Point 3: The Result Reveal

**Prompt:** Close-up of a glowing laptop screen showing a payment notification or bank app with money figure highlighted, reflection visible on glasses of a shocked person, cinematic film still 4K movie quality, slow zoom in, cinematic volumetric lighting, rule-of-thirds composition, masterpiece best quality
**Camera:** `zoom_in`
**Lighting:** `cinematic`
**Mood:** Satisfying, rewarding, proof moment

DO ✅
- Screen clearly shows amount
- Human reaction in reflection
- Dramatic reveal lighting

DON'T ❌
- Screen glare blocking amount
- No human element
- Too cluttered screen

---

### G-C005 B-Roll: Lifestyle Uplift

**Prompt:** Cinematic tracking shot gliding past a stylish modern apartment with plants books and warm lighting, cinematic film still 4K movie quality, shallow depth of field, steadicam smooth glide floated tracking, golden hour warmth amber tones bokeh, rule-of-thirds composition, masterpiece best quality
**Camera:** `steadicam` / `tracking`
**Lighting:** `golden_hour`
**Mood:** Aspirational, lifestyle, growth energy

DO ✅
- Stylish but realistic apartment
- Warm inviting lighting
- Smooth camera movement

DON'T ❌
- Too opulent / unrelatable
- Harsh artificial lighting
- Camera movement jittery

---

## 5. Growth — Anime

### G-A001 Hook: Gen-Z Reaction

**Prompt:** Anime character with exaggerated surprised expression staring at a glowing phone showing a viral number, Studio Ghibli inspired cel shaded vibrant, dramatic close-up reaction shot, neon glow cyberpunk lights, rule-of-thirds composition, masterpiece best quality
**Camera:** `zoom_in`
**Lighting:** `neon`
**Mood:** Surprised, relatable, Gen-Z energy

DO ✅
- Exaggerated but relatable expression
- Glowing phone screen as key element
- Vibrant neon background

DON'T ❌
- Too subtle reaction
- Screen unreadable
- Background too dark

---

### G-A002 Point 1: Money Visual

**Prompt:** Anime floating holographic money or coin stack with sparkle effects, Studio Ghibli inspired cel shaded, dynamic fluid animation, surreal motion morphing shapes, gold tones with neon accent glow, rule-of-thirds composition, masterpiece best quality
**Camera:** `zoom_in` / `tilt_up`
**Lighting:** `golden_hour` / `neon`
**Mood:** Exciting, aspirational, financial energy

DO ✅
- Clear money symbol (coins, stack, dollar sign)
- Sparkle / magical effects
- Vibrant gold + neon palette

DON'T ❌
- Too realistic / scary money imagery
- No visual interest
- Unclear what it represents

---

### G-A003 Point 2: The Growth Graph

**Prompt:** Anime character standing proudly in front of a glowing holographic upward trending graph, Studio Ghibli inspired cel shaded vibrant, exaggerated perspective low angle tilt up, neon glow cyberpunk lights, bold asymmetrical composition, masterpiece best quality
**Camera:** `tilt_up`
**Lighting:** `neon`
**Mood:** Proud, victorious, achievement energy

DO ✅
- Graph clearly trending upward
- Character looking at graph with pride
- Dramatic low angle

DON'T ❌
- Graph too complex to read
- Character too small
- Background overpowering

---

### G-A004 B-Roll: Urban Gen-Z Lifestyle

**Prompt:** Anime style fast-paced montage of a young person: walking in city, ordering coffee, working on laptop at cafe, looking at phone, Studio Ghibli inspired cel shaded vibrant colors, 2-second cuts energetic movement, bright punchy lighting high energy, vertical-ready composition, masterpiece best quality
**Camera:** `tracking` / `zoom_in`
**Lighting:** `studio` / `neon`
**Mood:** Energetic, fast, Gen-Z lifestyle

DO ✅
- Fast cuts between 3-4 urban scenes
- Energetic pacing implied
- Phone and tech visible

DON'T ❌
- Too slow-paced
- Only one location
- No tech / phone visible

---

## 6. Growth — Realistic

### G-R001 Hook: Raw Hustle

**Prompt:** Candid shot of a young person working late at a laptop in a small apartment at night, fairy lights and lamp the only light source, photorealistic hyperdetail 8K texture quality, documentary photography unposed natural moment, subtle handheld intimate feel, warm tungsten interior cozy lamp light firelight flicker, environmental context framing, masterpiece best quality
**Camera:** `handheld`
**Lighting:** `warm_indoor`
**Mood:** Relatable hustle, authenticity, late-night grind

DO ✅
- Warm lamp light as key source
- Realistic small apartment context
- Genuine tired but determined expression

DON'T ❌
- Overly dramatic dark/edgy lighting
- Too polished / too much equipment
- Expression unreadable

---

### G-R002 Point 1: Side Hustle Setup

**Prompt:** Close-up overhead flat-lay of a side hustle setup: laptop camera ring light and product samples on a white desk, photorealistic hyperdetail 8K texture quality, aerial overhead view, natural daylight from window, clean minimal composition, masterpiece best quality
**Camera:** `aerial`
**Lighting:** `natural`
**Mood:** Practical, actionable, real

DO ✅
- All equipment clearly visible
- Clean organized surface
- Natural light

DON'T ❌
- Cluttered surface
- Overhead fluorescent harsh lighting
- Too many unrelated items

---

### G-R003 Point 2: First Dollar Earned

**Prompt:** Close-up of a phone screen showing a payment received notification with a realistic hand holding the phone, photorealistic hyperdetail 8K texture, natural movement realistic physics, warm natural side light, clean portrait composition, masterpiece best quality
**Camera:** `static` / `zoom_in`
**Lighting:** `natural`
**Mood:** Historic, earned, milestone moment

DO ✅
- Notification clearly readable
- Hand visible holding phone
- Celebratory but not over-the-top

DON'T ❌
- Screen unreadable
- Too staged-looking
- Generic stock feeling

---

## 7. Education — Cinematic

### E-C001 Hook: The Misconception

**Prompt:** Professor or expert looking directly at camera with a chalkboard or whiteboard covered in crossed-out misconceptions behind them, cinematic film still 4K movie quality, static shot locked frame, studio lighting softbox key light, rule-of-thirds composition with expert in left third, masterpiece best quality
**Camera:** `static`
**Lighting:** `studio`
**Mood:** Authoritative, engaging, counter-intuitive

DO ✅
- Expert making direct eye contact
- Misconceptions visible and crossed out
- Clean professional background

DON'T ❌
- Too much text on board
- Expert looking away
- Cluttered distracting background

---

### E-C002 Point 1: The Concept Visualization

**Prompt:** Animated-style diagram showing a complex concept (e.g. compound interest growth curve or brain neural network) rendered in cinematic 3D, holographic floating light beams, cinematic film still 4K quality, zoom in slowly, cinematic lighting volumetric fog glow, clean dark background for contrast, masterpiece best quality
**Camera:** `zoom_in`
**Lighting:** `cinematic`
**Mood:** Enlightening, complex made simple

DO ✅
- Concept clearly visualized
- Dark background for contrast
- Smooth implied movement

DON'T ❌
- Diagram too complex
- Too many elements competing
- Low quality rendering

---

### E-C003 Point 2: Real World Application

**Prompt:** Tracking shot following hands building or assembling something ( LEGO / furniture / circuit board) with the finished result shown at the end, cinematic film still 4K quality, shallow depth of field, steadicam smooth glide, natural daylight, rule-of-thirds composition, masterpiece best quality
**Camera:** `tracking` / `steadicam`
**Lighting:** `natural`
**Mood:** Practical, hands-on, applicable

DO ✅
- Process clearly shown step by step
- End result visible and satisfying
- Natural daylight

DON'T ❌
- Too fast to follow
- No clear start/end
- Hands blurred or obscured

---

### E-C004 Point 3: The Evidence

**Prompt:** Close-up of an open textbook or research paper with highlighted passages and a coffee cup beside it, cinematic film still 4K movie quality, slow zoom in, warm golden hour light streaming through window, rule-of-thirds composition, masterpiece best quality
**Camera:** `zoom_in`
**Lighting:** `golden_hour`
**Mood:** Scholarly, credible, research-backed

DO ✅
- Text clearly visible
- Highlights visible and relevant
- Coffee adds lifestyle warmth

DON'T ❌
- Text too small
- Book looks unread
- Harsh fluorescent lighting

---

### E-C005 B-Roll: Library / Learning Space

**Prompt:** Cinematic glide through a beautiful library or co-working space with people studying, golden hour sunlight streaming through tall windows, cinematic film still 4K quality, steadicam smooth glide, golden hour warmth amber tones bokeh background, rule-of-thirds composition, masterpiece best quality
**Camera:** `steadicam`
**Lighting:** `golden_hour`
**Mood:** Aspirational learning, calm focus, productivity

DO ✅
- Golden hour light dominant
- People visibly focused
- Wide enough to show space

DON'T ❌
- Too dark
- People too blurry
- Space looks uninviting

---

## 8. Education — Anime

### E-A001 Hook: Brain Moment

**Prompt:** Anime character having a dramatic realization with stars and lightbulb appearing above their head, Studio Ghibli inspired cel shaded, exaggerated anime expressions, fluid animation, cinematic dramatic lighting, rule-of-thirds composition, masterpiece best quality
**Camera:** `tilt_up`
**Lighting:** `dramatic`
**Mood:** Aha moment, revelation, engaging hook

DO ✅
- Lightbulb or idea symbol visible
- Character expression matches "aha"
- Dramatic but not over-the-top

DON'T ❌
- Too subtle —看不到 idea symbol
- Expression doesn't match
- Too many competing elements

---

### E-A002 Point 1: Concept Monster

**Prompt:** Anime character fighting or conquering a large monster labeled with a complex concept (e.g. "PROCRASTINATION" written on a monster), Studio Ghibli inspired cel shaded vibrant, dynamic fluid animation exaggerated perspective, neon glow rim lighting, bold asymmetrical composition, masterpiece best quality
**Camera:** `zoom_in` / `tilt_up`
**Lighting:** `neon`
**Mood:** Conquering challenges, overcoming difficulty

DO ✅
- Label clearly readable on monster
- Character actively fighting
- High energy pose

DON'T ❌
- Label too small to read
- Static passive character
- Too many monsters

---

### E-A003 Point 2: Study Montage

**Prompt:** Anime time-lapse montage of a character studying: at desk writing, reading books, drinking coffee, making flashcards, Studio Ghibli inspired cel shaded, 2-second cuts fluid animation, warm cozy lamp lighting, rule-of-thirds composition, masterpiece best quality
**Camera:** `static` / `handheld`
**Lighting:** `warm_indoor`
**Mood:** Dedicated, aspirational study energy

DO ✅
- Clear study activities
- Warm cozy atmosphere
- Visible progress (stack of books grows)

DON'T ❌
- Only one static shot
- Too dark to see details
- No variety in activities

---

## 9. Education — Realistic

### E-R001 Hook: Expert Direct

**Prompt:** Real expert speaking directly to camera in a clean modern office or lab setting, natural daylight from large window, photorealistic hyperdetail 8K quality, static shot locked frame, natural movement realistic physics, clean professional composition, masterpiece best quality
**Camera:** `static`
**Lighting:** `natural`
**Mood:** Credible, trustworthy, expert authority

DO ✅
- Expert looking at camera
- Clean background with context
- Natural daylight

DON'T ❌
- Expert reading from script
- Cluttered distracting background
- Harsh artificial lighting

---

### E-R002 Point 1: Before / After Data

**Prompt:** Split-screen of a learner's progress: left side shows confusion / messy notes; right side shows mastery / clean organized diagrams, overhead aerial view, photorealistic documentary photography, natural daylight, editorial documentary framing, masterpiece best quality
**Camera:** `aerial`
**Lighting:** `natural`
**Mood:** Transformation, clear improvement, proof

DO ✅
- Clear split between before/after
- Both sides well-lit
- Context clearly educational

DON'T ❌
- Uneven lighting on two sides
- Too much text
- No clear improvement visible

---

## 10. Entertainment — Cinematic

### EN-C001 Hook: Plot Twist

**Prompt:** Dramatic close-up reaction shot of a person watching something surprising on their phone, cinematic film still 4K movie quality, slow zoom in, dramatic chiaroscuro lighting single hard key, rule-of-thirds composition, masterpiece best quality
**Camera:** `zoom_in`
**Lighting:** `dramatic`
**Mood:** Shocked, surprised, must-know-what-happens

DO ✅
- Clear phone screen visible
- Expression is genuinely surprised
- Dramatic lighting

DON'T ❌
- Phone screen unreadable
- Expression too subtle
- Flat frontal lighting

---

### EN-C002 Point 1: The Scene

**Prompt:** Cinematic wide shot of an epic location (mountains / city skyline / beach at sunset) with a person silhouetted looking into the distance, cinematic film still 4K quality, aerial drone shot, golden hour warmth lens flare amber tones, rule-of-thirds composition, masterpiece best quality
**Camera:** `aerial`
**Lighting:** `golden_hour`
**Mood:** Epic, adventurous, aspirational travel

DO ✅
- Epic location dominates frame
- Person silhouetted for scale
- Golden hour light

DON'T ❌
- Location too small
- Person blocking view
- Too dark to see location

---

### EN-C003 Point 2: Reaction Montage

**Prompt:** Fast-paced montage of different people reacting to something (wow faces, laughing, surprised) cut between close-up reaction shots, cinematic film still 4K quality, quick cuts 2-second scenes, bright punchy studio lighting, clean simple backgrounds, masterpiece best quality
**Camera:** `zoom_in`
**Lighting:** `studio`
**Mood:** Infectious energy, relatable, shareable

DO ✅
- 3-4 different reactions
- Clear varied expressions
- Clean simple background

DON'T ❌
- Only one reaction
- Expressions unreadable
- Background too busy

---

### EN-C004 B-Roll: Epic Travel Montage

**Prompt:** Cinematic drone tracking shot flying through a dramatic landscape at golden hour, cinematic film still 4K quality, steadicam smooth glide, golden hour warmth amber tones bokeh, rule-of-thirds composition, masterpiece best quality
**Camera:** `aerial` / `steadicam`
**Lighting:** `golden_hour`
**Mood:** Epic, awe-inspiring, wanderlust

DO ✅
- Continuous smooth aerial movement
- Golden light dominant
- Landscape clearly visible

DON'T ❌
- Camera shake
- Too short to appreciate
- Overcast flat lighting

---

## 11. Entertainment — Anime

### EN-A001 Hook: Anime Surprise

**Prompt:** Anime character with exaggerated shocked expression staring at a glowing mysterious portal or screen, Studio Ghibli inspired cel shaded vibrant colors, dramatic close-up reaction, neon glow cyberpunk lights, rule-of-thirds composition, masterpiece best quality
**Camera:** `zoom_in`
**Lighting:** `neon`
**Mood:** Mysterious, hook-energy, must-watch

DO ✅
- Exaggerated anime expression
- Mysterious glowing element
- Vibrant contrasting background

DON'T ❌
- Too subtle reaction
- No mysterious element
- Dark and unclear

---

### EN-A002 Point 1: Anime Adventure

**Prompt:** Anime protagonist running through an epic fantasy landscape or urban rooftop, Studio Ghibli inspired cel shaded vibrant, fluid animation exaggerated motion, dynamic camera tracking shot, neon glow sunset backlight, bold asymmetrical composition, masterpiece best quality
**Camera:** `tracking` / `pov`
**Lighting:** `neon` / `golden_hour`
**Mood:** Adventure, energy, epic movement

DO ✅
- Clear action movement
- Epic landscape/rooftop visible
- Character clearly visible

DON'T ❌
- Character too small
- Background too busy
- Static when movement needed

---

### EN-A003 Point 2: Comedy Moment

**Prompt:** Anime character in a funny relatable situation (slipping on banana peel / surprised by cat / caught in awkward moment), Studio Ghibli inspired cel shaded, exaggerated comedic timing frozen moment, warm cozy lighting, rule-of-thirds composition, masterpiece best quality
**Camera:** `static` / `zoom_in`
**Lighting:** `warm_indoor`
**Mood:** Comedic, relatable, shareable

DO ✅
- Clear comedic situation
- Expression matches comedy
- Warm inviting colors

DON'T ❌
- Too dark for comedy
- Situation unclear
- Expression doesn't match

---

## 12. Entertainment — Realistic

### EN-R001 Hook: Real Life Wow

**Prompt:** Candid close-up reaction of a real person genuinely surprised and laughing at something off-camera, photorealistic hyperdetail 8K texture quality, documentary photography unposed natural moment, observational handheld, natural window light, environmental documentary framing, masterpiece best quality
**Camera:** `handheld` / `zoom_in`
**Lighting:** `natural`
**Mood:** Genuine, relatable, infectious joy

DO ✅
- Genuine unposed reaction
- Natural lighting
- Close enough to see emotion

DON'T ❌
- Looks staged / acted
- Too far away
- Harsh artificial lighting

---

### EN-R002 Point 1: Food / Aesthetic

**Prompt:** Overhead flat-lay of beautifully arranged food or drink with colorful natural ingredients, photorealistic hyperdetail 8K texture quality, aerial overhead view, natural daylight from above, clean minimal composition, masterpiece best quality
**Camera:** `aerial`
**Lighting:** `natural`
**Mood:** Aesthetic, appetizing, shareable food

DO ✅
- Natural daylight from above
- Food clearly colorful and fresh
- Clean minimal composition

DON'T ❌
- Overhead fluorescent harsh light
- Food looks wilted / unappetizing
- Too many elements

---

### EN-R003 Point 2: Pet / Animal Moment

**Prompt:** Close-up of a dog or cat doing something adorable and unexpected, photorealistic hyperdetail 8K quality, natural outdoor daylight, static shot, clean portrait composition, masterpiece best quality
**Camera:** `static`
**Lighting:** `natural`
**Mood:** Adorable, heartwarming, universal appeal

DO ✅
- Animal clearly visible and in focus
- Natural outdoor light
- Adorable unexpected moment captured

DON'T ❌
- Animal too small in frame
- Harsh artificial light
- Looks posed/staged

---

## 13. Hook / CTA Scenes

### H-C001 Hook: Pattern Interrupt — Close-Up

**Prompt:** Extreme close-up of eyes widening in surprise, cinematic film still 4K quality, shallow depth of field, dramatic chiaroscuro lighting, slow zoom in, rule-of-thirds composition, masterpiece best quality
**Camera:** `zoom_in`
**Lighting:** `dramatic`
**Mood:** Intense, pattern interrupt, must-watch
**Style:** Works for all channels

DO ✅
- Eyes clearly visible and natural
- Dramatic lighting
- Slow smooth zoom

DON'T ❌
- Overly artificial / CGI look
- Too zoomed — lose emotion context
- Neutral expression

---

### H-C002 Hook: Text Overlay Hook

**Prompt:** Bold text overlay "YOU'RE DOING IT WRONG" on a dark cinematic background with subtle particle effects, cinematic film still 4K quality, static shot, cinematic volumetric fog glow, centered composition, masterpiece best quality
**Camera:** `static`
**Lighting:** `cinematic`
**Mood:** Provocative, challenge, attention-grab
**Style:** Works for all channels

DO ✅
- Text bold and clearly readable
- Dark cinematic background
- Subtle motion implied

DON'T ❌
- Text too small
- Too many colors
- Background too busy

---

### H-C003 CTA: Subscribe Button Visual

**Prompt:** Close-up of a glowing subscribe button or notification bell on a screen, cinematic film still 4K quality, zoom in slowly, golden ambient glow, clean dark background, rule-of-thirds composition, masterpiece best quality
**Camera:** `zoom_in`
**Lighting:** `cinematic`
**Mood:** Inviting, action-oriented, follow-now
**Style:** Works for all channels

DO ✅
- Button clearly visible and glowing
- Clean dark background
- Warm inviting light

DON'T ❌
- Button blends into background
- Too much else on screen
- Cold harsh lighting

---

## 14. Transition / B-Roll Scenes

### T-C001 Transition: Smooth Fade

**Prompt:** Slow-motion close-up of water rippling or light rays through blinds, cinematic film still 4K quality, static shot, cinematic volumetric light beams, clean dark to light gradient background, masterpiece best quality
**Camera:** `static` / `zoom_out`
**Lighting:** `cinematic`
**Mood:** Transitional, meditative, smooth
**Style:** Works for all channels

DO ✅
- Water or light clearly visible
- Slow-motion implied
- Clean background

DON'T ❌
- Too fast
- Too many competing elements
- Blurry / out of focus

---

### T-C002 B-Roll: Coffee Pour

**Prompt:** Slow-motion cinematic pour of black coffee into a white mug with steam rising, cinematic film still 4K quality, shallow depth of field, golden hour warm light, overhead slight angle, rule-of-thirds composition, masterpiece best quality
**Camera:** `static`
**Lighting:** `golden_hour`
**Mood:** Satisfying, lifestyle, ASMR-ready
**Style:** Productivity, Growth

DO ✅
- Coffee pour smooth and centered
- Steam visible
- Warm golden light

DON'T ❌
- Too fast — no slow-mo feel
- Dark murky coffee color
- No steam visible

---

### T-C003 B-Roll: City Time-Lapse

**Prompt:** Time-lapse of city street with people walking, lights turning on at dusk, cars moving, cinematic film still 4K quality, aerial drone shot, blue hour cool tones twilight ambient, rule-of-thirds composition, masterpiece best quality
**Camera:** `aerial`
**Lighting:** `blue_hour`
**Mood:** Urban energy, forward momentum, pace
**Style:** Growth, Entertainment

DO ✅
- Clear time-lapse transition visible
- Blue hour blue tones dominant
- Urban energy visible

DON'T ❌
- Too dark
- Time-lapse too fast to read
- No clear subject

---

### T-C004 B-Roll: Book Pages Flipping

**Prompt:** Slow-motion close-up of book pages flipping with highlighted passages visible, cinematic film still 4K quality, shallow depth of field, slow zoom in, natural window light, rule-of-thirds composition, masterpiece best quality
**Camera:** `zoom_in`
**Lighting:** `natural`
**Mood:** Knowledge, learning, turning point
**Style:** Education, Productivity

DO ✅
- Pages clearly visible
- Highlights readable
- Natural warm light

DON'T ❌
- Pages flipping too fast
- Highlights not visible
- Harsh overhead light

---

## 15. Seed Reference for Batch Generation

When generating multiple versions of the same scene (A/B testing visual directions, style variants, or batch production), use consistent seeds for reproducibility.

### Seed Naming Convention

```
{content-type}-{style}-{scene-number}

Examples:
- productivity-cinematic-01
- growth-anime-02
- education-realistic-03
- entertainment-cinematic-01
```

### Batch Generation Template

```js
import { HailuoPromptBuilder, batch_seeds } from '../lib/prompts.js';

const hb = new HailuoPromptBuilder({ defaultStyle: 'cinematic' });
const scene = { scene_number: 1, heading: 'Hook', visual_direction: '...', shot_type: 'closeup', camera_movement: 'zoom_in' };

// Generate 4 variants from same base seed
const baseSeed = 'productivity-cinematic-01';
const seeds = batch_seeds(baseSeed, 4);

seeds.forEach((seed, i) => {
  const result = hb.build_scene_prompt(scene, 'topic', { seed });
  console.log(`Variant ${i+1}: seed=${result.seed_info.seed_string}`);
  console.log(result.image_prompt);
});
```

### Quick Reference: Style → Lighting Mappings

| Content Type | Cinematic | Anime | Realistic |
|---|---|---|---|
| **Productivity** | `golden_hour` | `neon` | `natural` |
| **Growth** | `dramatic` | `neon` | `warm_indoor` |
| **Education** | `cinematic` | `dramatic` | `natural` |
| **Entertainment** | `golden_hour` | `neon` | `natural` |
| **Hook** | `dramatic` | `neon` | `blue_hour` |
| **CTA** | `studio` | `studio` | `warm_indoor` |

### Quick Reference: Camera → Scene Type Mappings

| Scene Type | Recommended Camera | Notes |
|---|---|---|
| Hook (close-up) | `zoom_in`, `static` | Slow zoom creates intensity |
| Point (instruction) | `tracking`, `steadicam` | Follows subject naturally |
| Point (over-shoulder) | `static` | Stable instructional feel |
| B-Roll (location) | `aerial`, `dolly_side` | Establishes space |
| B-Roll (product) | `static`, `rack_focus` | Clean product focus |
| CTA | `static`, `tilt_up` | Direct confident framing |
| Transition | `zoom_out`, `static` | Pulls back for scene change |

---

*Built by Founding Engineer 2 — TKP-82*
*Companion: `lib/prompts.js` (HailuoPromptBuilder) + `video_studio_app/ai_script_generator.py` (apply_hailuo_prompts)*
