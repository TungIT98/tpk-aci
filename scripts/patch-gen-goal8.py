#!/usr/bin/env python3
"""Patch gen-goal8.py: add remaining 40 episodes and update write_scripts()."""
import sys

FILE = "C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI/scripts/gen-goal8.py"

# ================================================================
# Episode data: (id_num, ep_num, subtitle, hook, story_arc, emotion)
# ================================================================

DPTK_E21_30 = [
    (131, 21, "The Flame Emperor's Sealed Memories",
     "The Flame Emperor sealed his own memories three thousand years ago. Tonight, Xiao Yan broke that seal — and everything changed.",
     "Seal broken → Truth revealed → Flame Emperor past → Betrayal → Cold resolve",
     "Shock → Horror → Grief → Rage → Cold resolve"),
    (132, 22, "Ninefold Burning Heaven Third Transformation",
     "The Ninefold Burning Heaven had two transformations. Tonight, Xiao Yan unlocked the third — and the sky above the Flame Sect literally burned.",
     "Third transformation → Power surge → Sky ignites → Sect kneels → Saint alerted",
     "Tension → Power → Wonder → Awe → Menace"),
    (133, 23, "Xiao Mei in the Dou Qi Realm",
     "While Xiao Yan burned the sky, Xiao Mei descended into the Dou Qi realm alone — and emerged with a power that surprised everyone.",
     "Xiao Mei descends → Dou Qi trial → Power awakening → Armament achieved → Returns transformed",
     "Wonder → Trial → Struggle → Breakthrough → Triumph"),
    (134, 24, "The Jia Academy Headmaster Identity Revealed",
     "The Jia Academy headmaster had trained Xiao Yan since he was fifteen. Tonight, he revealed who he really was.",
     "Headmaster summoned → Truth revealed → History rewrites → SFS weakness → Legacy passed",
     "Trust → Shock → Betrayal → Grief → Understanding"),
    (135, 25, "The Flame Emperor Legacy Claimed",
     "The Flame Emperor left behind three gifts. Tonight, Xiao Yan found the third and most dangerous: his Dou Zun core.",
     "Third gift found → Dou Zun core → Integration → Power surge → Saint attacks",
     "Discovery → Urgency → Power → Danger → Defense"),
    (136, 26, "The Sky Fortune Saint Descends",
     "The Sky Fortune Saint had waited three thousand years. Tonight — he descended from his divine realm personally.",
     "Saint descends → Divine realm opens → Face to face → Challenge issued → Epic clash",
     "Horror → Dread → Confrontation → Challenge → Epic clash"),
    (137, 27, "Nine-Star Dou Huang Breakthrough",
     "Xiao Yan was at eight-star Dou Huang. To defeat a god — he needed nine stars. And the only way was to burn everything.",
     "Battle rages → Power pushed → Nine-star threshold → Celestial stars → Breakthrough",
     "Desperation → Pain → Breakthrough → Power surge → Hope"),
    (138, 28, "Universe Fire Collapse",
     "The Flame Emperor's final technique had no name. Xiao Yan gave it one: Universe Fire Collapse.",
     "Universe Fire Collapse → God-tier technique → Saint in danger → Seal cracks → Counter-attack",
     "Power → Climax → Danger → Reversal → Standoff"),
    (139, 29, "Sky Fortune Saint Defeated",
     "The Sky Fortune Saint had never lost in three thousand years. Tonight — he was proven wrong.",
     "Saint attacks desperately → Xiao Mei flanks → Combined assault → Saint overwhelmed → Retreating",
     "Desperation → Reversal → Combined attack → Victory → Saint retreating"),
    (140, 30, "Dou Zun Achieved — The True Heir",
     "Xiao Yan had defeated a god. But the Flame Emperor left one final lesson: true power is about protecting what you love.",
     "Victory → Flame Emperor lesson → Dou Zun naturally → New era → Standing together",
     "Triumph → Reflection → Breakthrough → New era → Peace"),
]

