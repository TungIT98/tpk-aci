#!/usr/bin/env python3
"""
GOAL-8 Script Generator: XiAnyX E21-30, all 6 series (60 scripts)
Writes XIANYX-111 to XIANYX-170 to scripts/pending/xianxia/
"""
import json, os

WORKSPACE = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI"
OUT_DIR = os.path.join(WORKSPACE, "scripts", "pending", "xianxia")

SERIES_CONFIG = [
    # (start_id, series, channel, ep_start, ep_end, protagonist, arc_theme)
    (111, "Ha Tien Du",      "Ha Tien Du",       21, 30, "Lu\u00e2n",   "dragon realm, fire-ice mastery, shadow empire"),
    (121, "Trieu Tien",     "Trieu Tien",       21, 30, "Xiao Yan",   "Dou Di battleground, Nine-star Dou Huang, Flame Sect"),
    (131, "Dau Pha Thuong Khau", "Dau Pha Thuong Khau", 21, 30, "Xiao Yan", "Flame Emperor legacy, Ninefold Burning Heaven, Jia Academy"),
    (141, "Tru Tien",       "Tru Tien",         21, 30, "Jeon Jin-Woo", "monarch of shadows, demon king, shadow throne"),
    (151, "Thanh Van Mon",  "Thanh Van Mon",    21, 30, "Nie Li",     "Sacred Dragon, time regression, demon dimension, divine ranking"),
    (161, "Muc Than Ky",    "Muc Than Ky",      21, 30, "Mo Fan",     "five elements, Grand Architect, forbidden floor"),
]

# Episode plot outlines per series (climactic beats)
EPISODE_PLOTS = {
    "Ha Tien Du": [
        ("21", "The Dragon's Eye Opens",     "Lu\u00e2n discovers the hidden dragon realm entrance beneath the ancient temple"),
        ("22", "Trial of Fire and Ice",       "Lu\u00e2n faces the first trial: he must master both fire and ice simultaneously"),
        ("23", "The Frozen Scripture",         "Ancient dragon scriptures reveal the shadow empire's true origin"),
        ("24", "Ice Breaks, Fire Falls",      "Lu\u00e2n's fire-ice balance shatters; a great disaster begins"),
        ("25", "The Shadow Emperor Awakens", "The shadow empire's leader, dormant for centuries, stirs beneath the mountains"),
        ("26", "Blood of the First Dragon",   "Lu\u00e2n learns he carries the bloodline of the original dragon sovereign"),
        ("27", "The Five Dragon Gates",        "Five ancient dragon gates appear across the realm, each guarded"),
        ("28", "Fire Dragon's Last Stand",    "The fire dragon elder makes a sacrifice to open the final gate"),
        ("29", "Into the Void",               "Lu\u00e2n enters the void between realms, confronting shadow soldiers"),
        ("30", "The Jade Emperor's Shadow",   "Lu\u00e2n faces the Jade Emperor champion — a being of pure corrupted light. Climactic finale."),
    ],
    "Trieu Tien": [
        ("21", "The Dou Di Plains",            "Xiao Yan arrives at the legendary Dou Di battleground where emperors are made"),
        ("22", "Nine-Star Dou Huang",           "Under a blood moon, Xiao Yan begins his Nine-star Dou Huang breakthrough"),
        ("23", "Flame Sect's Warning",          "The ancient Flame Sect protector speaks: 'Your fire is not strong enough yet'"),
        ("24", "The Forbidden Flame",           "Xiao Yan discovers a flame that burned the old world: the Extinction Flame"),
        ("25", "Dou Qi vs Douli",               "A rival Douli prodigy challenges Xiao Yan for the title of youngest Dou Huang"),
        ("26", "Jia Academy's Summons",          "The Jia Academy headmaster demands Xiao Yan face a trial by combat"),
        ("27", "The Missing Instructor",         "Xiao Yan's missing teacher is found — alive, but trapped in a soul form"),
        ("28", "Flame Sect Protector Awakens",  "The ancient protector of the Flame Sect awakens to test Xiao Yan"),
        ("29", "Sky Fortune Saint Appears",      "The legendary Sky Fortune Saint descends to judge Xiao Yan's worth"),
        ("30", "The Battle for Dou Di",          "Xiao Yan faces the Sky Fortune Saint champion in an earth-shattering duel. Climactic finale."),
    ],
    "Dau Pha Thuong Khau": [
        ("21", "The Sealed Door Cracks",        "Xiao Mei touches the sealed door; ancient Flame Emperor memories flood her mind"),
        ("22", "Memories of Fire",               "She relives the Flame Emperor's final battle — he was betrayed by his own disciple"),
        ("23", "Ninefold: First Transformation","Xiao Yan's Ninefold Burning Heaven technique completes its first transformation"),
        ("24", "The Flame Emperor's Will",       "The Flame Emperor's will appears, offering Xiao Yan his complete legacy"),
        ("25", "Jia Academy Headmaster's Secret","The headmaster of Jia Academy reveals his true identity: the betrayer's descendant"),
        ("26", "Xiao Mei Speaks in Dou Qi",     "Xiao Mei's Dou Qi realm power awakens — she speaks with the voice of a Dou Qi master"),
        ("27", "The Betrayer's Descendant",      "The headmaster activates a seal trapping Xiao Yan in a nightmare realm"),
        ("28", "Ninefold: Third Transformation", "Xiao Yan breaks through to the third Ninefold transformation under extreme pressure"),
        ("29", "Flame Emperor Legacy Claimed",  "Xiao Yan claims the Flame Emperor's full legacy — a complete fire that burns even destiny"),
        ("30", "The Fire That Burns Fate",       "In the climactic finale, Xiao Yan burns away the betrayer's legacy with the Extinction Flame. Epic climax."),
    ],
    "Tru Tien": [
        ("21", "The Monarch Speaks",             "The Monarch of Shadows speaks aloud for the first time — revealing Jeon Jin-Woo's true power"),
        ("22", "The Demon King Connection",      "Jeon Jin-Woo meets his demon king counterpart from the shadow dimension"),
        ("23", "Ice Tribe Realm Collapses",      "The ice tribe underground realm begins to collapse; Jin-Woo must save its people"),
        ("24", "The Shadow King's Memories",     "The shadow soldiers' memories reveal a war fought before the first shadow war"),
        ("25", "The Final Gate Opens",            "The final gate between the shadow dimension and earth slowly opens"),
        ("26", "Shadow Soldiers Awaken",         "Hundreds of shadow soldiers awaken, swearing loyalty to their new monarch"),
        ("27", "The Ruler's Dilemma",            "Jin-Woo must choose: rule the shadow dimension alone, or return to the human world"),
        ("28", "Ice and Shadow Unite",           "The ice tribe princess fuses her ice power with Jin-Woo's shadow power"),
        ("29", "March of the Shadow Army",       "The shadow army marches toward the demon king's fortress in the shadow dimension"),
        ("30", "The Shadow Throne",              "Jin-Woo claims the shadow throne — becoming the true Monarch of Shadows. Climactic finale."),
    ],
    "Thanh Van Mon": [
        ("21", "The Sacred Dragon's Secret",      "Nie Li discovers the Sacred Dragon Sect's hidden technique was never lost — it was hidden"),
        ("22", "Time Regression's True Cost",   "Using time regression too often begins to tear Nie Li's soul apart"),
        ("23", "The Demon Dimension Gate",       "A gate to the demon dimension opens in Glory City; demons begin to pour through"),
        ("24", "Nie Li's Darkest Memory",        "The demons exploit Nie Li's darkest memory — his failure in his previous life"),
        ("25", "The Sacred Dragon Awakens",      "The Sacred Dragon itself awakens within Nie Li, recognizing its true heir"),
        ("26", "Glory City's Last Stand",        "The demon army lays siege to Glory City; civilians trapped inside"),
        ("27", "The Time-Freeze Gambit",         "Nie Li freezes time across Glory City to evacuate the civilians"),
        ("28", "Sacred Dragon Divine Technique", "Nie Li unlocks the Sacred Dragon Sect's ultimate technique: Divine Dragon's Judgment"),
        ("29", "The Demon General's Challenge",  "The demon army's supreme general challenges Nie Li to single combat"),
        ("30", "Divine Ranking Achieved",        "Nie Li defeats the demon general and achieves the Ultimate Divine Ranking. Epic climax."),
    ],
    "Muc Than Ky": [
        ("21", "The Forbidden Floor",            "Mo Fan unlocks the five elements forbidden floor — the highest restricted level"),
        ("22", "Fire Element Awakens",           "The fire element inside Mo Fan erupts, burning away his remaining doubts"),
        ("23", "Water Element: The Drowning Truth","The water element reveals to Mo Fan the truth about his missing memories"),
        ("24", "Earth Element: Mountains Remember","The earth element shows him the Grand Architect's original vision for the world"),
        ("25", "Wind and Thunder Merge",         "Wind and thunder elements merge inside Mo Fan, creating a devastating new power"),
        ("26", "The Five Elements in One",        "All five elements combine for the first time — Mo Fan screams as his body transforms"),
        ("27", "The Grand Architect's History",   "The Grand Architect reveals he was once human: a young mage named Wei who dreamed of building a perfect world"),
        ("28", "Mo Fan's Parents: The Secret",   "A hidden memory crystal reveals Mo Fan's parents were the Architect's last two apprentices"),
        ("29", "The Architect's Final Test",      "The Grand Architect tests Mo Fan: build something that cannot be destroyed"),
        ("30", "Grand Architect Level",           "Mo Fan constructs an eternal structure and ascends to Grand Architect level. Series climax."),
    ],
}

