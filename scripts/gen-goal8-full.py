#!/usr/bin/env python3
"""Write all 40 missing GOAL-8 episode data to gen-goal8.py"""
import re

TARGET = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/scripts/gen-goal8.py"

# ================================================================
# Episode data: 10 episodes per series, 4 series
# Each episode: (id_num, ep_num, subtitle, hook, story_arc, emotion)
# Scenes: 5 shots at 0,6,12,18,24s
# ================================================================

SERIES_DATA = {
    "DPTK": {
        "name": "Dau Pha Thuong Khau",
        "ids": list(range(131, 141)),
        "music": "Epic Chinese battle orchestral, flame emperor theme, Sky Fortune Saint confrontation, 95 BPM",
        "episodes": [
            (21, "The Flame Emperor's Sealed Memories",
             "The Flame Emperor sealed his own memories three thousand years ago. Tonight, Xiao Yan broke that seal — and learned his mentor was a victim, not a villain.",
             "Seal broken → Truth revealed → Flame Emperor past → Betrayal exposed → Cold resolve",
             "Shock → Horror → Grief → Rage → Cold resolve"),
            (22, "Ninefold Burning Heaven Third Transformation",
             "The Ninefold Burning Heaven had two transformations. Tonight, Xiao Yan unlocked the third — and the sky above the Flame Sect literally caught fire.",
             "Third transformation → Power surge → Sky ignites → Sect kneels → Saint alerted",
             "Tension → Power → Wonder → Awe → Menace"),
            (23, "Xiao Mei in the Dou Qi Realm",
             "While Xiao Yan burned the sky, Xiao Mei descended into the Dou Qi realm alone — and emerged with the Dou Qi Armament, a power only achieved by realm guardians.",
             "Xiao Mei descends → Dou Qi trial → Power awakening → Armament achieved → Returns transformed",
             "Wonder → Trial → Struggle → Breakthrough → Triumph"),
            (24, "The Jia Academy Headmaster Identity Revealed",
             "The Jia Academy headmaster had trained Xiao Yan since he was fifteen. Tonight, he removed his disguise — and revealed himself as the Flame Emperor's last living bodyguard.",
             "Headmaster summoned → Truth revealed → History rewrites → SFS weakness exposed → Legacy passed",
             "Trust → Shock → Betrayal → Grief → Understanding"),
            (25, "The Flame Emperor Legacy Claimed",
             "The Flame Emperor left three gifts. Tonight, Xiao Yan found the third and most dangerous: his own Dou Zun core, containing three thousand years of accumulated god-level power.",
             "Third gift found → Dou Zun core → Integration begins → Power surge → Saint attacks",
             "Discovery → Urgency → Power → Danger → Defense"),
            (26, "The Sky Fortune Saint Descends",
             "The Sky Fortune Saint had waited three thousand years. Tonight — he descended from his divine realm personally, because he could feel it: the Flame Emperor's power was returning.",
             "Saint descends → Divine realm opens → Face to face → Challenge issued → Epic clash begins",
             "Horror → Dread → Confrontation → Challenge → Epic clash"),
            (27, "Nine-Star Dou Huang Breakthrough",
             "Xiao Yan was at eight-star Dou Huang. To defeat a god — he needed nine stars. He used the Ninefold Burning Heaven in REVERSE, compressing all his power inward to force the impossible breakthrough.",
             "Battle rages → Power pushed to limit → Nine-star threshold → Nine celestial stars align → Breakthrough achieved",
             "Desperation → Pain → Breakthrough → Power surge → Hope"),
            (28, "Universe Fire Collapse",
             "The Flame Emperor's final technique had no name. Xiao Yan gave it one: Universe Fire Collapse — a miniature universe of flame collapsing in his palms. He threw it at a god.",
             "Universe Fire Collapse prepared → God-tier technique → Saint caught it → Saint wounded → Both exhausted standoff",
             "Power → Climax → Danger → Reversal → Standoff"),
            (29, "Sky Fortune Saint Defeated",
             "The Sky Fortune Saint had never lost in three thousand years. Tonight, flanked by Xiao Mei and hit by Universe Fire Collapse from both sides, he retreated.",
             "Saint attacks desperately → Xiao Mei flanks → Combined assault → Saint overwhelmed → Retreating wounded",
             "Desperation → Reversal → Combined attack → Victory → Saint retreating"),
            (30, "Dou Zun Achieved — The True Heir (Series Finale)",
             "Xiao Yan achieved Dou Zun naturally by understanding the Flame Emperor's final lesson: true power is about protecting what you love. With Xiao Mei also Dou Zun, the Flame Sect begins to rebuild.",
             "Victory → Flame Emperor's lesson → Dou Zun naturally → New era → Standing together",
             "Triumph → Reflection → Breakthrough → New era → Peace"),
        ],
    },
    "TRU": {
        "name": "Tru Tien",
        "ids": list(range(141, 151)),
        "music": "Dark epic orchestral, shadow throne theme, demon king confrontation, 95 BPM",
        "episodes": [
            (21, "Monarch of Shadows Speaks",
             "The Monarch of shadows had been silent for twenty episodes. Tonight, Jeon Jin-Woo finally heard the truth — the demon king was not his enemy. He was his destiny.",
             "Monarch speaks → Truth revealed → Jeon Jin-Woo shocked → Alliance fractured → Decision made",
             "Horror → Revelation → Shock → Fracture → Resolve"),
            (22, "Demon King Counterpart",
             "Jeon Jin-Woo discovered the truth: the demon king was not his enemy. It was his SHADOW — the dark reflection of himself that had gained sentience.",
             "Counterpart revealed → Mirror battle → Shadow vs shadow → Identity crisis → Choosing to fight",
             "Confusion → Dread → Mirror battle → Identity crisis → Resolve"),
            (23, "Ice Tribe Underground Realm Collapses",
             "The ice tribe underground realm had stood for ten thousand years. Tonight, the battle between shadow and demon king destabilized the very ground beneath them.",
             "Realm destabilizes → Earthquake begins → Ice tribe in danger → Jeon Jin-Woo decides → Collapse accelerates",
             "Warning → Destruction → Urgency → Decision → Catastrophe"),
            (24, "The Final Gate Opens",
             "Behind the ice tribe realm was a gate sealed since the creation of the world. The gate had been waiting for Jeon Jin-Woo. Tonight — it opened for him.",
             "Gate discovered → Jeon Jin-Woo approaches → Gate responds to him → Shadow throne visible → Gate opens",
             "Tension → Discovery → Recognition → Decision → Gate opening"),
            (25, "Shadow Throne Claimed",
             "The shadow throne had been waiting for its king for ten thousand years. Jeon Jin-Woo sat upon it — and the throne tested him with ten thousand years of accumulated shadow power.",
             "Shadow throne reached → Throne tests him → Jeon Jin-Woo accepts → Power floods in → Crowned Monarch",
             "Awe → Test → Decision → Power → Crowning"),
            (26, "Monarch vs Demon King",
             "Father and son. Shadow and shadow. Two monarchs of darkness facing each other at last — and only one could claim the shadow realm.",
             "Confrontation begins → Father vs son revealed → Shadow vs shadow → Technique clash → Neither yields",
             "Fury → Recognition → Battle → Technique clash → Standoff"),
            (27, "Ice Tribe Princess Sacrifice",
             "The ice tribe princess had loved Jeon Jin-Woo since episode one. Tonight, she sacrificed herself to seal the gate — saving a thousand worlds and Jeon Jin-Woo's future.",
             "Final battle → Princess sees opportunity → She sacrifices herself → Gate sealed → Jeon Jin-Woo weeps",
             "Battle → Love → Sacrifice → Gate sealed → Grief"),
            (28, "Shadow Clone Technique",
             "Jeon Jin-Woo was outnumbered a thousand to one. So he made a thousand of himself — shadow clones, each as powerful as the original. Many vs many. One wins.",
             "Surrounded → Shadow clone activates → Many Jeon Jin-Woos → Battle turning → Victory",
             "Desperation → Activation → Many vs one → Turning point → Victory"),
            (29, "Demon King's True Form Revealed",
             "The demon king shed his human form. What emerged was not a demon — it was the FIRST SHADOW, older than gods, born from the first darkness before the first light.",
             "True form revealed → Ancient entity emerges → World shudders → Jeon Jin-Woo faces old god → Final confrontation",
             "Horror → Revelation → World shuddering → Facing old god → Final confrontation"),
            (30, "Shadow Throne King — Series Finale",
             "Jeon Jin-Woo had become the Monarch of shadows. Not by conquering — but by choosing to protect. The shadow throne had finally found its eternal king.",
             "Victory achieved → Shadow throne secured → World blessed → Jeon Jin-Woo's choice → Eternal guardian",
             "Victory → Reflection → Blessing → Choice → Eternal guard"),
        ],
    },
    "TVM": {
        "name": "Thanh Van Mon",
        "ids": list(range(151, 161)),
        "music": "Epic Chinese divine orchestral, dragon awakening, time regression, divine tournament, 95 BPM",
        "episodes": [
            (21, "Sacred Dragon Sect Technique Awakens",
             "The Sacred Dragon Sect technique had been sleeping for a thousand years. Tonight, it woke for the Glory City hero — and ancient dragon power reshaped the sky.",
             "Technique awakens → Ancient dragon power → Glory City trembles → Hero channels → Dragon rises",
             "Awe → Ancient power → Trembling → Channeling → Dragon rising"),
            (22, "Time Regression Powers Manifest",
             "The hero had always felt time was strange around her. Tonight, she understood why: she could REWIND it. And in rewinding a battle — she changed history.",
             "Time anomaly noticed → Hero feels power → First rewind → Battle reversed → Time power mastered",
             "Confusion → Recognition → First rewind → Shock → Mastery"),
            (23, "Demon Dimension Gate Opens",
             "The demon dimension had been sealed since the wars of gods. Tonight, its gate CRACKED open over Glory City — and chaos poured through like black water.",
             "Gate cracks → Chaos breaks in → Glory City under attack → Hero stands → Gate must be closed",
             "Horror → Chaos → Attack → Hero stands → Decision"),
            (24, "Glory City Final Battle",
             "The battle for Glory City had been building for twenty episodes. Tonight — armies clashed, powers erupted, and the city's fate was decided in one epic night.",
             "Battle rages → All-out war → Glory City on edge → Hero's final stand → Victory at terrible cost",
             "Tension → War → Edge → Final stand → Victory"),
            (25, "Ultimate Divine Ranking Achieved",
             "The divine rankings had put the hero at number seven for twenty episodes. Tonight — she reached number one. Not by defeating the ones above her. By redefining what rank meant.",
             "Ranking tournament announced → Hero enters → Climbs through ranks → Faces number one → Victory achieved",
             "Challenge → Enter → Climb → Face champion → Victory"),
            (26, "Divine Realm Descends",
             "Heaven itself reached down to Glory City. The divine realm — the home of the immortals — became visible in the sky. And it had a message for the hero.",
             "Divine realm visible → Heaven descends → Glory City transformed → Hero chosen → Ascend or stay",
             "Awe → Transformation → Glory City → Hero chosen → Decision"),
            (27, "Confrontation with the Divine Council",
             "The divine council had ruled heaven for ten thousand years. Tonight, the hero challenged their authority — and named every unjust law they had enforced.",
             "Council confronted → Laws challenged → Hero accused → Council retaliates → Standing firm",
             "Confrontation → Accusation → Retaliation → Standing firm → Defiance"),
            (28, "Sacrifice of the Dragon",
             "The ancient dragon who had guided the hero since episode one had one final act left. Tonight — he died saving her life — and left her everything he knew.",
             "Dragon wounded in battle → Final stand → Dragon intercepts killing blow → Dies protecting → Hero inherits",
             "Battle → Warning → Interception → Sacrifice → Inheritance"),
            (29, "Divine Ranking Tournament",
             "The top ten immortals gathered for the divine tournament. The hero faced them all — one by one — and proved that human determination could defeat immortal power.",
             "Tournament begins → Hero enters arena → Faces immortals one by one → Climactic final → Toppling the champion",
             "Challenge → Enter → Face each immortal → Climax → Toppling champion"),
            (30, "Ascending to Divinity (Series Finale)",
             "The hero had spent thirty episodes becoming strong enough to face heaven. Tonight — she DID face heaven. And heaven bowed. She became a god.",
             "Ascension begins → Heaven opens → Hero rises → Divinity achieved → World blessed",
             "Beginning → Opening → Ascension → Divinity → World blessed"),
        ],
    },
    "MTK": {
        "name": "Muc Than Ky",
        "ids": list(range(161, 171)),
        "music": "Epic elemental orchestral, five elements theme, Grand Architect mystery, forbidden archive, 95 BPM",
        "episodes": [
            (21, "Five Elements Forbidden Floor",
             "The forbidden floor of the Grand Library held the five elements — fire, water, earth, wind, thunder. Mo Fan descended alone to face what no one had conquered in ten thousand years.",
             "Forbidden floor → Five elements locked → Mo Fan enters → Trial begins → First element",
             "Tension → Discovery → Entry → Trial → First element"),
            (22, "Fire Element Mastery",
             "Mo Fan conquered the fire trial — not by overpowering the flames, but by learning what fire truly was: not destruction, but transformation.",
             "Fire trial → Mo Fan enters → Fire tests his heart → Transformation understood → Fire mastered",
             "Tension → Trial → Test → Understanding → Mastery"),
            (23, "Water Element Mastery",
             "Mo Fan conquered the water trial — not by moving water, but by understanding it: water was not passive. It was the most persistent force in existence.",
             "Water trial → Mo Fan enters → Water tests persistence → Persistence proven → Water mastered",
             "Trial → Test → Persistence → Proven → Mastery"),
            (24, "Earth Element Mastery",
             "Mo Fan conquered the earth trial — and learned that earth was not about stillness. It was about building foundations that outlasted empires.",
             "Earth trial → Mo Fan enters → Earth tests foundation → Foundation proven → Earth mastered",
             "Trial → Test → Foundation → Proven → Mastery"),
            (25, "Wind Element Mastery",
             "Mo Fan conquered the wind trial — and learned that wind was not about freedom. It was about adapting to every obstacle and flowing around everything that blocked.",
             "Wind trial → Mo Fan enters → Wind tests adaptation → Adaptation learned → Wind mastered",
             "Trial → Test → Adaptation → Learned → Mastery"),
            (26, "Thunder Element Mastery",
             "The thunder trial was the last. Mo Fan conquered it — and learned that thunder was not power. It was TRUTH. The universe's way of saying: this is real.",
             "Thunder trial → Mo Fan enters → Thunder tests truth → Truth revealed → Thunder mastered",
             "Trial → Test → Truth → Revealed → Mastery"),
            (27, "Grand Architect History Revealed",
             "The first Grand Architect had built the world ten thousand years ago. Tonight, Mo Fan learned who he really was — and why the forbidden floor had been waiting for HIM.",
             "History discovered → First Architect revealed → Shocking identity → Mo Fan stunned → Inheritance accepted",
             "Discovery → Shocking truth → Revelation → Stunned → Inheritance"),
            (28, "Mo Fan Parents Revealed",
             "Mo Fan had been an orphan since birth. Tonight, he learned who his parents were — two elemental masters who had died sealing the forbidden floor to protect him.",
             "Parents revealed → Mo Fan stunned → Their sacrifice understood → Why they left → Emotional acceptance",
             "Revelation → Stunned → Sacrifice → Explanation → Acceptance"),
            (29, "Five Elements Merge",
             "Mo Fan had mastered all five elements. Tonight, he attempted what no one in ten thousand years had done: combine them into one. The Grand Element. Pure creation.",
             "Elements align → Mo Fan attempts merge → Five begin merging → Five become one → Grand Element achieved",
             "Alignment → Attempt → Merge → Five becoming one → Grand Element"),
            (30, "Grand Architect Level Achieved (Series Finale)",
             "Mo Fan had learned from the first Grand Architect. Tonight, he became the second — and from his five-element palms, he built a world that had never existed before.",
             "Architect level → Ascending to Grand Architect → Achieved → World responds → New world built",
             "Ascension → Achieved → World responds → Recognition → New world"),
        ],
    },
}

