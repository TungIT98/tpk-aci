#!/usr/bin/env python3
"""Generate all 60 GOAL-9 Xianxia scripts: XIANYX-171 to XIANYX-230.
Nova (CEO) — TKP-2961
Episodes 31-40 — Final Arcs for all 6 series
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

def make_script(id_num, episode, title, hook, story_arc, emotion,
               scenes, tags, bg_music, youtube_title, youtube_desc=None, tiktok_caption=None):
    series = title.split(" Episode ")[0].strip()
    channel = series
    shots = []
    hailuo_prompts = []
    prompt_parts = []
    narration_parts = []
    sfx_list = []

    for i, (time_start, prompt, camera, narration, sfx) in enumerate(scenes):
        shot_num = i + 1
        time_end = time_start + 6
        shots.append({
            "shot_number": shot_num,
            "time_start": time_start,
            "time_end": time_end,
            "duration": 6,
            "prompt": prompt,
            "camera": camera,
            "narration": narration,
            "sfx": sfx
        })
        hailuo_prompts.append({"shot": shot_num, "prompt": prompt})
        prompt_parts.append(f"Shot {shot_num}: {prompt}")
        narration_parts.append(narration)
        sfx_list.append({"time": time_start, "sound": sfx.split(",")[0].strip(), "volume": 0.5})

    full_narration = " ".join(narration_parts)
    full_prompt = " ".join(prompt_parts)
    if youtube_desc is None:
        youtube_desc = (f"{title}. {hook}\n\n"
                        f"📌 Follow for next episode\n"
                        f"#xianxia #chinesefantasy #{series.lower().replace(' ','')} #epic")
    if tiktok_caption is None:
        tiktok_caption = f"{hook} ⚔️🔥 {title} | Xianxia Việt Sub #xianxia #cổtrang"
    tag_list = [t.strip() for t in tags.split(",")]

    script = {
        "id": f"XIANYX-{id_num:03d}",
        "title": title,
        "category": "xianxia",
        "channel": channel,
        "series": series,
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
            "playlist": series
        },
        "production_notes": {
            "shot_count": 5, "total_duration_seconds": 30,
            "voice": "female_poetic_deep (MiniMax speech-02-hd, speed 1.0, slight reverb)",
            "music_volume": 0.35, "voice_volume": 1, "aspect_ratio": "9:16 vertical only"
        },
        "prompt_for_hailuo": full_prompt,
        "visual_scene": " ".join([s[1] for s in scenes]),
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


# ============================================================
# HA TIEN DU Episodes 31-40 (XIANYX-171 to 180)
# Luân completes elemental mastery, faces the Jade Emperor, celestial climax
# ============================================================
HTD_E31_40 = [
    (171, 31, "Ha Tien Du Episode 31: The Celestial Gate",
     "The celestial gate had been sealed since the first gods. Tonight, Luân carried the fire mark, the ice mastery, and the water of origin — and opened it alone.",
     "Celestial gate discovered → Luân approaches alone → Fire, ice, water combined → Gate opens → Celestial realm revealed",
     "Determination → Solo approach → Elemental power → Gateway opening → Awe",
     [
         (0,  "Extreme wide aerial — the celestial gate. Massive, ancient, carved with the script of creation itself. Standing before it: Luân alone. Fire mark on his forehead, ice blades on his back, Water of Origin in his hands. Camera: extreme wide aerial, celestial gate towering, Luân dwarfed but determined, cosmic scale. 6 seconds.",
          "Extreme wide aerial — celestial gate towering, Luân alone before it, fire mark glowing, ice blades ready, Water of Origin in hands, 6s",
          "The celestial gate. Sealed since the first gods. And he — the mortal who had walked through fire, mastered ice, and healed shadow — stood before it alone.",
          "Celestial gate humming, ancient script glowing, wind howling, his steady breath, epic orchestral swell"),
         (6,  "Wide cinematic — Luân raises the Water of Origin. The ice blades respond. The fire mark burns. Three elements combine into a WHITE LIGHT that engulfs the gate. Ancient locks begin to BREAK. Camera: wide, three elements combining into white light, ancient locks cracking, gate responding, 6 seconds.",
          "Wide — three elements combining into white light, ancient locks cracking, celestial gate responding, cosmic power display, 6s",
          "Fire, ice, and water. Three elements that should have destroyed each other. In his hands — they sang. And the celestial gate remembered what it felt like to bow to a mortal.",
          "Three elements merging, locks cracking, ancient mechanism groaning, white light humming, power crescendo"),
         (12, "Full-body cinematic — the gate OPENS. Beyond it: the celestial realm. Floating islands of pure light. Palaces of living starlight. Gods in human form walking gardens of eternity. Luân steps through. Camera: full-body cinematic, Luân stepping through celestial gate, entering the realm of gods, transcendent moment. 6 seconds.",
          "Full-body cinematic — celestial gate opening wide, realm of gods revealed, floating islands of light, Luân stepping through, transcendent entry, 6s",
          "He stepped through the celestial gate — and heaven itself fell silent. A mortal. Standing in the realm of immortals. And they could not look away.",
          "Gate opening grand sound, celestial realm reveal, ethereal choir, his footsteps on sacred ground, reverent silence"),
         (18, "Close-up — the Jade Emperor appears. Not a warrior. A scholar. Ancient, calm, with eyes that held the birth of stars. He looks at Luân — and smiles. 'You are the first in ten thousand years to open it alone.' Camera: close-up, Jade Emperor appearing, his ancient calm smile, Luân in awe, 6 seconds.",
          "Close-up — Jade Emperor appearing as ancient scholar, eyes holding birth of stars, his calm smile, Luân in awe, 6s",
          "The Jade Emperor was not a warrior god. He was older. Calmer. He had watched stars be born and had the patience to wait for one mortal who was finally worthy.",
          "Jade Emperor appearing, ancient calm voice, stars in eyes, gentle wind, scholarly peaceful presence"),
         (24, "Wide — Luân bows. Deeply. The Jade Emperor returns it. In that bow: not submission, but mutual respect between two beings who had mastered their craft. The Jade Emperor gestures to a palace of light. 'Welcome, Luân. You have earned your place.' Camera: wide, mutual bow between mortal and emperor, palace of light welcoming, 6 seconds.",
          "Wide — mutual bow between Luân and Jade Emperor, palace of light welcoming gesture, equality not submission, honored welcome, 6s",
          "The Jade Emperor bowed to him. Not as a subject. As an equal who had earned the right to stand in heaven through blood, fire, and absolute dedication.",
          "Mutual bow sound, palace welcoming hum, equality acknowledged, celestial orchestral finale")
     ],
     "xianxia, ha tien du, celestial gate, luân, jade emperor, elemental mastery, chinese fantasy",
     "Epic Chinese celestial orchestral, celestial gate opening, three elements united, jade emperor greeting, transcendent 95 BPM",
     "Ha Tien Du Tập 31: Cổng Trời | Xianxia Việt Sub ⚔️🌊",
     "Episode 31 of Ha Tien Du. The celestial gate had been sealed since the first gods. Luân carried the fire mark, ice mastery, and Water of Origin — and opened it alone. The Jade Emperor himself welcomed him.",
     "Cổng trời được phong tỏa từ thuở các vị thần đầu tiên. Luân mang dấu lửa, tinh thông băng, và Thủy Khởi Nguyên — và mở nó một mình. Ngọc Đế chào đón anh ⚔️🌊 Tập 31 Ha Tien Du #xianxia #cổtrang"),

    (172, 32, "Ha Tien Du Episode 32: The Celestial Library",
     "The celestial library held every secret of existence — past, present, and future. The Jade Emperor gave Luân one hour to read whatever he wished. Luân chose: how to save his world.",
     "Celestial library revealed → Jade Emperor offers knowledge → Luân chooses sacrifice over power → Secret found → Return decided",
     "Wonder → Offering → Choice → Discovery → Resolve",
     [
         (0,  "Wide establishing — the celestial library. Infinite shelves of light stretching into infinity. Each book bound in starlight. Luân walks in, his shadow the only dark thing in a realm of eternal light. Camera: wide, infinite celestial library, Luân's shadow the only darkness, breathtaking scale. 6 seconds.",
          "Wide — infinite celestial library stretching into eternity, books of starlight, Luân's shadow the only darkness, humbling scale, 6s",
          "The celestial library held every secret of existence. Every war that had been fought. Every love that had been lost. Every choice that had shaped worlds. And he had one hour.",
          "Celestial library ambient, infinite shelves humming, starlight books glowing, his footsteps echoing, mystical wonder"),
         (6,  "Close-up — the Jade Emperor beside him. 'You may read any book. Past, present, future. Power techniques. Lost languages. The name of every star.' Luân looks at the infinite shelves. Camera: close-up, infinite choices, Luân's thoughtful expression, Jade Emperor waiting patiently, 6 seconds.",
          "Close-up — infinite knowledge choices, Luân's thoughtful face, Jade Emperor patient offering, overwhelming options, 6s",
          "Power techniques. Lost languages. The names of stars. Every secret the gods had hoarded for eternity. And the Jade Emperor offered them freely.",
          "Knowledge humming, infinite possibilities, his thoughtful silence, Jade Emperor patient breath, anticipation building"),
         (12, "Wide cinematic — Luân walks past power techniques. Past star maps. Past ancient languages. He stops at a small, dark shelf — labeled: 'Sacrifices That Changed Worlds.' He takes one book. Camera: wide, Luân walking past grandeur to reach dark shelf of sacrifices, humble choice, 6 seconds.",
          "Wide — Luân walking past power and grandeur to dark shelf labeled sacrifices, humble book chosen, profound choice, 6s",
          "Power techniques were for those who wanted to dominate. He had never wanted to dominate. He wanted to save. And the book of sacrifices was the only one that taught how to do that.",
          "Walking past grandeur, choosing humble path, book of sacrifices humming, profound silence, emotional swell"),
         (18, "Close-up — Luân reads. The book shows him his world. The waterfall. His people. The coming darkness. And one path: he could pour his elemental mastery back into the world — and save everyone. Camera: close-up, Luân reading the sacrifice path, tears forming, world revealed in book, 6 seconds.",
          "Close-up — book revealing sacrifice path, his world in pages, tears forming, understanding the cost, 6s",
          "He could save them. All of them. By becoming what he had always been: a bridge. And bridges, when their purpose was done — let go.",
          "Book revealing, world in pages, his tears, understanding dawning, emotional weight settling"),
         (24, "Wide cinematic — Luân closes the book. He bows to the Jade Emperor. 'I have found my answer.' The Jade Emperor nods — with what looks like grief and pride. Camera: wide, book closed, bow of decision made, Jade Emperor's mixed grief and pride, destined farewell. 6 seconds.",
          "Wide — book closed, bow of decision made, Jade Emperor nodding with grief and pride, destined farewell moment, 6s",
          "He had come to heaven seeking power. He left it carrying something heavier: the knowledge of how to save everyone — by giving up everything.",
          "Book closing, bow sound, Jade Emperor grief pride nod, destined farewell orchestral, tearful finale")
     ],
     "xianxia, ha tien du, celestial library, luân, jade emperor, sacrifice, chinese fantasy",
     "Emotional Chinese orchestral, celestial library theme, sacrifice over power, jade emperor farewell, tearful 85 BPM",
     "Ha Tien Du Tập 32: Thư Viện Trời | Xianxia Việt Sub ⚔️🌊",
     "Episode 32 of Ha Tien Du. The celestial library held every secret of existence. Luân was given one hour to read whatever he wished — and chose a book of sacrifices over power techniques.",
     "Thư viện trời nắm giữ mọi bí mật của vũ trụ. Luân được chọn bất kỳ cuốn sách nào — và anh chọn quyển sách về sự hy sinh thay vì các chiêu thức quyền năng ⚔️🌊 Tập 32 Ha Tien Du #xianxia #cổtrang"),

    (173, 33, "Ha Tien Du Episode 33: The Road Home",
     "Luân descended from heaven carrying the knowledge of sacrifice. But the path home was not empty — the shadow empire had rebuilt, and they had been waiting for him to leave.",
     "Descending from heaven → Shadow empire ambush → Alone vs shadow army → Fire, ice, water together → Breakthrough escape",
     "Descent → Ambush → Alone fighting → Elemental combination → Escape",
     [
         (0,  "Wide aerial — Luân descending from the celestial gate. The world below: his kingdom, his waterfall, his people. He drifts downward through clouds. Peaceful. Camera: wide aerial, descent through clouds toward homeland, peaceful moment, bittersweet atmosphere. 6 seconds.",
          "Wide aerial — descent through clouds toward homeland, Luân drifting peacefully, his world below, bittersweet atmosphere, 6s",
          "He was going home. Not as a god. Not as an emperor. As the bridge he had always been — carrying the knowledge of how to save everyone.",
          "Wind rushing, cloud passage, homeland appearing below, peaceful descent, bittersweet orchestral"),
         (6,  "Wide — the shadow empire AMBUSHES. A thousand shadow soldiers rise from the clouds around him. They had been waiting. They had been learning. And they had one goal: stop the bridge. Camera: wide, shadow army emerging from clouds, ambush sprung, Luân surrounded, 6 seconds.",
          "Wide — shadow army emerging from clouds, ambush sprung, Luân surrounded by thousands, deadly intent, 6s",
          "They had been waiting for him to leave heaven. Shadow learned patience in the darkness. And they knew: the bridge was the only thing standing between them and total consumption.",
          "Shadow army erupting, ambush roar, deadly silence before attack, shadow soldiers humming, attack begins"),
         (12, "Wide cinematic — Luân fights ALONE against a thousand. Fire blades. Ice shields. Water arrows. He becomes a one-man army — three elements dancing around him in perfect harmony. Camera: wide cinematic, one-man elemental army, three elements in perfect harmony, shadow soldiers falling, breathtaking combat. 6 seconds.",
          "Wide cinematic — one-man army, three elements in perfect harmony, fire ice water dancing, shadow soldiers falling, breathtaking solo combat, 6s",
          "Fire, ice, water. Three elements that had tried to destroy each other for eons. In him — they became a symphony. And shadow had never faced a symphony before.",
          "Combat eruption, three elements singing, shadow soldiers falling, combat orchestral crescendo, his battle cry"),
         (18, "Close-up — Luân realizes he cannot defeat them all. Not quickly enough. He makes a choice: he BLASTS through the center of the army — not to kill, but to BREAK THROUGH. Camera: close-up, decision to break through rather than fight, elemental blast at center of army, desperate escape choice, 6 seconds.",
          "Close-up — decision to blast through army center, elemental explosion at shadow army center, desperate break-through choice, 6s",
          "A thousand shadow soldiers. He could fight them — for hours. Days. But every hour was another hour his people waited for a bridge that had not yet returned.",
          "Decision moment, shadow army pressing, his resolve hardening, elemental energy gathering, decisive action"),
         (24, "Full-body cinematic — Luân ERUPTS through the shadow army. Fire, ice, water combining into a dragon of light that tears through the darkness. He emerges on the other side — bleeding, exhausted, but FREE. Camera: full-body cinematic, dragon of light tearing through shadow army, Luân emerging free but wounded, desperate escape achieved. 6 seconds.",
          "Full-body cinematic — dragon of light tearing through shadow army, emergence free but bleeding, desperate escape achieved, 6s",
          "He erupted through the shadow army like a comet through darkness — leaving a trail of light in his wake. He was free. Bleeding, exhausted, but free. And home was closer now.",
          "Explosion through army, dragon of light roar, shadow army scattering, emergence sound, desperate relief orchestral")
     ],
     "xianxia, ha tien du, shadow empire, luân, elemental combat, escape, chinese fantasy",
     "Epic Chinese battle orchestral, shadow ambush, three-element combat symphony, desperate escape, bleeding but free 100 BPM",
     "Ha Tien Du Tập 33: Đường Về Nhà | Xianxia Việt Sub ⚔️🌊",
     "Episode 33 of Ha Tien Du. Luân descended from heaven carrying the knowledge of sacrifice. The shadow empire had been waiting — and ambushed him with a thousand soldiers. He fought through alone.",
     "Luân từ trời xuống mang theo kiến thức về sự hy sinh. Đế chế bóng tối đã đợi sẵn — và phục kích anh với một ngàn binh sĩ. Anh chiến đấu một mình và phá vây ⚔️🌊 Tập 33 Ha Tien Du #xianxia #cổtrang"),

    (174, 34, "Ha Tien Du Episode 34: The Last Gift",
     "Luân returned to the waterfall — and found that the shadow had already reached his home. His people were trapped. And he had one gift left: himself.",
     "Returning home → Shadow already there → People trapped → Final confrontation → Gift of self",
     "Return → Horror → Urgency → Confrontation → Sacrifice",
     [
         (0,  "Wide establishing — the waterfall. His home. His sanctuary. Shadow consuming the edges. People trapped at the center, behind a failing water barrier. Luân lands — and sees the horror. Camera: wide establishing, waterfall consumed by shadow, people trapped behind failing barrier, Luân's horrified landing, 6 seconds.",
          "Wide establishing — waterfall home consumed by shadow, people trapped behind failing barrier, Luân's horrified arrival, 6s",
          "The shadow had been faster. His people — his family — trapped in the one place he thought was safe. And the water barrier that protected them was dying.",
          "Shadow consuming, barrier cracking, people screaming, water barrier failing, horrified arrival"),
         (6,  "Close-up — the failing water barrier. Luân's mother had created it. Now it cracked. The shadow pressed against it. The people inside: the children he had grown up with. The elders who had told him stories. Camera: close-up, barrier cracking, shadow pressing, faces of people he loves behind it, 6 seconds.",
          "Close-up — barrier cracking under shadow pressure, faces of loved ones behind it, children's fear, desperate situation, 6s",
          "The water barrier had been his mother's last act of protection. For twenty years it had held. But shadow was patient — and tonight — it had finally found a way through.",
          "Barrier cracking sound, shadow pressing, children's fear, desperate tension, ominous orchestral"),
         (12, "Wide cinematic — Luân steps forward. The shadow sees him — and RECOILS. They remember him. The mortal who had destroyed their first empire. The bridge who had united fire, ice, and water. Camera: wide, shadow recoiling from Luân, his elemental power intimidating shadow, people watching in hope, 6 seconds.",
          "Wide — shadow recoiling from Luân, his elemental power intimidating shadow, people watching in hope, protective moment, 6s",
          "The shadow remembered him. And for the first time — shadow felt something it had not felt in ten thousand years: fear. Not of his power. Of what he was willing to become.",
          "Shadow recoiling, ancient fear sound, people gasping in hope, his presence dominating, protective orchestral"),
         (18, "Close-up — Luân raises his hands. Fire, ice, water rise around him — the three elements he had mastered. But instead of attacking — he POURS them into the barrier. Strengthen it. Camera: close-up, three elements poured into barrier, barrier strengthening, his life force draining, 6 seconds.",
          "Close-up — three elements poured into barrier, barrier becoming unbreakable, his life force visibly draining, noble sacrifice, 6s",
          "He poured his mastery into the barrier — not as a weapon, but as a shield. And with every element he gave — he felt himself becoming less. But the barrier became more.",
          "Elements flowing into barrier, barrier strengthening glow, his life draining, people gasping, noble sound"),
         (24, "Full-body cinematic — the barrier becomes unbreakable. Luân falls to his knees — diminished, fading, but smiling. The shadow attacks the barrier — and CANNOT BREAK IT. His people are safe. Camera: full-body cinematic, barrier unbreakable, Luân on knees smiling, shadow attacking futile barrier, SAFE. 6 seconds.",
          "Full-body cinematic — barrier unbreakable, Luân kneeling smiling, shadow attacks futile, people safe, final salvation achieved, 6s",
          "The bridge had held. One last time. And as he knelt — weaker than he had ever been — he had never felt more complete.",
          "Barrier unbreakable sound, shadow attacking futile, his gentle smile, safety achieved, emotional orchestral finale")
     ],
     "xianxia, ha tien du, luân, sacrifice, waterfall, shadow empire, chinese fantasy",
     "Deeply emotional Chinese orchestral, sacrifice theme, barrier strengthened, luân diminished but smiling, salvation achieved 80 BPM",
     "Ha Tien Du Tập 34: Món Quà Cuối Cùng | Xianxia Việt Sub ⚔️🌊",
     "Episode 34 of Ha Tien Du. Luân returned home to find shadow already there — his people trapped. He poured his elemental mastery into the barrier, weakening himself but making it unbreakable.",
     "Luân về nhà và thấy bóng tối đã ở đó — người dân bị mắc kẹt. Anh đổ tinh thông nguyên tố vào rào cản, làm yếu bản thân nhưng khiến nó bất khả phá. Người dân được an toàn ⚔️🌊 Tập 34 Ha Tien Du #xianxia #cổtrang"),

    (175, 35, "Ha Tien Du Episode 35: The Last Bridge",
     "The bridge was almost gone. But the shadow empire was not finished. They brought their final weapon: the void itself. And Luân — with nothing left — became the bridge one final time.",
     "Bridge almost gone → Void weapon arrives → Luân with nothing left → Becomes bridge again → Final stand",
     "Weakness → Ultimate weapon → Nothing left → Bridge renewed → Final stand",
     [
         (0,  "Wide — the void descends. Not shadow — VOID. The absence of everything. It consumes the shadow itself. And it moves toward the barrier — toward Luân's people. Luân, on his knees, looks up. Camera: wide, void descending, absence consuming shadow, terrifying erasure, Luân looking up from knees. 6 seconds.",
          "Wide — void descending, absence consuming everything including shadow, terrifying erasure, Luân looking up from knees, 6s",
          "The void. Not darkness. Not shadow. The absence of existence itself. It did not attack barriers. It simply made them — and everything behind them — cease to have ever been.",
          "Void humming, erasure sound, shadow being consumed, terrifying silence, void approaching"),
         (6,  "Close-up — Luân's hands — empty. His fire mark — gone. His ice blades — dissolved. His water of origin — spent. He had NOTHING left. But the void was coming. Camera: close-up, empty hands, all powers spent, nothing left, void approaching relentlessly, 6 seconds.",
          "Close-up — empty hands, all powers spent and gone, nothing left to fight with, void approaching, desperate helplessness, 6s",
          "He had nothing. No fire. No ice. No water. He had given everything to save them. And now — the void came for what was left.",
          "Empty silence, powers gone, void approaching, desperate helplessness, tension building orchestral"),
         (12, "Wide cinematic — Luân rises. Slowly. Not with power — with PURPOSE. He opens his arms. 'If I have nothing — then I will become the bridge with my BODY.' He walks toward the void. Camera: wide cinematic, slow rise with purpose not power, opening arms as bridge, walking toward void, desperate heroism. 6 seconds.",
          "Wide cinematic — slow rise with purpose, opening arms as bridge, walking toward void, body as bridge, desperate ultimate heroism, 6s",
          "If he had no power left — he would become a bridge with his body. And if the void consumed him — it would have to go through him to reach them. And he would hold. As long as he could.",
          "Rise with purpose, body as bridge sound, walking toward void, desperate heroism orchestral, his steady footsteps"),
         (18, "Full-body — Luân MEETS the void. He becomes the bridge — not of elements, but of WILL. His body stretched between the void and his people. The void pushed — and could not pass. Camera: full-body, body as bridge between void and people, void pushing against human will, holding the line. 6 seconds.",
          "Full-body — body stretched as bridge between void and people, void pushing against human will, cannot pass, holding by willpower alone, 6s",
          "The void pushed. And pushed. And pushed. And a mortal — with no powers, no fire, no ice, no water — held it back with the only thing he had left: absolute, stubborn, infinite will.",
          "Void pressing, human will holding, struggle sound, his grunt of effort, impossible resistance orchestral"),
         (24, "Wide — the void SURROUNDED him but could not pass. Luân — stretched thin, fading, but UNBROKEN — became the eternal bridge. His people behind him: safe. Always. Camera: wide, void surrounding but cannot pass, Luân stretched thin but unbroken, eternal bridge achieved, people safe forever. 6 seconds.",
          "Wide — void surrounding but cannot pass, Luân stretched thin but unbroken, eternal bridge achieved, people safe forever, transcendent finale, 6s",
          "The bridge had become the bridge. Not metaphor. Not symbol. ETERNITY. And as long as his will held — they would be safe. Always.",
          "Void surrounding sound, eternal bridge hum, will holding forever, people safe, transcendent eternal finale")
     ],
     "xianxia