TEMPLATE_SHOTS = [
    {"time_start": 0,  "time_end": 6,  "duration": 6,  "time_label": "0-6s"},
    {"time_start": 6,  "time_end": 12, "duration": 6,  "time_label": "6-12s"},
    {"time_start": 12, "time_end": 18, "duration": 6,  "time_label": "12-18s"},
    {"time_start": 18, "time_end": 24, "duration": 6,  "time_label": "18-24s"},
    {"time_start": 24, "time_end": 30, "duration": 6,  "time_label": "24-30s"},
]

TEMPLATE_SFX = [
    {"time": 0,  "sound": "mysterious reveal"},
    {"time": 6,  "sound": "power building"},
    {"time": 12, "sound": "climactic confrontation"},
    {"time": 18, "sound": "peak intensity"},
    {"time": 24, "sound": "epic resolution"},
]

def make_shot(shot_num, time_start, time_end, duration, prompt, camera, narration, sfx):
    return {
        "shot_number": shot_num,
        "time_start": time_start,
        "time_end": time_end,
        "duration": duration,
        "prompt": prompt,
        "camera": camera,
        "narration": narration,
        "sfx": sfx
    }

def build_narration(narr_list):
    return " ".join(narr_list)

def build_audio(narration_text, sfx_list, ep_num, series):
    bg_music_map = {
        "Ha Tien Du": "Epic Chinese orchestral, dragon realm mystery, fire-ice duality, triumphant 95 BPM",
        "Trieu Tien": "Epic battle orchestral, flame fury, Dou Di conquest, intense 100 BPM",
        "Dau Pha Thuong Khau": "Dark flame orchestral, betrayal revealed, Ninefold power surge, epic 95 BPM",
        "Tru Tien": "Shadow orchestration, dark monarch theme, demon king confrontation, ominous 85 BPM",
        "Thanh Van Mon": "Sacred dragon fanfare, divine light, demon army siege, epic destiny 100 BPM",
        "Muc Than Ky": "Grand architectural orchestral, five elements convergence, transcendence theme, epic 90 BPM",
    }
    return {
        "narration": narration_text,
        "narration_duration": 28,
        "bg_music": bg_music_map.get(series, "Epic Chinese orchestral 90 BPM"),
        "sfx": sfx_list
    }

def build_metadata(title, episode, series, tiktok_caption, tags):
    vi_series_map = {
        "Ha Tien Du": "Ha Tien Du",
        "Trieu Tien": "Trieu Tien",
        "Dau Pha Thuong Khau": "Dau Pha Thuong Khau",
        "Tru Tien": "Tru Tien",
        "Thanh Van Mon": "Thanh Van Mon",
        "Muc Than Ky": "Muc Than Ky",
    }
    vi_series = vi_series_map.get(series, series)
    return {
        "youtube_title": f"{vi_series} T\u1eadp {episode}: {title} | Xianxia Vi\u1ec7t Sub \u2694\ufe0f\U0001f3ac",
        "youtube_description": f"Episode {episode} of {series}. {title}.\n\n\U0001f3ac {series} \u2014 Original Chinese Fantasy Series\n\ud83c\udfc6 Season 2 Episodes 21-30\n#xianxia #{series.lower().replace(' ','#')} #ep{episode} #fantasy #epic",
        "youtube_tags": tags,
        "tiktok_caption": tiktok_caption,
        "playlist": series
    }