# Scene templates per series (5 scenes each: 0,6,12,18,24s)
SCENE_TEMPLATES = {
    "DPTK": [
        (0, "Wide establishing — the Flame Emperor sealed tomb at midnight. Ancient seals glow with suppressed power. Xiao Yan approaches the sealed chamber.", "Wide — ancient tomb glowing at midnight, Xiao Yan approaching, ominous atmosphere, 6s", "The Flame Emperor had sealed his own memories three thousand years ago. Tonight — they broke free.", "Ancient seal humming, Xiao Yan's footsteps, ominous wind, tension drums"),
        (6, "Close-up — the sealed memory vision bleeds through the ancient barrier. Young Flame Emperor's past revealed in fragments — a murdered family, a villain in the shadows.", "Close-up — vision bleeding through seal, Flame Emperor's past in fragments, shocking truth emerging, 6s", "Tonight, the seals broke. And what they showed shattered everything Xiao Yan believed about his mentor.", "Vision whoosh, barrier breaking, shocked breath, revelation sound, ancient truth"),
        (12, "Wide cinematic — Xiao Yan's dou qi ERUPTS. Three thousand years of rage channeled into pure flame power. The tomb walls crack. He is transformed.", "Wide — dou qi explosion from sealed memories, three thousand years of rage, Xiao Yan transformed, 6s", "Three thousand years of rage — finally released. The heir had become something his mentor never dared to become.", "Dou qi explosion, ancient power roaring, rage channeling, epic orchestral swell"),
        (18, "Close-up — the Sky Fortune Saint SENSES the power surge across the continent. His ancient eyes open. His face shows genuine fear for the first time in three thousand years.", "Close-up — Sky Fortune Saint sensing power surge, first fear in 3000 years, ominous recognition, 6s", "The god of fortune had not been afraid in three thousand years. Until tonight. Until the Flame Emperor's heir finally woke.", "Ancient fear rising, SFS sharp inhale, ominous bass, tension building strings"),
        (24, "Wide shot — Xiao Yan stands at the peak of the Flame Sect. Transformed. The Flame Emperor's heir — no longer an heir. An emperor. Heaven itself will learn to fear him.", "Wide — transformed Xiao Yan at sect peak, heir becoming emperor, final defiant stance against heaven, 6s", "The heir had become the emperor. And the god who murdered his mentor — had exactly one week to be afraid.", "Emperor aura, transformed stance, epic orchestral finale, resolve"),
    ],
    "TRU": [
        (0, "Wide establishing — the shadow throne chamber deep underground. Absolute darkness older than light. The throne carved from living shadow. Jeon Jin-Woo approaches.", "Wide — shadow throne chamber underground, absolute darkness, throne carved from living shadow, Jeon approaching, 6s", "The Monarch of shadows had been waiting ten thousand years. Tonight — Jeon Jin-Woo finally heard the truth.", "Shadow chamber humming, ancient darkness, Jeon's careful footsteps, tension drums"),
        (6, "Close-up — the shadow throne SPEAKS. A voice of ten thousand years of patience and loneliness: You are not fighting an enemy, Jeon Jin-Woo. You are meeting yourself.", "Close-up — shadow throne speaking with ancient voice, Jeon Jin-Woo listening in shock, truth delivered, 6s", "The demon king was not his enemy. He was his shadow — the dark reflection that had gained sentience when Jeon Jin-Woo's power grew strong enough.", "Ancient voice, shadow throne speaking, Jeon stunned, revelation sound, ancient truth"),
        (12, "Wide cinematic — Jeon Jin-Woo vs his shadow clone. The demon king uses the perfected shadow clone technique. Mirror battle. Each move mirrored. Each counter perfect.", "Wide — Jeon vs shadow clone, demon king's perfected shadow technique clashing, mirror battle, 6s", "Shadow against shadow. The demon king's technique against Jeon Jin-Woo's. And only one could claim the throne that night.", "Shadow clash, mirror battle sounds, technique perfected, tension rising, epic orchestral swell"),
        (18, "Close-up — the ice tribe princess at the collapsing gate. She makes her choice. She will seal the gate with her own life force — saving a thousand worlds and the man she loves.", "Close-up — ice tribe princess at collapsing gate, choosing sacrifice, determined tearful face, 6s", "She had loved him since episode one. Tonight — she chose to save him. And in that choice — she became eternal.", "Gate collapsing, princess choosing, sacrifice sound, emotional swell, her final breath"),
        (24, "Wide cinematic — Jeon Jin-Woo on the shadow throne. Living darkness crowns him. The Monarch of shadows — reborn. Not a boy called trash. A king ten thousand years in the making.", "Wide — shadow throne crowned, Jeon Jin-Woo as Monarch, living darkness crown, transcendent finale, 6s", "The orphan who had been called trash had become the Monarch of shadows. And the first act of his reign — was to protect everyone he loved.", "Shadow crown forming, power flooding in, Monarch crowned, epic orchestral finale, resolve"),
    ],
    "TVM": [
        (0, "Wide establishing — Glory City at sunrise. The Sacred Dragon Sect ancient seals BREAK simultaneously. Ancient dragon power that slept for a thousand years ERUPTS from the city center.", "Wide — Glory City at sunrise, dragon seals breaking, ancient power awakening, breathtaking scale, 6s", "The dragon technique had been sleeping for a thousand years. Tonight — it woke. And Glory City was never the same.", "Ancient dragon power humming, sunrise light, seals breaking, awakening mystical sound"),
        (6, "Close-up — the hero in battle. Time fractures around her hands — literally. She reaches out and REWINDS a killing blow. The attack reverses. The enemy stares in horror.", "Close-up — hero in battle, time fracturing around hands, rewinding a killing blow, time power first manifest, 6s", "Time. She could REWIND it. And in rewinding a single moment — she changed everything that followed.", "Time fracturing sound, rewind whoosh, battle reversing, power manifest, mystical orchestral swell"),
        (12, "Wide cinematic — the demon dimension gate CRACKS open above Glory City. Black chaos pours through like inverted water. The sky over Glory City becomes a window to hell.", "Wide — demon gate cracking open above Glory City, chaos pouring through, city screaming, terrifying scale, 6s", "The demon dimension had been sealed since the wars of gods. Until tonight. Until the gate chose Glory City to end.", "Gate cracking, chaos roaring, Glory City screaming, ominous orchestral, world shuddering"),
        (18, "Close-up — the ancient dragon FALLS. His scales going dark. His thousand-year-old eyes find the hero. 'Protect them,' he whispers. And he dies — giving her everything he ever was.", "Close-up — ancient dragon dying, scales dimming, final words 'protect them', hero weeping, 6s", "The dragon who had guided her since episode one was gone. And in his death — she inherited ten thousand years of dragon wisdom.", "Dragon falling, final whisper, hero weeping, inheritance sound, emotional orchestral swell"),
        (24, "Wide cinematic — the hero RISES as a GOD. Heaven opens above Glory City. She ascends through the divine realm. The divine council watches in absolute silence as a mortal becomes one of them.", "Wide — hero ascending as god, heaven opening, divinity achieved, divine council watching, transcendent finale, 6s", "The girl from Glory City had become a god. And heaven itself — could not argue.", "Heaven opening, ascension sound, divinity achieved, divine council silent, transcendent finale"),
    ],
    "MTK": [
        (0, "Wide establishing — the forbidden floor of the Grand Library. Five massive locked doors, each glowing with elemental power: fire orange, water blue, earth brown, wind white, thunder purple.", "Wide — forbidden floor, five locked element doors, Mo Fan standing before them, mysterious atmosphere, 6s", "The forbidden floor held the five elements. One for each trial Mo Fan must pass alone — or die trying.", "Five doors humming, forbidden atmosphere, Mo Fan's footsteps, mystical tension building"),
        (6, "Close-up — Mo Fan in the fire trial. The flames test not his power — but his HEART. Can he accept that transformation is not loss? That changing yourself is not dying?", "Close-up — Mo Fan in fire trial, flames testing his heart, transformation understood, 6s", "Fire was not destruction. It was TRANSFORMATION. And the first step in changing the world — was changing himself.", "Fire testing heart, transformation understanding, Mo Fan accepting, mystical whoosh, mastery sound"),
        (12, "Wide cinematic — Mo Fan combines water and earth for the FIRST TIME IN HISTORY. MUD forms. STONE rises. Foundation and persistence united in a single technique.", "Wide — water and earth combining, mud forming stone rising, foundation and persistence united, power building, 6s", "No one had ever combined two elements like this. Fire could burn alone. Water could flow alone. But mud — mud could build worlds from nothing.", "Elements combining, mud forming, stone rising, power hum building, achievement orchestral swell"),
        (18, "Close-up — the first Grand Architect's history appears in the Grand Library's light. Mo Fan sees his own FACE reflected in the Architect's memory. He IS the first Grand Architect reborn.", "Close-up — first Architect history appearing, Mo Fan sees his own face as the first Architect, shocking revelation, 6s", "The first Grand Architect. The one who built the world ten thousand years ago. And he — was Mo Fan himself, reborn. He was building his OWN world.", "History revealing, shocked recognition, first Architect face, revelation sound, ancient truth"),
        (24, "Wide shot — Mo Fan as Grand Architect. The five elements MERGE in his palms. Not mixing — TRANSCENDING. A NEW WORLD takes shape — from nothing. From his five-element palms, existence itself is born.", "Wide — Grand Architect Mo Fan, five elements merged in palms, new world taking shape, transcendent finale, 6s", "The orphan who had been told he was nothing had become the architect of worlds. And from his five-element palms — creation itself was born.", "Five elements merging, world forming in palms, creation sound, Grand Architect achieved, transcendent finale"),
    ],
}


