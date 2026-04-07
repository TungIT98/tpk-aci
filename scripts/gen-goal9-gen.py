#!/usr/bin/env python3
"""Generate all 60 GOAL-9 Xianxia scripts: XIANYX-171 to 230.
Uses data-driven approach: episode metadata + reusable shot templates.
"""
import json, os
from pathlib import Path

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
OUT = ROOT / "scripts" / "pending" / "xianxia"
OUT.mkdir(parents=True, exist_ok=True)

def save(data, num):
    path = OUT / f"XIANYX-{num:03d}.json"
    raw = json.dumps(data, indent=2, ensure_ascii=False)
    path.write_text(raw, encoding="utf-8")
    print(f"  Wrote {path.name}")

def make_script(id_num, episode, title, hook, story_arc, emotion, series, shots_data, tags, bg_music):
    series_clean = series.split(" Episode ")[0].strip()
    channel = series_clean
    shots = []
    hailuo_prompts = []
    prompt_parts = []
    narration_parts = []
    sfx_list = []

    for i, (time_start, prompt, camera_note, narration, sfx) in enumerate(shots_data):
        shot_num = i + 1
        time_end = time_start + 6
        shots.append({
            "shot_number": shot_num,
            "time_start": time_start,
            "time_end": time_end,
            "duration": 6,
            "prompt": prompt,
            "camera": camera_note,
            "narration": narration,
            "sfx": sfx
        })
        hailuo_prompts.append({"shot": shot_num, "prompt": prompt})
        prompt_parts.append(f"Shot {shot_num}: {prompt}")
        narration_parts.append(narration)
        sfx_list.append({"time": time_start, "sound": sfx.split(",")[0].strip(), "volume": 0.5})

    full_narration = " ".join(narration_parts)
    full_prompt = " ".join(prompt_parts)
    tag_list = [t.strip() for t in tags.split(",")]
    youtube_title = f"{title} | Xianxia Việt Sub ⚔️🔥"
    youtube_desc = (f"{title}. {hook}\n\n📌 Follow for next episode\n"
                    f"#xianxia #chinesefantasy #{series_clean.lower().replace(' ','')} #epic")
    tiktok_caption = f"{hook} ⚔️🔥 {title} | Xianxia Việt Sub #xianxia #cổtrang"

    script = {
        "id": f"XIANYX-{id_num:03d}",
        "title": title,
        "category": "xianxia",
        "channel": channel,
        "series": series_clean,
        "episode": episode,
        "audience": "Fans of Chinese fantasy, wuxia/xianxia drama viewers, 18-35 demographic who enjoy epic visual storytelling",
        "tone": "Heroic, melancholic, epic, cinematic, emotionally charged",
        "platform": ["TikTok", "YouTube Shorts"],
        "format": "30 seconds, 9:16 vertical",
        "status": "pending",
        "concept": {"hook": hook, "story_arc": story_arc, "emotion": emotion, "duration_seconds": 30},
        "shots": shots,
        "audio": {"narration": full_narration, "narration_duration": 28, "bg_music": bg_music, "sfx": sfx_list},
        "hailuo_prompts": hailuo_prompts,
        "metadata": {
            "youtube_title": youtube_title,
            "youtube_description": youtube_desc,
            "youtube_tags": tag_list,
            "tiktok_caption": tiktok_caption,
            "playlist": series_clean
        },
        "production_notes": {
            "shot_count": 5, "total_duration_seconds": 30,
            "voice": "female_poetic_deep (MiniMax speech-02-hd, speed 1.0, slight reverb)",
            "music_volume": 0.35, "voice_volume": 1, "aspect_ratio": "9:16 vertical only"
        },
        "prompt_for_hailuo": full_prompt,
        "visual_scene": " ".join([s[1] for s in shots_data]),
        "specific_details": {
            "subject": "Beautiful young woman, 18-22 years old, oval face, fair porcelain skin, high cheekbones, graceful features with a mix of fragility and inner steel",
            "outfit_exact": "Flowing Hanfu with gold embroidery patterns on hems and sleeves, wide sleeves, high waist sash, silk fabric. Ornate hairpiece crowning long black hair in an elaborate updo",
            "setting_details": "Ancient Chinese fantasy setting, misty mountains, temple courtyards, dramatic lighting",
            "face_expression": "Varied by shot — serene, determined, sorrowful, fierce as appropriate",
            "body_movement": "Graceful martial arts movements, ceremonial gestures, emotional expressions",
            "camera": "Cinematic camera movements per scene — push-ins, pans, dramatic close-ups"
        },
        "negative_prompt": "anime or cartoon style, illustrated characters, distorted hands or fingers, blurry or low resolution, text overlays or captions, logos or watermarks, modern clothing, wrong hair color, western fantasy, bright daylight midday, modern buildings, plastic-looking skin, dead eyes, stiff pose, landscape orientation, no mist or atmosphere, wrong cultural elements",
        "thumbnail_idea": f"Dramatic scene from {title}",
        "duration_seconds": 30, "resolution": "1080x1920", "fps": 24,
        "tags": tag_list, "created_by": "Nova CEO", "created_at": "2026-04-07T06:45:00Z"
    }
    return script

