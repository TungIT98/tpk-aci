/**
 * lib/tts.js
 * Text-to-Speech provider: ElevenLabs (primary) + MiniMax (fallback).
 *
 * Usage:
 *   import { TTSProvider, ELEVENLABS_VOICES } from './lib/tts.js';
 *   const tts = new TTSProvider();
 *   const audio = await tts.speak({ text: 'Hello world' });
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const env = {};
    for (const line of readFileSync(resolve(__dirname, '..', '.env'), 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();

const ELEVENLABS_BASE     = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_KEY      = env.ELEVENLABS_API_KEY ?? '';
const MINIMAX_BASE        = env.MINIMAX_BASE_URL    ?? 'https://api.minimax.io';
const MINIMAX_KEY         = env.MINIMAX_API_KEY     || env.ANTHROPIC_TOKEN_KEY || '';
const ELEVENLABS_CLONE_ID = env.ELEVENLABS_VOICE_CLONE_ID ?? '';

// Channel voice profiles — mapped to ElevenLabs voice IDs
// Selected based on tone match to channel persona
export const CHANNEL_VOICES = {
  // TKP Productivity — calm authority, warm, measured pace
  // 'antonio' is authoritative but warm — fits calm professional tone
  productivity: { voiceId: 'ErXwobaYiN019pkycrre', label: 'Antoni — calm professional' },
  // 'rachel' is clear and engaging — good for direct instructional tone
  productivity_fallback: { voiceId: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel — clear direct' },

  // TKP Growth — energetic, punchy, Gen Z–native
  // 'josh' has a younger, energetic quality
  growth: { voiceId: 'TX37GLJWiS1HyvCFBiYb', label: 'Josh — energetic Gen Z' },
  // 'sarah' is expressive and warm — good for relatable content
  growth_fallback: { voiceId: 'EXAVITQu4vr4xnSD0c5L', label: 'Sarah — warm relatable' },
};

// Legacy flat map for backwards compatibility
export const ELEVENLABS_VOICES = {
  rachel: '21m00Tcm4TlvDq8ikWAM',
  josh:   'TX37GLJWiS1HyvCFBiYb',
  sarah:  'EXAVITQu4vr4xnSD0c5L',
  antoni: 'ErXwobaYiN019pkycrre',
};

export class TTSProvider {
  constructor({ elevenlabsKey = ELEVENLABS_KEY, minimaxKey = MINIMAX_KEY } = {}) {
    this.elevenlabsKey = elevenlabsKey;
    this.minimaxKey    = minimaxKey;
  }

  /** ElevenLabs TTS — returns MP3 Buffer */
  async elevenlabs({ text, voiceId = ELEVENLABS_VOICES.rachel, stability = 0.5, similarity = 0.75 }) {
    if (!this.elevenlabsKey) throw new Error('ElevenLabs key not set');
    const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': this.elevenlabsKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({ text, stability, similarity_boost: similarity }),
    });
    if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** List available ElevenLabs voices for voice selection UI. */
  async listVoices() {
    if (!this.elevenlabsKey) return Object.entries(ELEVENLABS_VOICES).map(([label, voiceId]) => ({
      voiceId, label, category: 'builtin', previewUrl: null,
    }));
    const res = await fetch(`${ELEVENLABS_BASE}/voices`, {
      headers: { 'xi-api-key': this.elevenlabsKey },
    });
    if (!res.ok) throw new Error(`listVoices failed: ${res.status}`);
    const data = await res.json();
    return (data.voices ?? []).map(v => ({
      voiceId:    v.voice_id,
      name:       v.name,
      category:   v.category ?? 'custom',
      previewUrl: v.preview_url ?? null,
      labels:     v.labels ?? {},
    }));
  }

  /**
   * Generate a short audio preview for a given voice.
   * @param {string} voiceId     — ElevenLabs voice ID
   * @param {string} [previewText] — Short text (≤150 chars recommended)
   * @returns {Promise<Buffer>}  — MP3 audio buffer
   */
  async previewVoice(voiceId, previewText = 'Hi, this is a voice preview from ElevenLabs.') {
    return this.elevenlabs({ text: previewText.slice(0, 200), voiceId });
  }

  /** Windows SAPI TTS fallback — returns MP3 Buffer via PowerShell + FFmpeg.
   *  Used when ElevenLabs and MiniMax both fail. Not premium quality but works offline.
   *  Voice mapping: productivity → David, growth → Zira */
  async sapi({ text, voice = 'David', outputPath }) {
    const tempDir = resolve(__dirname, '..', 'output', '_temp');
    const tempWav = resolve(tempDir, `sapi_${Date.now()}.wav`);
    const tempMp3 = outputPath ?? resolve(tempDir, `sapi_${Date.now()}.mp3`);

    // Ensure temp directory exists (sync, blocking)
    const { mkdirSync: msync } = await import('fs');
    msync(tempDir, { recursive: true });

    // Generate WAV via PowerShell SAPI
    const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Male)
