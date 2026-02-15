import { NextRequest, NextResponse } from 'next/server';
import { getTicket } from '@/lib/crmClient';
import { suggestNextSteps } from '@/lib/aiProvider';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { ticketId } = await req.json();

    if (!ticketId) {
      return NextResponse.json(
        { ok: false, error: 'ticketId is required' },
        { status: 400 },
      );
    }

    // Fetch ticket from CRM API
    const ticketResult = await getTicket(ticketId);
    if (!ticketResult.ok) {
      return NextResponse.json(
        { ok: false, error: ticketResult.error },
        { status: 400 },
      );
    }

    // Get AI suggestions
    const suggestions = await suggestNextSteps(ticketResult.data);

    // Store suggestion
    await prisma.aISuggestion.create({
      data: {
        ticketId,
        type: 'next_steps',
        content: suggestions,
        model: 'gpt-4o-mini',
      },
    });

    return NextResponse.json({ ok: true, data: suggestions });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
