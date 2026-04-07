#!/usr/bin/env python3
"""Generate GOAL-9 scripts (XIANYX-171 to 230) by adapting GOAL-8 scripts.
Reads existing GOAL-8 scripts (111-170) and creates adapted versions for episodes 31-40."""
import json, re
from pathlib import Path

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
SRC = ROOT / "scripts" / "pending" / "xianxia"
OUT = ROOT / "scripts" / "pending" / "xianxia"

# Map: goal8_id -> (goal9_id, ep_num, ep_suffix)
# Episodes 31-40 for each of 6 series = 60 scripts
MAP_31_40 = [
    # Ha Tien Du 21-30 -> 31-40 (171-180)
    (111,171,31,"Episode 31: The Celestial Gate"),(112,172,32,"Episode 32: The Celestial Library"),
    (113,173,33,"Episode 33: The Road Home"),(114,174,34,"Episode 34: The Last Gift"),
    (115,175,35,"Episode 35: The Last Bridge"),(116,176,36,"Episode 36: The Eternal Water"),
    (117,177,37,"Episode 37: The Final Trial"),(118,178,38,"Episode 38: The Mortal Return"),
    (119,179,39,"Episode 39: The Water Remembers"),(120,180,40,"Episode 40: The Eternal Spring"),
    # Trieu Tien 21-30 -> 31-40 (181-190)
    (121,181,31,"Episode 31: The Nine-Star Summit"),(122,182,32,"Episode 32: The Flame Sect's Legacy"),
    (123,183,33,"Episode 33: The Dou Zong Challenge"),(124,184,34,"Episode 34: The Sky Fortune Saint's Test"),
    (125,185,35,"Episode 35: The Emperor's Decree"),(126,186,36,"Episode 36: The Imperial Palace Fire"),
    (127,187,37,"Episode 37: The War of Philosophies"),(128,188,38,"Episode 38: The Flame Sect Reunites"),
    (129,189,39,"Episode 39: The Dou Di Congress"),(130,190,40,"Episode 40: The Eternal Flame"),
    # Dau Pha Thuong Khau 21-30 -> 31-40 (191-200)
    (131,191,31,"Episode 31: The Emperor's Tomb Opens"),(132,192,32,"Episode 32: The Ninefold Complete"),
    (133,193,33,"Episode 33: The Memory Bridge"),(134,194,34,"Episode 34: The Palace Reborn"),
    (135,195,35,"Episode 35: The Emperor's Two Halves"),(136,196,36,"Episode 36: The Fire That Heals"),
    (137,197,37,"Episode 37: The Academy Founded"),(138,198,38,"Episode 38: The Betrayer's Redemption"),
    (139,199,39,"Episode 39: The Eternal Fire"),(140,200,40,"Episode 40: The Emperor's Children"),
    # Tru Tien 21-30 -> 31-40 (201-210)
    (141,201,31,"Episode 31: The Shadow Throne's True Purpose"),(142,202,32,"Episode 32: The Monarch's Promise"),
    (143,203,33,"Episode 33: The Demon King Speaks"),(144,204,34,"Episode 34: The Shadow Army Assembles"),
    (145,205,35,"Episode 35: The Darkest Realm's Invasion"),(146,206,36,"Episode 36: The Monarch's Sacrifice"),
    (147,207,37,"Episode 37: The Peace Treaty"),(148,208,38,"Episode 38: The Shadow Library"),
    (149,209,39,"Episode 39: The Last Shadow Guard"),(150,210,40,"Episode 40: The Eternal Monarch"),
    # Thanh Van Mon 21-30 -> 31-40 (211-220)
    (151,211,31,"Episode 31: The Divine Seal Cracks"),(152,212,32,"Episode 32: The Demon Dimension Wakes"),
    (153,213,33,"Episode 33: The Time Master's Dilemma"),(154,214,34,"Episode 34: The Past Life War"),
    (155,215,35,"Episode 35: The God Realm Intervention"),(156,216,36,"Episode 36: The Time Regression Reborn"),
    (157,217,37,"Episode 37: The Sacred Dragon's Final Gift"),(158,218,38,"Episode 38: The Demon King's Apology"),
    (159,219,39,"Episode 39: The Web of Time"),(160,220,40,"Episode 40: The Eternal Time"),
    # Muc Than Ky 21-30 -> 31-40 (221-230)
    (161,221,31,"Episode 31: The Forbidden Floor Opens"),(162,222,32,"Episode 32: The Five Elements Speak"),
    (163,223,33,"Episode 33: The Grand Architect's Memory"),(164,224,34,"Episode 34: The New World Takes Shape"),
    (165,225,35,"Episode 35: The Library of Everything"),(166,226,36,"Episode 36: The Five Elements United"),
    (167,227,37,"Episode 37: The Student's Test"),(168,228,38,"Episode 38: The Orphan's Library"),
    (169,229,39,"Episode 39: The Grand Architect Returns"),(170,230,40,"Episode 40: The Eternal Archive"),
]

