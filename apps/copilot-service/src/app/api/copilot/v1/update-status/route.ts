import { NextRequest } from 'next/server';
import { updateTicketStatus } from '@/lib/crmClient';
import { UpdateStatusRequestSchema } from '@/lib/schemas';
import { ok, fail, handleRouteError } from '@/lib/apiResponse';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getRateLimitKey, newRequestId } from '@/lib/requestContext';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: 'update-status', requestId });
  try {
    const rlKey = await getRateLimitKey(req);
    enforceRateLimit(`update-status:${rlKey}`);

    const body = await req.json();
    const { ticketId, status } = UpdateStatusRequestSchema.parse(body);

    const result = await updateTicketStatus(ticketId, status);
    if (!result.ok) {
      log.warn('update_status_failed', { ticketId, error: result.error });
      return fail(result.error, 500);
    }

    log.info('status_updated', { ticketId, status });
    return ok(result.data);
  } catch (err) {
    return handleRouteError(err, 'update-status', { requestId });
  }
}