def make_episode_tuple(series_key, id_num, ep_num, subtitle, hook, story_arc, emotion):
    """Build a 12-element episode tuple matching gen-goal8.py format."""
    info = SERIES_DATA[series_key]
    series = info["name"]
    scenes = SCENE_TEMPLATES[series_key]
    music = info["music"]
    tags = f"xianxia, {series.lower()}, {series_key.lower()}, epic battle, chinese fantasy, cultivation"
    yt_title = f"{series} Tập {ep_num}: {subtitle} | Xianxia Việt Sub ⚔️"
    yt_desc = (f"Episode {ep_num} of {series}. {hook}\n\n"
                f"⚔️ {series} — Original Chinese Fantasy Series\n"
                f"📌 Follow for next episode\n"
                f"#xianxia #{series.lower().replace(' ','')} #epic")
    tt_caption = f"{hook} ⚔️🔥 Tập {ep_num} {series} #xianxia #cổtrang"
    title = f"{series} Episode {ep_num}: {subtitle}"
    return (id_num, ep_num, title, hook, story_arc, emotion, scenes, tags, music, yt_title, yt_desc, tt_caption)


def episodes_to_py_list(list_name, episodes):
    """Generate Python list literal for episodes."""
    lines = [f"# {list_name} ({len(episodes)} episodes)"]
    lines.append(f"{list_name} = [")
    for ep in episodes:
        id_num, ep_num, title, hook, story_arc, emotion, scenes, tags, music, yt_title, yt_desc, tt_caption = ep
        lines.append(f"    ({id_num}, {ep_num},")
        lines.append(f"     {repr(title)},")
        lines.append(f"     {repr(hook)},")
        lines.append(f"     {repr(story_arc)},")
        lines.append(f"     {repr(emotion)},")
        lines.append(f"     [")
        for s in scenes:
            lines.append(f"         ({s[0]}, {repr(s[1])}, {repr(s[2])}, {repr(s[3])}, {repr(s[4])}),")
        lines.append(f"     ],")
        lines.append(f"     {repr(tags)},")
        lines.append(f"     {repr(music)},")
        lines.append(f"     {repr(yt_title)},")
        lines.append(f"     {repr(yt_desc)},")
        lines.append(f"     {repr(tt_caption)}),")
    lines.append("]")
    return "\n".join(lines)


