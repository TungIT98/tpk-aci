import type { CustomerMessage, AgentResponse } from '../types.js';
import { TikTokClient } from './tiktok-api.js';
import { MiniMaxAgent } from '../minimax-agent.js';
import { KnowledgeBase } from '../knowledge-base.js';
import { getConfig } from '../config.js';

export class CommentHandler {
  private tiktok: TikTokClient;
  private agent: MiniMaxAgent;
  private knowledgeBase: KnowledgeBase;
  private processedComments: Set<string> = new Set();
  private responseCount: number = 0;
  private hourWindowStart: number = Date.now();

  constructor(tiktok: TikTokClient, agent: MiniMaxAgent, knowledgeBase: KnowledgeBase) {
    this.tiktok = tiktok;
    this.agent = agent;
    this.knowledgeBase = knowledgeBase;
  }

  async processVideoComments(videoId: string): Promise<void> {
    const cfg = getConfig();
    if (!cfg.AUTO_RESPOND) {
      console.log('[CommentHandler] Auto-respond disabled');
      return;
    }

    // Rate limiting check
    this.checkRateLimit();

    const comments = await this.tiktok.getComments(videoId);
    console.log(`[CommentHandler] Found ${comments.length} comments for video ${videoId}`);

    for (const comment of comments) {
      // Skip already processed comments
      if (this.processedComments.has(comment.comment_id)) {
        continue;
      }

      // Skip own comments (is_from_me equivalent check would be done via user_id)
      const isRelevant = this.isRelevantComment(comment.text);
      if (!isRelevant) {
        continue;
      }

      // Create customer message object
      const customerMessage: CustomerMessage = {
        id: comment.comment_id,
        type: 'comment',
        authorId: comment.user_id,
        authorUsername: comment.username,
        content: comment.text,
        timestamp: new Date(comment.create_time * 1000),
        parentId: comment.parent_comment_id,
      };

      // Get relevant context from knowledge base
      const context = await this.knowledgeBase.getRelevantContext(comment.text);

      // Generate response
      const response = await this.agent.respond(customerMessage, { relevantKnowledge: context });

      // Post response if confidence is high enough
      if (response.shouldRespond && response.confidence >= cfg.CONFIDENCE_THRESHOLD) {
        await this.delay(cfg.RESPONSE_DELAY_MS);

        const postedCommentId = await this.tiktok.replyToComment(
          comment.comment_id,
          response.content
        );

        if (postedCommentId) {
          this.processedComments.add(comment.comment_id);
          this.responseCount++;
          console.log(`[CommentHandler] Replied to comment ${comment.comment_id}`);
        }
      }
    }
  }

  private isRelevantComment(text: string): boolean {
    const cfg = getConfig();
    const lowerText = text.toLowerCase();

    // Check ignored keywords
    for (const keyword of cfg.IGNORED_KEYWORDS) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return false;
      }
    }

    // Skip very short comments (likely spam or reactions)
    if (text.length < 5) {
      return false;
    }

    // Skip obvious spam patterns
    const spamPatterns = [
      /check out my page/i,
      /follow me/i,
      /dm me/i,
      /link in bio/i,
      /buy now/i,
      /click here/i,
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
      throw new Error(`[CommentHandler] Rate limit reached: ${this.responseCount}/${cfg.MAX_RESPONSES_PER_HOUR} responses this hour`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}