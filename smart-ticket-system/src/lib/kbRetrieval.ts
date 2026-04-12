import { prisma } from './prisma';
import { generateEmbedding } from './embeddings';
import type { KBReference } from './schemas';

const MIN_SCORE = 0.7;
const DEFAULT_LIMIT = 5;

export async function searchKnowledgeBase(
  query: string,
  options?: { productArea?: string; limit?: number },
): Promise<KBReference[]> {
  const embedding = await generateEmbedding(query);
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const productArea = options?.productArea ?? null;

  const vectorStr = `[${embedding.join(',')}]`;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      title: string;
      url: string | null;
      snippet: string;
      score: number;
    }>
  >(
    `SELECT id, title, url,
            LEFT(content, 300) AS snippet,
            1 - (embedding <=> $1::vector) AS score
     FROM "KnowledgeBaseArticle"
     WHERE ($2::text IS NULL OR "productArea" = $2)
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    vectorStr,
    productArea,
    limit,
  );

  return rows.filter((r) => r.score >= MIN_SCORE);
}