TRU_TIEN_E21_30 = [
    (141, 21, "Monarch of Shadows Speaks",
     "The Monarch of shadows had been silent for twenty episodes. Tonight, Jeon Jin-Woo finally heard the truth.",
     "Monarch speaks → Truth revealed → Jeon Jin-Woo shocked → Alliance fractured → Decision made",
     "Horror → Revelation → Shock → Fracture → Resolve"),
    (142, 22, "Demon King Counterpart",
     "Jeon Jin-Woo discovered the truth: the demon king was not his enemy. It was his shadow — literally.",
     "Counterpart revealed → Mirror battle → Shadow vs shadow → Identity crisis → Choosing to fight",
     "Confusion → Dread → Mirror battle → Identity crisis → Resolve"),
    (143, 23, "Ice Tribe Underground Realm Collapses",
     "The ice tribe underground realm had stood for ten thousand years. Tonight, it fell.",
     "Realm destabilizes → Earthquake → Ice tribe in danger → Jeon Jin-Woo decides → Collapse",
     "Warning → Destruction → Urgency → Decision → Catastrophe"),
    (144, 24, "The Final Gate Opens",
     "Behind the ice tribe realm was a gate sealed since the creation of the world. Tonight, it opened.",
     "Gate discovered → Jeon Jin-Woo approaches → Gate responds → Shadow throne visible → Opens",
     "Tension → Discovery → Recognition → Decision → Gate opening"),
    (145, 25, "Shadow Throne Claimed",
     "The shadow throne had been waiting for its king for ten thousand years. Jeon Jin-Woo sat upon it.",
     "Shadow throne reached → Throne tests him → Jeon Jin-Woo accepts → Power floods in → Crowned",
     "Awe → Test → Decision → Power → Crowning"),
    (146, 26, "Monarch vs Demon King",
     "Father and son. Shadow and shadow. Two monarchs of darkness facing each other at last.",
     "Confrontation begins → Father vs son → Shadow vs shadow → Technique clash → Neither yields",
     "Fury → Recognition → Battle → Technique clash → Standoff"),
    (147, 27, "Ice Tribe Princess Sacrifice",
     "The ice tribe princess had loved Jeon Jin-Woo since episode one. Tonight, she died to seal the gate.",
     "Final battle → Princess sees opportunity → She sacrifices herself → Gate sealed → Jeon Jin-Woo weeps",
     "Battle → Love → Sacrifice → Gate sealed → Grief"),
    (148, 28, "Shadow Clone Technique",
     "Jeon Jin-Woo was outnumbered a thousand to one. So he made a thousand of himself.",
     "Surrounded → Shadow clone activates → Many Jeon Jin-Woos → Battle turning → Victory",
     "Desperation → Activation → Many vs one → Turning point → Victory"),
    (149, 29, "Demon King's True Form Revealed",
     "The demon king shed his human form. What emerged was not a demon — it was something older.",
     "True form revealed → Ancient entity → World shudders → Jeon Jin-Woo faces old god → Final confrontation",
     "Horror → Revelation → World shuddering → Facing old god → Final confrontation"),
    (150, 30, "Shadow Throne King — Series Finale",
     "Jeon Jin-Woo had become the Monarch of shadows. Not by conquering — but by choosing to protect.",
     "Victory achieved → Shadow throne secured → World blessed → Jeon Jin-Woo's choice → Eternal guard",
     "Victory → Reflection → Blessing → Choice → Eternal guard"),
]

