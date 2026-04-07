#!/usr/bin/env python3
"""Generate GZ-13, GZ-14, GZ-15, GZ-16 using Pexels video + gTTS + FFmpeg."""
import os, sys, json, subprocess, shutil
from pathlib import Path
from urllib.parse import quote

ROOT = Path("C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI")
TEMP = ROOT / "output" / "_temp_gz"
OUT = Path("C:/tmp/openclaw/uploads")
PEXELS_KEY = "1OgVKQwZjQ1aVnixVZFFOE6FoGa9HmTysLOOfxOzfhgJtKiT04fWsaEa"
SCRIPTS_DIR = ROOT / "scripts" / "pending"
TEMP.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

VIDEOS = [
    {
        "id": "GZ-13",
        "title": "The Salary Negotiation Script That Works Even If You're Introverted",
        "search": "person typing laptop desk home office portrait",
        "script": "Most salary negotiation advice is built for extroverts. If that makes you want to disappear, this is for you. A salary negotiation script that works in writing. Three emails. No awkward meetings. Email one: the opener. 'Hi, I'd like to discuss my compensation.' Email two: the anchor. Name your number. Email three: the close. Written negotiation works because 95% of candidates never send these emails. Drop NEGOTIATE in the comments.",
        "duration": 7
    },
    {
        "id": "GZ-14",
        "title": "The One Resume Section That Recruiters Look at First",
        "search": "person looking at laptop screen resume job",
        "script": "Recruiters spend 7 seconds on your resume, and they are not looking at your name or education. There's one section that gets the first scan, and most people optimize the wrong thing. Format it like this: did X, measured by Y, resulted in Z. Three lines in this format will outperform an entire page of job descriptions. Flip it: 'Grew Instagram following by 300% in 6 months.' The ATS scanner reads numbers like a heat map. More numbers, more heat. More heat, more calls.",
        "duration": 7
    },
    {
        "id": "GZ-15",
        "title": "I Did 30 Days of Cold Outreach. Here's What Actually Worked.",
        "search": "person laptop spreadsheet data work from home",
        "script": "I did 30 days of cold outreach and tracked every single response. Day 3 to 7: template every guru recommends. Response rate: 4%. Disappointing. Day 14: I made one change. Stopped pitching and started asking a question. Response rate jumped to 18%. Doubled. Day 20: I stopped sending attachments. Suddenly people replied. Day 30: 90 messages sent, 14 responses, 3 leads, 1 opportunity. The template that got the most replies: two sentence intro, one specific observation, one question. Plain text. No attachments.",
        "duration": 7
    },
    {
        "id": "GZ-16",
        "title": "The One Skill That 10x'd My Income",
        "search": "person phone social media scrolling confident",
        "script": "Everyone says learn to code. Everyone says learn sales. Here's the skill nobody talks about that 10x'd my income. It is clear written communication. One clear Slack message gets you the promotion. One clear proposal gets you the client. One clear LinkedIn post gets you noticed. The difference between a junior and senior version of any role is usually not skill. It is clarity. Before any important message you send, ask: can someone who does not know me understand exactly what I am offering and what I want? If yes, you have done it. Every message is a credibility deposit. Start making them.",
        "duration": 7
    }
]

def log(tag, *a):
    print(f"[{tag}] {' '.join(str(x) for x in a)}")

def curl_json(url):
    r = subprocess.run(["curl", "-s", "-L", url,
                        "-H", f"Authorization: {PEXELS_KEY}"],
                       capture_output=True, text=True, timeout=30)
    try:
        return json.loads(r.stdout)
    except:
        log("ERROR", "JSON parse failed:", r.stdout[:200])
        return {}

def curl_dl(url, path):
    r = subprocess.run(["curl", "-s", "-L", "-o", str(path),
                        "-w", "%{http_code}",
                        url, "-H", f"Authorization: {PEXELS_KEY}"],
                       capture_output=True, text=True, timeout=60)
    code = r.stdout.strip()
    if code != "200":
        raise RuntimeError(f"HTTP {code} for {url}")

def best_clip(videos):
    for v in videos:
        for f in v.get("video_files", []):
            h = f.get("height", 0)
            w = f.get("width", 0)
            if f.get("quality") == "hd" and h >= 720 and w >= 360:
                return f
    if videos and videos[0].get("video_files"):
        return videos[0]["video_files"][0]
    return None

def ffmpeg(args):
    r = subprocess.run(["ffmpeg", "-y"] + args, capture_output=True, timeout=120)
    if r.returncode != 0:
        err = r.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"FFmpeg error: {err[-300:]}")

