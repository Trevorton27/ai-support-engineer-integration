import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DraftSaveRequestSchema } from '@/lib/schemas';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = DraftSaveRequestSchema.parse(body);

    const existing = await prisma.aISuggestion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Draft not found' },
        { status: 404 },
      );
    }

    const prevContent =
      existing.content && typeof existing.content === 'object'
        ? (existing.content as Record<string, unknown>)
        : {};

    const nextContent: Record<string, unknown> = {
      ...prevContent,
      text: parsed.text,
    };
    if (parsed.markedSent !== undefined) {
      nextContent.markedSent = parsed.markedSent;
    }

    const updated = await prisma.aISuggestion.update({
      where: { id },
      data: { content: nextContent as object },
    });

    return NextResponse.json({
      ok: true,
      data: { id: updated.id, content: updated.content },
    });
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