try { $synth.SelectVoice('${voice} Desktop') } catch { }
$synth.SetOutputToWaveFile('${tempWav.replace(/\\/g, '\\\\')}')
$synth.Speak([Console]::In.ReadToEnd())
$synth.SetOutputToDefaultAudioDevice()
Write-Host 'SAPI_OK'
`.trim();

    const psResult = spawnSync('powershell', ['-NoProfile', '-Command', psScript], {
      input: text,
      encoding: 'utf-8',
    });

    if (psResult.status !== 0 || !psResult.stdout.includes('SAPI_OK')) {
      throw new Error(`SAPI TTS failed: ${psResult.stderr || psResult.stdout}`);
    }

    // Convert WAV to MP3 via FFmpeg
    const ffmpegResult = spawnSync('ffmpeg', [
      '-i', tempWav,
      '-codec:a', 'libmp3lame',
      '-qscale:a', '2',
      '-y',
      tempMp3,
    ], { encoding: 'utf-8' });

    if (ffmpegResult.status !== 0) {
      throw new Error(`FFmpeg conversion failed: ${ffmpegResult.stderr}`);
    }

    return { audioBuffer: readFileSync(tempMp3), mp3Path: tempMp3 };
  }

  /** MiniMax TTS — returns { audio_url, duration_s } */
  async minimax({ text, model = 'speech-2.8-hd', speed = 1.0 }) {
    if (!this.minimaxKey) throw new Error('MiniMax key not set');
    const res = await fetch(`${MINIMAX_BASE}/v1/t2a`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.minimaxKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, text, speed }),
    });
    if (!res.ok) throw new Error(`MiniMax TTS failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  /** Unified speak — tries ElevenLabs first, falls back to MiniMax */
  async speak({ text, provider = 'auto', voiceId }) {
    if (provider === 'elevenlabs' || (provider === 'auto' && this.elevenlabsKey)) {
      return this.elevenlabs({ text, voiceId: voiceId ?? ELEVENLABS_VOICES.rachel });
    }
    return this.minimax({ text });
  }

  /**
   * Speak for a specific channel — applies channel-optimized voice and settings.
   * Tries providers in order: ElevenLabs → MiniMax → Windows SAPI (offline fallback)
   * @param {string} channel - 'productivity' | 'growth'
   * @param {object} opts
   * @param {string} opts.text
   * @param {string} [opts.provider='auto'] - 'elevenlabs' | 'minimax' | 'sapi' | 'auto'
   * @param {number} [opts.speedOverride] - override voice speed
   */
  async speakForChannel(channel, { text, provider = 'auto', speedOverride, outputPath } = {}) {
    const profile = CHANNEL_VOICES[channel];
    if (!profile) throw new Error(`Unknown channel: ${channel}. Use 'productivity' or 'growth'.`);

    const voiceId = profile.voiceId;
    const sapiVoice = channel === 'growth' ? 'Zira' : 'David';

    // Explicit provider request
    if (provider === 'sapi') {
      const { audioBuffer, mp3Path } = await this.sapi({ text, voice: sapiVoice, outputPath });
      return { audioBuffer, mp3Path };
    }

    // Try ElevenLabs
    if (provider === 'elevenlabs' || provider === 'auto') {
      try {
        const stability = channel === 'growth' ? 0.35 : 0.5;
        const similarity = channel === 'growth' ? 0.85 : 0.75;
        return await this.elevenlabs({ text, voiceId, stability, similarity });
      } catch (err) {
        // ElevenLabs failed — try next provider
      }
    }

    // Try MiniMax
    if (provider === 'minimax' || (!this.elevenlabsKey && provider === 'auto')) {
      try {
        const speed = speedOverride ?? (channel === 'growth' ? 1.1 : 1.0);
        return await this.minimax({ text, speed });
      } catch (err) {
        // MiniMax failed — try SAPI fallback
      }
    }

    // Final fallback: Windows SAPI (no API key needed)
    const { audioBuffer, mp3Path } = await this.sapi({ text, voice: sapiVoice, outputPath });
    return { audioBuffer, mp3Path };
  }

  /**
   * Script-to-audio pipeline: generate, QC check, return audio buffer.
   * @param {object} opts
   * @param {string} opts.channel - 'productivity' | 'growth'
   * @param {string} opts.text - script text
   * @param {string} [opts.provider='auto']
   * @param {Function} [opts.onProgress] - called with status strings
   */
  async generateAudio({ channel, text, provider = 'auto', onProgress } = {}) {
    const log = onProgress ?? (() => {});
    log(`[TTS] Starting pipeline for channel: ${channel}`);
    log(`[TTS] Text length: ${text.length} chars`);

    log('[TTS] Generating audio...');
    const audioStart = Date.now();
    const audio = await this.speakForChannel(channel, { text, provider });
    log(`[TTS] Audio generated in ${Date.now() - audioStart}ms`);

    log('[TTS] Running QC check...');
    const qcResult = await this.qualityCheck(audio, { channel, textLength: text.length });
    if (!qcResult.pass) {
      log(`[TTS] QC WARNING: ${qcResult.warnings.join('; ')}`);
    } else {
      log('[TTS] QC passed.');
    }

    return { audio, qc: qcResult };
  }

  /**
   * Quality review step for generated audio.
   * @param {Buffer} audioBuffer
   * @param {object} opts
   * @param {string} opts.channel
   * @param {number} opts.textLength
   * @returns {{ pass: boolean, warnings: string[] }}
   */
  async qualityCheck(audioBuffer, { channel, textLength } = {}) {
    const warnings = [];
    const MIN_AUDIO_BYTES = 5000; // ~1s of audio at 64kbps = ~8000 bytes; be generous

    if (!audioBuffer || audioBuffer.length < MIN_AUDIO_BYTES) {
      warnings.push('Audio buffer suspiciously small — possible silent generation');
    }

    const expectedDurationSec = textLength / 12; // ~12 chars/sec average speech rate
    const expectedBytes = expectedDurationSec * 16000; // rough MP3 byte estimate at 128kbps
    if (audioBuffer && audioBuffer.length > expectedBytes * 3) {
      warnings.push('Audio significantly larger than expected — possible duplication or error');
    }

    return { pass: warnings.length === 0, warnings };
  }

  /**
   * Clone a voice from an audio sample using ElevenLabs Instant Voice Cloning.
   *
   * Requires: audio file with at least 30 seconds of clear speech (MP3/WAV/OGG).
   * The cloned voice ID is stored in .env as ELEVENLABS_VOICE_CLONE_ID.
   *
   * @param {string} sampleAudioPath — path to audio sample (≥30 seconds recommended)
   * @param {string} [name='clone'] — label for the cloned voice
   * @returns {Promise<string>} — voice ID of the newly cloned voice
   */
  async cloneVoice(sampleAudioPath, name = 'clone') {
    if (!this.elevenlabsKey) throw new Error('ElevenLabs key not set for voice cloning');
    if (!existsSync(sampleAudioPath)) throw new Error(`Sample audio not found: ${sampleAudioPath}`);

    const formData = new FormData();
    formData.append('files', await this._fileFromPath(sampleAudioPath));
    formData.append('name', name);
    formData.append('description', `Cloned voice: ${name} — created ${new Date().toISOString()}`);

    const res = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': this.elevenlabsKey },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ElevenLabs voice cloning failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    const voiceId = data.voice_id ?? data.generated_voice_id;
    if (!voiceId) throw new Error(`Voice cloning response missing voice_id: ${JSON.stringify(data)}`);

    return voiceId;
  }

  /**
   * Use the pre-configured cloned voice ID for TTS.
   * Requires ELEVENLABS_VOICE_CLONE_ID in .env.
   *
   * @param {string} text — text to speak
   * @param {object} [opts] — voice settings (stability, similarity, speed)
   * @returns {Promise<Buffer>} — MP3 audio buffer
   */
  async speakWithClonedVoice(text, opts = {}) {
    if (!ELEVENLABS_CLONE_ID) throw new Error('ELEVENLABS_VOICE_CLONE_ID not set in .env');
    const { stability = 0.5, similarity = 0.75 } = opts;
    return this.elevenlabs({ text, voiceId: ELEVENLABS_CLONE_ID, stability, similarity });
  }

  /**
   * TTS with automatic failover: cloned voice → ElevenLabs preset → MiniMax → SAPI.
   *
   * @param {string} text
   * @param {object} [opts]
   * @param {Function} [opts.onProgress] — called with status strings
   */
  async speakWithFailover(text, opts = {}) {
    const { onProgress } = opts ?? {};

    // 1. Try cloned voice
    if (ELEVENLABS_CLONE_ID) {
      try {
        onProgress?.('[TTS] Trying cloned voice...');
        return await this.speakWithClonedVoice(text, opts);
      } catch (_) { /* fall through */ }
    }

    // 2. Try ElevenLabs preset (auto voice selection)
    try {
      onProgress?.('[TTS] Trying ElevenLabs...');
      return await this.speak({ text, provider: 'elevenlabs' });
    } catch (_) { /* fall through */ }

    // 3. Try MiniMax
    try {
      onProgress?.('[TTS] Trying MiniMax TTS...');
      return await this.minimax({ text });
    } catch (_) { /* fall through */ }

    // 4. Final fallback: SAPI
    onProgress?.('[TTS] Falling back to Windows SAPI...');
    const { audioBuffer } = await this.sapi({ text, voice: 'David' });
    return audioBuffer;
  }

  // Internal helper — polyfill-free File from path for Node 18
  async _fileFromPath(filePath) {
    const buffer = readFileSync(filePath);
    const name = filePath.split(/[\\/]/).pop();
    return new File([buffer], name);
  }
}