THANH_VAN_MON_E21_30 = [
    (151, 21, "Sacred Dragon Sect Technique Awakens",
     "The Sacred Dragon Sect technique had been sleeping for a thousand years. Tonight, it woke for the Glory City hero.",
     "Technique awakens → Ancient dragon power → Glory City trembling → Hero channels → Dragon rises",
     "Awe → Ancient power → Trembling → Channeling → Dragon rising"),
    (152, 22, "Time Regression Powers Manifest",
     "The hero had always felt time was strange. Tonight, she understood why: she could rewind it.",
     "Time anomaly → Hero feels it → First rewind → Battle reversed → Time power mastered",
     "Confusion → Recognition → First rewind → Shock → Mastery"),
    (153, 23, "Demon Dimension Gate Opens",
     "The demon dimension had been sealed since the wars of gods. Tonight, its gate cracked open over Glory City.",
     "Gate cracks → Chaos breaks in → Glory City attacks → Hero stands → Gate must be closed",
     "Horror → Chaos → Attack → Hero stands → Decision"),
    (154, 24, "Glory City Final Battle",
     "The battle for Glory City had been building for twenty episodes. Tonight, it reached its peak.",
     "Battle rages → All-out war → Glory City on edge → Hero final stand → Victory at cost",
     "Tension → War → Edge → Final stand → Victory"),
    (155, 25, "Ultimate Divine Ranking Achieved",
     "The divine rankings had put the hero at number seven for twenty episodes. Tonight, she reached number one.",
     "Ranking tournament → Hero climbs → Faces top → Victory → Number one achieved",
     "Challenge → Climb → Face top → Victory → Number one"),
    (156, 26, "Divine Realm Descends",
     "Heaven itself reached down to Glory City. The divine realm — the home of the immortals — became visible.",
     "Divine realm visible → Heaven descends → Glory City transformed → Hero chosen → Ascend or stay",
     "Awe → Transformation → Glory City → Hero chosen → Decision"),
    (157, 27, "Confrontation with the Divine Council",
     "The divine council had ruled heaven for ten thousand years. Tonight, the hero challenged their authority.",
     "Council confronted → Laws challenged → Hero accused → Council retaliates → Standing firm",
     "Confrontation → Accusation → Retaliation → Standing firm → Defiance"),
    (158, 28, "Sacrifice of the Dragon",
     "The ancient dragon who had guided the hero since episode one died tonight — saving her life.",
     "Dragon wounded → Final battle → Dragon intercepts → Dies protecting → Hero inherits",
     "Battle → Warning → Interception → Sacrifice → Inheritance"),
    (159, 29, "Divine Ranking Tournament",
     "The top ten immortals gathered for the divine tournament. The hero faced them all — one by one.",
     "Tournament begins → Hero enters → Faces immortals → Climactic fight → Toppling the top",
     "Challenge → Enter → Face immortals → Climax → Toppling top"),
    (160, 30, "Ascending to Divinity",
     "The hero had spent thirty episodes becoming strong enough to face heaven. Tonight, she became a god.",
     "Ascension begins → Heaven opens → Hero ascends → Divinity achieved → World blessed",
     "Beginning → Opening → Ascension → Divinity → World blessed"),
]

MUC_THAN_KY_E21_30 = [
    (161, 21, "Five Elements Forbidden Floor",
     "The forbidden floor of the Grand Library held the five elements. Mo Fan descended alone.",
     "Forbidden floor → Five elements locked → Mo Fan enters → Trial begins → First element",
     "Tension → Discovery → Entry → Trial → First element"),
    (162, 22, "Fire Element Mastery",
     "Mo Fan conquered the fire trial — and learned that fire was not destruction. It was transformation.",
     "Fire trial → Mo Fan enters → Fire tests → Transformation understood → Fire mastered",
     "Tension → Trial → Test → Understanding → Mastery"),
    (163, 23, "Water Element Mastery",
     "Mo Fan conquered the water trial — and learned that water was not passive. It was persistence.",
     "Water trial → Mo Fan enters → Water tests → Persistence proven → Water mastered",
     "Trial → Test → Persistence → Proven → Mastery"),
    (164, 24, "Earth Element Mastery",
     "Mo Fan conquered the earth trial — and learned that earth was not stillness. It was foundation.",
     "Earth trial → Mo Fan enters → Earth tests → Foundation proven → Earth mastered",
     "Trial → Test → Foundation → Proven → Mastery"),
    (165, 25, "Wind Element Mastery",
     "Mo Fan conquered the wind trial — and learned that wind was not freedom. It was adaptation.",
     "Wind trial → Mo Fan enters → Wind tests → Adaptation learned → Wind mastered",
     "Trial → Test → Adaptation → Learned → Mastery"),
    (166, 26, "Thunder Element Mastery",
     "The thunder trial was the last. Mo Fan conquered it — and learned that thunder was not power. It was truth.",
     "Thunder trial → Mo Fan enters → Thunder tests → Truth revealed → Thunder mastered",
     "Trial → Test → Truth → Revealed → Mastery"),
    (167, 27, "Grand Architect History Revealed",
     "The first Grand Architect had built the world ten thousand years ago. Tonight, Mo Fan learned who he really was.",
     "History discovered → First Architect revealed → Shocking truth → Mo Fan stunned → Inheritance",
     "Discovery → Shocking truth → Revelation → Stunned → Inheritance"),
    (168, 28, "Mo Fan Parents Revealed",
     "Mo Fan had been an orphan since birth. Tonight, he learned who his parents were — and why they left.",
     "Parents revealed → Mo Fan stunned → Their sacrifice → Why they left → Understanding",
     "Revelation → Stunned → Sacrifice → Explanation → Understanding"),
    (169, 29, "Five Elements Merge",
     "Mo Fan had mastered all five elements. Tonight, he combined them into one — the Grand Element.",
     "Elements align → Mo Fan attempts → Merge begins → Five become one → Grand Element achieved",
     "Alignment → Attempt → Merge → Five becoming one → Grand Element"),
    (170, 30, "Grand Architect Level Achieved",
     "Mo Fan had learned from the first Grand Architect. Tonight, he became the second.",
     "Architect level → Ascending → Grand Architect achieved → World responds → Series finale",
     "Ascension → Achieved → World responds → Recognition → Series finale"),
]