def build_production_notes():
    return {
        "shot_count": 5,
        "total_duration_seconds": 30,
        "voice": "female_poetic_deep (MiniMax speech-02-hd, speed 1.0, slight reverb)",
        "music_volume": 0.35,
        "voice_volume": 1,
        "aspect_ratio": "9:16 vertical only"
    }

def make_shots_ep21(series, episode, plot_title, arc_theme):
    """Generic 5-shot structure for Episode 21"""
    ep_num = str(episode)
    shots = []

    if series == "Ha Tien Du":
        prompts = [
            ("Wide aerial \u2014 Lu\u00e2n stands at the edge of an ancient temple. The floor beneath him CRACKS open, revealing a spiral staircase descending into a glowing dragon realm. He stares down into infinite darkness threaded with golden light. Camera: wide aerial, temple floor cracking open, dragon realm revealed beneath.", "Lu\u00e2n had spent twenty years mastering fire. Today, the dragon realm had chosen him."),
            ("Medium cinematic \u2014 Lu\u00e2n descends the spiral staircase. Dragon bones line the walls \u2014 enormous, ancient, still glowing faintly with residual energy. Ancient characters on the walls pulse as he passes. He touches one and sees a vision: a dragon in battle against the sky itself. Camera: medium, dragon bone corridor, Lu\u00e2n touching glowing characters.", "The staircase was lined with the bones of the first dragons \u2014 creatures so vast they had shaped mountains just by sleeping."),
            ("Close-up \u2014 Lu\u00e2n reaches the bottom. A vast underground chamber opens before him. At its center: a lake of LIQUID GOLD, and above it, suspended in mid-air, a DRAGON'S EYE made of pure amber, the size of a house, staring directly at him. It BLINKS. Camera: close-up, Lu\u00e2n and the dragon's eye blinking at each other, liquid gold lake beneath.", "And at the center of the chamber \u2014 the Dragon's Eye. Older than the first empire. Watching. Waiting. Choosing."),
            ("Extreme close-up \u2014 The Dragon's Eye speaks \u2014 not in words but in visions. Lu\u00e2n sees himself wielding fire and ice simultaneously. He sees the shadow empire rising. He sees himself standing alone against an emperor of corrupted light. He gasps. The Eye smiles. Camera: extreme close-up, vision floods Lu\u00e2n's face, fire and ice duality, shadow empire rising.", "It showed him his fire. It showed him his ice. It showed him the shadow empire's corrupted emperor. And it showed him standing alone \u2014 holding both."),
            ("Wide cinematic \u2014 The Dragon's Eye PULSES \u2014 a beam of gold light strikes Lu\u00e2n's forehead. He staggers but does not fall. Frost spreads up one arm, flame up the other. He is becoming the bridge between fire and ice. The chamber RUMBLES. Camera: wide, gold light beam striking Lu\u00e2n, frost and flame spreading, chamber rumbling.", "It chose him. Not as a student. As a bridge. Fire and ice \u2014 the two halves of the first dragon's power \u2014 merging inside one human body. Lu\u00e2n screamed. But he did not let go.")
        ]
        narrations = [
            "Lu\u00e2n had spent twenty years mastering fire. Today, the dragon realm had chosen him.",
            "The staircase was lined with the bones of the first dragons \u2014 creatures so vast they had shaped mountains just by sleeping.",
            "And at the center of the chamber \u2014 the Dragon's Eye. Older than the first empire. Watching. Waiting. Choosing.",
            "It showed him his fire. It showed him his ice. It showed him the shadow empire's corrupted emperor. And it showed him standing alone \u2014 holding both.",
            "It chose him. Not as a student. As a bridge. Fire and ice \u2014 the two halves of the first dragon's power \u2014 merging inside one human body. Lu\u00e2n screamed. But he did not let go."
        ]
        sfx_list = [
            {"time": 0,  "sound": "temple stone cracking, mysterious wind", "volume": 0.5},
            {"time": 6,  "sound": "ancient bones humming, dragon energy", "volume": 0.5},
            {"time": 12, "sound": "dragon's eye opening, gold light beam", "volume": 0.5},
            {"time": 18, "sound": "vision flooding, fire and ice crackling", "volume": 0.5},
            {"time": 24, "sound": "gold beam striking, frost and flame spreading, chamber rumble", "volume": 0.5},
        ]
        tiktok_caption = f"Con M\u1eaft R\u1ed3ng m\u1edf \u2014 Lu\u00e2n \u0111\u01b0\u1ee3c ch\u1ecdn l\u00e0m c\u1ea7u n\u1ed1i gi\u1eefa l\u1eeda v\u00e0 b\u0103ng. Hai s\u1ee9c m\u1ea1nh h\u1ee3p nh\u1ea5t trong m\u1ed9t con ng\u01b0\u1eddi. Epic ch\u01b0a t\u1eebng c\u00f3! \U0001f409\U0001f43e {ep_num} #xianxia #ha tien du"
        tags = ["xianxia","ha tien du","dragon realm","trial of fire and ice","chosen one","epic"]

    elif series == "Trieu Tien":
        prompts = [
            ("Wide aerial \u2014 the Dou Di plains stretch infinitely. Dead emperors lie in crystal tombs across the field \u2014 each one a monument to a fallen ruler. Xiao Yan walks alone toward the central arena. The ground trembles. Camera: extreme wide aerial, Dou Di plains, crystal tombs, Xiao Yan approaching.", "The Dou Di plains. Where emperors were made. Where emperors died."),
            ("Medium shot \u2014 Xiao Yan enters the central arena. Nine stone pillars ring the field, each inscribed with a different star sign. They begin to GLOW as he steps inside. The sky above darkens despite it being midday. Camera: medium, nine glowing pillars, midday sky darkening, Xiao Yan in arena center.", "Nine pillars. Nine stars. And the sky above going dark in broad daylight \u2014 because his power was calling to the heavens."),
            ("Close-up \u2014 Xiao Yan sits in meditation. His Dou Qi erupts \u2014 violet and orange fire spiraling up from his body in NINE distinct streams, one for each star. Each stream solidifies into a glowing star above his head. Camera: close-up, nine violet-orange fire streams rising, nine stars materializing above.", "Nine-star Dou Huang. The rank that had taken his teacher a lifetime to reach. He was about to achieve it in one night."),
            ("Extreme close-up \u2014 the final star forms above Xiao Yan's head \u2014 but it is not violet. It is PURE WHITE, brighter than all others. The heavens SCREAM. Lightning strikes the arena. Xiao Yan's eyes open: pure white. Camera: extreme close-up, pure white final star forming, lightning strike, white-eyed Xiao Yan.", "The ninth star was not violet. It was white. And the heavens themselves were afraid of what he was becoming."),
            ("Wide cinematic \u2014 Xiao Yan rises. Nine stars orbit his head like a crown. The crystal tombs of dead emperors CRACK \u2014 their inhabitants stirring, acknowledging a new Nine-star Dou Huang has risen. Camera: wide cinematic, nine stars orbiting, crystal tombs cracking, dead emperors acknowledging Xiao Yan.", "Nine-star Dou Huang. Not just Dou Huang \u2014 something beyond. Something the Dou Di plains had never seen before. The dead emperors stirred. They remembered what true power felt like.")
        ]
        narrations = [
            "The Dou Di plains. Where emperors were made. Where emperors died.",
            "Nine pillars. Nine stars. And the sky above going dark in broad daylight \u2014 because his power was calling to the heavens.",
            "Nine-star Dou Huang. The rank that had taken his teacher a lifetime to reach. He was about to achieve it in one night.",
            "The ninth star was not violet. It was white. And the heavens themselves were afraid of what he was becoming.",
            "Nine-star Dou Huang. Not just Dou Huang \u2014 something beyond. Something the Dou Di plains had never seen before. The dead emperors stirred. They remembered what true power felt like."
        ]
        sfx_list = [
            {"time": 0,  "sound": "wind across plains, distant thunder", "volume": 0.5},
            {"time": 6,  "sound": "pillars glowing, sky darkening, ominous hum", "volume": 0.5},
            {"time": 12, "sound": "Dou Qi erupting, fire streams whooshing", "volume": 0.5},
            {"time": 18, "sound": "final star forming, heaven screaming, lightning crack", "volume": 0.5},
            {"time": 24, "sound": "nine stars orbiting, crystal tombs cracking, emperor acknowledgment", "volume": 0.5},
        ]
        tiktok_caption = f"Ch\u00e0ng ta l\u00ean \u0111\u1ebfn C\u1eefu Tinh \u0110\u1ea1o Ho\u00e0ng! T\u00e2m th\u1ea7n th\u1ee9 9 ng\u00f4i sao tr\u1eafng \u0111\u01b0\u1ee3c h\u00ecnh th\u00e0nh \u2014 thi\u00ean \u0111\u01b0\u1eddng run s\u1ee3! \U0001f3c6 T\u1eadp {ep_num} #xianxia #trieu tien #dou di"
        tags = ["xianxia","trieu tien","dou di plains","nine-star dou huang","breakthrough","epic"]

    elif series == "Dau Pha Thuong Khau":
        prompts = [
            ("Wide aerial \u2014 ancient ruins beneath Jia Academy. Xiao Mei stands before a massive door covered in flame seals. The seals begin to crack on their own. She is not touching them. A memory \u2014 someone else's memory \u2014 is pouring into her. Camera: wide aerial, flame-sealed door cracking, Xiao Mei in trance.", "The sealed door was not responding to her touch. It was responding to the Flame Emperor's memories sleeping inside her blood."),
            ("Medium close-up \u2014 in her vision, Xiao Mei sees the Flame Emperor's final battle. He stands against his own disciple \u2014 a young man with kind eyes who suddenly drives a blade through the Emperor's back. Camera: medium close-up, vision of betrayal \u2014 blade through back, Emperor's shocked face.", "His own disciple. The kindest of them all. The one who had carried the Emperor's books when he was old. The blade went through his back."),
            ("Close-up \u2014 the vision continues. The Flame Emperor falls. But before he dies, he writes something in fire in the sky: a legacy seal. He looks directly at the disciple and says: 'You will never find it.' The disciple SCREAMS in rage. Camera: close-up, Emperor writing legacy seal in fire sky, disciple screaming.", "The Emperor died writing one final thing in the sky: a seal no one could break. His legacy \u2014 hidden where his betrayer could never touch it. Until today."),
            ("Extreme close-up \u2014 Xiao Mei GASPS awake. The door has shattered. She is drenched in sweat. Her eyes are now FLAME-COLORED \u2014 she is carrying the Flame Emperor's consciousness inside her. She speaks with his voice: 'Xiao Yan. Come to me.' Camera: extreme close-up, Xiao Mei awakening, flame-colored eyes, Emperor's voice speaking.", "She woke with the Flame Emperor inside her. Not a possession. A partnership. And the first thing he needed \u2014 was his successor."),
            ("Wide cinematic \u2014 Xiao Yan arrives at the ruins. He sees the shattered door, then sees Xiao Mei standing in the center with flame-colored eyes. He freezes. She smiles with his teacher's smile. Camera: wide, Xiao Yan arriving, frozen at sight of flame-eyed Xiao Mei.", "Xiao Yan saw her and understood: his teacher had not just left a legacy. He had left a guide. And she had just woken up.")
        ]
        narrations = [
            "The sealed door was not responding to her touch. It was responding to the Flame Emperor's memories sleeping inside her blood.",
            "His own disciple. The kindest of them all. The one who had carried the Emperor's books when he was old. The blade went through his back.",
            "The Emperor died writing one final thing in the sky: a seal no one could break. His legacy \u2014 hidden where his betrayer could never touch it. Until today.",
            "She woke with the Flame Emperor inside her. Not a possession. A partnership. And the first thing he needed \u2014 was his successor.",
            "Xiao Yan saw her and understood: his teacher had not just left a legacy. He had left a guide. And she had just woken up."
        ]
        sfx_list = [
            {"time": 0,  "sound": "seals cracking, ancient wind", "volume": 0.5},
            {"time": 6,  "sound": "vision whoosh, blade through back, emotional betrayal", "volume": 0.5},
            {"time": 12, "sound": "fire writing in sky, legacy seal igniting", "volume": 0.5},
            {"time": 18, "sound": "awakening gasp, flame eyes igniting", "volume": 0.5},
            {"time": 24, "sound": "door shattering, footsteps approaching, reunion", "volume": 0.5},
        ]
        tiktok_caption = f"K\u00fd \u1ee9c Ho\u00e0ng \u0110\u1ebf \u0111\u00e3 \u0111\u01b0\u1ee3c \u0111\u00e1nh th\u1ee9c! H\u1eafn nh\u00ecn th\u1ea5y m\u1ecdi th\u1ee9 \u2014 v\u00e0 h\u1eafn c\u01b0\u1eddi. T\u00f4i s\u1ebd ch\u1ec9 \u0111\u1ea1o \u0111\u1ed3 \u0111\u1ec7 c\u1ee7a ta! \U0001f525 T\u1eadp {ep_num} #xianxia #dau pha thuong khau #flame emperor",
        tags = ["xianxia","dau pha thuong khau","flame emperor","sealed memories","betrayal","epic"]

    elif series == "Tru Tien":
        prompts = [
            ("Wide cinematic \u2014 Jeon Jin-Woo stands in the shadow dimension. The Monarch of Shadows \u2014 his own voice from the shadow soldiers \u2014 speaks aloud for the first time: 'You have grown strong enough to hear me.' Jin-Woo's face: shock, then awe. Camera: wide, Jin-Woo in shadow dimension, listening to his own voice.", "In twenty years of hunting shadow monsters, Jeon Jin-Woo had never heard the Monarch speak. Today, the Monarch had chosen to be heard."),
            ("Close-up \u2014 the Monarch speaks through Jin-Woo's own mouth: 'I am the shadow you carry. I am every shadow soldier you command. And I have watched you with pride.' Jin-Woo's shadow behind him moves independently \u2014 it bows to him. Camera: close-up, Jin-Woo's shadow bowing to him, the Monarch speaking through him.", "I am the shadow you carry. I am every shadow soldier you command. And I have watched you with pride."),
            ("Medium shot \u2014 a tear falls from Jin-Woo's eye. The Monarch's presence fills him with centuries of loneliness and patience. He speaks back: 'Then teach me. All of it.' The shadow dimension RUMBLES. Camera: medium, Jin-Woo speaking to the Monarch, shadow dimension rumbling with power.", "Twenty years of hunting alone. And he finally had someone to answer to: a king older than the shadow dimension itself."),
            ("Extreme close-up \u2014 the Monarch's power FLOODS into Jin-Woo. Shadow armor forms around his body. His eyes turn completely black. He is becoming the Monarch \u2014 not just carrying it, but becoming it. Camera: extreme close-up, shadow armor forming, eyes turning pure black, transformation.", "The Monarch was not giving Jin-Woo his power. The Monarch was merging with it. Two shadows becoming one."),
            ("Wide cinematic \u2014 Jin-Woo rises. He is now the true Monarch of Shadows \u2014 shadow armor gleaming, black eyes, shadow soldiers kneeling across the dimension. He speaks with absolute authority: 'The shadow throne will be claimed. By me.' Camera: wide cinematic, Monarch of Shadows risen, shadow army kneeling, epic declaration.", "The shadow throne. The one thing the Monarch had been waiting centuries to reclaim. And now \u2014 finally \u2014 there was a king worthy of it.")
        ]
        narrations = [
            "In twenty years of hunting shadow monsters, Jeon Jin-Woo had never heard the Monarch speak. Today, the Monarch had chosen to be heard.",
            "I am the shadow you carry. I am every shadow soldier you command. And I have watched you with pride.",
            "Twenty years of hunting alone. And he finally had someone to answer to: a king older than the shadow dimension itself.",
            "The Monarch was not giving Jin-Woo his power. The Monarch was merging with it. Two shadows becoming one.",
            "The shadow throne. The one thing the Monarch had been waiting centuries to reclaim. And now \u2014 finally \u2014 there was a king worthy of it."
        ]
        sfx_list = [
            {"time": 0,  "sound": "shadow dimension wind, monarch's voice echoing", "volume": 0.5},
            {"time": 6,  "sound": "shadow bowing, whisper of a thousand soldiers", "volume": 0.5},
            {"time": 12, "sound": "power flooding in, shadow dimension rumbling", "volume": 0.5},
            {"time": 18, "sound": "armor forming, transformation whoosh", "volume": 0.5},
            {"time": 24, "sound": "throne claiming, shadow army kneeling, epic declaration", "volume": 0.5},
        ]
        tiktok_caption = f"Qu\u00e2n V\u01b0\u01a1ng B\u00f3ng T\u1ed1i l\u1ea7n \u0111\u1ea7u l\u00ean ti\u1ebfng! 'Ta \u0111\u00e3 ch\u1ee9ng ki\u1ebfn ng\u01b0\u01a1i!' Jin-Woo kh\u00f3c v\u00ec cu\u1ed1i c\u00f9ng c\u00f3 ai \u0111\u00f3 c\u00f9ng \u00f4ng \u0111\u1ea7u! \U0001f576\ufe0f T\u1eadp {ep_num} #xianxia #tru tien #shadow monarch",
        tags = ["xianxia","tru tien","monarch of shadows","shadow throne","shadow army","epic"]

    elif series == "Thanh Van Mon":
        prompts = [
            ("Wide cinematic \u2014 Nie Li enters the Sacred Dragon Sect's forbidden archive. A hidden compartment in the wall opens on its own \u2014 recognizing his bloodline. Inside: a scroll that reads 'THE DIVINE DRAGON TECHNIQUE: NEVER LOST, ONLY HIDDEN.' Camera: wide, forbidden archive opening, divine dragon technique revealed.", "The Divine Dragon Technique. The one technique the Sacred Dragon Sect claimed had been lost for a thousand years. It had never been lost. It had been hidden \u2014 waiting for the right heir."),
            ("Medium close-up \u2014 Nie Li unrolls the scroll. Dragon symbols float off the page, orbiting him. Each symbol unlocks a memory from his previous life \u2014 memories he had lost, now returning. He gasps: he had been the one who HID the technique. Camera: medium close-up, dragon symbols orbiting, lost memories returning.", "He stared at the scroll and understood: he had been the one who hid it. A thousand years ago. Before he died. Before he was reborn."),
            ("Close-up \u2014 Nie Li's body begins to change. The dragon symbols enter his skin. His back splits with light \u2014 a SPIRITUAL DRAGON materializes behind him, made of sacred golden light. It ROARS. The archive shakes. Camera: close-up, dragon symbols entering skin, spiritual dragon materializing behind, archive shaking.", "The Divine Dragon materialized behind him \u2014 not a small spirit, not a flicker of power, but a FULL SPIRITUAL DRAGON made of sacred golden light."),
            ("Extreme close-up \u2014 the spiritual dragon looks at Nie Li with ancient, knowing eyes. It speaks directly into his mind: 'You hid me to protect the world from what I could do.' Nie Li's face: realization, grief, acceptance. Camera: extreme close-up, spiritual dragon's eyes, Nie Li's emotional reaction.", "You hid me to protect the world from what I could do. The dragon's words settled in Nie Li's heart. He had been wise. A thousand years ago. And now he needed to be wise again."),
            ("Wide cinematic \u2014 Nie Li bows to the spiritual dragon. It bows back. The dragon merges into his body \u2014 a soft golden glow spreading across his skin. He is now the true Sacred Dragon Sect heir. The Divine Dragon Technique is his. Camera: wide cinematic, mutual bow, dragon merging into body, golden glow, true heir crowned.", "He bowed to the dragon. And the dragon bowed to him. A thousand years of waiting \u2014 ended. The Divine Dragon Technique had found its heir. And the heir had finally found himself.")
        ]
        narrations = [
            "The Divine Dragon Technique. The one technique the Sacred Dragon Sect claimed had been lost for a thousand years. It had never been lost. It had been hidden \u2014 waiting for the right heir.",
            "He stared at the scroll and understood: he had been the one who hid it. A thousand years ago. Before he died. Before he was reborn.",
            "The Divine Dragon materialized behind him \u2014 not a small spirit, not a flicker of power, but a FULL SPIRITUAL DRAGON made of sacred golden light.",
            "You hid me to protect the world from what I could do. The dragon's words settled in Nie Li's heart. He had been wise. A thousand years ago. And now he needed to be wise again.",
            "He bowed to the dragon. And the dragon bowed to him. A thousand years of waiting \u2014 ended. The Divine Dragon Technique had found its heir. And the heir had finally found himself."
        ]
        sfx_list = [
            {"time": 0,  "sound": "archive opening, ancient mechanism", "volume": 0.5},
            {"time": 6,  "sound": "dragon symbols floating, memories returning", "volume": 0.5},
            {"time": 12, "sound": "dragon materializing, sacred roar, archive shaking", "volume": 0.5},
            {"time": 18, "sound": "dragon's voice in mind, emotional revelation", "volume": 0.5},
            {"time": 24, "sound": "mutual bow, dragon merging, heir crowned, triumphant swell", "volume": 0.5},
        ]
        tiktok_caption = f"K\u1ef9 Th\u1eadt Th\u1ea7n Long \u0111\u01b0\u1ee3c t\u00ecm th\u1ea5y! N\u00f3 ch\u01b0a bao gi\u1edd m\u1ea5t \u2014 n\u00f3 \u0111\u00e3 \u0111\u01b0\u1ee3c gi\u1ea5u \u0111i \u0111\u1ec3 b\u1ea3o v\u1ec7 th\u1ebf gi\u1edbi. Nie Li l\u00e0 ng\u01b0\u1eddi th\u1eeba k\u1ebf ch\u00ednh th\u1ee9c! \U0001f409\U0001f409 T\u1eadp {ep_num} #xianxia #thanh van mon #sacred dragon",
        tags = ["xianxia","thanh van mon","sacred dragon sect","divine dragon technique","chosen heir","epic"]

    elif series == "Muc Than Ky":
        prompts = [
            ("Wide aerial \u2014 Mo Fan stands before a door that has no handle, no lock, no visible mechanism. Just five elemental symbols carved into ancient stone: fire, water, earth, wind, thunder. The forbidden floor. The highest restricted level. Camera: wide aerial, Mo Fan before the five-element door.", "The forbidden floor. The one level every architect in the world was forbidden to enter. The one level that had driven the last three who tried into madness. Mo Fan reached for the handle. There was no handle."),
            ("Medium close-up \u2014 Mo Fan places his hand on the fire symbol. The door PULSES. A voice speaks: 'You carry all five elements inside you. You do not need a handle. You ARE the key.' The door begins to glow. Camera: medium close-up, Mo Fan's hand on fire symbol, door pulsing, realization on face.", "You carry all five elements inside you. You do not need a handle. You ARE the key."),
            ("Close-up \u2014 Mo Fan presses both palms on the door. Fire ERUPTS from his left hand, water from his right, earth from his feet, wind from his body, thunder from his eyes. All five elements respond simultaneously. The door SCREAMS as it opens. Camera: close-up, five elements erupting simultaneously, door screaming open.", "All five elements answered his call at once. Fire, water, earth, wind, thunder \u2014 all responding to one person. The door screamed as it opened."),
            ("Wide cinematic \u2014 the door opens. Inside is not a room but a DIMENSION \u2014 a vast space where all five elements exist in perfect balance. The Grand Architect's workshop, preserved for centuries, perfectly intact. Mo Fan steps inside, breathless. Camera: wide cinematic, dimension interior, perfect elemental balance, Grand Architect's workshop revealed.", "Inside was not a room. It was a dimension \u2014 a perfect space where all five elements existed in balance. And there, in the center, the Grand Architect's workshop. Preserved. Waiting."),
            ("Extreme close-up \u2014 at the center of the workshop: a half-finished structure made of all five elements. A design for something that could change the world. Mo Fan recognizes it \u2014 he has seen it in his dreams. The Grand Architect's final, unfinished masterpiece. Camera: extreme close-up, half-finished five-element structure, Mo Fan's recognition, dream connection.", "And at the center of the workshop: a half-finished structure. Made of all five elements. A design that could change the world. And Mo Fan recognized it instantly \u2014 because he had been dreaming of it his entire life.")
        ]
        narrations = [
            "The forbidden floor. The one level every architect in the world was forbidden to enter. The one level that had driven the last three who tried into madness. Mo Fan reached for the handle. There was no handle.",
            "You carry all five elements inside you. You do not need a handle. You ARE the key.",
            "All five elements answered his call at once. Fire, water, earth, wind, thunder \u2014 all responding to one person. The door screamed as it opened.",
            "Inside was not a room. It was a dimension \u2014 a perfect space where all five elements existed in balance. And there, in the center, the Grand Architect's workshop. Preserved. Waiting.",
            "And at the center of the workshop: a half-finished structure. Made of all five elements. A design that could change the world. And Mo Fan recognized it instantly \u2014 because he had been dreaming of it his entire life."
        ]
        sfx_list = [
            {"time": 0,  "sound": "footsteps, door creaking, five symbols glowing", "volume": 0.5},
            {"time": 6,  "sound": "door pulsing, voice speaking, revelation", "volume": 0.5},
            {"time": 12, "sound": "five elements erupting, door screaming open, elemental clash", "volume": 0.5},
            {"time": 18, "sound": "dimension opening, wind rushing, workshop revealed", "volume": 0.5},
            {"time": 24, "sound": "structure humming, recognition, dream connection", "volume": 0.5},
        ]
        tiktok_caption = f"T\u1ea7ng C\u1ea5m Kh\u1ed5 \u0111\u01b0\u1ee3c m\u1edf! Mo Fan l\u00e0 CH\u00ccA KH\u00d3A! Ng\u00f4i nh\u00e0 c\u1ee7a \u0110\u1ea1i Ki\u1ebfn Tr\u00fac S\u01b0 \u0111\u01b0\u1ee3c ti\u1ebft l\u1ed9 sau bao th\u1ecf k\u1ef7! \U0001f3f7\ufe0f\U0001f525 T\u1eadp {ep_num} #xianxia #muc than ky #grand architect",
        tags = ["xianxia","muc than ky","forbidden floor","five elements","grand architect","epic"]

    else:
        prompts = []
        narrations = []
        sfx_list = []
        tiktok_caption = f"Episode {ep_num} of {series}."
        tags = ["xianxia", series.lower().replace(" ","")]

    for i, (p, n) in enumerate(zip(prompts, narrations)):
        ts = TEMPLATE_SHOTS[i]
        prompt_text = p
        camera_text = p.split("Camera: ")[1] if "Camera: " in p else p[:100]
        shot = make_shot(i+1, ts["time_start"], ts["time_end"], ts["duration"], prompt_text, camera_text, n, sfx_list[i]["sound"])
        if not isinstance(shot, dict):
            print(f"ERROR: make_shot returned {type(shot)} at i={i}")
            print(f"  args: {i+1}, {ts}, {camera_text[:30]}, {n[:30]}, {sfx_list[i]['sound']}")
            print(f"  result: {shot}")
        shots.append(shot)

    hailuo_prompts = [{"shot": s["shot_number"], "prompt": s["prompt"]} for s in shots]
    narration_text = build_narration(narrations)

    audio = build_audio(narration_text, sfx_list, ep_num, series)
    metadata = build_metadata(plot_title, ep_num, series, tiktok_caption, tags)
    production_notes = build_production_notes()

    visual_scene = " ".join(s["prompt"] for s in shots)
    prompt_for_hailuo = " ".join(f"Shot {s['shot_number']}: {s['prompt']}" for s in shots)

    return shots, hailuo_prompts, audio, metadata, production_notes, narration_text, visual_scene, prompt_for_hailuo, tiktok_caption, tags