# ================================================================
# SHOT TEMPLATES (5 shots x 30s total, each shot ~6s)
# ================================================================

SHOTS = {
    "Ha Tien Du": [
        (0,  "Extreme wide aerial — the celestial gate towering over the mortal realm. Luân standing before it, fire mark glowing on his forehead, ice blades crossed on his back, Water of Origin glowing in his palms. Three elements in one mortal. Camera: extreme wide aerial, celestial gate, Luân dwarfed but radiant.",
         "Extreme wide aerial — celestial gate, Luân with fire mark and ice blades, Water of Origin glowing, three elements united, 6s",
         "The celestial gate had been sealed since the first gods. And he — the mortal who had mastered fire, ice, and shadow — stood before it carrying everything he had learned.",
         "Celestial gate humming, fire mark sizzling, ice blades chiming, ancient power awakening, epic orchestral swell"),
        (6,  "Wide cinematic — Luân combines fire and ice. Not opposing — COMPLEMENTING. Frost fire erupts around him — blue flames that burn cold. The most beautiful and deadly technique ever seen. Camera: wide, frost fire erupting, blue flames dancing, breathtaking elemental beauty and power.",
         "Wide — frost fire erupting, blue flames dancing around Luân, fire and ice unified, most beautiful elemental technique, 6s",
         "Fire and ice. Two elements that had warred since the beginning of time. In his hands — they danced. And the dance was more beautiful than either could be alone.",
         "Frost fire erupting, ice crystals forming in flames, two elements singing together, beautiful power hum, ethereal orchestral"),
        (12, "Close-up — Luân faces a trial within the trial. A mirror of himself made of pure shadow. 'You could have been a god,' it says. 'You chose to be a bridge.' Luân: 'Gods are alone. Bridges are not.' Camera: close-up, shadow mirror confrontation, profound dialogue.",
         "Close-up — shadow mirror confronting Luân, profound choice declared, bridges vs gods, philosophical combat, 6s",
         "The shadow showed him what he could have been: a god. Eternal. Alone. Powerful beyond measure. And he chose — again — to be the bridge. Because bridges were never alone.",
         "Shadow mirror speaking, profound echo, his calm reply, philosophical tension, mystical strings"),
        (18, "Wide — the Jade Emperor's champion appears — not to fight, but to TEST. Five questions. Each harder than the last. Luân answers each — and with each answer, he ascends higher. Camera: wide, Jade Emperor champion appearing, five questions test.",
         "Wide — Jade Emperor champion appearing, five questions test, Luân ascending higher with each answer, divine trial, 6s",
         "The five questions of heaven: What do you fight for? What do you die for? What do you live for? What do you become? And finally: Are you willing to let go?",
         "Champion appearing, divine question echoing, each answer reverberating, ascension sound, heaven responding"),
        (24, "Full-body cinematic — Luân stands at the peak. Heaven and earth meet at his feet. He raises both hands — fire, ice, and water merged into pure WHITE LIGHT. The celestial gate OPENS. Camera: full-body cinematic, heaven and earth meeting, white light erupting, celestial gate opening.",
         "Full-body cinematic — peak of heaven and earth, white light erupting from merged elements, celestial gate opening, transcendent peak, 6s",
         "He stood at the place where heaven and earth became one. And with fire, ice, and water unified in his hands — he opened the gate that had been closed since the first dawn.",
         "Gate opening grand sound, white light erupting, heaven and earth merging, divine orchestral crescendo, transcendent finale")
    ],
    "Trieu Tien": [
        (0,  "Extreme wide aerial — the Dou Di plains at sunrise. Thousands of cultivators gathered. In the center: Xiao Yan — Nine-star Dou Huang standing alone against an army of doubters. Camera: extreme wide aerial, Dou Di plains crowded, Xiao Yan alone at center, thousands watching.",
         "Extreme wide aerial — Dou Di plains at sunrise, thousands gathered, Xiao Yan alone at center, army of doubters, epic scale, 6s",
         "The Dou Di plains. Where emperors were made and pretenders were destroyed. And today — Xiao Yan would prove that a Nine-star Dou Huang was worth more than all of them combined.",
         "Crowd murmuring, doubters heckling, wind blowing across plains, epic tension, battle drums distant"),
        (6,  "Close-up — Xiao Yan channels Nine-star Dou Huang power. Nine golden stars appear above his head — each one representing a breakthrough, a battle won, a loss transformed. The crowd gasps. Camera: close-up, nine golden stars appearing above Xiao Yan.",
         "Close-up — nine golden stars appearing above head, each star milestone, crowd gasping, Nine-star Dou Huang power fully revealed, 6s",
         "Nine stars. Nine breakthroughs. Nine times he had fallen and risen. And each star above his head was not just power — it was proof that failure was just a lesson that took longer to learn.",
         "Stars igniting, breakthrough sound, crowd gasping, power revelation, golden light humming"),
        (12, "Wide cinematic — the Dou Di tournament begins. Xiao Yan faces opponent after opponent — each one stronger. He defeats them not with raw power but with the Extinction Flame — the fire that burned the old world. Camera: wide cinematic, tournament battle, Extinction Flame defeating opponents.",
         "Wide cinematic — tournament battle, Extinction Flame defeating opponents one by one, dominant victory after victory, spectacular combat, 6s",
         "The Extinction Flame. The fire that had burned the old world and allowed a new one to be born. And he wielded it not to destroy — but to make space for something better.",
         "Extinction Flame roaring, opponents falling, tournament roar, dominant battle sounds, epic orchestral crescendo"),
        (18, "Close-up — the final opponent: a Dou Zong — two full realms above him. Xiao Yan is outmatched. The Flame Sect protector speaks from within him: 'It is not your power they need. It is your example.' Camera: close-up, Dou Zong overwhelming power, Flame Sect protector voice.",
         "Close-up — Dou Zong overwhelming him, despair moment, Flame Sect protector voice, example over power turning point, 6s",
         "He was outmatched. Completely. A Dou Zong was an emperor among mortals. But the protector whispered: power was not what they needed. His example was.",
         "Power overwhelming, despair silence, protector whisper, example sound, turning point orchestral"),
        (24, "Full-body cinematic — Xiao Yan channels the FULL Extinction Flame. Not as a weapon — as a LIGHT. It illuminates the entire Dou Di plains. The Dou Zong shields his eyes. Xiao Yan wins — not by burning — by BLINDING. Camera: full-body cinematic, full Extinction Flame as light.",
         "Full-body cinematic — full Extinction Flame as blinding light, Dou Zong shielding eyes, unexpected victory by illumination not burning, 6s",
         "He won — not by being the strongest. But by being the most creative. The Extinction Flame could burn worlds. He used it to light a single moment so brightly — that even an emperor had to look away.",
         "Extinction Flame as brilliant light, Dou Zong shielding, unexpected victory sound, light spreading, triumphant orchestral finale")
    ],
    "Dau Pha Thuong Khau": [
        (0,  "Extreme wide aerial — the ancient ruins of the Flame Emperor's palace. Crumbling. Forgotten. Xiao Mei stands at the center with the Flame Emperor's memory still burning in her mind. Camera: extreme wide aerial, ruins of Flame Emperor palace, Xiao Mei alone, ancient grandeur decayed.",
         "Extreme wide aerial — ancient Flame Emperor ruins, Xiao Mei alone at center, grandeur decayed, melancholic epic scale, 6s",
         "The Flame Emperor's palace had crumbled to dust — but the memories it held burned brighter than ever. And Xiao Mei — the girl who had touched the sealed door — was the only one who remembered what it had been.",
         "Wind through ruins, dust settling, ancient grandeur silence, memory burning, melancholic orchestral swell"),
        (6,  "Wide cinematic — Xiao Yan appears — not as cultivator, but as the Flame Emperor reborn. His body literally BLAZES with the Emperor's fire. The palace ruins RECOGNIZE him. Camera: wide cinematic, Xiao Yan appearing as Flame Emperor reborn, palace ruins recognizing true heir.",
         "Wide cinematic — Xiao Yan as Flame Emperor reborn, palace ruins recognizing true heir, emperor fire blazing, ancient recognition, 6s",
         "The palace had been waiting. For a thousand years — it had waited for the Flame Emperor to return. And tonight — in Xiao Yan's body — he finally did.",
         "Palace recognizing heir, emperor fire igniting, ancient recognition sound, fire roaring, destiny fulfilled orchestral"),
        (12, "Close-up — Xiao Mei and Xiao Yan stand together. The Flame Emperor's memories SPLIT between them — half for each. 'You are not rivals,' the memories say. 'You are the two halves of what I was.' Camera: close-up, memories splitting between two, revelation of two halves.",
         "Close-up — memories splitting between Xiao Yan and Xiao Mei, two halves revelation, Flame Emperor explaining purpose, profound truth moment, 6s",
         "The Flame Emperor had been two people before he became one. His fire — and his memory. And now — they were reunited in the only way they could be: two people who carried what he had been.",
         "Memories splitting sound, two halves reuniting, Flame Emperor voice, profound truth echo, emotional orchestral swell"),
        (18, "Wide — the Ninefold Burning Heaven technique is COMPLETE. Nine transformations. Each one burning away one weakness, one doubt, one limitation. Xiao Yan becomes PURE fire. Camera: wide, Ninefold complete transformation, nine weaknesses burned away.",
         "Wide — Ninefold complete, nine weaknesses burned away, Xiao Yan becoming pure fire, nine transformations visible, peak power achieved, 6s",
         "Nine transformations. Nine weaknesses burned away. And what remained — was not a stronger version of who he had been. It was the first version of who he was always meant to become.",
         "Nine transformations sound, weaknesses burning away, pure fire achieved, nine flames dancing, peak power orchestral crescendo"),
        (24, "Full-body cinematic — Xiao Yan and Xiao Mei stand at the restored Flame Emperor palace — now BURNING with renewed life. The fire that had been dormant for a thousand years — blazed again. Camera: full-body cinematic, restored palace burning with renewed life.",
         "Full-body cinematic — restored Flame Emperor palace burning renewed, dormant fire blazing after thousand years, resurrection achieved, transcendent finale, 6s",
         "The Flame Emperor's palace burned again. Not with the fire of revenge — but with the fire of what came next. And two children stood at its center — carrying the weight of what had been — and the hope of what would be.",
         "Palace renewed fire blazing, thousand-year dormancy ending, resurrection sound, renewed hope orchestral, transcendent finale")
    ],
    "Tru Tien": [
        (0,  "Extreme wide aerial — the shadow throne room. Massive, dark, with a throne made of living shadow. Jeon Jin-Woo sits upon it — not as emperor — but as GUARDIAN. Camera: extreme wide aerial, shadow throne room, Jeon Jin-Woo seated as guardian not emperor.",
         "Extreme wide aerial — shadow throne room, throne of living shadow, Jeon Jin-Woo seated as guardian, dark grandeur, ominous scale, 6s",
         "The shadow throne. It could make him an emperor of darkness — or a guardian of light. He sat upon it — and chose: to be the bridge between shadow and light. Not to rule either.",
         "Shadow throne humming, living shadow breathing, guardian choice sound, dark grandeur, ominous orchestral"),
        (6,  "Close-up — Jeon Jin-Woo faces his shadow self — the demon king that he had absorbed. 'We are one now,' he says. 'Not master and servant — but equals.' The demon king nods. Camera: close-up, shadow self integration, equals not master, demon king acknowledging partnership.",
         "Close-up — shadow self integration, demon king acknowledging partnership, equals not master and servant, profound unity, 6s",
         "The demon king had been his enemy. His greatest fear. And now — he was his most trusted partner. Because he had learned: our greatest fears — are often our greatest teachers.",
         "Shadow integration sound, demon king nod, equals partnership echo, profound unity orchestral, mystical swell"),
        (12, "Wide cinematic — Jeon Jin-Woo raises the shadow throne's power — and uses it NOT for conquest — but to PROTECT. Shadow walls rise around cities. Shadow soldiers defend the innocent. Camera: wide cinematic, shadow power used for protection not conquest, shadow walls protecting cities.",
         "Wide cinematic — shadow power protecting not conquering, shadow walls defending cities, shadow soldiers as protectors, unprecedented use of dark power, 6s",
         "Shadow had always been used for conquest. For destruction. For fear. He turned it upside down — and used the darkest power in existence to protect. Because the best shield — was often the scariest thing on the battlefield.",
         "Shadow walls rising, protection sound, shadow soldiers defending, inverted purpose orchestral, heroic dark"),
        (18, "Close-up — the ancient demon armies ATTACK — but they ATTACK SHADOW SOLDIERS. Jeon Jin-Woo watches from the shadow throne as his shadow army defends his world. 'This is what shadow was always meant for,' he says. Camera: close-up, ancient demons attacking shadow army.",
         "Close-up — ancient demons attacking shadow army, Jeon Jin-Woo watching from throne, shadow army defending, profound statement about shadow's purpose, 6s",
         "The ancient demons had come to conquer. And they found shadow — the thing they thought was their ally — standing in their way. Turned. By the one man who understood darkness better than any of them.",
         "Ancient demons attacking, shadow army defending, Jeon Jin-Woo watching, profound shadow purpose statement, battle orchestral"),
        (24, "Full-body cinematic — Jeon Jin-Woo descends from the shadow throne — not as emperor, but as the MONARCH OF SHADOWS. A title that meant: the one who controlled darkness — so that light could survive. Camera: full-body cinematic, descent from shadow throne as Monarch of Shadows.",
         "Full-body cinematic — descent as Monarch of Shadows, darkness serving light, guardian not emperor, shadow throne transforming to protective symbol, transcendent finale, 6s",
         "He was not the emperor of shadow. He was the monarch of it — which meant he understood it completely. And what he understood most — was that the scariest darkness — was always the best guardian of the light.",
         "Descent sound, monarch title declared, shadow transforming from conquest to protection, guardian achieved, transcendent orchestral finale")
    ],
    "Thanh Van Mon": [
        (0,  "Extreme wide aerial — Glory City at dawn. Sacred Dragon Sect's ancient seals — that had held for a thousand years — begin to CRACK. Something ancient stirs beneath. Camera: extreme wide aerial, Glory City at dawn, ancient dragon seals cracking.",
         "Extreme wide aerial — Glory City at dawn, dragon seals cracking after thousand years, something ancient stirring, ominous epic scale, 6s",
         "The dragon seals had held — through wars, through dynasties, through the slow forgetting of an age. But time was finding its way through. And what slumbered beneath — was beginning to wake.",
         "Seals cracking, ancient stirring, thousand-year sleep ending, ominous rumble, epic orchestral swell"),
        (6,  "Close-up — Nie Li in the sacred archive. Reading the time regression scrolls. He discovers: the demon dimension had been sealed by HIS OWN CHOICE — in a past life. He was the one who had closed the gate. Camera: close-up, time regression scrolls revealing truth.",
         "Close-up — sacred archive, time regression scrolls revealing truth, Nie Li discovers past life choice sealed demon dimension, shocking revelation, 6s",
         "He had sealed the demon dimension. Not a god. Not an ancient hero. Him — in a life he did not remember. And now — he would have to decide whether to seal it again — or let the past decision stand.",
         "Scroll revealing, past life echoing, shocking truth discovered, time regression hum, revelation orchestral swell"),
        (12, "Wide cinematic — the demon dimension gate CRACKS OPEN. Black chaos pours through — not an army, but PURE DARK INTENT. It seeks one thing: Nie Li. The one who had imprisoned it. Camera: wide cinematic, demon gate cracking, chaos pouring through, dark intent seeking Nie Li.",
         "Wide cinematic — demon gate cracking, chaos pouring through, dark intent seeking Nie Li specifically, terrifying scale, 6s",
         "The demon dimension did not send an army. It sent INTENTION. Pure, focused, ancient malice that had been waiting a thousand years for one target: the man who had locked the door.",
         "Gate cracking, chaos pouring, ancient malice targeting, terrifying silence before attack, ominous orchestral crescendo"),
        (18, "Close-up — Nie Li stands before the gate. He has three choices: reseal it (and lose his time powers forever), fight it (and probably die), or TRANSFORM it. He chooses the third. Camera: close-up, three choices presented, transformation chosen.",
         "Close-up — three choices presented, transformation chosen over sealing or fighting, Nie Li's decisive expression, profound decision, 6s",
         "Seal it — and become mortal. Fight it — and probably lose. Transform it — and risk everything. He chose the third. Because the only thing scarier than an ancient demon dimension — was a time master with nothing left to lose.",
         "Three choices appearing, transformation choice, decisive sound, ancient risk accepted, daring orchestral"),
        (24, "Full-body cinematic — Nie Li reaches into the demon dimension — and REWINDS it. Not fighting it — REVERSING it. The chaos flows BACKWARD. The gate seals from inside. Camera: full-body cinematic, reaching into demon dimension, rewinding chaos backward, gate sealing from inside out.",
         "Full-body cinematic — reaching into demon dimension, rewinding chaos backward, gate sealing from inside out, impossible reversal, transcendent finale, 6s",
         "He did not fight the demon dimension. He simply — reversed it. And in reversing ten thousand years of malice — he proved something that even the gods had doubted: that time — was stronger than hate.",
         "Rewind sound, chaos reversing, gate sealing from inside, time triumphing over hate, transcendent orchestral finale")
    ],
    "Muc Than Ky": [
        (0,  "Extreme wide aerial — the Grand Library's forbidden floor. Five elemental doors — fire, water, earth, wind, thunder — now OPEN. All five at once. Mo Fan walks through all of them simultaneously. Camera: extreme wide aerial, all five elemental doors open simultaneously.",
         "Extreme wide aerial — all five elemental doors open simultaneously, Mo Fan walking through all at once, unprecedented event, 6s",
         "The five elemental doors had been opened one at a time for ten thousand years. Today — Mo Fan opened all five simultaneously. Because he had learned: true mastery was not about choosing one element — it was about unifying them.",
         "Five doors opening simultaneously, unprecedented event, elemental hum, his steady footsteps, epic orchestral swell"),
        (6,  "Wide cinematic — Mo Fan combines all five elements for the FIRST TIME IN HISTORY. Fire, water, earth, wind, thunder — MERGE in his five-element palms. Not five powers — ONE power. Camera: wide cinematic, all five elements merging in five-element palms.",
         "Wide cinematic — five elements merging in five-element palms, one unified power achieved, first time in history, unprecedented power, 6s",
         "Five elements. Ten thousand years of separation. In his palms — they became one. Not because he forced them — but because he finally understood what each of them had always been trying to become.",
         "Five elements merging, unified power humming, first time in history, harmony achieved, unprecedented orchestral swell"),
        (12, "Close-up — the Grand Architect's COMPLETE HISTORY appears in the library's light. Mo Fan sees: he IS the first Grand Architect. Not reborn — REMEMBERED. He always was. Camera: close-up, Grand Architect complete history, Mo Fan realizing he always was first Architect.",
         "Close-up — Grand Architect complete history appearing, complete truth revealed, Mo Fan always was first Architect, shocking full revelation, 6s",
         "He was not the reincarnation of the Grand Architect. He was not a copy. He was not a successor. He WAS the first Grand Architect — who had simply forgotten — and was now remembering.",
         "History fully revealing, complete truth echoing, realization dawning, first Architect confirmed, revelation orchestral swell"),
        (18, "Wide — Mo Fan creates from his five-element palms — not a weapon, not a technique — an ENTIRE LIBRARY. A new forbidden archive — with every element unified — accessible to everyone. Camera: wide, Mo Fan creating entire new library from five-element palms.",
         "Wide — Mo Fan creating entire new library from five-element palms, forbidden knowledge now accessible to all, revolutionary act, 6s",
         "The first Grand Architect had hoarded knowledge — because he feared it would be misused. Mo Fan undid that fear — and created a library open to all. Because the best guard against misuse — was not secrecy — but wisdom.",
         "Library materializing, knowledge becoming free, revolutionary act, wisdom replacing fear, hopeful orchestral swell"),
        (24, "Full-body cinematic — Mo Fan stands at the center of the new library — surrounded by five-element light, students learning, knowledge flowing freely. He smiles. The orphan who was told he was nothing — built a world where everyone could be something. Camera: full-body cinematic.",
         "Full-body cinematic — Mo Fan at center of new library, five-element light, students learning freely, orphan's dream achieved, transcendent finale, 6s",
         "The boy who had been told he was nothing — had built a library where everyone could become something. And at its center — surrounded by the five elements he had unified — he was finally home.",
         "Library humming, students learning, knowledge free flow, orphan's dream fulfilled, transcendent orchestral finale")
    ]
}

