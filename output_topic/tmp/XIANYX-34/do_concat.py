import subprocess
import os
from gtts import gTTS

FFMPEG = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe"
TMP = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\output_topic\tmp\XIANYX-34"
OUT = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI\output_topic\videos\XIANYX-34.mp4"
TTS = os.path.join(TMP, "narration.mp3")
CONCAT = os.path.join(TMP, "concat_noaudio.mp4")

clips = [
    os.path.join(TMP, "shot1_scaled.mp4"),
    os.path.join(TMP, "shot2_scaled.mp4"),
    os.path.join(TMP, "shot3_scaled.mp4"),
    os.path.join(TMP, "shot4_scaled.mp4"),
    os.path.join(TMP, "shot5_scaled.mp4"),
]

# Generate TTS
print("Generating TTS...")
narration = """Three months of peace. The jade bracelet glowed gentle green — a reminder that she had broken the curse, saved the valley, become the healer the realm needed. She had walked from village to village — freeing those trapped by Jade Mirrors, ending the Thanh Van Mon's three-century reign of terror. And then — in a village three months later — the word she had prayed never to hear again. Jade Mirror. Two faces in the Jade Mirror. The daughter — sixteen, terrified, trapped. And behind her — in the mirror's depths — her own face. Not a reflection. A RECORDING. The moment she had first looked into the Jade Mirror three months ago — moments before she had broken the curse and become the healer the realm celebrated. The recording was not a memory. It was a WARNING. Because the Jade Mirror does not just show the present. It shows what was — to the one who will CARRY it next. She did not break the curse. She became the curse's HOST. The Thanh Van Mon was never one person — it was a PERPETUATION CYCLE. The curse lives in a host until the next host is ready — then it transfers. She had been the host for three months. The daughter was free. Because she — the healer, the breaker, the hero — was now the monster. She smiled at the villagers who called her hero. And in every house she entered for the rest of her long, cursed life — the Jade Mirror would already be waiting. Break the monster. Become the monster. And call it healing. The Thanh Van Mon lives forever — because heroes always want to save people. And the curse is patient."""
tts = gTTS(text=narration, lang="en", slow=False)
tts.save(TTS)
print(f"TTS: {os.path.getsize(TTS)//1024}KB")

# Concat using filter_complex (re-encode to avoid concat demuxer -t bug)
print("Concatenating clips...")
vf = ";".join([
    f"[{i}:v]trim=start=0:duration=6,setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[f{i}]"
    for i in range(len(clips))
])
concat_maps = "".join([f"[f{i}]" for i in range(len(clips))])
filter_complex = vf + ";" + concat_maps + f"concat=n={len(clips)}:v=1:a=0[outv]"

cmd = [FFMPEG, "-y"] + sum([["-i", c] for c in clips], []) + [
    "-filter_complex", filter_complex,
    "-map", "[outv]",
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-an", CONCAT
]
result = subprocess.run(cmd, capture_output=True, timeout=180)
if result.returncode != 0:
    print("CONCAT ERROR:", result.stderr[-800:].decode("utf-8", errors="replace"))
    exit(1)
print(f"Concat: {os.path.getsize(CONCAT)//1024}KB")

# Mux with audio
print("Muxing...")
cmd = [FFMPEG, "-y", "-i", CONCAT, "-i", TTS,
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest", OUT]
result = subprocess.run(cmd, capture_output=True, timeout=120)
if result.returncode != 0:
    print("MUX ERROR:", result.stderr[-500:].decode("utf-8", errors="replace"))
    exit(1)

print(f"\n✅ DONE: {OUT}")
print(f"   Size: {os.path.getsize(OUT)//1024//1024}MB")