HOOKS_31_40 = {
    171: "The celestial gate had been sealed since the first gods. Tonight, Luân carried the fire mark, ice mastery, and Water of Origin — and opened it alone.",
    172: "The celestial library held every secret of existence. Luân was given one hour — and chose a book of sacrifices over power techniques.",
    173: "Luân descended from heaven carrying the knowledge of sacrifice. The shadow empire had been waiting — and ambushed him with a thousand soldiers.",
    174: "Luân returned home to find shadow already there — his people trapped. He poured his elemental mastery into the barrier — and became everything he had left.",
    175: "The bridge was almost gone. The void descended. And Luân — with nothing left — became the bridge one final time.",
    176: "Luân became the eternal bridge between worlds. His body stretched across the void — became the barrier that would never fall.",
    177: "The celestial realm sent its final trial: not combat — but the choice to let go. Luân had to choose: stay as bridge forever — or become mortal again.",
    178: "Luân returned to the mortal realm — no fire mark, no ice blades, no Water of Origin. Just a man. And his people — safe forever.",
    179: "Years later: the waterfall glowed. Luân — old now — sat beside it. And the water showed him: everyone he had saved, living full lives.",
    180: "On his last day, Luân returned to the dragon gate one final time. Heaven itself — bowed to the mortal who had become eternal.",
    181: "The Dou Di Summit: nine Nine-star Dou Huangs gathered. Xiao Yan — the youngest — was the only one who had earned his stars through failure.",
    182: "The Flame Sect elders revealed: the Extinction Flame was not just a technique — it was a philosophy. To burn the old — so the new could be born.",
    183: "A Dou Zong — two full realms above — challenged Xiao Yan publicly. He accepted — and showed why technique beats raw power.",
    184: "The Sky Fortune Saint tested Xiao Yan with a question: 'What will you burn to build your world?'",
    185: "Xiao Yan became the youngest Flame Emperor in history — not by conquest, but by being the first emperor who asked his people what they needed.",
    186: "Xiao Yan set fire to his own imperial palace — to prove that an emperor who could let go of comfort — could never be corrupted.",
    187: "Other empires attacked — not the body, but the philosophy. Xiao Yan's way threatened foundations of power everywhere.",
    188: "The Flame Sect — scattered for a thousand years — reunited under Xiao Yan. Not as army — as family.",
    189: "Xiao Yan called the first Dou Di Congress — all realms, all factions. He proposed: no more wars fought over what could be shared.",
    190: "On his last day as emperor, Xiao Yan passed the Extinction Flame to the next generation — as a promise that burning old things lets something better begin.",
    191: "Xiao Mei touched the Emperor's tomb — and it opened. Inside: not a body — but the Flame Emperor's final lesson, preserved for a thousand years.",
    192: "Xiao Yan completed the Ninefold Burning Heaven — all nine transformations achieved. The Flame Emperor's full legacy — finally inherited.",
    193: "Xiao Mei and Xiao Yan together became the memory bridge — connecting past emperor to future world. Two children — carrying a thousand years.",
    194: "The Flame Emperor's palace — restored to its original glory — became not a tomb, but a living school where anyone could learn.",
    195: "The Flame Emperor had been two people who became one. Xiao Mei and Xiao Yan — proved that being two people who were one — was stronger.",
    196: "Xiao Yan discovered: the Extinction Flame could not only destroy — it could HEAL. Burn the sickness — not the body.",
    197: "Xiao Yan founded the first Flame Academy — open to all, regardless of birth. The old world gasped. The new world began.",
    198: "The disciple who had betrayed the Flame Emperor a thousand years ago — appeared. Not as enemy — as penitent. And forgiveness was offered.",
    199: "The Flame Emperor's fire — now in two children — spread across the world. Not as conquest — as warmth. Every cold night — lit.",
    200: "The Flame Emperor watched from beyond — two children carrying his fire. And for the first time in a thousand years — he smiled.",
    201: "Jeon Jin-Woo sat upon the shadow throne — and understood its true purpose: not to conquer light — but to protect it.",
    202: "Jeon Jin-Woo made a promise: as long as he sat upon the shadow throne — no shadow would touch an innocent. A promise witnessed by gods.",
    203: "The demon king within Jeon Jin-Woo spoke — not with malice, but with wisdom accumulated over ten thousand years.",
    204: "Jeon Jin-Woo gathered shadow soldiers — not to attack, but to DEFEND. The largest protective army ever assembled.",
    205: "The darkest realm invaded — but found shadow armies protecting, not attacking. Confusion became fear became respect.",
    206: "Jeon Jin-Woo sacrificed his immortality — to become fully human again. The demon king's wisdom — lived in him as memory.",
    207: "Jeon Jin-Woo brokered the first peace treaty between light and shadow — not through weakness, but through understanding.",
    208: "Jeon Jin-Woo built the shadow library — every dark technique ever invented — so it could never be used again.",
    209: "The last shadow guard was placed — not to keep enemies out, but to remind the world that darkness was just light that had not yet found its way.",
    210: "Jeon Jin-Woo left the shadow throne — and became the first mortal to walk freely between light and shadow — forever.",
    211: "Glory City's divine seals — that had held for a thousand years — began to crack. Something ancient was about to return.",
    212: "The demon dimension stirred — and sent not an army, but a SINGLE MESSAGE: Nie Li. We remember. We are coming.",
    213: "Nie Li discovered: sealing the demon dimension again would cost him everything — including the people he loved.",
    214: "Nie Li's past life memories flooded back — a war that had lasted a thousand years — and he was the one who had started it.",
    215: "The god realm intervened — and offered Nie Li godhood in exchange for opening the demon dimension willingly.",
    216: "Nie Li used time regression not to go back — but to bring the future forward. Every sacrifice that would happen — he saw. And changed.",
    217: "The sacred dragon — dying — gave Nie Li its final gift: the ability to see time — not as a line, but as a web.",
    218: "The demon king — appearing in person — apologized. 'We did not know what we were doing. We were young.'",
    219: "Nie Li wove the web of time — connecting every realm, every era, every choice — into one infinite tapestry of existence.",
    220: "Nie Li became one with time itself — not as a god, but as the flow between moments. Every hero's story — carried forward.",
    221: "The forbidden floor's final door — the one that had never been opened — creaked. Mo Fan stood before it with all five elements mastered.",
    222: "The five elements spoke — for the first time in ten thousand years. They had been waiting for someone who could truly listen.",
    223: "Mo Fan remembered: he was not the reincarnation of the Grand Architect. He was the FIRST Grand Architect — who had forgotten.",
    224: "From his five-element palms — Mo Fan created not a weapon, not a technique — but the BLUEPRINT for a new world.",
    225: "Mo Fan built the Library of Everything — every secret, every technique, every story — accessible to all who sought it.",
    226: "The five elements united — not in Mo Fan's palms — but in every person who walked through the library's doors.",
    227: "A student — young, afraid, told she had no talent — walked through the library's doors. Mo Fan watched. And remembered himself.",
    228: "Mo Fan built the orphan's wing — for every child who had been told they were nothing. Every story of those who became something.",
    229: "Mo Fan returned to the place where he had been told he was nothing — and left a library. So no child would ever hear those words again.",
    230: "Mo Fan faded — not in death, but in becoming the library itself. Every book, every secret, every story — was him now.",
}

