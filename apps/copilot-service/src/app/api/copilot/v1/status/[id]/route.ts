import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const suggestion = await prisma.aISuggestion.findUnique({
      where: { id },
      select: {
        id: true,
        state: true,
        content: true,
        error: true,
        kind: true,
        updatedAt: true,
      },
    });

    if (!suggestion) {
      return NextResponse.json(
        { ok: false, error: 'Suggestion not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: suggestion,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
