/**
 * Backfill script: generate and store vector embeddings for all Ticket rows
 * that don't yet have one (or whose embedding is stale).
 *
 * Usage:
 *   DATABASE_URL=... OPENAI_API_KEY=... pnpm tsx prisma/embed-tickets.ts
 *
 * The script is idempotent — re-running only embeds tickets that are missing
 * an embedding or have been updated since their embedding was generated.
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 10; // embeddings API can handle batches; keep small to avoid timeouts
const EMBEDDING_MODEL = 'text-embedding-3-small';

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

function buildText(title: string, description: string): string {
  return `${title}\n\n${description}`.slice(0, 8000);
}

async function run() {
  // Find tickets that have no embedding, or whose embedding is older than the
  // ticket's last updatedAt (meaning description/title may have changed).
  const tickets = await prisma.$queryRaw<
    Array<{ id: string; title: string; description: string }>
  >`
    SELECT id, title, description
    FROM "Ticket"
    WHERE embedding IS NULL
       OR "embeddingUpdatedAt" < "updatedAt"
    ORDER BY "createdAt" ASC
  `;

  if (tickets.length === 0) {
    console.log('All tickets already have up-to-date embeddings.');
    return;
  }

  console.log(`Embedding ${tickets.length} ticket(s)...`);

  let done = 0;
  for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
    const batch = tickets.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (t) => {
        const text = buildText(t.title, t.description);
        const embedding = await generateEmbedding(text);
        const vectorStr = `[${embedding.join(',')}]`;
        const now = new Date();

        await prisma.$executeRawUnsafe(
          `UPDATE "Ticket"
           SET embedding = $1::vector, "embeddingUpdatedAt" = $2
           WHERE id = $3`,
          vectorStr,
          now,
          t.id,
        );

        done += 1;
        process.stdout.write(`  [${done}/${tickets.length}] ${t.title}\n`);
      }),
    );
  }

  console.log(`\nDone! Embedded ${done} ticket(s).`);
}

run()
  .catch((err) => {
    console.error('Embedding backfill failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