def build_shots_generic(series, episode, plot_title, beat):
    """Generic 5-shot structure"""
    ep_num = str(episode)
    shots = []
    sfx_list = []

    # Generic shot structures by series
    structures = {
        "Ha Tien Du": {
            "theme": "fire and ice mastery",
            "colors": "fire-orange and ice-blue",
            "protagonist": "Lu\u00e2n",
        },
        "Trieu Tien": {
            "theme": "Dou Qi battle",
            "colors": "violet-orange flame",
            "protagonist": "Xiao Yan",
        },
        "Dau Pha Thuong Khau": {
            "theme": "Flame Emperor legacy",
            "colors": "dark crimson flame",
            "protagonist": "Xiao Yan",
        },
        "Tru Tien": {
            "theme": "shadow power",
            "colors": "pure black shadow",
            "protagonist": "Jeon Jin-Woo",
        },
        "Thanh Van Mon": {
            "theme": "Sacred Dragon power",
            "colors": "sacred gold light",
            "protagonist": "Nie Li",
        },
        "Muc Than Ky": {
            "theme": "five elements convergence",
            "colors": "five-colored elemental light",
            "protagonist": "Mo Fan",
        },
    }

    s = structures.get(series, structures["Muc Than Ky"])
    colors = s["colors"]
    protagonist = s["protagonist"]

    prompt_templates = [
        "Wide cinematic \u2014 {protagonist} stands at the center of {theme}. {beat}. The {colors} energy swirls around him in a perfect vortex. Camera: wide cinematic, {theme} vortex, {protagonist} at center. 6 seconds.",
        "Medium shot \u2014 {protagonist} channels {theme} energy. {beat}. The {colors} power erupts from his body, forming a massive spiritual construct above him. Camera: medium, {colors} spiritual construct forming. 6 seconds.",
        "Close-up \u2014 {protagonist}'s face is drenched in sweat. {beat}. The power is at its peak \u2014 he can feel it about to break through to the next level. His eyes {colors.split()[0]}. Camera: close-up, extreme effort, power peaking. 6 seconds.",
        "Extreme close-up \u2014 {protagonist} BREAKS THROUGH. {beat}. The {colors} energy IGNITES, a new level achieved. The heavens ROAR. Camera: extreme close-up, breakthrough moment, new level achieved, heavens roaring. 6 seconds.",
        "Wide cinematic \u2014 {protagonist} rises, transformed. {beat}. The {theme} power now belongs to him permanently. He is no longer the student. He is the master. Camera: wide cinematic, transformed rise, new master crowned, epic declaration. 6 seconds.",
    ]

    narration_templates = [
        "{beat}.",
        "The {theme} energy answered his call \u2014 not as a tool, but as a partner.",
        "He was at the edge. One more step and he would cross into a realm only legends had reached.",
        "He broke through. {beat}. The heavens themselves acknowledged his ascension.",
        "He was no longer the student. He was the master of {theme}."
    ]

    sfx_templates = [
        {"time": 0,  "sound": "energy gathering, power swirling", "volume": 0.5},
        {"time": 6,  "sound": "spiritual construct forming, power building", "volume": 0.5},
        {"time": 12, "sound": "extreme effort, breakthrough imminent", "volume": 0.5},
        {"time": 18, "sound": "breakthrough achieved, heavens roaring", "volume": 0.5},
        {"time": 24, "sound": "transformation complete, new master crowned", "volume": 0.5},
    ]

    for i in range(5):
        ts = TEMPLATE_SHOTS[i]
        prompt_text = prompt_templates[i].format(protagonist=protagonist, theme=s["theme"], colors=colors, beat=beat)
        camera_text = prompt_text.split("Camera: ")[1] if "Camera: " in prompt_text else prompt_text[:100]
        narration_text = narration_templates[i].format(theme=s["theme"], colors=colors, beat=beat)
        sfx_item = sfx_templates[i]
        sfx_item = dict(sfx_item)

        shots.append(make_shot(i+1, ts["time_start"], ts["time_end"], ts["duration"], prompt_text, camera_text, narration_text, sfx_item["sound"]))
        sfx_list.append(sfx_item)

    hailuo_prompts = [{"shot": s["shot_number"], "prompt": s["prompt"]} for s in shots]
    full_narration = build_narration([s["narration"] for s in shots])

    audio = build_audio(full_narration, sfx_list, ep_num, series)

    tag_base = series.lower().replace(" ", "")
    vi_series_map = {"Ha Tien Du":"Ha Tien Du","Trieu Tien":"Trieu Tien","Dau Pha Thuong Khau":"Dau Pha Thuong Khau","Tru Tien":"Tru Tien","Thanh Van Mon":"Thanh Van Mon","Muc Than Ky":"Muc Than Ky"}
    vi_series = vi_series_map.get(series, series)
    tiktok_caption = f"\u00c9pisode {ep_num}: {plot_title}. {beat}. {s['theme'].title()} mastery achieved! \U0001f3c6 T\u1eadp {ep_num} #xianxia #{tag_base}"
    tags = ["xianxia", tag_base, s["theme"].replace(" ",""), "epic", f"ep{ep_num}"]

    metadata = build_metadata(plot_title, ep_num, series, tiktok_caption, tags)
    production_notes = build_production_notes()
    visual_scene = " ".join(s["prompt"] for s in shots)
    prompt_for_hailuo = " ".join(f"Shot {s['shot_number']}: {s['prompt']}" for s in shots)

    return shots, hailuo_prompts, audio, metadata, production_notes, full_narration, visual_scene, prompt_for_hailuo, tiktok_caption, tags


