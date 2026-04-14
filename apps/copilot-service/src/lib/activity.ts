import { prisma } from './prisma';
import { logger } from './logger';

type AIEventType =
  | 'AI_ANALYZED'
  | 'AI_SUGGESTED'
  | 'AI_DRAFTED'
  | 'AI_CHATTED'
  | 'AI_FEEDBACK';

// Emits a TicketEvent row. Swallows errors so activity logging never
// breaks the primary request path.
export async function logActivity(
  ticketId: string,
  type: AIEventType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await prisma.ticketEvent.create({
      data: {
        ticketId,
        type,
        payload: payload as object,
      },
    });
  } catch (err) {
    logger.warn('activity_log_failed', {
      ticketId,
      type,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
