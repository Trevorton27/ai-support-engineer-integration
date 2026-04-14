import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FeedbackRequestSchema } from '@/lib/schemas';
import { ok, fail, handleRouteError } from '@/lib/apiResponse';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getRateLimitKey, newRequestId } from '@/lib/requestContext';
import { logger } from '@/lib/logger';
import { logActivity } from '@/lib/activity';

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: 'feedback', requestId });
  try {
    const rlKey = await getRateLimitKey(req);
    enforceRateLimit(`feedback:${rlKey}`);

    const body = await req.json();
    const { suggestionId, rating, comment } = FeedbackRequestSchema.parse(body);

    const suggestion = await prisma.aISuggestion.findUnique({
      where: { id: suggestionId },
      select: { id: true, ticketId: true },
    });
    if (!suggestion) {
      return fail('Suggestion not found', 404);
    }

    const feedback = await prisma.aIFeedback.create({
      data: { suggestionId, rating, comment: comment ?? null },
    });

    log.info('feedback_recorded', { suggestionId, rating });
    void logActivity(suggestion.ticketId, 'AI_FEEDBACK', {
      suggestionId,
      rating,
    });

    return ok({ id: feedback.id });
  } catch (err) {
    return handleRouteError(err, 'feedback', { requestId });
  }
}

export async function GET(req: NextRequest) {
  const requestId = newRequestId();
  try {
    const suggestionId = req.nextUrl.searchParams.get('suggestionId');
    if (!suggestionId) {
      return fail('Missing suggestionId', 400);
    }
    const items = await prisma.aIFeedback.findMany({
      where: { suggestionId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    });
    return ok({ items });
  } catch (err) {
    return handleRouteError(err, 'feedback-get', { requestId });
  }
}
