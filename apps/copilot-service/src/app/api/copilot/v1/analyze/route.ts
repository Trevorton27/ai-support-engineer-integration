import { NextRequest } from 'next/server';
import { getTicket } from '@/lib/crmClient';
import { analyzeTicket } from '@/lib/aiProvider';
import { prisma } from '@/lib/prisma';
import { AnalyzeRequestSchema } from '@/lib/schemas';
import { executeAsyncJob } from '@/lib/asyncExecution';
import { searchKnowledgeBase } from '@/lib/kbRetrieval';
import { ok, handleRouteError } from '@/lib/apiResponse';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getRateLimitKey, newRequestId } from '@/lib/requestContext';
import { logger } from '@/lib/logger';
import { logActivity } from '@/lib/activity';

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: 'analyze', requestId });
  try {
    const rlKey = await getRateLimitKey(req);
    enforceRateLimit(`analyze:${rlKey}`);

    const body = await req.json();
    const { ticketId } = AnalyzeRequestSchema.parse(body);

    const suggestion = await prisma.aISuggestion.create({
      data: {
        ticketId,
        type: 'analysis',
        kind: 'analysis',
        content: {},
        model: 'gpt-4o-mini',
        state: 'queued',
      },
    });

    log.info('analyze_queued', { suggestionId: suggestion.id, ticketId });
    void logActivity(ticketId, 'AI_ANALYZED', { suggestionId: suggestion.id });

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

      const analysis = await analyzeTicket(ticketResult.data);
      return { ...analysis, references };
    });

    return ok({ suggestionId: suggestion.id, state: 'queued' });
  } catch (err) {
    return handleRouteError(err, 'analyze', { requestId });
  }
}
