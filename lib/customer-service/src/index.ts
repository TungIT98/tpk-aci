import { validateConfig, getConfig } from './config.js';
import { createVectorStore } from './vector-store.js';
import { KnowledgeBase, DEFAULT_KB_ENTRIES } from './knowledge-base.js';
import { MiniMaxAgent } from './minimax-agent.js';
import { TikTokClient } from './automation/tiktok-api.js';
import { CommentHandler } from './automation/comment-handler.js';
import { DMHandler } from './automation/dm-handler.js';

export interface CustomerServiceOptions {
  watchedVideoIds?: string[];
  pollIntervalMs?: number;
  ingestDefaultKB?: boolean;
}

export class CustomerServiceAutomation {
  private knowledgeBase: KnowledgeBase;
  private agent: MiniMaxAgent;
  private tiktok: TikTokClient;
  private commentHandler: CommentHandler;
  private dmHandler: DMHandler;
  private watchedVideoIds: string[];
  private pollIntervalMs: number;
  private running: boolean = false;
  private pollInterval?: ReturnType<typeof setInterval>;

  constructor(options: CustomerServiceOptions = {}) {
    this.watchedVideoIds = options.watchedVideoIds || [];
    this.pollIntervalMs = options.pollIntervalMs || 60000; // Default 1 minute

    // Initialize components
    this.knowledgeBase = new KnowledgeBase(createVectorStore() as any);
    this.agent = new MiniMaxAgent();
    this.tiktok = new TikTokClient();
    this.commentHandler = new CommentHandler(this.tiktok, this.agent, this.knowledgeBase);
    this.dmHandler = new DMHandler(this.tiktok, this.agent, this.knowledgeBase);
  }

  async initialize(ingestDefaultKB: boolean = true): Promise<void> {
    console.log('[CustomerService] Initializing...');

    // Validate configuration
    validateConfig();

    // Initialize knowledge base
    await this.knowledgeBase.initialize();

    // Ingest default entries
    if (ingestDefaultKB) {
      console.log('[CustomerService] Ingesting default knowledge base entries...');
      await this.knowledgeBase.addEntries(DEFAULT_KB_ENTRIES);
      console.log(`[CustomerService] Ingested ${DEFAULT_KB_ENTRIES.length} default entries`);
    }

    console.log('[CustomerService] Initialization complete');
  }

  async addKnowledgeEntry(entry: Parameters<KnowledgeBase['addEntry']>[0]): Promise<void> {
    await this.knowledgeBase.addEntry(entry);
  }

  async addKnowledgeEntries(entries: Array<Parameters<KnowledgeBase['addEntry']>[0]>): Promise<void> {
    await this.knowledgeBase.addEntries(entries);
  }

  watchVideo(videoId: string): void {
    if (!this.watchedVideoIds.includes(videoId)) {
      this.watchedVideoIds.push(videoId);
      console.log(`[CustomerService] Now watching video ${videoId}`);
    }
  }

  unwatchVideo(videoId: string): void {
    this.watchedVideoIds = this.watchedVideoIds.filter((id) => id !== videoId);
    console.log(`[CustomerService] Stopped watching video ${videoId}`);
  }

  async processOnce(): Promise<void> {
    console.log('[CustomerService] Processing cycle starting...');

    // Process comments for watched videos
    for (const videoId of this.watchedVideoIds) {
      try {
        await this.commentHandler.processVideoComments(videoId);
      } catch (error) {
        console.error(`[CustomerService] Error processing comments for video ${videoId}:`, error);
      }
    }

    // Process DMs
    try {
      await this.dmHandler.processDMs();
    } catch (error) {
      console.error('[CustomerService] Error processing DMs:', error);
    }

    console.log('[CustomerService] Processing cycle complete');
  }

  start(): void {
    if (this.running) {
      console.warn('[CustomerService] Already running');
      return;
    }

    this.running = true;
    console.log(`[CustomerService] Started with poll interval ${this.pollIntervalMs}ms`);

    // Initial processing
    this.processOnce().catch(console.error);

    // Set up polling
    this.pollInterval = setInterval(() => {
      if (this.running) {
        this.processOnce().catch(console.error);
      }
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (!this.running) {
      console.warn('[CustomerService] Not running');
      return;
    }

    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    console.log('[CustomerService] Stopped');
  }

  isRunning(): boolean {
    return this.running;
  }
}

// CLI entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'start': {
      const videoIds = args.slice(1);
      const automation = new CustomerServiceAutomation({
        watchedVideoIds: videoIds,
        pollIntervalMs: 60000,
      });

      await automation.initialize(true);
      automation.start();

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n[CustomerService] Shutting down...');
        automation.stop();
        process.exit(0);
      });
      break;
    }

    case 'process': {
      const videoId = args[1];
      if (!videoId) {
        console.error('Usage: tsx src/index.ts process <video_id>');
        process.exit(1);
      }

      const automation = new CustomerServiceAutomation();
      await automation.initialize(true);
      automation.watchVideo(videoId);
      await automation.processOnce();
      break;
    }

    case 'ingest': {
      const automation = new CustomerServiceAutomation();
      await automation.initialize(false);
      await automation.addKnowledgeEntries(DEFAULT_KB_ENTRIES);
      console.log('Knowledge base ingested successfully');
      break;
    }

    case 'help':
    default:
      console.log(`
Customer Service Automation CLI

Usage:
  tsx src/index.ts start [video_ids...]  Start the automation
  tsx src/index.ts process <video_id>    Process a single video's comments
  tsx src/index.ts ingest                Ingest default knowledge base entries
  tsx src/index.ts help                  Show this help message

Examples:
  tsx src/index.ts start 123456789 987654321
  tsx src/index.ts process 123456789
      `);
      break;
  }
}

main().catch(console.error);

// Export for programmatic use
export { DEFAULT_KB_ENTRIES } from './knowledge-base.js';