
from gtts import gTTS
with open("C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\output\\_temp_hgf07\\_tts_text.txt", "r", encoding="utf-8") as f:
    text = f.read()
gTTS(text=text, lang="vi", slow=False).save("C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\output\\_temp_hgf07\\narration.mp3")
print("TTS saved")
