import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, handleRouteError } from '@/lib/apiResponse';
import { newRequestId } from '@/lib/requestContext';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = newRequestId();
  try {
    const { id } = await params;
    const versions = await prisma.draftVersion.findMany({
      where: { suggestionId: id },
      orderBy: { version: 'desc' },
      select: {
        version: true,
        text: true,
        markedSent: true,
        createdAt: true,
      },
    });
    return ok({ versions });
  } catch (err) {
    return handleRouteError(err, 'draft-versions', { requestId });
  }
}
