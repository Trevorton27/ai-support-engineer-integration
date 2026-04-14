import { NextRequest } from 'next/server';
import { getTicket } from '@/lib/crmClient';
import { chatAboutTicket } from '@/lib/aiProvider';
import { prisma } from '@/lib/prisma';
import { ChatRequestSchema } from '@/lib/schemas';
import { executeAsyncJob } from '@/lib/asyncExecution';
import { appendChatTurn, loadConversation } from '@/lib/chatMemory';
import { ok, handleRouteError } from '@/lib/apiResponse';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getRateLimitKey, newRequestId } from '@/lib/requestContext';
import { logger } from '@/lib/logger';
import { logActivity } from '@/lib/activity';

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: 'chat', requestId });
  try {
    const rlKey = await getRateLimitKey(req);
    enforceRateLimit(`chat:${rlKey}`);

    const body = await req.json();
    const { ticketId, message } = ChatRequestSchema.parse(body);

    const suggestion = await prisma.aISuggestion.create({
      data: {
        ticketId,
        type: 'chat',
        kind: 'chat',
        content: {},
        model: 'gpt-4o-mini',
        state: 'queued',
      },
    });

    log.info('chat_queued', { suggestionId: suggestion.id, ticketId });
    void logActivity(ticketId, 'AI_CHATTED', { suggestionId: suggestion.id });

    executeAsyncJob(suggestion.id, async () => {
      const ticketResult = await getTicket(ticketId);
      if (!ticketResult.ok) {
        throw new Error(ticketResult.error);
      }

      const history = await loadConversation(ticketId);
      const chatResult = await chatAboutTicket(ticketResult.data, message, history);

      await appendChatTurn(ticketId, [
        { role: 'user', content: message },
        { role: 'assistant', content: chatResult.answer },
      ]);

      return chatResult;
    });

    return ok({ suggestionId: suggestion.id, state: 'queued' });
  } catch (err) {
    return handleRouteError(err, 'chat', { requestId });
  }
}
