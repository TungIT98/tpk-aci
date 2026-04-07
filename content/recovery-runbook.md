# TKP Content Agency — Recovery Runbook

**Last updated:** 2026-03-26
**Owner:** Founding Engineer (7bb601dc)

---

## Overview

Step-by-step recovery procedures when primary AI services fail.
The auto-failover system (`lib/failover.js`) handles most failures automatically.
This runbook documents the fallback chain and manual intervention steps.

---

## Service Failure Hierarchy

```
VIDEO GENERATION
├── Primary: Hailuo (MiniMax) ────────────────────────── ✅
│   └── Failover: SD WebUI + FFmpeg Ken Burns ────────── ✅
│       └── Final fallback: Stock footage (Pexels)
│
TTS / VOICE
├── Primary: ElevenLabs (cloned voice if configured) ─── ✅
│   ├── Failover: ElevenLabs preset voices ──────────── ✅
│   ├── Failover: MiniMax TTS ───────────────────────── ✅
│   └── Final fallback: Windows SAPI (David/Zira) ────── ✅
│
AUDIO PROCESSING (always local)
├── FFmpeg ───────────────────────────────────────────── ✅ (always available)
└── Whisper (OpenAI) ─────────────────────────────────── ⚠️ (requires OPENAI_API_KEY)
```

---

## 1. Hailuo (MiniMax) Video API Failure

### Symptoms
- `HailuoVideo.generateVideo()` throws error after 3 attempts
- Error: "MiniMax API error", "rate limit", "quota exceeded", "connection timeout"
- Status: "Fail" returned from `query/video_generation`

### Auto-Failover (handled by `lib/failover.js`)
```
FailoverOrchestrator.generateVideo()
  → Hailuo attempt 1 → FAIL
  → Hailuo attempt 2 → FAIL
  → Hailuo attempt 3 → FAIL
  → SD WebUI + FFmpeg Ken Burns animation → SUCCESS
```

### Manual Recovery (if auto-failover also fails)

**Step 1:** Check MiniMax platform status
```
https://platform.minimax.io
```
- Check if account has remaining video credits
- Check if API key is valid

**Step 2:** If quota exceeded → wait or upgrade plan
```
MiniMax Video API: 3 videos/day (film.03) on basic plan
Upgrade to: $80/month plan for higher limits
```

**Step 3:** If API key invalid → rotate key
1. Log in to platform.minimax.io
2. Go to API Keys → Regenerate
3. Update `ANTHROPIC_TOKEN_KEY` in `.env`

**Step 4:** If MiniMax is down entirely → use stock footage fallback
```javascript
import { FootageFetcher } from './video_studio_app/footage_fetcher.js';
const fetcher = new FootageFetcher();
const clips = await fetcher.search({ query: 'productivity tips', count: 5 });
// Use clips[0].hd_url as video source
```

---

## 2. ElevenLabs TTS Failure

### Symptoms
- `ElevenLabs.tts()` returns 401/403 (auth error)
- `speakWithFailover()` auto-recovers via MiniMax or SAPI
- Error: "ElevenLabs rate limit exceeded"

### Auto-Failover (handled by `lib/failover.js`)
```
FailoverOrchestrator.generateSpeech()
  → ElevenLabs cloned voice → FAIL
  → ElevenLabs preset voice → FAIL
  → MiniMax TTS → FAIL
  → Windows SAPI (David/Zira) → SUCCESS
```

### Manual Recovery

**Step 1:** Check ElevenLabs account
```
https://elevenlabs.io/account
- Check character usage: 10,000 chars/month free
- Check voice library for cloned voices
```

**Step 2:** If auth error (401) → fix API key
```bash
# Update in .env:
ELEVENLABS_API_KEY=sk_78b64d180673e69f9d16228928d7fedf29045578
```

**Step 3:** If rate limited → wait 1 hour or use SAPI directly
```javascript
// Force SAPI:
import { TTSProvider } from './lib/tts.js';
const tts = new TTSProvider();
const audio = await tts.sapi({ text: 'Hello world', voice: 'David' });
```

**Step 4:** If ElevenLabs is down → MiniMax TTS fallback
```javascript
// Force MiniMax TTS:
const audio = await tts.minimax({ text: 'Hello world' });
```

---

## 3. Stable Diffusion WebUI Failure

### Symptoms
- SD WebUI returns non-200 response
- Error: "SD WebUI connection refused" (localhost:7860 not running)
- Fallback animation in `failover.js` fails

### Manual Recovery

**Step 1:** Check if SD WebUI is running
```bash
curl http://localhost:7860/sdapi/v1/progress
# Should return JSON if running
```

**Step 2:** Start SD WebUI if not running
```bash
# Windows:
.\webui-user.bat

# Or with custom port:
set SD_WEBUI_PORT=7860
.\webui-user.bat
```

**Step 3:** If SD WebUI won't start → use Pexels stock footage
```javascript
import { FootageFetcher } from './video_studio_app/footage_fetcher.js';
const fetcher = new FootageFetcher();
const result = await fetcher.search({ query: 'your topic', count: 3 });
const broll = result.clips[0];
// Download and use as video source
```

---

