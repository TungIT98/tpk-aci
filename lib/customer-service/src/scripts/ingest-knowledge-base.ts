/**
 * Knowledge Base Ingestion Script
 *
 * Load knowledge base entries from a JSON file and ingest into the vector store.
 *
 * Usage:
 *   tsx src/scripts/ingest-knowledge-base.ts [file_path]
 *
 * JSON format:
 * [
 *   {
 *     "id": "unique-id",
 *     "question": "What is your return policy?",
 *     "answer": "We offer 30-day returns...",
 *     "category": "policy"
 *   }
 * ]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createVectorStore } from '../vector-store.js';
import { KnowledgeBase } from '../knowledge-base.js';
import type { KnowledgeEntry } from '../types.js';
import 'dotenv/config';

async function loadEntries(filePath: string): Promise<Array<Omit<KnowledgeEntry, 'embedding'>>> {
  const fullPath = resolve(filePath);
  const content = readFileSync(fullPath, 'utf8');
  const entries = JSON.parse(content);

  if (!Array.isArray(entries)) {
    throw new Error('JSON file must contain an array of entries');
  }

  return entries.map((entry: any, index: number) => {
    if (!entry.question || !entry.answer) {
      throw new Error(`Entry ${index} is missing 'question' or 'answer'`);
    }

    return {
      id: entry.id || `entry-${Date.now()}-${index}`,
      question: entry.question,
      answer: entry.answer,
      category: entry.category || 'faq',
      metadata: entry.metadata,
    };
  });
}

async function main(): Promise<void> {
  const filePath = process.argv[2];

  if (!filePath) {
    console.log('Usage: tsx src/scripts/ingest-knowledge-base.ts <json_file>');
    console.log('\nExample JSON format:');
    console.log(JSON.stringify([
      {
        id: 'my-entry-1',
        question: 'What is your return policy?',
        answer: 'We offer 30-day returns on all items.',
        category: 'policy'
      }
    ], null, 2));
    process.exit(1);
  }

  console.log(`Loading entries from ${filePath}...`);
  const entries = await loadEntries(filePath);
  console.log(`Loaded ${entries.length} entries`);

  console.log('Initializing vector store...');
  const store = await createVectorStore();
  const kb = new KnowledgeBase(store);

  console.log('Ingesting entries...');
  await kb.addEntries(entries);

  console.log(`Successfully ingested ${entries.length} entries`);
}

main().catch(console.error);