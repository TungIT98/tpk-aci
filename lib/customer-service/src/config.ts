import { z } from 'zod';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from workspace root
config({ path: resolve(__dirname, '../../.env') });

const EnvSchema = z.object({
  ANTHROPIC_BASE_URL: z.string().default('https://api.minimax.io/anthropic'),
  ANTHROPIC_TOKEN_KEY: z.string(),

  // Qdrant
  QDRANT_URL: z.string().default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION_NAME: z.string().default('tkp-knowledge-base'),

  // TikTok
  TIKTOK_CLIENT_KEY: z.string(),
  TIKTOK_CLIENT_SECRET: z.string(),
  TIKTOK_APP_ID: z.string(),

  // Automation settings
  AUTO_RESPOND: z.string().default('true').transform(v => v === 'true'),
  CONFIDENCE_THRESHOLD: z.string().default('0.7').transform(Number),
  MAX_RESPONSES_PER_HOUR: z.string().default('50').transform(Number),
  RESPONSE_DELAY_MS: z.string().default('2000').transform(Number),
  IGNORED_KEYWORDS: z.string().default('').transform(v => v ? v.split(',').map(k => k.trim()) : []),
});

export type Config = z.infer<typeof EnvSchema>;

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) return cachedConfig;

  const raw = {
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
    ANTHROPIC_TOKEN_KEY: process.env.ANTHROPIC_TOKEN_KEY,
    QDRANT_URL: process.env.QDRANT_URL,
    QDRANT_API_KEY: process.env.QDRANT_API_KEY,
    QDRANT_COLLECTION_NAME: process.env.QDRANT_COLLECTION_NAME,
    TIKTOK_CLIENT_KEY: process.env.TIKTOK_CLIENT_KEY,
    TIKTOK_CLIENT_SECRET: process.env.TIKTOK_CLIENT_SECRET,
    TIKTOK_APP_ID: process.env.TIKTOK_APP_ID,
    AUTO_RESPOND: process.env.AUTO_RESPOND,
    CONFIDENCE_THRESHOLD: process.env.CONFIDENCE_THRESHOLD,
    MAX_RESPONSES_PER_HOUR: process.env.MAX_RESPONSES_PER_HOUR,
    RESPONSE_DELAY_MS: process.env.RESPONSE_DELAY_MS,
    IGNORED_KEYWORDS: process.env.IGNORED_KEYWORDS,
  };

  cachedConfig = EnvSchema.parse(raw);
  return cachedConfig;
}

export function validateConfig(): void {
  const cfg = getConfig();
  const missing: string[] = [];

  if (!cfg.ANTHROPIC_TOKEN_KEY) missing.push('ANTHROPIC_TOKEN_KEY');
  if (!cfg.TIKTOK_CLIENT_KEY) missing.push('TIKTOK_CLIENT_KEY');
  if (!cfg.TIKTOK_CLIENT_SECRET) missing.push('TIKTOK_CLIENT_SECRET');
  if (!cfg.TIKTOK_APP_ID) missing.push('TIKTOK_APP_ID');

  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(', ')}`);
  }
}