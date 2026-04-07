import subprocess, os
from gtts import gTTS

workdir = r"C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI"
FFMPEG = r"C:\New folder\ffmpeg-2025-12-01-git-7043522fe0-essentials_build\bin\ffmpeg.exe"

clips = ["shot1", "shot2", "shot3", "shot4", "shot5"]
starts = ["0", "6", "12", "18", "24"]
durations = [6, 6, 6, 6, 6]

# Generate TTS narration
narration = """One year after the winter solstice — when a gravekeeper's fire, for the first time in three thousand years, welcomed a child into the world instead of carrying one out. The palace did not know how to commemorate it. Half the court prepared cold blue mourning flowers — the old tradition, honoring what the gravekeeper took. The other half prepared warm orange chrysanthemums — the new tradition, honoring what the gravekeeper healed. And the family arrived at the palace gates — not knowing which welcome they would receive. She had no fear. How could she? She had been born into fire — literally — her first breath taken in white-gold flame. To her, fire was not the cold blue of death. It was the warmth of being welcomed into the world. The first warm fire in three thousand years. Not the cold blue of death. Not the pale white of the gravekeeper's eternal flame. Warm orange-gold phoenix fire — the color of a hearth, the color of childhood, the color of a family. Three thousand years of cold. Three thousand years of funeral fires. Three thousand years of the gravekeeper's fire that ONLY took — never gave. And this child — one year old, born into fire, not taken by it — had just healed three thousand years of cold with one small hand."""

tts_path = os.path.join(workdir, "XIANYX-42_audio.mp3")
tts = gTTS(text=narration, lang="en", slow=False)
tts.save(tts_path)
print(f"TTS: {tts_path} ({os.path.getsize(tts_path)/1024/1024:.1f}MB)")

# Build scale+trim for each clip
vf_parts = []
for i in range(len(clips)):
    src = os.path.join(workdir, f"XIANYX-42_{clips[i]}.mp4")
    start = starts[i]
    dur = durations[i]
    vf_parts.append(
        f"[{i}:v]trim=start={start}:duration={dur},setpts=PTS-STARTPTS,"
        f"scale=1080:-2:force_original_aspect_ratio=increase,"
        f"pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,"
        f"setsar=1[v{i}]"
    )

vf_str = ";".join(vf_parts)
concat_inputs = "".join([f"[v{i}]" for i in range(len(clips))])
vf_str += f";{concat_inputs}concat=n={len(clips)}:v=1:a=0[outv]"

input_args = []
for clip in clips:
    input_args += ["-i", os.path.join(workdir, f"XIANYX-42_{clip}.mp4")]

output = os.path.join(workdir, "output_topic", "videos", "XIANYX-42.mp4")
os.makedirs(os.path.dirname(output), exist_ok=True)

# FFmpeg args: all inputs first, then output options
cmd = [FFMPEG, "-y"] + input_args + [
    "-filter_complex", vf_str,
    "-map", "[outv]",
    "-i", tts_path,
    "-map", "1:a",
    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest",
    output
]

print("Running FFmpeg...")
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    print(f"ERROR:\n{r.stderr[-3000:]}")
else:
    size = os.path.getsize(output) / 1024 / 1024
    print(f"DONE: {output} ({size:.1f}MB)")
