import { NextRequest } from 'next/server';
import { getTicket } from '@/lib/crmClient';
import { searchSimilarTickets, buildTicketEmbeddingText } from '@/lib/ticketEmbeddings';
import { SimilarCasesRequestSchema } from '@/lib/schemas';
import { ok, handleRouteError } from '@/lib/apiResponse';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getRateLimitKey, newRequestId } from '@/lib/requestContext';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: 'similar', requestId });
  try {
    const rlKey = await getRateLimitKey(req);
    enforceRateLimit(`similar:${rlKey}`);

    const body = await req.json();
    const { ticketId, productArea, limit } =
      SimilarCasesRequestSchema.parse(body);

    const ticketResult = await getTicket(ticketId);
    if (!ticketResult.ok) {
      throw new Error(ticketResult.error);
    }

    const ticket = ticketResult.data;
    const queryText = buildTicketEmbeddingText(ticket.title, ticket.description);

    const cases = await searchSimilarTickets(queryText, {
      excludeTicketId: ticketId,
      productArea: productArea ?? ticket.productArea,
      limit,
    });

    log.info('similar_searched', {
      ticketId,
      matches: cases.length,
      productArea: ticket.productArea,
    });

    return ok({ cases });
  } catch (err) {
    return handleRouteError(err, 'similar', { requestId });
  }
}