def gen_video(vid):
    vid_id = vid["id"]
    log(vid_id, "=== Starting ===")
    
    tmp_video = TEMP / f"{vid_id}_raw.mp4"
    tmp_audio = TEMP / f"{vid_id}_tts.mp3"
    tmp_audio_wav = TEMP / f"{vid_id}_tts.wav"
    final = OUT / f"{vid_id}-FINAL.mp4"
    
    # Step 1: Search Pexels
    q = quote(vid["search"])
    url = f"https://api.pexels.com/videos/search?query={q}&per_page=5&orientation=portrait"
    data = curl_json(url)
    videos = data.get("videos", [])
    log(vid_id, f"Pexels results: {len(videos)}")
    
    if not videos:
        log(vid_id, "ERROR: No Pexels results!")
        return False
    
    clip = best_clip(videos)
    if not clip:
        log(vid_id, "ERROR: No suitable clip found!")
        return False
    
    clip_url = clip["link"]
    log(vid_id, f"Downloading clip: {clip_url}")
    curl_dl(clip_url, tmp_video)
    
    # Get video duration
    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json",
         "-show_format", "-show_streams", str(tmp_video)],
        capture_output=True, text=True, timeout=30
    )
    try:
        info = json.loads(probe.stdout)
        streams = info.get("streams", [])
        duration = float(info.get("format", {}).get("duration", 7))
        for s in streams:
            if s.get("codec_type") == "video":
                vw = s.get("width", 0)
                vh = s.get("height", 0)
                break
        else:
            vw, vh = 1080, 1920
    except:
        duration = 7.0
        vw, vh = 1080, 1920
    
    log(vid_id, f"Video: {vw}x{vh}, {duration:.1f}s")
    
    # Step 2: gTTS narration (trim to match video or 6s, whichever is shorter)
    from gtts import gTTS
    trim_dur = min(duration - 0.5, 6.0)
    log(vid_id, f"Generating TTS ({trim_dur:.1f}s)...")
    tts = gTTS(text=vid["script"][:500], lang="en", tld="com")
    tts.save(str(tmp_audio))
    
    # Convert to wav for precise trimming
    ffmpeg(["-i", str(tmp_audio), "-ar", "44100", "-ac", "2", str(tmp_audio_wav)])
    
    # Get TTS duration
    probe2 = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(tmp_audio_wav)],
        capture_output=True, text=True, timeout=30
    )
    try:
        tts_dur = float(json.loads(probe2.stdout).get("format", {}).get("duration", 6.0))
    except:
        tts_dur = 6.0
    
    log(vid_id, f"TTS duration: {tts_dur:.1f}s, video: {duration:.1f}s")
    
    # Step 3: Trim TTS audio to match video duration
    tmp_audio_trimmed = TEMP / f"{vid_id}_tts_trimmed.wav"
    ffmpeg([
        "-i", str(tmp_audio_wav),
        "-t", str(trim_dur),
        "-ar", "44100", "-ac", "2",
        "-y", str(tmp_audio_trimmed)
    ])
    log(vid_id, f"TTS trimmed to {trim_dur:.1f}s")
    
    # Step 4: Assemble — portrait crop if landscape
    if vw > vh:
        new_w = min(vw, int(vh * 9 / 16))
        x_off = (vw - new_w) // 2
        log(vid_id, f"Center-cropping {vw}x{vh} to {new_w}x{vh}")
        ffmpeg([
            "-ss", "0", "-t", str(trim_dur),
            "-i", str(tmp_video),
            "-vf", f"crop={new_w}:{vh}:{x_off}:0,scale=1080:1920",
            "-c:v", "libx264", "-preset", "fast",
            "-pix_fmt", "yuv420p", "-r", "30",
            "-an", "-y", str(TEMP / f"{vid_id}_video_only.mp4")
        ])
    else:
        ffmpeg([
            "-ss", "0", "-t", str(trim_dur),
            "-i", str(tmp_video),
            "-vf", f"scale=1080:1920",
            "-c:v", "libx264", "-preset", "fast",
            "-pix_fmt", "yuv420p", "-r", "30",
            "-an", "-y", str(TEMP / f"{vid_id}_video_only.mp4")
        ])
    
    log(vid_id, "Combining video + audio...")
    ffmpeg([
        "-i", str(TEMP / f"{vid_id}_video_only.mp4"),
        "-i", str(tmp_audio_trimmed),
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-y", str(TEMP / f"{vid_id}_combined.mp4")
    ])
    log(vid_id, "Assembling video...")

    
    # Copy to final output
    shutil.copy2(TEMP / f"{vid_id}_combined.mp4", final)
    log(vid_id, f"DONE -> {final}")
    
    # Cleanup temp
    for f in [tmp_video, tmp_audio, tmp_audio_wav, tmp_audio_trimmed,
              TEMP / f"{vid_id}_combined.mp4", TEMP / f"{vid_id}_video_only.mp4"]:
        try:
            f.unlink()
        except:
            pass
    
    return True

if __name__ == "__main__":
    results = {}
    for vid in VIDEOS:
        try:
            ok = gen_video(vid)
            results[vid["id"]] = "OK" if ok else "FAILED"
        except Exception as e:
            log(vid["id"], "EXCEPTION:", str(e))
            results[vid["id"]] = f"ERROR: {e}"
    
    print("\n=== SUMMARY ===")
    for k, v in results.items():
        print(f"  {k}: {v}")
