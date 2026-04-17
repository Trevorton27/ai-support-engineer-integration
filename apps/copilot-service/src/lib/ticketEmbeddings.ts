import { prisma } from './prisma';
import { generateEmbedding } from './embeddings';
import type { SimilarCase } from './schemas';

const MIN_SCORE = 0.65;
const DEFAULT_LIMIT = 5;

/**
 * Build the text we embed for a ticket. Concatenate title + description so the
 * vector captures both the subject and the symptom detail.
 */
export function buildTicketEmbeddingText(
  title: string,
  description: string,
): string {
  return `${title}\n\n${description}`.slice(0, 8000);
}

/**
 * Generate and persist an embedding for a ticket.
 * Uses $executeRawUnsafe because Prisma cannot handle Unsupported("vector") in
 * regular create/update calls.
 */
export async function storeTicketEmbedding(
  ticketId: string,
  title: string,
  description: string,
): Promise<void> {
  const text = buildTicketEmbeddingText(title, description);
  const embedding = await generateEmbedding(text);
  const vectorStr = `[${embedding.join(',')}]`;
  const now = new Date();

  await prisma.$executeRawUnsafe(
    `UPDATE "Ticket"
     SET embedding = $1::vector, "embeddingUpdatedAt" = $2
     WHERE id = $3`,
    vectorStr,
    now,
    ticketId,
  );
}

/**
 * Find tickets semantically similar to a given query text.
 * Filters to tickets that have reached a resolved/closed outcome by default so
 * that the "Apply pattern" feature has real resolutions to draw from.
 */
export async function searchSimilarTickets(
  queryText: string,
  options?: {
    excludeTicketId?: string;
    productArea?: string;
    resolvedOnly?: boolean;
    limit?: number;
  },
): Promise<SimilarCase[]> {
  const embedding = await generateEmbedding(queryText);
  const vectorStr = `[${embedding.join(',')}]`;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const excludeId = options?.excludeTicketId ?? null;
  const productArea = options?.productArea ?? null;
  // Default: only return tickets that have an actual outcome
  const resolvedOnly = options?.resolvedOnly ?? true;

  type Row = {
    id: string;
    title: string;
    productArea: string;
    status: string;
    score: number;
    resolution: string | null;
  };

  const statusFilter = resolvedOnly
    ? `AND t.status IN ('RESOLVED', 'CLOSED')`
    : '';

  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT
       t.id,
       t.title,
       t."productArea",
       t.status::text,
       1 - (t.embedding <=> $1::vector) AS score,
       (
         SELECT m.content
         FROM "TicketMessage" m
         WHERE m."ticketId" = t.id
           AND m."authorType" IN ('AGENT', 'SYSTEM')
         ORDER BY m."createdAt" DESC
         LIMIT 1
       ) AS resolution
     FROM "Ticket" t
     WHERE t.embedding IS NOT NULL
       ${excludeId ? `AND t.id != $2` : `AND ($2::text IS NULL OR FALSE)`}
       AND ($3::text IS NULL OR t."productArea" = $3)
       ${statusFilter}
     ORDER BY t.embedding <=> $1::vector
     LIMIT $4`,
    vectorStr,
    excludeId,
    productArea,
    limit,
  );

  return rows
    .filter((r) => r.score >= MIN_SCORE)
    .map((r) => ({
      id: r.id,
      title: r.title,
      productArea: r.productArea,
      status: r.status as SimilarCase['status'],
      score: r.score,
      resolution: r.resolution ?? null,
    }));
}
