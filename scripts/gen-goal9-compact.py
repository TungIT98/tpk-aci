#!/usr/bin/env python3
"""Generate all 60 GOAL-9 Xianxia scripts: XIANYX-171 to 230.
Nova (CEO) — Episodes 31-40 for all 6 series.
Uses templated shots per series for efficiency.
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

# ============================================================
# SERIES TEMPLATES: 5 shots each reused across episodes 31-40
# Each tuple: (time_start, visual_prompt, camera_note, narration, sfx)
# ============================================================

SERIES_TEMPLATES = {
    "Ha Tien Du": {
        "channel": "Ha Tien Du",
        "protagonist": "Luân",
        "shots": [
            (0,  "Extreme wide aerial — celestial gate towering over the mortal realm. Luân standing before it, fire mark glowing on his forehead, ice blades crossed on his back, Water of Origin glowing in his palms. Three elements in one mortal. Camera: extreme wide aerial, celestial gate, Luân dwarfed but radiant, cosmic scale.",
             "Extreme wide aerial — celestial gate towering, Luân with fire mark and ice blades, Water of Origin glowing, three elements united, 6s",
             "The celestial gate had been sealed since the first gods. And he — the mortal who had mastered fire, ice, and shadow — stood before it carrying everything he had learned.",
             "Celestial gate humming, fire mark sizzling, ice blades chiming, ancient power awakening, epic orchestral swell"),
            (6,  "Wide cinematic — Luân combines fire and ice. Not opposing — COMPLEMENTING. Frost fire erupts around him — blue flames that burn cold. The most beautiful and deadly technique ever seen. Camera: wide, frost fire erupting, blue flames dancing, breathtaking elemental beauty and power, 6 seconds.",
             "Wide — frost fire erupting, blue flames dancing around Luân, fire and ice unified, most beautiful elemental technique ever seen, 6s",
             "Fire and ice. Two elements that had warred since the beginning of time. In his hands — they danced. And the dance was more beautiful than either could be alone.",
             "Frost fire erupting, ice crystals forming in flames, two elements singing together, beautiful power hum, ethereal orchestral"),
            (12, "Close-up — Luân faces a trial within the trial. A mirror of himself made of pure shadow. 'You could have been a god,' it says. 'You chose to be a bridge.' Luân: 'Gods are alone. Bridges are not.' Camera: close-up, shadow mirror confrontation, profound dialogue, philosophical battle, 6 seconds.",
             "Close-up — shadow mirror confronting Luân, profound choice declared, bridges vs gods, philosophical combat, 6s",
             "The shadow showed him what he could have been: a god. Eternal. Alone. Powerful beyond measure. And he chose — again — to be the bridge. Because bridges were never alone.",
             "Shadow mirror speaking, profound echo, his calm reply, philosophical tension, mystical strings"),
            (18, "Wide — the Jade Emperor's champion appears — not to fight, but to TEST. Five questions. Each harder than the last. Luân answers each — and with each answer, he ascends higher. Camera: wide, Jade Emperor champion appearing, five questions test, Luân ascending higher with each correct answer, 6 seconds.",
             "Wide — Jade Emperor champion appearing, five questions test, Luân ascending higher with each answer, divine trial, 6s",
             "The five questions of heaven: What do you fight for? What do you die for? What do you live for? What do you become? And finally: Are you willing to let go?",
             "Champion appearing, divine question echoing, each answer reverberating, ascension sound, heaven responding"),
            (24, "Full-body cinematic — Luân stands at the peak. Heaven and earth meet at his feet. He raises both hands — fire, ice, and water merged into pure WHITE LIGHT. The celestial gate OPENS. Camera: full-body cinematic, heaven and earth meeting at his feet, white light erupting, celestial gate opening, transcendent finale. 6 seconds.",
             "Full-body cinematic — peak of heaven and earth, white light erupting from merged elements, celestial gate opening, transcendent peak achieved, 6s",
             "He stood at the place where heaven and earth became one. And with fire, ice, and water unified in his hands — he opened the gate that had been closed since the first dawn.",
             "Gate opening grand sound, white light erupting, heaven and earth merging, divine orchestral crescendo, transcendent finale")
        ],
        "tags": "xianxia, ha tien du, luân, celestial gate, jade emperor, frost fire, elemental unity, chinese fantasy",
        "bg_music": "Epic Chinese celestial orchestral, frost fire theme, celestial gate, jade emperor test, transcendent unity 95 BPM"
    },
    "Trieu Tien": {
        "channel": "Trieu Tien",
        "protagonist": "Xiao Yan",
        "shots": [
            (0,  "Extreme wide aerial — the Dou Di plains at sunrise. Thousands of cultivators gathered. In the center: Xiao Yan — Nine-star Dou Huang standing alone against an army of doubters. Camera: extreme wide aerial, Dou Di plains crowded, Xiao Yan alone at center, thousands watching, epic scale.",
             "Extreme wide aerial — Dou Di plains at sunrise, thousands gathered, Xiao Yan alone at center, army of doubters, epic scale, 6s",
             "The Dou Di plains. Where emperors were made and pretenders were destroyed. And today — Xiao Yan would prove that a Nine-star Dou Huang was worth more than all of them combined.",
             "Crowd murmuring, doubters heckling, wind blowing across plains, epic tension, battle drums distant"),
            (6,  "Close-up — Xiao Yan channels Nine-star Dou Huang power. Nine golden stars appear above his head — each one representing a breakthrough, a battle won, a loss transformed. The crowd gasps. Camera: close-up, nine golden stars appearing above Xiao Yan, each star a milestone, crowd gasping, power revelation, 6 seconds.",
             "Close-up — nine golden stars appearing above head, each star milestone, crowd gasping, Nine-star Dou Huang power fully revealed, 6s",
             "Nine stars. Nine breakthroughs. Nine times he had fallen and risen. And each star above his head was not just power — it was proof that failure was just a lesson that took longer to learn.",
             "Stars igniting, breakthrough sound, crowd gasping, power revelation, golden light humming"),
            (12, "Wide cinematic — the Dou Di tournament begins. Xiao Yan faces opponent after opponent — each one stronger. He defeats them not with raw power but with the Extinction Flame — the fire that burned the old world. Camera: wide cinematic, tournament battle after battle, Extinction Flame defeating opponents, dominant performance, 6 seconds.",
             "Wide cinematic — tournament battle, Extinction Flame defeating opponents one by one, dominant victory after victory, spectacular combat, 6s",
             "The Extinction Flame. The fire that had burned the old world and allowed a new one to be born. And he wielded it not to destroy — but to make space for something better.",
             "Extinction Flame roaring, opponents falling, tournament roar, dominant battle sounds, epic orchestral crescendo"),
            (18, "Close-up — the final opponent: a Dou Zong — two full realms above him. Xiao Yan is outmatched. The Flame Sect protector speaks from within him: 'It is not your power they need. It is your example.' Camera: close-up, Dou Zong overwhelming power, Flame Sect protector voice, turning point, 6 seconds.",
             "Close-up — Dou Zong overwhelming him, despair moment, Flame Sect protector voice, example over power turning point, 6s",
             "He was outmatched. Completely. A Dou Zong was an emperor among mortals. And he — was still just a Dou Huang. But the protector whispered: power was not what they needed. His example was.",
             "Power overwhelming, despair silence, protector whisper, example sound, turning point orchestral"),
            (24, "Full-body cinematic — Xiao Yan channels the FULL Extinction Flame. Not as a weapon — as a LIGHT. It illuminates the entire Dou Di plains. The Dou Zong shields his eyes. Xiao Yan wins — not by burning — by BLINDING. Camera: full-body cinematic, full Extinction Flame as light blinding Dou Zong, unexpected victory, Dou Di plains illuminated, 6 seconds.",
             "Full-body cinematic — full Extinction Flame as blinding light, Dou Zong shielding eyes, unexpected victory by illumination not burning, 6s",
             "He won — not by being the strongest. But by being the most creative. The Extinction Flame could burn worlds. He used it to light a single moment so brightly — that even an emperor had to look away.",
             "Extinction Flame as brilliant light, Dou Zong shielding, unexpected victory sound, light spreading, triumphant orchestral finale")
        ],
        "tags": "xianxia, trieu tien, xiao yan, dou di, nine-star dou huang, extinction flame, chinese fantasy",
        "bg_music": "Epic Chinese battle orchestral, Nine-star Dou Huang theme, Dou Di tournament, Extinction Flame, triumphant 100 BPM"
    },
    "Dau Pha Thuong Khau": {
        "channel": "Dau Pha Thuong Khau",
        "protagonist": "Xiao Yan and Xiao Mei",
        "shots": [
            (0,  "Extreme wide aerial — the ancient ruins of the Flame Emperor's palace. Crumbling. Forgotten. Xiao Mei stands at the center with the Flame Emperor's memory still burning in her mind. Camera: extreme wide aerial, ruins of Flame Emperor palace, Xiao Mei alone, ancient grandeur decayed, melancholic scale.",
             "Extreme wide aerial — ancient Flame Emperor ruins, Xiao Mei alone at center, grandeur decayed, melancholic epic scale, 6s",
             "The Flame Emperor's palace had crumbled to dust — but the memories it held burned brighter than ever. And Xiao Mei — the girl who had touched the sealed door — was the only one who remembered what it had been.",
             "Wind through ruins, dust settling, ancient grandeur silence, memory burning, melancholic orchestral swell"),
            (6,  "Wide cinematic — Xiao Yan appears — not as cultivator, but as the Flame Emperor reborn. His body literally BLAZES with the Emperor's fire. The palace ruins RECOGNIZE him. Camera: wide cinematic, Xiao Yan appearing as Flame Emperor reborn, palace ruins recognizing true heir, fire erupting, 6 seconds.",
             "Wide cinematic — Xiao Yan as Flame Emperor reborn, palace ruins recognizing true heir, emperor fire blazing, ancient recognition, 6s",
             "The palace had been waiting. For a thousand years — it had waited for the Flame Emperor to return. And tonight — in Xiao Yan's body — he finally did.",
             "Palace recognizing heir, emperor fire igniting, ancient recognition sound, fire roaring, destiny fulfilled orchestral"),
            (12, "Close-up — Xiao Mei and Xiao Yan stand together. The Flame Emperor's memories SPLIT between them — half for each. 'You are not rivals,' the memories say. 'You are the two halves of what I was.' Camera: close-up, memories splitting between two, revelation of two halves, profound truth, 6 seconds.",
             "Close-up — memories splitting between Xiao Yan and Xiao Mei, two halves revelation, Flame Emperor explaining purpose, profound truth moment, 6s",
             "The Flame Emperor had been two people before he became one. His fire — and his memory. And now — they were reunited in the only way they could be: two people who carried what he had been.",
             "Memories splitting sound, two halves reuniting, Flame Emperor voice, profound truth echo, emotional orchestral swell"),
            (18, "Wide — the Ninefold Burning Heaven technique is COMPLETE. Nine transformations. Each one burning away one weakness, one doubt, one limitation. Xiao Yan becomes PURE fire. Camera: wide, Ninefold complete transformation, nine weaknesses burned away, Xiao Yan becoming pure fire, peak power achieved, 6 seconds.",
             "Wide — Ninefold complete, nine weaknesses burned away, Xiao Yan becoming pure fire, nine transformations visible, peak power achieved, 6s",
             "Nine transformations. Nine weaknesses burned away. And what remained — was not a stronger version of who he had been. It was the first version of who he was always meant to become.",
             "Nine transformations sound, weaknesses burning away, pure fire achieved, nine flames dancing, peak power orchestral crescendo"),
            (24, "Full-body cinematic — Xiao Yan and Xiao Mei stand at the restored Flame Emperor palace — now BURNING with renewed life. The fire that had been dormant for a thousand years — blazed again. Camera: full-body cinematic, restored palace burning with renewed life, dormant fire blazing again, resurrection achieved, 6 seconds.",
             "Full-body cinematic — restored Flame Emperor palace burning renewed, dormant fire blazing after thousand years, resurrection achieved, transcendent finale, 6s",
             "The Flame Emperor's palace burned again. Not with the fire of revenge — but with the fire of what came next. And two children stood at its center — carrying the weight of what had been — and the hope of what would be.",
             "Palace renewed fire blazing, thousand-year dormancy ending, resurrection sound, renewed hope orchestral, transcendent finale")
        ],
        "tags": "xianxia, dau pha thuong khau, xiao yan, xiao mei, flame emperor, ninefold burning heaven, chinese fantasy",
        "bg_music": "Epic Chinese fire orchestral, Flame Emperor theme, Ninefold Burning Heaven, palace restoration, fire reborn 95 BPM"
    },
    "Tru Tien": {
        "channel": "Tru Tien",
        "protagonist": "Jeon Jin-Woo",
        "shots": [
            (0,  "Extreme wide aerial — the shadow throne room. Massive, dark, with a throne made of living shadow. Jeon Jin-Woo sits upon it — not as emperor — but as GUARDIAN. Camera: extreme wide aerial, shadow throne room, Jeon Jin-Woo seated as guardian not emperor, dark grandeur, ominous scale.",
             "Extreme wide aerial — shadow throne room, throne of living shadow, Jeon Jin-Woo seated as guardian, dark grandeur, ominous scale, 6s",
             "The shadow throne. It could make him an emperor of darkness — or a guardian of light. He sat upon it — and chose: to be the bridge between shadow and light. Not to rule either.",
             "Shadow throne humming, living shadow breathing, guardian choice sound, dark grandeur, ominous orchestral"),
            (6,  "Close-up — Jeon Jin-Woo faces his shadow self — the demon king that he had absorbed. 'We are one now,' he says. 'Not master and servant — but equals.' The demon king nods. Camera: close-up, shadow self integration, equals not master, demon king acknowledging partnership, 6 seconds.",
             "Close-up — shadow self integration, demon king acknowledging partnership, equals not master and servant, profound unity, 6s",
             "The demon king had been his enemy. His greatest fear. And now — he was his most trusted partner. Because he had learned: our greatest fears — are often our greatest teachers.",
             "Shadow integration sound, demon king nod, equals partnership echo, profound unity orchestral, mystical swell"),
            (12, "Wide cinematic — Jeon Jin-Woo raises the shadow throne's power — and uses it NOT for conquest — but to PROTECT. Shadow walls rise around cities. Shadow soldiers defend the innocent. Camera: wide cinematic, shadow power used for protection not conquest, shadow walls protecting cities, shadow soldiers defending innocent, 6 seconds.",
             "Wide cinematic — shadow power protecting not conquering, shadow walls defending cities, shadow soldiers as protectors, unprecedented use of dark power, 6s",
             "Shadow had always been used for conquest. For destruction. For fear. He turned it upside down — and used the darkest power in existence to protect. Because the best shield — was often the scariest thing on the battlefield.",
             "Shadow walls rising, protection sound, shadow soldiers defending, inverted purpose orchestral, heroic dark"),
            (18, "Close-up — the ancient demon armies ATTACK — but they ATTACK SHADOW SOLDIERS. Jeon Jin-Woo watches from the shadow throne as his shadow army defends his world. 'This is what shadow was always meant for,' he says. Camera: close-up, ancient demons attacking shadow army, Jeon Jin-Woo watching from throne, shadow defending world, 6 seconds.",
             "Close-up — ancient demons attacking shadow army, Jeon Jin-Woo watching from throne, shadow army defending, profound statement about shadow's purpose, 6s",
             "The ancient demons had come to conquer. And they found shadow — the thing they thought was their ally — standing in their way. Turned. By the one man who understood darkness better than any of them.",
             "Ancient demons attacking, shadow army defending, Jeon Jin-Woo watching, profound shadow purpose statement, battle orchestral"),
            (24, "Full-body cinematic — Jeon Jin-Woo descends from the shadow throne — not as emperor, but as the MONARCH OF SHADOWS. A title that meant: the one who controlled darkness — so that light could survive. Camera: full-body cinematic, descent from shadow throne as Monarch of Shadows, darkness serving light, guardian not emperor, transcendent finale. 6 seconds.",
             "Full-body cinematic — descent as Monarch of Shadows, darkness serving light, guardian not emperor, shadow throne transforming to protective symbol, transcendent finale, 6s",
             "He was not the emperor of shadow. He was the monarch of it — which meant he understood it completely. And what he understood most — was that the scariest darkness — was always the best guardian of the light.",
             "Descent sound, monarch title declared, shadow transforming from conquest to protection, guardian achieved, transcendent orchestral finale")
        ],
        "tags": "xianxia, tru tien, jeon jin-woo, shadow throne, monarch of shadows, demon king, chinese fantasy",
        "bg_music": "Dark epic orchestral, shadow throne theme, Monarch of Shadows, darkness protecting light, guardian not emperor 90 BPM"
    },
    "Thanh Van Mon": {
        "channel": "Thanh Van Mon",
        "protagonist": "Nie Li",
        "shots": [
            (0,  "Extreme wide aerial — Glory City at dawn. Sacred Dragon Sect's ancient seals — that had held for a thousand years — begin to CRACK. Something ancient stirs beneath. Camera: extreme wide aerial, Glory City at dawn, ancient dragon seals cracking, something ancient awakening, epic ominous scale.",
             "Extreme wide aerial — Glory City at dawn, dragon seals cracking after thousand years, something ancient stirring, ominous epic scale, 6s",
             "The dragon seals had held — through wars, through dynasties, through the slow forgetting of an age. But time was finding its way through. And what slumbered beneath — was beginning to wake.",
             "Seals cracking, ancient stirring, thousand-year sleep ending, ominous rumble, epic orchestral swell"),
            (6,  "Close-up — Nie Li in the sacred archive. Reading the time regression scrolls. He discovers: the demon dimension had been sealed by HIS OWN CHOICE — in a past life. He was the one who had closed the gate. Camera: close-up, time regression scrolls revealing truth, Nie Li discovering he sealed demon dimension in past life, shocking revelation, 6 seconds.",
             "Close-up — sacred archive, time regression scrolls revealing truth, Nie Li discovers past life choice sealed demon dimension, shocking revelation, 6s",
             "He had sealed the demon dimension. Not a god. Not an ancient hero. Him — in a life he did not remember. And now — he would have to decide whether to seal it again — or let the past decision stand.",
             "Scroll revealing, past life echoing, shocking truth discovered, time regression hum, revelation orchestral swell"),
            (12, "Wide cinematic — the demon dimension gate CRACKS OPEN. Black chaos pours through — not an army, but PURE DARK INTENT. It seeks one thing: Nie Li. The one who had imprisoned it. Camera: wide cinematic, demon gate cracking, chaos pouring through, dark intent seeking Nie Li specifically, terrifying scale, 6 seconds.",
             "Wide cinematic — demon gate cracking, chaos pouring through, dark intent seeking Nie Li specifically, terrifying scale, 6s",
             "The demon dimension did not send an army. It sent INTENTION. Pure, focused, ancient malice that had been waiting a thousand years for one target: the man who had locked the door.",
             "Gate cracking, chaos pouring, ancient malice targeting, terrifying silence before attack, ominous orchestral crescendo"),
            (18, "Close-up — Nie Li stands before the gate. He has three choices: reseal it (and lose his time powers forever), fight it (and probably die), or TRANSFORM it. He chooses the third. Camera: close-up, three choices presented, transformation chosen over sealing or fighting, decisive moment, 6 seconds.",
             "Close-up — three choices presented, transformation chosen over sealing or fighting, Nie Li's decisive expression, profound decision, 6s",
             "Seal it — and become mortal. Fight it — and probably lose. Transform it — and risk everything. He chose the third. Because the only thing scarier than an ancient demon dimension — was a time master with nothing left to lose.",
             "Three choices appearing, transformation choice, decisive sound, ancient risk accepted, daring orchestral"),
            (24, "Full-body cinematic — Nie Li reaches into the demon dimension — and REWINDS it. Not fighting it — REVERSING it. The chaos flows BACKWARD. The gate seals from inside. Camera: full-body cinematic, reaching into demon dimension, rewinding chaos backward, gate sealing from inside out, impossible reversal achieved, 6 seconds.",
             "Full-body cinematic — reaching into demon dimension, rewinding chaos backward, gate sealing from inside out, impossible reversal, transcendent finale, 6s",
             "He did not fight the demon dimension. He simply — reversed it. And in reversing ten thousand years of malice — he proved something that even the gods had doubted: that time — was stronger than hate.",
             "Rewind sound, chaos reversing, gate sealing from inside, time triumphing over hate, transcendent orchestral finale")
        ],
        "tags": "xianxia, thanh van mon, nie li, time regression, demon dimension, glory city, chinese fantasy",
        "bg_music": "Epic Chinese temporal orchestral, time regression theme, demon dimension reversal, time mastery, transcendent 95 BPM"
    },
    "Muc Than Ky": {
        "channel": "Muc Than Ky",
        "protagonist": "Mo Fan",
        "shots": [
            (0,  "Extreme wide aerial — the Grand Library's forbidden floor. Five elemental doors — fire, water, earth, wind, thunder — now OPEN. All five at once. Mo Fan walks through all of them simultaneously. Camera: extreme wide aerial, all five elemental doors open simultaneously, Mo Fan walking through all at once, unprecedented mastery, 6 seconds.",
             "Extreme wide aerial — all five elemental doors open simultaneously, Mo Fan walking through all at once, unprecedented event, 6s",
             "The five elemental doors had been opened one at a time for ten thousand years. Today — Mo Fan opened all five simultaneously. Because he had learned: true mastery was not about choosing one element — it was about unifying them.",
             "Five doors opening simultaneously, unprecedented event, elemental hum, his steady footsteps, epic orchestral swell"),
            (6,  "Wide cinematic — Mo Fan combines all five elements for the FIRST TIME IN HISTORY. Fire, water, earth, wind, thunder — MERGE in his five-element palms. Not five powers — ONE power. Camera: wide cinematic, all five elements merging in five-element palms, one unified power achieved, unprecedented, 6 seconds.",
             "Wide cinematic — five elements merging in five-element palms, one unified power achieved, first time in history, unprecedented power, 6s",
             "Five elements. Ten thousand years of separation. In his palms — they became one. Not because he forced them — but because he finally understood what each of them had always been trying to become.",
             "Five elements merging, unified power humming, first time in history, harmony achieved, unprecedented orchestral swell"),
            (12, "Close-up — the Grand Architect's COMPLETE HISTORY appears in the library's light. Mo Fan sees: he IS the first Grand Architect. Not reborn — REMEMBERED. He always was. Camera: close-up, Grand Architect complete history, Mo Fan realizing he always was the first Architect, shocking complete truth, 6 seconds.",
             "Close-up — Grand Architect complete history appearing, complete truth revealed, Mo Fan always was first Architect, shocking full revelation, 6s",
             "He was not the reincarnation of the Grand Architect. He was not a copy. He was not a successor. He WAS the first Grand Architect — who had simply forgotten — and was now remembering.",
             "History fully revealing, complete truth echoing, realization dawning, first Architect confirmed, revelation orchestral swell"),
            (18, "Wide — Mo Fan creates from his five-element palms — not a weapon, not a technique — an ENTIRE LIBRARY. A new forbidden archive — with every element unified — accessible to everyone. Camera: wide, Mo Fan creating entire new library from five-element palms, forbidden archive accessible to all, revolutionary act, 6 seconds.",
             "Wide — Mo Fan creating entire new library from five-element palms, forbidden knowledge now accessible to all, revolutionary act, 6s",
             "The first Grand Architect had hoarded knowledge — because he feared it would be misused. Mo Fan undid that fear — and created a library open to all. Because the best guard against misuse — was not secrecy — but wisdom.",
             "Library materializing, knowledge becoming free, revolutionary act, wisdom replacing fear, hopeful orchestral swell"),
            (24, "Full-body cinematic — Mo Fan stands at the center of the new library — surrounded by five-element light, students learning, knowledge flowing freely. He smiles. The orphan who was told he was nothing — built a world where everyone could be something. Camera: full-body cinematic, Mo Fan at center of new library, students learning, knowledge free, orphan's dream achieved, transcendent finale. 6 seconds.",
             "Full-body cinematic — Mo Fan at center of new library, five-element light, students learning freely, orphan's dream achieved, transcendent finale, 6s",
             "The boy who had been told he was nothing — had built a library where everyone could become something. And at its center — surrounded by the five elements he had unified — he was finally home.",
             "Library humming, students learning, knowledge free flow, orphan's dream fulfilled, transcendent orchestral finale")
        ],
        "tags": "xianxia, muc than ky, mo fan, five elements, grand architect, forbidden archive, chinese fantasy",
        "bg_music": "Epic elemental orchestral, five elements unified theme, Grand Architect revelation, library accessible to all, transcendent 95 BPM"
    }
}

# Episode titles and hooks per series (10 episodes each: 31-40)
EPISODE_DATA = {
    "Ha Tien Du": [
        (171, 31, "The Celestial Gate", "The celestial gate had been sealed since the first gods. Tonight, Luân carried the fire mark, ice mastery, and Water of Origin — and opened it alone.", "Celestial gate discovered → Three elements combined → Gate opens → Celestial realm revealed → Awe", "Determination → Elemental power → Gateway opening → Realm revealed → Awe"),
        (172, 32, "The Celestial Library", "The celestial library held every secret of existence. Luân was given one hour — and chose a book of sacrifices over power techniques.", "Wonder → Offering → Choice → Discovery → Resolve"),
        (173, 33, "The Road Home", "Luân descended from heaven carrying the knowledge of sacrifice. The shadow empire had been waiting — and ambushed him with a thousand soldiers.", "Descent → Ambush → Alone fighting → Elemental combination → Escape"),
        (174, 34, "The Last Gift", "Luân returned home to find shadow already there — his people trapped. He poured his elemental mastery into the barrier — and became everything he had left.", "Return → Horror → Urgency → Confrontation → Sacrifice"),
        (175, 35, "The Last Bridge", "The bridge was almost gone. The void descended. And Luân — with nothing left — became the bridge one final time.", "Weakness → Void weapon → Nothing left → Bridge renewed → Final stand"),
        (176, 36, "The Eternal Water", "Luân became the eternal bridge between worlds. His body — stretched across the void — became the barrier that would never fall.", "Bridge stretched → Void pressing → Will holding → Eternal → Protected"),
        (177, 37, "The Final Trial", "The celestial realm sent its final trial: not combat — but the choice to let go. Luân had to choose: stay as bridge forever — or become mortal again.", "Trial → Choice presented → Letting go → Mortal decision → Freedom"),
        (178, 38, "The Mortal Return", "Luân returned to the mortal realm — no fire mark, no ice blades, no Water of Origin. Just a man. And his people — safe forever.", "Mortal return → No powers → Just a man → Safe people → Peace"),
        (179, 39, "The Water Remembers", "Years later: the waterfall glowed. Luân — old now — sat beside it. And the water showed him: everyone he had saved, living full lives.", "Years later → Old by waterfall → Water shows him → Saved lives → Gratitude"),
        (180, 40, "The Eternal Spring (Series Finale)", "On his last day, Luân returned to the dragon gate one final time. The dragon king bowed. The Ice Master bowed. Heaven itself — bowed to the mortal who had become eternal.", "Last day → Dragon gate → All bow → Mortal who became eternal → Legend")
    ],
    "Trieu Tien": [
        (181, 31, "The Nine-Star Summit", "The Dou Di Summit: nine Nine-star Dou Huangs gathered. Xiao Yan — the youngest — was the only one who had earned his stars through failure.", "Gathering → Youngest → Failure earned stars → Respect → Dominance"),
        (182, 32, "The Flame Sect's Legacy", "The Flame Sect elders revealed: the Extinction Flame was not just a technique — it was a philosophy. To burn the old — so the new could be born.", "Legacy → Philosophy revealed → Burning old for new → Understanding → Acceptance"),
        (183, 33, "The Dou Zong Challenge", "A Dou Zong — two full realms above — challenged Xiao Yan publicly. He accepted — and showed why technique beat raw power.", "Challenge → Accept → Technique over power → Victory → Proof"),
        (184, 34, "The Sky Fortune Saint's Test", "The Sky Fortune Saint tested Xiao Yan one final time — not with combat, but with a question: 'What will you burn to build your world?'", "Test → Question → What to burn → Answer → Purpose"),
        (185, 35, "The Emperor's Decree", "Xiao Yan became the youngest Flame Emperor in history — not by conquest, but by being the first emperor who asked his people what they needed.", "Becoming emperor → Asking not commanding → People's needs → New kind of emperor → Revolution"),
        (186, 36, "The Imperial Palace Fire", "Xiao Yan set fire to his own imperial palace — to prove that an emperor who could let go of comfort — could never be corrupted.", "Palace fire → Letting go comfort → Cannot be corrupted → Proof → Trust"),
        (187, 37, "The War of Philosophies", "Other empires attacked — not the body, but the philosophy. Xiao Yan's way of burning old things threatened the foundations of power everywhere.", "War of philosophies → Burning old threatens power → Defense → New philosophy → Victory"),
        (188, 38, "The Flame Sect Reunites", "The Flame Sect — scattered for a thousand years — reunited under Xiao Yan. Not as army — as family.", "Reunion → Scattered sect → Family not army → Reunited → Strength"),
        (189, 39, "The Dou Di Congress", "Xiao Yan called the first Dou Di Congress — all realms, all factions. He proposed: no more wars fought over what could be shared.", "Congress → All realms → Sharing not warring → Proposal → Beginning"),
        (190, 40, "The Eternal Flame (Series Finale)", "On his last day as emperor, Xiao Yan passed the Extinction Flame to the next generation — not as a weapon, but as a promise: that burning old things — was always so something better could begin.", "Last day → Passing flame → Promise → New beginning → Eternal")
    ],
    "Dau Pha Thuong Khau": [
        (191, 31, "The Emperor's Tomb Opens", "Xiao Mei touched the Emperor's tomb — and it opened. Inside: not a body — but the Flame Emperor's final lesson, preserved for a thousand years.", "Tomb opens → Not body → Final lesson → Preserved → Waiting"),
        (192, 32, "The Ninefold Complete", "Xiao Yan completed the Ninefold Burning Heaven — all nine transformations achieved. The Flame Emperor's full legacy — finally inherited.", "Ninefold complete → All nine → Full legacy → Inherited → Complete"),
        (193, 33, "The Memory Bridge", "Xiao Mei and Xiao Yan together became the memory bridge — connecting past emperor to future world. Two children — carrying a thousand years.", "Memory bridge → Two children → Past to future → Connected → Carrying"),
        (194, 34, "The Palace Reborn", "The Flame Emperor's palace — restored to its original glory — became not a tomb, but a living school where anyone could learn the Emperor's way.", "Palace reborn → School not tomb → Living → Open → Learning"),
        (195, 35, "The Emperor's Two Halves", "The Flame Emperor had been two people who became one. Now Xiao Mei and Xiao Yan — proved that being two people who were one — was stronger.", "Two halves → Two who are one → Stronger together → Proved → Complete"),
        (196, 36, "The Fire That Heals", "Xiao Yan discovered: the Extinction Flame could not only destroy — it could HEAL. Burn the sickness — not the body. Revolution in medicine.", "Fire heals → Burning sickness → Revolutionary → Medicine → New way"),
        (197, 37, "The Academy Founded", "Xiao Yan founded the first Flame Academy — open to all, regardless of birth. The old world gasped. The new world began.", "Academy founded → Open to all → Old world gasps → New world → Beginning"),
        (198, 38, "The Betrayer's Redemption", "The disciple who had betrayed the Flame Emperor a thousand years ago — appeared. Not as enemy — as penitent. And Xiao Yan chose: forgiveness.", "Betrayer appears → Penitent → Forgiveness chosen → Redemption → Peace"),
        (199, 39, "The Eternal Fire", "The Flame Emperor's fire — now in two children — spread across the world. Not as conquest — as warmth. Every cold night — lit.", "Eternal fire spreading → Warmth not conquest → Every cold night lit → Warm → Everywhere"),
        (200, 40, "The Emperor's Children (Series Finale)", "The Flame Emperor watched from beyond — two children carrying his fire. And for the first time in a thousand years — he smiled. Not at what was restored. At what was improved.", "Emperor watching → Two children → Smile → Not restored — improved → Better")
    ],
    "Tru Tien": [
        (201, 31, "The Shadow Throne's True Purpose", "Jeon Jin-Woo sat upon the shadow throne — and understood its true purpose: not to conquer light — but to protect it.", "Shadow throne → True purpose → Protect light → Guardian → Understood"),
        (202, 32, "The Monarch's Promise", "Jeon Jin-Woo made a promise: as long as he sat upon the shadow throne — no shadow would touch an innocent. A promise witnessed by gods.",