# Scene templates for each series
SCENE_TEMPLATES = {
    "Dau Pha Thuong Khau": [
        (0, "Wide establishing — the Flame Emperor sealed tomb at midnight. Ancient seals glow with suppressed power. Xiao Yan approaches.", "Wide — ancient tomb glowing at midnight, Xiao Yan approaching, ominous atmosphere, 6s", "The Flame Emperor had sealed his own memories three thousand years ago.", "Ancient seal humming, Xiao Yan's footsteps, ominous wind, tension drums"),
        (6, "Close-up — the sealed memory vision bleeds through the barrier. Young Flame Emperor's past revealed in fragments.", "Close-up — vision of Flame Emperor's past bleeding through seal, shocking truth in fragments, 6s", "Tonight, the seals broke. And what they showed Xiao Yan shattered everything he believed about his mentor.", "Vision whoosh, barrier breaking, shocked breath, revelation sound, ancient truth"),
        (12, "Wide cinematic — Xiao Yan's dou qi ERUPTS. Three thousand years of rage channeled into pure flame power.", "Wide — dou qi explosion from sealed memories, three thousand years of rage, Xiao Yan transformed, 6s", "Three thousand years of rage — finally released. The heir had become something his mentor never was: beyond forgiveness.", "Dou qi explosion, ancient power roaring, rage channeling, epic orchestral swell"),
        (18, "Close-up — the Sky Fortune Saint SENSES the power surge. His ancient face shows genuine fear for the first time in millennia.", "Close-up — Sky Fortune Saint sensing power surge, first fear in 3000 years, ominous recognition, 6s", "The god of fortune had not been afraid in three thousand years. Until tonight.", "Ancient fear rising, SFS sharp inhale, ominous bass, tension building strings"),
        (24, "Wide shot — Xiao Yan stands transformed. The Flame Emperor's heir no longer — now the Flame Emperor himself reborn.", "Wide — transformed Xiao Yan standing, heir becoming emperor, final defiant stance, 6s", "The heir had become the emperor. And heaven itself would learn what that meant.", "Emperor aura, transformed stance, epic orchestral finale, resolve"),
    ],
    "Tru Tien": [
        (0, "Wide establishing — the shadow throne chamber deep underground. Absolute darkness. Ancient power.", "Wide — shadow throne chamber underground, absolute darkness, Jeon Jin-Woo approaching, 6s", "The Monarch of shadows had been waiting ten thousand years. Tonight, Jeon Jin-Woo finally heard why.", "Shadow chamber humming, ancient darkness, Jeon's careful footsteps, tension drums"),
        (6, "Close-up — the shadow throne SPEAKS. A voice of ten thousand years of patience and loneliness.", "Close-up — shadow throne speaking with ancient voice, Jeon Jin-Woo listening in shock, 6s", "The throne spoke. And its words explained everything: the demon king's origin, Jeon Jin-Woo's destiny, and the choice that would define him.", "Ancient voice, shadow throne speaking, Jeon stunned, revelation sound, ancient truth"),
        (12, "Wide cinematic — Jeon Jin-Woo vs his shadow. The demon king's clone uses the shadow clone technique — perfected.", "Wide — Jeon vs shadow clone, demon king's perfected shadow technique clashing, mirror battle, 6s", "Shadow against shadow. The demon king's technique vs Jeon Jin-Woo's. And only one could claim the throne.", "Shadow clash, mirror battle sounds, technique perfected, tension rising, epic orchestral swell"),
        (18, "Close-up — the ice tribe princess at the collapsing gate. She makes her choice — to save Jeon Jin-Woo's world.", "Close-up — ice tribe princess at collapsing gate, choosing to sacrifice, determined tearful face, 6s", "She had loved him since episode one. Tonight, she chose to save him — and a thousand worlds — with her life.", "Gate collapsing, princess choosing, sacrifice sound, emotional swell, her final breath"),
        (24, "Wide cinematic — Jeon Jin-Woo on the shadow throne crowned in living darkness. The Monarch of shadows reborn.", "Wide — shadow throne crowned, Jeon Jin-Woo as Monarch, living darkness crown, transcendent finale, 6s", "The boy called trash had become the Monarch of shadows. And the first act of his reign — was to protect everything he had almost lost.", "Shadow crown forming, power flooding in, Monarch crowned, epic orchestral finale, resolve"),
    ],
    "Thanh Van Mon": [
        (0, "Wide establishing — Glory City at sunrise. The Sacred Dragon Sect ancient seals BREAK. Ancient dragon power awakens.", "Wide — Glory City at sunrise, dragon seals breaking, ancient power awakening, breathtaking scale, 6s", "The dragon technique had been sleeping for a thousand years. Tonight, it woke — and Glory City trembled.", "Ancient dragon power humming, sunrise light, seals breaking, awakening mystical sound"),
        (6, "Close-up — the hero in battle. Time fractures around her hands. She reaches out — and REWINDS a killing blow.", "Close-up — hero in battle, time fracturing, rewinding a killing blow, time power first manifest, 6s", "Time. She could REWIND it. And in rewinding a single moment — she changed everything that followed.", "Time fracturing sound, rewind whoosh, battle reversing, power manifest, mystical orchestral"),
        (12, "Wide cinematic — the demon dimension gate CRACKS open above Glory City. Chaos pours through like black water.", "Wide — demon gate cracking open above Glory City, chaos pouring through, city screaming, terrifying scale, 6s", "The demon dimension had been sealed since the wars of gods. Until tonight. Until the gate chose Glory City to break.", "Gate cracking, chaos roaring, Glory City screaming, ominous orchestral, world shuddering"),
        (18, "Close-up — the ancient dragon FALLS. His scales dimming. He looks at the hero and whispers: 'Protect them.' He dies.", "Close-up — ancient dragon dying, scales dimming, final words 'protect them', hero weeping, 6s", "The dragon who had guided her since episode one was gone. And in his death — he gave her everything he had ever learned.", "Dragon falling, final whisper, hero weeping, inheritance sound, emotional orchestral swell"),
        (24, "Wide cinematic — the hero RISES as a GOD. Heaven opens. She ascends. The divine council watches in silence.", "Wide — hero ascending as god, heaven opening, divinity achieved, divine council watching, transcendent finale, 6s", "The girl from Glory City had become a god. And heaven itself — could not argue.", "Heaven opening, ascension sound, divinity achieved, divine council silent, transcendent finale"),
    ],
    "Muc Than Ky": [
        (0, "Wide establishing — the forbidden floor of the Grand Library. Five massive locked doors, each glowing with element power.", "Wide — forbidden floor, five locked element doors, Mo Fan standing before them, mysterious atmosphere, 6s", "The forbidden floor held the five elements — fire, water, earth, wind, thunder. One for each trial Mo Fan must pass alone.", "Five doors humming, forbidden atmosphere, Mo Fan's footsteps, mystical tension building"),
        (6, "Close-up — Mo Fan in the fire trial. The flames test not his power — but his HEART. Can he accept change?", "Close-up — Mo Fan in fire trial, flames testing his heart, transformation understood, 6s", "Fire was not destruction. It was TRANSFORMATION. And the first step in changing the world — was changing yourself.", "Fire testing heart, transformation understanding, Mo Fan accepting, mystical whoosh, mastery sound"),
        (12, "Wide cinematic — Mo Fan combines water and earth. MUD forms. STONE rises. Foundation and persistence united.", "Wide — water and earth combining, mud forming stone rising, foundation and persistence united, power building, 6s", "No one had ever combined two elements like this. Fire could burn alone. Water could flow alone. But mud — mud could build worlds.", "Elements combining, mud forming, stone rising, power hum building, achievement orchestral swell"),
        (18, "Close-up — the first Grand Architect's history appears in the light. Mo Fan sees his own FACE. He IS the first Architect reborn.", "Close-up — first Architect history, Mo Fan sees his own face as the first Architect, shocking revelation, 6s", "The first Grand Architect. The one who built the world ten thousand years ago. And he — was Mo Fan himself, reborn.", "History revealing, shocked recognition, first Architect face, revelation sound, ancient truth"),
        (24, "Wide shot — Mo Fan as Grand Architect. The five elements MERGE in his palms. A NEW WORLD takes shape — from nothing.", "Wide — Grand Architect Mo Fan, five elements merged in palms, new world taking shape, transcendent finale, 6s", "The orphan who had been told he was nothing had become the architect of worlds. And from his five-element palms — creation itself was born.", "Five elements merging, world forming in palms, creation sound, Grand Architect achieved, transcendent finale"),
    ],
}

