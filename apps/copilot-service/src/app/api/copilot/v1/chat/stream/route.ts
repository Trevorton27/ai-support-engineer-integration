import { NextRequest } from 'next/server';
import { getTicket } from '@/lib/crmClient';
import { chatAboutTicketStream } from '@/lib/aiProvider';
import { ChatRequestSchema } from '@/lib/schemas';
import { appendChatTurn, loadConversation } from '@/lib/chatMemory';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getRateLimitKey, newRequestId } from '@/lib/requestContext';
import { logger } from '@/lib/logger';

// Server-Sent Events response. Emits:
//   event: delta    data: { "text": "..." }
//   event: done     data: { "answer": "..." }
//   event: error    data: { "error": "..." }
export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const log = logger.child({ route: 'chat-stream', requestId });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  let ticketId: string;
  let message: string;
  try {
    const rlKey = await getRateLimitKey(req);
    enforceRateLimit(`chat-stream:${rlKey}`);
    const parsed = ChatRequestSchema.parse(body);
    ticketId = parsed.ticketId;
    message = parsed.message;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid request';
    const status = msg.includes('rate_limit') ? 429 : 400;
    return new Response(msg, { status });
  }

  const encoder = new TextEncoder();
  const send = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    event: string,
    data: unknown,
  ) => {
    controller.enqueue(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
    );
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const ticketResult = await getTicket(ticketId);
        if (!ticketResult.ok) {
          send(controller, 'error', { error: ticketResult.error });
          controller.close();
          return;
        }

        const history = await loadConversation(ticketId);
        const iter = chatAboutTicketStream(ticketResult.data, message, history);

        let full = '';
        while (true) {
          const next = await iter.next();
          if (next.done) {
            full = typeof next.value === 'string' ? next.value : full;
            break;
          }
          full += next.value;
          send(controller, 'delta', { text: next.value });
        }

        await appendChatTurn(ticketId, [
          { role: 'user', content: message },
          { role: 'assistant', content: full },
        ]);

        send(controller, 'done', { answer: full });
        controller.close();
        log.info('chat_stream_done', { ticketId, length: full.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        log.error('chat_stream_error', { ticketId, message: msg });
        send(controller, 'error', { error: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
