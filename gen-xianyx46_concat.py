import subprocess, os
from gtts import gTTS

FFMPEG = r'C:\NEWFOL~1\FFMPEG~1\bin\ffmpeg.exe'
WORKSPACE = r'C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI'
CLIPS_DIR = os.path.join(WORKSPACE, 'output_topic', 'clips')
OUTPUT = os.path.join(WORKSPACE, 'output_topic', 'videos', 'XIANYX-46.mp4')
TEMP_VIDEO = os.path.join(WORKSPACE, 'output_topic', 'clips', 'xianyx46_concat.mp4')
TEMP_AUDIO = os.path.join(WORKSPACE, 'output_topic', 'clips', 'xianyx46_tts.mp3')

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

# Step 1: Generate TTS narration
narration = """Three months after the Supreme Cultivator knelt before the teaching altar — the Crimson Phoenix Sect had grown. More banners. More disciples. More believers in the philosophy of vulnerable first. And the Supreme Cultivator — the most powerful cultivator in the realm — stood beside her at the teaching altar. Not as the realm's highest authority. As her first student. Learning to teach what she had taught him. Until a messenger arrived at dawn — with forty figures at the valley entrance below — and a challenge that would determine whether the first lesson was philosophy — or truth. He walked to the valley entrance alone. No violet aura. No spiritual pressure. He stopped ten paces from Chen Weiming's raised blade — and opened his arms. Completely. Chest exposed. No guard. No counter. I choose to stay — even when you ask me to kneel. The first lesson, offered without a blade in sight. I will not fight you. I will wait — until you are too tired to hold the blade. And then — he stood perfectly still. As eight hundred years of violence waited for an answer. One minute passed. Then two. Chen Weiming's blade trembled inches from the Supreme Cultivator's chest. One thrust would end everything. And the most powerful cultivator in the realm — stood completely still. Not because he could not fight back. Because he had learned something in three months that eight hundred years of war had never taught him: the bravest thing a warrior can do — is set down the blade first. And wait. And trust. And stay. The blade lowered. Then dropped. Chen Weiming fell to his knees — not in surrender — in recognition. You are the first person in three hundred years who has made me question whether the blade was ever worth it. The forty disciples behind him lowered their weapons — watching their master kneel before a philosophy that refused to fight back. And the Supreme Cultivator — the most powerful cultivator in the realm — had just proven the first lesson in the only way it could be proven: by surviving a challenge without raising a hand. He extended his hand. Not to strike. Not to judge. To help him up. The first lesson is the hardest — it nearly broke me too — come — there is tea at the teaching altar. And forty Broken Blade disciples walked through the temple gates — joining the Crimson Phoenix Sect not because they were defeated — but because they had witnessed the most powerful proof of philosophy in three hundred years: a man who survived the sword — by refusing to carry one. The sect grew — not through conquest — through the courage to stay."""

print('Generating TTS...')
tts = gTTS(text=narration, lang='en', slow=False)
tts.save(TEMP_AUDIO)
print(f'TTS: {os.path.getsize(TEMP_AUDIO)//1024}KB')

# Step 2: Concat using filter_complex (clips are already trimmed to 6s each)
clips = ['shot1', 'shot2', 'shot3', 'shot4', 'shot5']
clip_paths = [os.path.join(CLIPS_DIR, f'xianyx46_{s}.mp4') for s in clips]
n = len(clip_paths)

# Simple approach: use concat filter with all inputs
filter_str = ''
for i in range(n):
    filter_str += f'[{i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[v{i}];'
filter_str += f'{"".join(f"[v{i}]" for i in range(n))}concat=n={n}:v=1:a=0[outv]'

print('Concatenating clips...')
cmd = [FFMPEG, '-y'] + sum([['-i', p] for p in clip_paths], []) + [
    '-filter_complex', filter_str,
    '-map', '[outv]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-an', TEMP_VIDEO
]
print('Running ffmpeg concat...')
result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode != 0:
    print('CONCAT FAILED:', result.stderr[-2000:])
else:
    print(f'Concat done: {os.path.getsize(TEMP_VIDEO)//1024}KB')

# Step 3: Combine video + audio
print('Combining video + audio...')
cmd2 = [FFMPEG, '-y', '-i', TEMP_VIDEO, '-i', TEMP_AUDIO,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-shortest', OUTPUT]
result2 = subprocess.run(cmd2, capture_output=True, text=True)
if result2.returncode != 0:
    print('COMBINE FAILED:', result2.stderr[-1000:])
else:
    print(f'Final: {os.path.getsize(OUTPUT)//1024}KB')
    print('DONE:', OUTPUT)