# ================================================================
# EPISODE DEFINITIONS
# (id, ep_num, title, hook, arc, emotion)
# ================================================================
EPISODES = [
    # Ha Tien Du (171-180)
    (171, 31, "Ha Tien Du Episode 31: The Celestial Gate", "The celestial gate had been sealed since the first gods. Tonight, Luân carried the fire mark, ice mastery, and Water of Origin — and opened it alone.", "Gate discovered → Three elements combined → Gate opens → Celestial realm → Awe", "Determination", "Ha Tien Du"),
    (172, 32, "Ha Tien Du Episode 32: The Celestial Library", "The celestial library held every secret of existence. Luân was given one hour — and chose a book of sacrifices over power techniques.", "Wonder → Offering → Choice → Discovery → Resolve", "Wonder", "Ha Tien Du"),
    (173, 33, "Ha Tien Du Episode 33: The Road Home", "Luân descended from heaven carrying the knowledge of sacrifice. The shadow empire had been waiting — and ambushed him with a thousand soldiers.", "Descent → Ambush → Alone fighting → Elemental combo → Escape", "Desperation", "Ha Tien Du"),
    (174, 34, "Ha Tien Du Episode 34: The Last Gift", "Luân returned home to find shadow already there — his people trapped. He poured his elemental mastery into the barrier — and became everything he had left.", "Return → Horror → Confrontation → Sacrifice → Safe", "Sacrifice", "Ha Tien Du"),
    (175, 35, "Ha Tien Du Episode 35: The Last Bridge", "The bridge was almost gone. The void descended. And Luân — with nothing left — became the bridge one final time.", "Weakness → Void weapon → Bridge renewed → Final stand → Held", "Heroism", "Ha Tien Du"),
    (176, 36, "Ha Tien Du Episode 36: The Eternal Water", "Luân became the eternal bridge between worlds. His body — stretched across the void — became the barrier that would never fall.", "Bridge stretched → Void pressing → Will holding → Eternal → Protected", "Transcendence", "Ha Tien Du"),
    (177, 37, "Ha Tien Du Episode 37: The Final Trial", "The celestial realm sent its final trial: not combat — but the choice to let go. Luân had to choose: stay as bridge forever — or become mortal again.", "Trial → Choice → Letting go → Mortal return → Freedom", "Resolution", "Ha Tien Du"),
    (178, 38, "Ha Tien Du Episode 38: The Mortal Return", "Luân returned to the mortal realm — no fire mark, no ice blades, no Water of Origin. Just a man. And his people — safe forever.", "Mortal return → No powers → Just a man → Safe people → Peace", "Peace", "Ha Tien Du"),
    (179, 39, "Ha Tien Du Episode 39: The Water Remembers", "Years later: the waterfall glowed. Luân — old now — sat beside it. And the water showed him: everyone he had saved, living full lives.", "Years later → Old by waterfall → Water shows → Saved lives → Gratitude", "Gratitude", "Ha Tien Du"),
    (180, 40, "Ha Tien Du Episode 40: The Eternal Spring (Finale)", "On his last day, Luân returned to the dragon gate one final time. The dragon king bowed. Heaven itself — bowed to the mortal who had become eternal.", "Last day → Dragon gate → All bow → Mortal eternal → Legend", "Legend", "Ha Tien Du"),
    # Trieu Tien (181-190)
    (181, 31, "Trieu Tien Episode 31: The Nine-Star Summit", "The Dou Di Summit: nine Nine-star Dou Huangs gathered. Xiao Yan — the youngest — was the only one who had earned his stars through failure.", "Gathering → Youngest → Stars earned through failure → Respect → Dominance", "Determination", "Trieu Tien"),
    (182, 32, "Trieu Tien Episode 32: The Flame Sect's Legacy", "The Flame Sect elders revealed: the Extinction Flame was not just a technique — it was a philosophy. To burn the old — so the new could be born.", "Legacy → Philosophy → Burning old for new → Understanding → Acceptance", "Revelation", "Trieu Tien"),
    (183, 33, "Trieu Tien Episode 33: The Dou Zong Challenge", "A Dou Zong — two full realms above — challenged Xiao Yan publicly. He accepted — and showed why technique beat raw power.", "Challenge → Accept → Technique vs power → Victory → Proof", "Triumph", "Trieu Tien"),
    (184, 34, "Trieu Tien Episode 34: The Sky Fortune Saint's Test", "The Sky Fortune Saint tested Xiao Yan one final time — with a question: 'What will you burn to build your world?'", "Test → Question → What to burn → Answer → Purpose", "Purpose", "Trieu Tien"),
    (185, 35, "Trieu Tien Episode 35: The Emperor's Decree", "Xiao Yan became the youngest Flame Emperor in history — not by conquest, but by being the first emperor who asked his people what they needed.", "Becoming emperor → Asking not commanding → People's needs → New kind → Revolution", "Revolution", "Trieu Tien"),
    (186, 36, "Trieu Tien Episode 36: The Imperial Palace Fire", "Xiao Yan set fire to his own imperial palace — to prove that an emperor who could let go of comfort — could never be corrupted.", "Palace fire → Letting go comfort → Cannot be corrupted → Proof → Trust", "Integrity", "Trieu Tien"),
    (187, 37, "Trieu Tien Episode 37: The War of Philosophies", "Other empires attacked — not the body, but the philosophy. Xiao Yan's way of burning old things threatened the foundations of power everywhere.", "War of philosophies → Burning old threatens power → Defense → New philosophy → Victory", "Conflict", "Trieu Tien"),
    (188, 38, "Trieu Tien Episode 38: The Flame Sect Reunites", "The Flame Sect — scattered for a thousand years — reunited under Xiao Yan. Not as army — as family.", "Reunion → Scattered sect → Family not army → Reunited → Strength", "Family", "Trieu Tien"),
    (189, 39, "Trieu Tien Episode 39: The Dou Di Congress", "Xiao Yan called the first Dou Di Congress — all realms, all factions. He proposed: no more wars fought over what could be shared.", "Congress → All realms → Sharing not warring → Proposal → Beginning", "Hope", "Trieu Tien"),
    (190, 40, "Trieu Tien Episode 40: The Eternal Flame (Finale)", "On his last day as emperor, Xiao Yan passed the Extinction Flame to the next generation — not as a weapon, but as a promise: that burning old things — was always so something better could begin.", "Last day → Passing flame → Promise → New beginning → Eternal", "Legacy", "Trieu Tien"),
    # Dau Pha Thuong Khau (191-200)
    (191, 31, "Dau Pha Thuong Khau Episode 31: The Emperor's Tomb Opens", "Xiao Mei touched the Emperor's tomb — and it opened. Inside: not a body — but the Flame Emperor's final lesson, preserved for a thousand years.", "Tomb opens → Not body → Final lesson → Preserved → Waiting", "Revelation", "Dau Pha Thuong Khau"),
    (192, 32, "Dau Pha Thuong Khau Episode 32: The Ninefold Complete", "Xiao Yan completed the Ninefold Burning Heaven — all nine transformations achieved. The Flame Emperor's full legacy — finally inherited.", "Ninefold complete → All nine → Full legacy → Inherited → Complete", "Achievement", "Dau Pha Thuong Khau"),
    (193, 33, "Dau Pha Thuong Khau Episode 33: The Memory Bridge", "Xiao Mei and Xiao Yan together became the memory bridge — connecting past emperor to future world. Two children — carrying a thousand years.", "Memory bridge → Two children → Past to future → Connected → Carrying", "Connection", "Dau Pha Thuong Khau"),
    (194, 34, "Dau Pha Thuong Khau Episode 34: The Palace Reborn", "The Flame Emperor's palace — restored