def build_episodes(list_data, series):
    """Build full episode tuples from (id, ep, subtitle, hook, arc, emotion)."""
    scenes_templates = SCENE_TEMPLATES[series]
    result = []
    for (id_num, ep_num, subtitle, hook, story_arc, emotion) in list_data:
        title = f"{series} Episode {ep_num}: {subtitle}"
        tags = f"xianxia, {series.lower()}, epic battle, chinese fantasy, cultivation"
        bg_music = f"Epic Chinese orchestral, {series} theme, climactic arc, 95 BPM"
        yt_title = f"{series} Tập {ep_num}: {subtitle} | Xianxia Việt Sub ⚔️"
        yt_desc = f"Episode {ep_num} of {series}. {hook}\n\n⚔️ {series} — Original Chinese Fantasy Series\n📌 Follow for next episode\n#xianxia #{series.lower().replace(' ','')} #epic"
        tt_caption = f"{hook} ⚔️🔥 Tập {ep_num} {series} #xianxia #cổtrang"
        scenes = [(t[0], t[1], t[2], t[3], t[4]) for t in scenes_templates]
        result.append((id_num, ep_num, title, hook, story_arc, emotion, scenes, tags, bg_music, yt_title, yt_desc, tt_caption))
    return result

DPTK_eps = build_episodes(DPTK_E21_30, "Dau Pha Thuong Khau")
TRU_eps = build_episodes(TRU_TIEN_E21_30, "Tru Tien")
TVM_eps = build_episodes(THANH_VAN_MON_E21_30, "Thanh Van Mon")
MTK_eps = build_episodes(MUC_THAN_KY_E21_30, "Muc Than Ky")

