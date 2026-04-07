import type { CustomerMessage } from '../types.js';
import { TikTokClient } from './tiktok-api.js';
import { MiniMaxAgent } from '../minimax-agent.js';
import { KnowledgeBase } from '../knowledge-base.js';
import { getConfig } from '../config.js';

export class DMHandler {
  private tiktok: TikTokClient;
  private agent: MiniMaxAgent;
  private knowledgeBase: KnowledgeBase;
  private processedDMs: Set<string> = new Set();
  private responseCount: number = 0;
  private hourWindowStart: number = Date.now();

  constructor(tiktok: TikTokClient, agent: MiniMaxAgent, knowledgeBase: KnowledgeBase) {
    this.tiktok = tiktok;
    this.agent = agent;
    this.knowledgeBase = knowledgeBase;
  }

  async processDMs(): Promise<void> {
    const cfg = getConfig();
    if (!cfg.AUTO_RESPOND) {
      console.log('[DMHandler] Auto-respond disabled');
      return;
    }

    // Rate limiting check
    this.checkRateLimit();

    const dms = await this.tiktok.getDMs();
    console.log(`[DMHandler] Found ${dms.length} DMs`);

    for (const dm of dms) {
      // Skip own messages
      if (dm.is_from_me) {
        continue;
      }

      // Skip already processed DMs
      if (this.processedDMs.has(dm.dm_id)) {
        continue;
      }

      // Check if DM is relevant
      if (!this.isRelevantDM(dm.text)) {
        continue;
      }

      // Create customer message object
      const customerMessage: CustomerMessage = {
        id: dm.dm_id,
        type: 'dm',
        authorId: dm.sender_id,
        authorUsername: 'unknown', // TikTok DM doesn't always provide username in list
        content: dm.text,
        timestamp: new Date(dm.create_time * 1000),
      };

      // Get relevant context from knowledge base
      const context = await this.knowledgeBase.getRelevantContext(dm.text);

      // Generate response
      const response = await this.agent.respond(customerMessage, { relevantKnowledge: context });

      // Send response if confidence is high enough
      if (response.shouldRespond && response.confidence >= cfg.CONFIDENCE_THRESHOLD) {
        await this.delay(cfg.RESPONSE_DELAY_MS);

        const sentDMId = await this.tiktok.sendDM(dm.sender_id, response.content);

        if (sentDMId) {
          this.processedDMs.add(dm.dm_id);
          this.responseCount++;
          console.log(`[DMHandler] Replied to DM ${dm.dm_id}`);
        }
      }
    }
  }

  private isRelevantDM(text: string): boolean {
    const cfg = getConfig();
    const lowerText = text.toLowerCase();

    // Check ignored keywords
    for (const keyword of cfg.IGNORED_KEYWORDS) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return false;
      }
    }

    // Skip very short messages
    if (text.length < 3) {
      return false;
    }

    // Skip obvious spam
    const spamPatterns = [
      /check out my page/i,
      /follow me/i,
      /dm me/i,
      /buy now/i,
      /click here/i,
      /free money/i,
      /make \$\$/i,
    ];

    for (const pattern of spamPatterns) {
      if (pattern.test(text)) {
        return false;
      }
    }

    return true;
  }

  private checkRateLimit(): void {
    const cfg = getConfig();
    const hourMs = 60 * 60 * 1000;
    const now = Date.now();

    // Reset counter if hour has passed
    if (now - this.hourWindowStart > hourMs) {
      this.responseCount = 0;
      this.hourWindowStart = now;
    }

    if (this.responseCount >= cfg.MAX_RESPONSES_PER_HOUR) {
      throw new Error(`[DMHandler] Rate limit reached: ${this.responseCount}/${cfg.MAX_RESPONSES_PER_HOUR} responses this hour`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}