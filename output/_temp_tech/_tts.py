from gtts import gTTS
with open("C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\output\\_temp_tech\\_tts_text.txt", "r", encoding="utf-8") as f:
    t = f.read()
# Truncate to 500 chars if needed
t = t[:500] if len(t) > 500 else t
gTTS(text=t, lang="vi", slow=False).save("C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\output\\_temp_tech\\TECH-11\\narration.mp3")
print("TTS saved:", len(t), "chars")
