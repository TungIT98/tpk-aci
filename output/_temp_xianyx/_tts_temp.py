from gtts import gTTS
with open(r"C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\output\\_temp_xianyx\\_tts_text.txt", "r", encoding="utf-8") as f:
    t = f.read()
gTTS(text=t, lang="vi", slow=False).save(r"C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\output\\_temp_xianyx\\XIANYX-70\\narration.mp3")
