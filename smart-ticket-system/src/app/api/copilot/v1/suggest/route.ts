import { NextRequest, NextResponse } from 'next/server';
import { getTicket } from '@/lib/crmClient';
import { suggestNextSteps } from '@/lib/aiProvider';
import { prisma } from '@/lib/prisma';
import { SuggestRequestSchema } from '@/lib/schemas';
import { executeAsyncJob } from '@/lib/asyncExecution';

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request
    const body = await req.json();
    const { ticketId } = SuggestRequestSchema.parse(body);

    // Create queued suggestion record
    const suggestion = await prisma.aISuggestion.create({
      data: {
        ticketId,
        type: 'next_steps', // Backward compat
        kind: 'next_steps',
        content: {},
        model: 'gpt-4o-mini',
        state: 'queued',
      },
    });

    // Execute async job
    executeAsyncJob(suggestion.id, async () => {
      // Fetch ticket from CRM API
      const ticketResult = await getTicket(ticketId);
      if (!ticketResult.ok) {
        throw new Error(ticketResult.error);
      }

      // Suggest next steps with AI (includes redaction and validation)
      const steps = await suggestNextSteps(ticketResult.data);

      return steps;
    });

    // Return immediately with suggestion ID
    return NextResponse.json({
      ok: true,
      data: {
        suggestionId: suggestion.id,
        state: 'queued',
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'ZodError') {
      return NextResponse.json(
        { ok: false, error: 'Invalid request data' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