# Build all episodes
all_episodes = {}
for series_key, info in SERIES_DATA.items():
    list_name = f"{series_key}_E21_30"
    eps = []
    for i, (ep_num, subtitle, hook, story_arc, emotion) in enumerate(info["episodes"]):
        id_num = info["ids"][i]
        ep = make_episode_tuple(series_key, id_num, ep_num, subtitle, hook, story_arc, emotion)
        eps.append(ep)
    all_episodes[series_key] = (list_name, eps)

# Generate Python code for each list
list_py_codes = {}
for series_key, (list_name, eps) in all_episodes.items():
    list_py_codes[series_key] = episodes_to_py_list(list_name, eps)

new_write_scripts = '''

def write_scripts():
    count = 0

    print("\\n=== HA TIEN DU Episodes 21-30 ===")
    for ep in HA_TIEN_DU_E21_30:
        script = make_script(*ep)
        save(script, ep[0])
        count += 1

    print("\\n=== TRIEU TIEN Episodes 21-30 ===")
    for ep in TRIEU_TIEN_E21_30:
        script = make_script(*ep)
        save(script, ep[0])
        count += 1

    print("\\n=== DAU PHA THUONG KHAU Episodes 21-30 ===")
    for ep in DPTK_E21_30:
        script = make_script(*ep)
        save(script, ep[0])
        count += 1

    print("\\n=== TRU TIEN Episodes 21-30 ===")
    for ep in TRU_TIEN_E21_30:
        script = make_script(*ep)
        save(script, ep[0])
        count += 1

    print("\\n=== THANH VAN MON Episodes 21-30 ===")
    for ep in THANH_VAN_MON_E21_30:
        script = make_script(*ep)
        save(script, ep[0])
        count += 1

    print("\\n=== MUC THAN KY Episodes 21-30 ===")
    for ep in MUC_THAN_KY_E21_30:
        script = make_script(*ep)
        save(script, ep[0])
        count += 1

    print(f"\\nTotal scripts written: {count}")
    print("All 60 GOAL-8 scripts complete!")

write_scripts()
'''

