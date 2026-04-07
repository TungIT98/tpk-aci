from gtts import gTTS
import sys, os

script12 = "There's a two-list strategy that gives you total career clarity in 20 minutes. Step one: write down 25 career goals you want to achieve someday. Step two: circle your top five. Step three: look at the other 20. Those 20 are your avoid at all costs list. What you deliberately do not do defines your career as much as what you do. Most people spread themselves across all 25. The ones who get clarity and results focus on the five and ruthlessly protect their time from the other 20. The clarity is in the subtraction. Not in adding more."

out_path = os.path.join(os.path.dirname(__file__), 'audio.mp3')
tts = gTTS(text=script12, lang='en', slow=False)
tts.save(out_path)
print(f"gTTS OK: {out_path}")
