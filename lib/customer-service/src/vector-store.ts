import type { KnowledgeEntry, VectorSearchResult } from './types.js';
import { getConfig } from './config.js';

export interface VectorStore {
  upsert(entry: KnowledgeEntry, embedding: number[]): Promise<void>;
  search(queryEmbedding: number[], topK: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  initialize(): Promise<void>;
}

// Simple in-memory vector store for development/fallback
export class InMemoryVectorStore implements VectorStore {
  private entries: Map<string, { entry: KnowledgeEntry; embedding: number[] }> = new Map();

  async initialize(): Promise<void> {
    console.log('[VectorStore] In-memory store initialized (no Qdrant)');
  }

  async upsert(entry: KnowledgeEntry, embedding: number[]): Promise<void> {
    this.entries.set(entry.id, { entry, embedding });
  }

  async search(queryEmbedding: number[], topK: number): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    for (const [, { entry, embedding }] of this.entries) {
      const score = this.cosineSimilarity(queryEmbedding, embedding);
      results.push({ entry, score });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async delete(id: string): Promise<void> {
    this.entries.delete(id);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

// Qdrant-backed vector store
export class QdrantVectorStore implements VectorStore {
  private collectionName: string;
  private url: string;
  private apiKey?: string;

  constructor() {
    const cfg = getConfig();
    this.url = cfg.QDRANT_URL;
    this.collectionName = cfg.QDRANT_COLLECTION_NAME;
    this.apiKey = cfg.QDRANT_API_KEY;
  }

  async initialize(): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }

    // Create collection if not exists
    const response = await fetch(`${this.url}/collections/${this.collectionName}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      // Collection doesn't exist, create it
      await fetch(`${this.url}/collections/${this.collectionName}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          vectors: {
            size: 1536, // Standard embedding dimension
            distance: 'Cosine',
          },
        }),
      });
    }

    console.log(`[VectorStore] Qdrant collection '${this.collectionName}' ready`);
  }

  async upsert(entry: KnowledgeEntry, embedding: number[]): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['api-key'] = this.apiKey;

    await fetch(`${this.url}/collections/${this.collectionName}/points`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        points: [
          {
            id: entry.id,
            vector: embedding,
            payload: {
              question: entry.question,
              answer: entry.answer,
              category: entry.category,
              metadata: entry.metadata || {},
            },
          },
        ],
      }),
    });
  }

  async search(queryEmbedding: number[], topK: number): Promise<VectorSearchResult[]> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['api-key'] = this.apiKey;

    const response = await fetch(`${this.url}/collections/${this.collectionName}/points/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vector: queryEmbedding,
        limit: topK,
        with_payload: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Qdrant search failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      result: Array<{
        id: string;
        score: number;
        payload: { question: string; answer: string; category: string; metadata?: Record<string, string> };
      }>;
    };

    return data.result.map((r) => ({
      entry: {
        id: r.id,
        question: r.payload.question,
        answer: r.payload.answer,
        category: r.payload.category as KnowledgeEntry['category'],
        metadata: r.payload.metadata,
      },
      score: r.score,
    }));
  }

  async delete(id: string): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['api-key'] = this.apiKey;

    await fetch(`${this.url}/collections/${this.collectionName}/points/${id}`, {
      method: 'DELETE',
      headers,
    });
  }
}

// Factory to create appropriate store
export async function createVectorStore(): Promise<VectorStore> {
  const cfg = getConfig();

  // Try Qdrant first
  try {
    const store = new QdrantVectorStore();
    await store.initialize();
    return store;
  } catch {
    console.warn('[VectorStore] Qdrant unavailable, falling back to in-memory store');
    const store = new InMemoryVectorStore();
    await store.initialize();
    return store;
  }
}