# Convert to Python list repr
import json

def episodes_to_py(list_name, episodes):
    lines = [f"\n# ============================================================"]
    lines.append(f"# {list_name.replace('_',' ').title().replace('E21 30','E21-30')} ({list_name} list)")
    lines.append(f"{list_name} = [")
    for ep in episodes:
        id_num, ep_num, title, hook, story_arc, emotion, scenes, tags, bg_music, yt_title, yt_desc, tt_caption = ep
        lines.append(f"    ({id_num}, {ep_num}, {repr(title)},")
        lines.append(f"     {repr(hook)},")
        lines.append(f"     {repr(story_arc)},")
        lines.append(f"     {repr(emotion)},")
        lines.append(f"     [")
        for s in scenes:
            lines.append(f"         ({s[0]}, {repr(s[1])}, {repr(s[2])}, {repr(s[3])}, {repr(s[4])}),")
        lines.append(f"     ],")
        lines.append(f"     {repr(tags)},")
        lines.append(f"     {repr(bg_music)},")
        lines.append(f"     {repr(yt_title)},")
        lines.append(f"     {repr(yt_desc)},")
        lines.append(f"     {repr(tt_caption)}),")
    lines.append("]")
    return "\n".join(lines)

# Build new write_scripts function
NEW_WRITE = '''
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

# Now patch the file
with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

# Find the position to insert new lists (after the TRIEU_TIEN_E21_30 ] and before def write_scripts)
# The file ends with:  ]\n\n\ndef write_scripts():\ninsert_marker = "]\n\n\ndef write_scripts():"
new_lists = episodes_to_py("DPTK_E21_30", DPTK_eps)
new_lists += episodes_to_py("TRU_TIEN_E21_30", TRU_eps)
new_lists += episodes_to_py("THANH_VAN_MON_E21_30", TVM_eps)
new_lists += episodes_to_py("MUC_THAN_KY_E21_30", MTK_eps)

if insert_marker not in content:
    print("ERROR: Could not find insert marker!")
    print("Looking for:", repr(insert_marker))
    # Try alternate
    idx = content.rfind("]\n\n\ndef write_scripts():")
    if idx == -1:
        idx = content.rfind("def write_scripts():")
    print(f"Found def write_scripts at: {idx}")
    sys.exit(1)

new_content = content.replace(insert_marker, "]" + new_lists + NEW_WRITE, 1)

with open(FILE, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"Patched {FILE}")
print(f"New file length: {len(new_content)}")
print(f"Added: DPTK_E21_30 ({len(DPTK_eps)}), TRU_TIEN_E21_30 ({len(TRU_eps)}), THANH_VAN_MON_E21_30 ({len(TVM_eps)}), MUC_THAN_KY_E21_30 ({len(MTK_eps)})")

# Validate Python syntax
import ast
try:
    ast.parse(new_content)
    print("Python syntax: VALID")
except SyntaxError as e:
    print(f"Python syntax ERROR: {e}")
