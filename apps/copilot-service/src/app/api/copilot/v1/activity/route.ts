import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleRouteError } from '@/lib/apiResponse';
import { newRequestId } from '@/lib/requestContext';

export async function GET(req: NextRequest) {
  const requestId = newRequestId();
  try {
    const ticketId = req.nextUrl.searchParams.get('ticketId');
    if (!ticketId) {
      return fail('Missing ticketId', 400);
    }

    const events = await prisma.ticketEvent.findMany({
      where: {
        ticketId,
        type: {
          in: ['AI_ANALYZED', 'AI_SUGGESTED', 'AI_DRAFTED', 'AI_CHATTED', 'AI_FEEDBACK'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        payload: true,
        createdAt: true,
      },
    });

    return ok({ events });
  } catch (err) {
    return handleRouteError(err, 'activity', { requestId });
  }
}