## 4. Whisper Transcription Failure (OpenAI)

### Symptoms
- `WhisperTranscriber.transcribe()` throws: "OpenAI API key not set"
- Error: `OPENAI_API_KEY in .env` is empty or invalid

### Manual Recovery

**Step 1:** Set OpenAI API key
```bash
# In .env:
OPENAI_API_KEY=sk-...  # from platform.openai.com
```

**Step 2:** If no OpenAI key → skip transcription, use manual subtitles
```javascript
// Generate basic subtitles from TTS timestamps:
const subs = generateBasicSubtitles(ttsAudio, { maxWordsPerCue: 6 });
// Write to .srt file using audio.js
```

**Step 3:** Check OpenAI billing
```
https://platform.openai.com/account/usage
Whisper: ~$0.006/minute
```

---

## 5. Video Upload Failures (YouTube/TikTok/Instagram/LinkedIn)

### YouTube Upload Failure
```javascript
// OAuth token expired → refresh:
node scripts/oauth-youtube.js --refresh

// Or re-authorize:
node scripts/oauth-youtube.js --url
# Visit URL → authorize → copy code
node scripts/oauth-youtube.js <code>
```

### TikTok Upload Failure
```javascript
// Token expired → re-authorize:
node scripts/oauth-tiktok.js --url
# Visit TikTok auth page → authorize → get code
```

### Instagram/LinkedIn Failure
- Check `IG_ACCESS_TOKEN` and `LINKEDIN_ACCESS_TOKEN` in `.env`
- Re-authenticate via their respective OAuth flows

---

## 6. Voice Cloning — Setup & Management

### Clone a Voice (requires 30+ seconds of clear audio)

```javascript
import { TTSProvider } from './lib/tts.js';

const tts = new TTSProvider();

// Clone from audio file (MP3/WAV, ≥30 seconds recommended)
const voiceId = await tts.cloneVoice('path/to/voice_sample.mp3', 'my-voice');

console.log('Cloned voice ID:', voiceId);
// → Add to .env:
// ELEVENLABS_VOICE_CLONE_ID=abc123...

// Use the cloned voice:
const audio = await tts.speakWithClonedVoice('Hello, this is my cloned voice.');
```

### List All Voice Profiles

```javascript
const voices = await tts.listVoices();
voices.forEach(v => {
  console.log(`${v.label}: ${v.voiceId} (${v.category})`);
  console.log(`  Preview: ${v.previewUrl}`);
});
```

### Delete an Unused Voice Profile

```javascript
// ElevenLabs voice management API:
const ELEVENLABS_API_KEY = 'sk_...';
const VOICE_ID_TO_DELETE = 'abc123';

const res = await fetch(`https://api.elevenlabs.io/v1/voices/${VOICE_ID_TO_DELETE}`, {
  method: 'DELETE',
  headers: { 'xi-api-key': ELEVENLABS_API_KEY },
});
// 200 = deleted, 404 = not found
```

### Use Voice Profile for TTS

```javascript
// Use a specific voice by ID:
const audio = await tts.elevenlabs({
  text: 'Hello from my custom voice!',
  voiceId: 'my-custom-voice-id',
  stability: 0.5,
  similarity: 0.75,
});
```

---

## 7. Emergency: All Services Down

If all AI services are unavailable, use the **human-in-the-loop** fallback:

1. **Generate script** — human writes narration script
2. **Record audio** — human records voice on phone → upload MP3
3. **Find stock footage** — human selects Pexels clips manually
4. **Assemble video** — run FFmpeg assembly with human-provided assets

```bash
# Emergency FFmpeg assembly (no AI needed):
ffmpeg -i video.mp4 -i audio.mp3 -c:v copy -c:a aac -shortest output.mp4
```

### Escalation Contacts

| Service | Status Page | Support |
|---------|------------|---------|
| MiniMax | platform.minimax.io | billing/credits |
| ElevenLabs | elevenlabs.io/account | usage/billing |
| OpenAI | platform.openai.com/usage | API keys/billing |
| Pexels | pexels.com/api | rate limits |

---

## Quick Reference: Fallback Commands

```bash
# Force SAPI TTS (always works on Windows):
node -e "
const {TTSProvider} = require('./lib/tts.js');
const t = new TTSProvider();
t.sapi({text: 'Test', voice: 'David'}).then(r => require('fs').writeFileSync('test.mp3', r.audioBuffer));
"

# Extract audio from video:
node lib/audio.js extract video.mp4 audio.mp3

# Check audio duration:
node lib/audio.js duration audio.mp3

# Run health check:
node scripts/monitor-services.js --alerts

# Force SD WebUI fallback (if Hailuo fails):
# → Already handled automatically by lib/failover.js
```

---

## Monitoring & Alerting

Run periodic health checks:
```bash
# Every 15 minutes (add to n8n or cron):
node scripts/monitor-services.js --probe

# Daily alert check:
node scripts/monitor-services.js --alerts

# Weekly report:
node scripts/monitor-services.js --weekly
```

---

*Recovery procedures maintained by Founding Engineer*
*Auto-failover code: `lib/failover.js`*
*Health monitoring: `scripts/monitor-services.js`*