STORY_ARCS = {
    171: "Gate discovered → Three elements combined → Gate opens → Celestial realm → Awe",
    172: "Wonder → Offering → Choice → Discovery → Resolve",
    173: "Descent → Ambush → Alone fighting → Elemental combo → Escape",
    174: "Return → Horror → Confrontation → Sacrifice → Safe",
    175: "Weakness → Void weapon → Bridge renewed → Final stand → Held",
    176: "Bridge stretched → Void pressing → Will holding → Eternal → Protected",
    177: "Trial → Choice → Letting go → Mortal return → Freedom",
    178: "Mortal return → No powers → Just a man → Safe people → Peace",
    179: "Years later → Old by waterfall → Water shows → Saved lives → Gratitude",
    180: "Last day → Dragon gate → All bow → Mortal eternal → Legend",
    181: "Gathering → Youngest → Failure earned → Dominance → Proof",
    182: "Legacy → Philosophy → Burn old → New born → Understanding",
    183: "Challenge → Accept → Technique vs power → Victory → Proof",
    184: "Test → Question → What to burn → Answer → Purpose",
    185: "Becoming emperor → Asking → People's needs → New kind → Revolution",
    186: "Palace fire → Let go comfort → Cannot corrupt → Proof → Trust",
    187: "War → Philosophy attacked → Defense → New philosophy → Victory",
    188: "Reunion → Scattered → Family → Reunited → Strength",
    189: "Congress → All realms → Sharing → Proposal → Beginning",
    190: "Last day → Passing flame → Promise → New beginning → Eternal",
    191: "Tomb opens → Not body → Final lesson → Preserved → Waiting",
    192: "Ninefold complete → All nine → Full legacy → Inherited → Complete",
    193: "Memory bridge → Two children → Past to future → Connected → Carrying",
    194: "Palace reborn → School not tomb → Living → Open → Learning",
    195: "Two halves → Two who are one → Stronger → Proved → Complete",
    196: "Fire heals → Burn sickness → Revolutionary → Medicine → New way",
    197: "Academy founded → Open to all → Old gasps → New begins → Beginning",
    198: "Betrayer appears → Penitent → Forgiveness → Redemption → Peace",
    199: "Eternal fire → Warmth not conquest → Every cold night lit → Warm → Everywhere",
    200: "Emperor watching → Two children → Smile → Not restored — improved → Better",
    201: "Shadow throne → True purpose → Protect light → Guardian → Understood",
    202: "Promise → Shadow throne → No innocent touched → Witnessed → Sacred",
    203: "Demon king speaks → Not malice → Wisdom → Ten thousand years → Guidance",
    204: "Shadow army → Assembles → Defend not attack → Largest protection → Unprecedented",
    205: "Darkest realm → Invasion → Protection found → Confusion → Respect",
    206: "Sacrifice → Immortality given up → Human again → Wisdom as memory → Living",
    207: "Peace treaty → Light and shadow → Not weakness → Understanding → Historic",
    208: "Shadow library → Every dark technique → So it can't be used → Archive → Prevention",
    209: "Last shadow guard → Reminder → Darkness is light → Waiting → Hope",
    210: "Left throne → Freely walk → Between light and shadow → Forever → Eternal",
    211: "Seals crack → Thousand years held → Ancient returning → About to happen → Urgent",
    212: "Demon dimension wakes → Single message → We remember → Coming → Dread",
    213: "Dilemma → Seal again → Cost everything → Including loved ones → Heartbreaking",
    214: "Past life war → Thousand years → He started it → Guilt → Understanding",
    215: "God realm → Intervention → Godhood offered → Exchange → Temptation",
    216: "Regression reborn → Future brought forward → Every sacrifice seen → Changed → Redeemed",
    217: "Dragon's final gift → See time as web → Not line → Connected → Wisdom",
    218: "Demon king apology → Appearing → Did not know → Young → Understanding",
    219: "Web of time → Every realm → Every era → One tapestry → Infinite",
    220: "One with time → Not god → Flow between moments → Every story → Carried",
    221: "Forbidden floor → Final door → Never opened → Stood before → Destiny",
    222: "Five elements speak → Ten thousand years → Waiting → Listen → Connection",
    223: "Architect's memory → Not reincarnation → Was first → Forgot → Remembered",
    224: "New world → From five-element palms → Blueprint → Not weapon → Creation",
    225: "Library of everything → Every secret → Accessible to all → Seeking → Open",
    226: "Five elements united → Not in palms → In every person → Library doors → Everyone",
    227: "Student's test → Young, afraid → No talent → Walked through → Remembered",
    228: "Orphan's wing → Told nothing → Became something → Every story → Hope",
    229: "Grand architect returns → Told nothing → Left library → No child hears → Legacy",
    230: "Faded → Not death → Became library → Every book → Eternal",
}

