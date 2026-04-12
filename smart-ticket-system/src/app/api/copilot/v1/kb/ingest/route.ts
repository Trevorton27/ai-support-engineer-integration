import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateEmbedding } from '@/lib/embeddings';

const IngestSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  url: z.string().url().optional(),
  productArea: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
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

    return NextResponse.json({ ok: true, data: { id } });
  } catch (err) {
    if (err instanceof Error && err.name === 'ZodError') {
      return NextResponse.json(
        { ok: false, error: 'Invalid request data' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
