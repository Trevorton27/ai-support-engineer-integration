import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getTicket } from '@/lib/crmClient';
import { prisma } from '@/lib/prisma';
import { ApplySimilarCaseRequestSchema } from '@/lib/schemas';
import { executeAsyncJob } from '@/lib/asyncExecution';
import { ok, ApiError, handleRouteError } from '@/lib/apiResponse';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getRateLimitKey, newRequestId } from '@/lib/requestContext';
import { logger } from '@/lib/logger';
import { logActivity } from '@/lib/activity';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = newRequestId();
  const log = logger.child({ route: 'similar/apply', requestId });
  try {
    const rlKey = await getRateLimitKey(req);
    enforceRateLimit(`similar-apply:${rlKey}`);

    const { id: matchedTicketId } = await params;
    const body = await req.json();
    const { ticketId } = ApplySimilarCaseRequestSchema.parse({
      ...body,
      matchedTicketId,
    });

    // Verify the matched ticket exists and has resolution messages
    const matchedTicket = await prisma.ticket.findUnique({
      where: { id: matchedTicketId },
      include: {
        messages: {
          where: { authorType: { in: ['AGENT', 'SYSTEM'] } },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
    });
    if (!matchedTicket) {
      throw new ApiError(404, 'not_found', 'Matched ticket not found');
    }

    const currentTicketResult = await getTicket(ticketId);
    if (!currentTicketResult.ok) {
      throw new Error(currentTicketResult.error);
    }

    const suggestion = await prisma.aISuggestion.create({
      data: {
        ticketId,
        type: 'draft_customer_reply',
        kind: 'draft_customer_reply',
        content: {},
        model: 'gpt-4o-mini',
        state: 'queued',
      },
    });

    log.info('apply_similar_queued', {
      suggestionId: suggestion.id,
      ticketId,
      matchedTicketId,
    });
    void logActivity(ticketId, 'AI_DRAFTED', {
      suggestionId: suggestion.id,
      draftType: 'customer_reply',
      source: 'similar_case',
      matchedTicketId,
    });

    executeAsyncJob(suggestion.id, async () => {
      const currentTicket = currentTicketResult.data;
      const resolutionMessages = matchedTicket.messages
        .map((m) => m.content)
        .join('\n\n');

      const prompt = `You are a senior support engineer writing a customer reply.

A similar past ticket was resolved successfully. Use the resolution below as a pattern to draft a response for the current ticket.

CURRENT TICKET
Title: ${currentTicket.title}
Description: ${currentTicket.description}
Customer: ${currentTicket.customerName}

RESOLUTION FROM SIMILAR CASE (ticket: ${matchedTicket.title})
${resolutionMessages || 'No resolution messages available.'}

Write a professional customer-facing reply for the current ticket, adapting the resolution pattern above. Be empathetic, specific to this customer's situation, and under 2000 characters. Return ONLY the reply text — no JSON, no preamble.`;

      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 600,
      });

      const text =
        response.choices[0]?.message?.content?.trim() ??
        'Unable to generate a reply at this time.';

      return {
        text,
        draftType: 'customer_reply' as const,
        tone: 'professional',
        usedAnalysisId: null,
        markedSent: false,
        sourceSimilarTicketId: matchedTicketId,
      };
    });

    return ok({ suggestionId: suggestion.id, state: 'queued' });
  } catch (err) {
    return handleRouteError(err, 'similar/apply', { requestId });
  }
}
