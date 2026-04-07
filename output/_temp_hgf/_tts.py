from gtts import gTTS
with open("C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\output\\_temp_hgf\\_tts_text.txt", "r", encoding="utf-8") as f:
    t = f.read()
t = t[:500] if len(t) > 500 else t
gTTS(text=t, lang="vi", slow=False).save("C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\output\\_temp_hgf\\HGF-14\\narration.mp3")
print("TTS saved:", len(t), "chars")