# ================================================================
# Patch the file
# ================================================================
with open(TARGET, "r", encoding="utf-8") as f:
    content = f.read()

# Find where to insert: after ] of TRIEU_TIEN_E21_30, before def write_scripts()
# The file ends with:  ]\n\n\ndef write_scripts():
insert_marker = "]\n\n\ndef write_scripts():"
if insert_marker not in content:
    print("ERROR: Could not find insert marker in gen-goal8.py")
    # Try alternate
    idx = content.rfind("]\n\n\ndef write_scripts():")
    print(f"  Found at index: {idx}")
    if idx == -1:
        import sys
        sys.exit(1)

# Build new content to insert
insert_py = []
for series_key in ["DPTK", "TRU", "TVM", "MTK"]:
    list_name, eps = all_episodes[series_key]
    insert_py.append(episodes_to_py_list(list_name, eps))
    insert_py.append("")
insert_py_str = "\n\n".join(insert_py)

new_content = content.replace(insert_marker, "]" + insert_py_str + new_write_scripts, 1)

with open(TARGET, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"Patched {TARGET}")
print(f"New file length: {len(new_content)}")

# Validate
import ast
try:
    ast.parse(new_content)
    print("Python syntax: VALID")
except SyntaxError as e:
    print(f"Python syntax ERROR at line {e.lineno}: {e.msg}")
    print(f"  Line: {e.text[:80] if e.text else 'N/A'}")
