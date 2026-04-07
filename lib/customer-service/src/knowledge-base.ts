import type { KnowledgeEntry, VectorSearchResult } from './types.js';
import { createVectorStore, type VectorStore } from './vector-store.js';

// Simple embedding function (cosine similarity with TF-IDF-like approach)
// In production, you'd use OpenAI embeddings or similar
function createEmbedding(text: string, dimension: number = 1536): number[] {
  const words = text.toLowerCase().split(/\s+/);
  const embedding = new Array(dimension).fill(0);

  for (let i = 0; i < words.length; i++) {
    const wordHash = hashString(words[i]);
    const position = wordHash % dimension;
    embedding[position] += 1 / (i + 1); // Weight by position
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export class KnowledgeBase {
  private store: VectorStore;
  private initialized: boolean = false;

  constructor(store: VectorStore) {
    this.store = store;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.store.initialize();
    this.initialized = true;
  }

  async addEntry(entry: Omit<KnowledgeEntry, 'embedding'>): Promise<void> {
    await this.initialize();

    const embedding = createEmbedding(`${entry.question} ${entry.answer}`);
    await this.store.upsert(
      { ...entry, embedding },
      embedding
    );
  }

  async addEntries(entries: Array<Omit<KnowledgeEntry, 'embedding'>>): Promise<void> {
    await this.initialize();

    for (const entry of entries) {
      const embedding = createEmbedding(`${entry.question} ${entry.answer}`);
      await this.store.upsert({ ...entry, embedding }, embedding);
    }
  }

  async search(query: string, topK: number = 5): Promise<VectorSearchResult[]> {
    await this.initialize();

    const queryEmbedding = createEmbedding(query);
    return this.store.search(queryEmbedding, topK);
  }

  async getRelevantContext(query: string, topK: number = 3): Promise<string> {
    const results = await this.search(query, topK);

    if (results.length === 0) {
      return '';
    }

    return results
      .map((r) => `Q: ${r.entry.question}\nA: ${r.entry.answer}`)
      .join('\n\n');
  }

  async deleteEntry(id: string): Promise<void> {
    await this.initialize();
    await this.store.delete(id);
  }
}

// Default knowledge base entries for TKP Content Agency
export const DEFAULT_KB_ENTRIES: Array<Omit<KnowledgeEntry, 'embedding'>> = [
  // FAQ
  {
    id: 'faq-1',
    question: 'How do I get started with your content creation services?',
    answer: 'To get started, simply follow our TikTok account and submit your content request through our automated system. We handle everything from scriptwriting to video production automatically.',
    category: 'faq',
  },
  {
    id: 'faq-2',
    question: 'What types of content do you create?',
    answer: 'We create short-form video content optimized for TikTok, YouTube Shorts, Instagram Reels, and LinkedIn. Our content spans educational, entertainment, and promotional categories.',
    category: 'faq',
  },
  {
    id: 'faq-3',
    question: 'How long does it take to produce a video?',
    answer: 'Our AI-powered pipeline can produce videos in under an hour. The exact timeline depends on complexity and current queue volume.',
    category: 'faq',
  },
  // Policy
  {
    id: 'policy-1',
    question: 'What is your refund policy?',
    answer: 'We offer full refunds within 7 days of delivery if you are not satisfied with the content. Contact our support team to initiate a refund.',
    category: 'policy',
  },
  {
    id: 'policy-2',
    question: 'What are your usage rights for the content?',
    answer: 'You receive full commercial rights to all content produced for you. This includes the right to post, monetize, and modify the content on any platform.',
    category: 'policy',
  },
  // Product
  {
    id: 'product-1',
    question: 'What makes your content different from other agencies?',
    answer: 'We use a fully automated AI pipeline that handles scriptwriting, video generation, and multi-platform publishing. This allows us to produce high-quality content at scale without human bottlenecks.',
    category: 'product',
  },
  {
    id: 'product-2',
    question: 'Do you offer custom content requests?',
    answer: 'Yes, we accept custom content requests. Our AI can adapt to various styles, topics, and brand guidelines. Submit your request and we will generate content tailored to your specifications.',
    category: 'product',
  },
  // Troubleshooting
  {
    id: 'trouble-1',
    question: 'My video did not publish correctly. What should I do?',
    answer: 'First, check your connected platform accounts to ensure they are still linked. If the issue persists, our system will automatically retry publishing. You can also manually trigger a republish from your dashboard.',
    category: 'troubleshooting',
  },
  {
    id: 'trouble-2',
    question: 'How do I connect my TikTok account?',
    answer: 'Go to your account settings and click "Connect Platform". Select TikTok and authorize our app. Your account will be linked within minutes.',
    category: 'troubleshooting',
  },
];