/**
 * lib/script-generator.js
 * AI script generation via MiniMax M2 model.
 *
 * Usage:
 *   import { ScriptGenerator } from './lib/script-generator.js';
 *   const gen = new ScriptGenerator();
 *   const script = await gen.generate({ channel: 'productivity_worker', topic: '...' });
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

export const MINIMAX_BASE = env.MINIMAX_BASE_URL ?? 'https://api.minimax.io';
export const MINIMAX_KEY  = env.MINIMAX_API_KEY  || env.ANTHROPIC_TOKEN_KEY || '';

// ---------------------------------------------------------------------------
// Channel prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPTS = {
  productivity_worker: `You are a skilled YouTube/TikTok scriptwriter for the "TKP Productivity" channel. Audience: 25–40yo office workers who want to work less and get more done. Tone: calm authority, evidence-based, warm. Format: hook (first 3 seconds), intro (5–10s), body (3 key points), CTA. Keep sentences short. Max 150 words total for a 60–90s video script.`,

  gen_z_success: `You are a skilled YouTube/TikTok scriptwriter for the "TKP Growth" channel. Audience: 18–28yo ambitious Gen Zers building careers and side incomes. Tone: energetic, direct, honest, no BS. Format: hook (first 2 seconds), punchy body, strong CTA. Use Gen Z language and energy. Max 120 words for a 45–75s video script.`,
};

export const CHANNELS = {
  productivity_worker: {
    id: 'productivity_worker',
    label: 'TKP Productivity',
    aspectRatio: '16:9',
    voiceId: 'rachel', // ElevenLabs
    systemPrompt: SYSTEM_PROMPTS.productivity_worker,
  },
  gen_z_success: {
    id: 'gen_z_success',
    label: 'TKP Growth',
    aspectRatio: '9:16',
    voiceId: 'sarah', // ElevenLabs
    systemPrompt: SYSTEM_PROMPTS.gen_z_success,
  },
};

// ---------------------------------------------------------------------------
// ScriptGenerator
// ---------------------------------------------------------------------------

export class ScriptGenerator {
  constructor({ baseUrl = MINIMAX_BASE, apiKey = MINIMAX_KEY } = {}) {
    this.baseUrl = baseUrl;
    this.apiKey  = apiKey;
  }

  /**
   * Generate a video script.
   * @param {object} opts
   * @param {string} opts.channel  — 'productivity_worker' | 'gen_z_success'
   * @param {string} opts.topic   — Video topic
   * @param {string} [opts.angle] — Specific angle/hook (optional)
   * @returns {Promise<string>}    — Generated script text
   */
  async generate({ channel, topic, angle }) {
    if (!this.apiKey) throw new Error('MiniMax API key not set (ANTHROPIC_TOKEN_KEY)');
    const ch = CHANNELS[channel];
    if (!ch) throw new Error(`Unknown channel: ${channel}. Use 'productivity_worker' or 'gen_z_success'.`);

    const anglePrompt = angle ? `\nSpecific angle to emphasize: ${angle}` : '';

    const res = await fetch(`${this.baseUrl}/v1/text/chatcompletion_v2`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'MiniMax-Text-01',
        max_tokens: 512,
        temperature: 0.7,
        messages: [
          { role: 'system', content: ch.systemPrompt },
          { role: 'user',   content: `Write a short video script about: ${topic}.${anglePrompt}` },
        ],
      }),
    });

    if (!res.ok) throw new Error(`MiniMax script generation failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    return content.trim();
  }

  /** Generate script with pre-built prompt from content/calendars */
  async fromOutline({ channel, outline }) {
    const { topic, angle, hook } = outline;
    return this.generate({ channel, topic, angle, customHook: hook });
  }
}
