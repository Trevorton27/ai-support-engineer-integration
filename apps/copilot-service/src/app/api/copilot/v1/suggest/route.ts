import { NextRequest } from 'next/server';
import { getTicket } from '@/lib/crmClient';
import { suggestNextSteps } from '@/lib/aiProvider';
import { prisma } from '@/lib/prisma';
import { SuggestRequestSchema } from '@/lib/schemas';
import { executeAsyncJob } from '@/lib/asyncExecution';
import { searchKnowledgeBase } from '@/lib/kbRetrieval';
import { ok, handleRouteError } from '@/lib/apiResponse';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getRateLimitKey, newRequestId } from '@/lib/requestContext';
import { logger } from '@/lib/logger';
import { logActivity } from '@/lib/activity';

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: 'suggest', requestId });
  try {
    const rlKey = await getRateLimitKey(req);
    enforceRateLimit(`suggest:${rlKey}`);

    const body = await req.json();
    const { ticketId } = SuggestRequestSchema.parse(body);

    const suggestion = await prisma.aISuggestion.create({
      data: {
        ticketId,
        type: 'next_steps',
        kind: 'next_steps',
        content: {},
        model: 'gpt-4o-mini',
        state: 'queued',
      },
    });

    log.info('suggest_queued', { suggestionId: suggestion.id, ticketId });
    void logActivity(ticketId, 'AI_SUGGESTED', { suggestionId: suggestion.id });

    executeAsyncJob(suggestion.id, async () => {
      const ticketResult = await getTicket(ticketId);
      if (!ticketResult.ok) {
        throw new Error(ticketResult.error);
      }

      const references = await searchKnowledgeBase(
        `${ticketResult.data.title} ${ticketResult.data.description}`,
        { productArea: ticketResult.data.productArea },
      ).catch((err) => {
        log.warn('kb_search_failed', { error: String(err) });
        return [];
      });

      const steps = await suggestNextSteps(ticketResult.data);
      return { ...steps, references };
    });

    return ok({ suggestionId: suggestion.id, state: 'queued' });
  } catch (err) {
    return handleRouteError(err, 'suggest', { requestId });
  }
}
