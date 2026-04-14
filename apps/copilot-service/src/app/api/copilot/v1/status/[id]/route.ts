import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleRouteError } from '@/lib/apiResponse';
import { newRequestId } from '@/lib/requestContext';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = newRequestId();
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
      return fail('Suggestion not found', 404);
    }

    return ok(suggestion);
  } catch (err) {
    return handleRouteError(err, 'status', { requestId });
  }
}