count = 0
for src_id, dst_id, ep_num, ep_suffix in MAP_31_40:
    src_path = SRC / f"XIANYX-{src_id:03d}.json"
    if not src_path.exists():
        print(f"SKIP {src_id}: source script not found")
        continue
    with open(src_path, encoding="utf-8-sig") as f:
        script = json.load(f)
    # Update ID and title
    old_title = script.get("title", "")
    series = old_title.split(" Episode ")[0].strip()
    script["id"] = f"XIANYX-{dst_id:03d}"
    script["title"] = f"{series} {ep_suffix}"
    script["episode"] = ep_num
    script["status"] = "pending"
    script["created_at"] = "2026-04-07T06:45:00Z"
    # Update concept
    if "concept" in script:
        hook = HOOKS_31_40.get(dst_id, script["concept"].get("hook", ""))
        arc = STORY_ARCS.get(dst_id, script["concept"].get("story_arc", ""))
        script["concept"]["hook"] = hook
        script["concept"]["story_arc"] = arc
    # Update metadata
    if "metadata" in script:
        new_yt_title = f"{series} {ep_suffix} | Xianxia Việt Sub ⚔️🔥"
        new_yt_desc = f"{series} {ep_suffix}. {HOOKS_31_40.get(dst_id, '')}\n\n📌 Follow for next episode\n#xianxia #chinesefantasy #{series.lower().replace(' ','')} #epic"
        new_tt_cap = f"{HOOKS_31_40.get(dst_id, '')} ⚔️🔥 {series} {ep_suffix} | Xianxia Việt Sub #xianxia #cổtrang"
        script["metadata"]["youtube_title"] = new_yt_title
        script["metadata"]["youtube_description"] = new_yt_desc
        script["metadata"]["tiktok_caption"] = new_tt_cap
    # Update tags
    if "tags" in script and isinstance(script["tags"], list):
        script["tags"] = [t for t in script["tags"] if t not in ["pending", "produced"]]
        script["tags"].append("goal9")
    # Update prompt_for_hailuo
    if "prompt_for_hailuo" in script:
        script["prompt_for_hailuo"] = script["prompt_for_hailuo"].replace(old_title, f"{series} {ep_suffix}")
    # Save
    dst_path = OUT / f"XIANYX-{dst_id:03d}.json"
    with open(dst_path, "w", encoding="utf-8-sig") as f:
        json.dump(script, f, indent=2, ensure_ascii=False)
    print(f"Created XIANYX-{dst_id:03d}.json ({series} {ep_suffix})")
    count += 1

print(f"\nDone: {count} scripts created")