def make_script(script_id, title, series, channel, episode, plot_title, beat, tiktok_caption, tags, shots, hailuo_prompts, audio, metadata, production_notes, visual_scene, prompt_for_hailuo):
    return {
        "id": script_id,
        "title": f"{series} Episode {episode}: {plot_title}",
        "category": "xianxia",
        "channel": channel,
        "series": series,
        "episode": episode,
        "audience": "Fans of Chinese fantasy, wuxia/xianxia drama viewers, 18-35 demographic who enjoy epic visual storytelling",
        "tone": "Heroic, melancholic, epic, cinematic, emotionally charged",
        "platform": ["TikTok", "YouTube Shorts"],
        "format": "30 seconds, 9:16 vertical",
        "status": "pending",
        "concept": {
            "hook": plot_title + ". " + beat,
            "story_arc": f"{plot_title} \u2192 power rising \u2192 breakthrough \u2192 transformation \u2192 new level",
            "emotion": "Tension \u2192 Intensity \u2192 Peak effort \u2192 Breakthrough \u2192 Triumph",
            "duration_seconds": 30
        },
        "shots": shots,
        "audio": audio,
        "hailuo_prompts": hailuo_prompts,
        "metadata": metadata,
        "production_notes": production_notes,
        "prompt_for_hailuo": prompt_for_hailuo,
        "visual_scene": visual_scene,
        "specific_details": {
            "subject": "Beautiful young woman, 18-22 years old, oval face, fair porcelain skin, high cheekbones, graceful features with a mix of fragility and inner steel",
            "outfit_exact": "Flowing Hanfu with gold embroidery patterns on hems and sleeves, wide sleeves, high waist sash, silk fabric. Ornate hairpiece crowning long black hair in an elaborate updo",
            "setting_details": "Ancient Chinese fantasy setting, misty mountains, temple courtyards, dramatic lighting",
            "face_expression": "Varied by shot \u2014 serene, determined, sorrowful, fierce as appropriate",
            "body_movement": "Graceful martial arts movements, ceremonial gestures, emotional expressions",
            "camera": "Cinematic camera movements per scene \u2014 push-ins, pans, dramatic close-ups"
        },
        "negative_prompt": "anime or cartoon style, illustrated characters, distorted hands or fingers, blurry or low resolution, text overlays or captions, logos or watermarks, modern clothing, wrong hair color, western fantasy, bright daylight midday, modern buildings, plastic-looking skin, dead eyes, stiff pose, landscape orientation, no mist or atmosphere, wrong cultural elements",
        "thumbnail_idea": f"Dramatic scene from {series} Episode {episode}: {plot_title}",
        "duration_seconds": 30,
        "resolution": "1080x1920",
        "fps": 24,
        "tags": tags,
        "created_by": "Content Director",
        "created_at": "2026-04-06T04:20:00Z"
    }


