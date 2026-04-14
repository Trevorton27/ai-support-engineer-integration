import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateEmbedding } from '@/lib/embeddings';
import { ok, handleRouteError } from '@/lib/apiResponse';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getRateLimitKey, newRequestId } from '@/lib/requestContext';
import { logger } from '@/lib/logger';

const IngestSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  url: z.string().url().optional(),
  productArea: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: 'kb-ingest', requestId });
  try {
    const rlKey = await getRateLimitKey(req);
    enforceRateLimit(`kb-ingest:${rlKey}`, { capacity: 10, refillPerSec: 10 / 60 });

    const body = await req.json();
    const { title, content, url, productArea } = IngestSchema.parse(body);

    const embedding = await generateEmbedding(`${title}\n${content}`);
    const vectorStr = `[${embedding.join(',')}]`;

    const id = `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "KnowledgeBaseArticle" (id, title, content, url, "productArea", embedding, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8)`,
      id,
      title,
      content,
      url ?? null,
      productArea ?? null,
      vectorStr,
      now,
      now,
    );

    log.info('kb_ingested', { id, productArea });
    return ok({ id });
  } catch (err) {
    return handleRouteError(err, 'kb-ingest', { requestId });
  }
}
