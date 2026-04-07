# Voiceover Workflow — TKP Content Agency

> TKP-26 (VID-15: Voiceover setup). Implementation in `lib/tts.js`.
> Defines voice profiles per channel, script-to-audio pipeline, and quality review step.

---

## Voice Profiles by Channel

### TKP Productivity

| Property | Value |
|----------|-------|
| Primary voice | Antoni (`ErXwobaYiN019pkycrre`) |
| Character | Calm professional — authoritative but warm |
| Fallback voice | Rachel (`21m00Tcm4TlvDq8ikWAM`) |
| Stability setting | 0.50 (consistent, measured delivery) |
| Similarity boost | 0.75 (neutral but engaging) |
| Pace | Natural (speed = 1.0) |
| Tone | "Here's what the research shows" |

### TKP Growth

| Property | Value |
|----------|-------|
| Primary voice | Josh (`TX37GLJWiS1HyvCFBiYb`) |
| Character | Energetic, younger, Gen Z–native |
| Fallback voice | Sarah (`EXAVITQu4vr4xnSD0c5L`) |
| Stability setting | 0.35 (more expressive, variable) |
| Similarity boost | 0.85 (immersive, conversational) |
| Pace | Slightly faster (speed = 1.1) |
| Tone | "Here's exactly what I did" |

---

## Script-to-Audio Pipeline

### Usage

```js
import { TTSProvider } from './lib/tts.js';

const tts = new TTSProvider();

// Simple speak for a channel
const { audio, qc } = await tts.generateAudio({
  channel: 'productivity',   // 'productivity' | 'growth'
  text: 'Your script text here...',
  provider: 'auto',           // 'auto' | 'elevenlabs' | 'minimax'
});

// audio is a Buffer (MP3)
// qc.pass === true means QC passed
// qc.warnings is an array of any warnings
```

### Provider Fallback Chain

1. **Primary**: ElevenLabs (higher quality, voice consistency)
2. **Fallback**: MiniMax TTS (cost-effective, used if ElevenLabs key is absent)
3. **Manual**: If both fail, pipeline throws — no silent failures

### Speed and Stability Tuning

| Channel | Stability | Similarity | Speed |
|---------|-----------|------------|-------|
| Productivity | 0.50 | 0.75 | 1.0 |
| Growth | 0.35 | 0.85 | 1.1 |

> Stability 0.35 = more varied/expressive (good for energetic Growth content)
> Stability 0.50 = more consistent/read-aloud style (good for instructional Productivity content)

---

## Quality Review Step

### Automated QC Checks (in `qualityCheck()`)

| Check | Threshold | Warning |
|-------|-----------|---------|
| Audio buffer size | Min 5KB | "Audio buffer suspiciously small" |
| Size vs. expected | Max 3× expected | "Audio significantly larger than expected" |

### Manual QC Checklist (run on generated audio before publish)

- [ ] Audio is present (file > 0 bytes, plays)
- [ ] No obvious truncation or cut-off at end
- [ ] No repeated sections or weird silence gaps
- [ ] Pacing sounds natural (not too fast/slow for channel)
- [ ] Volume level is consistent throughout
- [ ] No API error artifacts (sometimes seen as static bursts)
- [ ] Script match: voiceover matches the written script (spot-check key claims)

### If QC Fails

1. Re-generate with same text (transient API errors are rare but happen)
2. Try switching provider: `provider: 'minimax'` instead of `provider: 'elevenlabs'`
3. Try different voice ID within same channel: use fallback voice
4. Check `.env` has valid API keys

---

## Environment Variables

```env
# ElevenLabs (primary TTS — higher quality)
ELEVENLABS_API_KEY=your_elevenlabs_key_here

# MiniMax (fallback TTS — cost-effective)
MINIMAX_API_KEY=your_minimax_key_here
ANTHROPIC_TOKEN_KEY=your_minimax_api_token_here
```

> MiniMax key is read from `ANTHROPIC_TOKEN_KEY` in lib/tts.js (legacy env name — update if MiniMax has a dedicated TTS key)

---

## Integration with Video Pipeline

The `lib/video-pipeline.js` calls `TTSProvider.generateAudio()` as part of the pipeline:

```
Script → TTS Audio → Video Assembly (Hailuo clips + audio + overlays) → Export
```

The QC result is returned alongside audio so the pipeline can:
- Log warnings but proceed (soft fail — producer reviews manually)
- Or halt if QC is critical (buffer size = 0)

---

## Cost Notes

- ElevenLabs: ~$0.18–$0.30 per 1,000 characters (standard voices)
- MiniMax: ~$0.05 per 1,000 characters (estimated)
- For a 150-word script (~900 chars): ElevenLabs ~$0.16, MiniMax ~$0.05
- Both are included in free tiers (ElevenLabs: 10K chars/month; MiniMax: varies)
- Track usage in `logs/tts-usage.md`