def write_script(script_data, filepath):
    with open(filepath, "w", encoding="utf-8-sig") as f:
        json.dump(script_data, f, ensure_ascii=False, indent=2)
    print(f"  Wrote {script_data['id']}: {script_data['title'][:60]}")


def main():
    print("Starting GOAL-8 script generation: XiAnyX E21-30 (60 scripts)")
    print("=" * 60)

    total = 0

    for start_id, series, channel, ep_start, ep_end, protagonist, arc_theme in SERIES_CONFIG:
        plots = EPISODE_PLOTS.get(series, [])
        print(f"\n{series} (E{ep_start}-{ep_end}):")

        for idx, (ep_str, plot_title, beat) in enumerate(plots):
            script_id_num = start_id + idx
            script_id = f"XIANYX-{script_id_num}"
            episode = int(ep_str)

            out_file = os.path.join(OUT_DIR, f"{script_id}.json")
            if os.path.exists(out_file):
                print(f"  SKIP {script_id} (already exists)")
                total += 1
                continue

            if episode == 21:
                shots, hailuo_prompts, audio, metadata, production_notes, narration_text, visual_scene, prompt_for_hailuo, tiktok_caption, tags = make_shots_ep21(series, episode, plot_title, arc_theme)
            else:
                shots, hailuo_prompts, audio, metadata, production_notes, narration_text, visual_scene, prompt_for_hailuo, tiktok_caption, tags = build_shots_generic(series, episode, plot_title, beat)

            title = f"{series} Episode {episode}: {plot_title}"

            script_data = make_script(
                script_id=script_id,
                title=title,
                series=series,
                channel=channel,
                episode=episode,
                plot_title=plot_title,
                beat=beat,
                tiktok_caption=tiktok_caption,
                tags=tags,
                shots=shots,
                hailuo_prompts=hailuo_prompts,
                audio=audio,
                metadata=metadata,
                production_notes=production_notes,
                visual_scene=visual_scene,
                prompt_for_hailuo=prompt_for_hailuo,
            )

            write_script(script_data, out_file)
            total += 1

    print(f"\n{'='*60}")
    print(f"Done. {total} scripts written.")


if __name__ == "__main__":
    main()
