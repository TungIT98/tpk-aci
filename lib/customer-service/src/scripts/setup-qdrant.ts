/**
 * Qdrant Setup Script
 *
 * Run this script to set up Qdrant for the customer service automation.
 *
 * Prerequisites:
 *   - Docker must be running
 *   - Port 6333 must be available
 *
 * Usage:
 *   npm run setup-qdrant
 *   or
 *   tsx src/scripts/setup-qdrant.ts
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

const QDRANT_IMAGE = 'qdrant/qdrant:latest';
const QDRANT_PORT = '6333';
const DATA_PATH = './qdrant_data';

async function checkDocker(): Promise<boolean> {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function isQdrantRunning(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${QDRANT_PORT}/collections`);
    return response.ok;
  } catch {
    return false;
  }
}

async function pullImage(): Promise<void> {
  console.log(`Pulling ${QDRANT_IMAGE}...`);
  execSync(`docker pull ${QDRANT_IMAGE}`, { stdio: 'inherit' });
}

async function startQdrant(): Promise<void> {
  console.log(`Starting Qdrant container on port ${QDRANT_PORT}...`);

  // Check if container already exists
  try {
    execSync(`docker ps -a --filter "name=qdrant" --format "{{.Names}}"`, { stdio: 'pipe' });
    const existingContainer = execSync(
      `docker ps -a --filter "name=qdrant" --format "{{.Names}}"`,
      { encoding: 'utf8' }
    ).trim();

    if (existingContainer) {
      console.log(`Removing existing container ${existingContainer}...`);
      execSync(`docker rm -f ${existingContainer}`, { stdio: 'pipe' });
    }
  } catch {
    // No existing container
  }

  execSync(
    `docker run -d \
      --name qdrant \
      -p ${QDRANT_PORT}:6333 \
      -p 6334:6334 \
      -v "${DATA_PATH}:/qdrant/storage" \
      ${QDRANT_IMAGE}`,
    { stdio: 'inherit' }
  );

  console.log('Qdrant container started');
}

async function waitForQdrant(): Promise<void> {
  console.log('Waiting for Qdrant to be ready...');

  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    const isRunning = await isQdrantRunning();
    if (isRunning) {
      console.log('Qdrant is ready!');
      return;
    }

    console.log(`Attempt ${i + 1}/${maxAttempts}...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Qdrant failed to start within timeout');
}

async function createCollection(): Promise<void> {
  console.log('Creating knowledge base collection...');

  const response = await fetch(`http://localhost:${QDRANT_PORT}/collections/tkp-knowledge-base`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vectors: {
        size: 1536,
        distance: 'Cosine',
      },
    }),
  });

  if (response.ok) {
    console.log('Collection created successfully');
  } else {
    const error = await response.text();
    throw new Error(`Failed to create collection: ${error}`);
  }
}

async function main(): Promise<void> {
  console.log('=== Qdrant Setup for TKP Customer Service ===\n');

  // Check Docker
  const dockerAvailable = await checkDocker();
  if (!dockerAvailable) {
    console.error('Docker is not available. Please install Docker first.');
    console.log('\nAlternatively, you can use the in-memory vector store for development:');
    console.log('  The system will automatically fall back to in-memory storage if Qdrant is unavailable.');
    process.exit(1);
  }

  // Check if already running
  if (await isQdrantRunning()) {
    console.log('Qdrant is already running on port', QDRANT_PORT);
    const proceed = process.argv.includes('--force');
    if (!proceed) {
      console.log('Use --force to restart');
      process.exit(0);
    }
  }

  try {
    await pullImage();
    await startQdrant();
    await waitForQdrant();
    await createCollection();

    console.log('\n=== Setup Complete ===');
    console.log(`Qdrant is running at http://localhost:${QDRANT_PORT}`);
    console.log(`Dashboard: http://localhost:${QDRANT_PORT}/dashboard`);
    console.log(`\nAdd to your .env:`);
    console.log(`QDRANT_URL=http://localhost:${QDRANT_PORT}`);
    console.log(`QDRANT_COLLECTION_NAME=tkp-knowledge-base`);
  } catch (error) {
    console.error('\nSetup failed:', error);
    process.exit(1);
  }
}

main();