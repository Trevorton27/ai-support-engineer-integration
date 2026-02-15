import { NextRequest, NextResponse } from 'next/server';
import { getTicket } from '@/lib/crmClient';
import { draftReply } from '@/lib/aiProvider';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { ticketId, tone = 'professional' } = await req.json();

    if (!ticketId) {
      return NextResponse.json(
        { ok: false, error: 'ticketId is required' },
        { status: 400 },
      );
    }

    if (!['professional', 'friendly', 'concise'].includes(tone)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid tone. Must be professional, friendly, or concise' },
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

    // Draft reply with AI
    const draft = await draftReply(ticketResult.data, tone);

    // Store suggestion
    await prisma.aISuggestion.create({
      data: {
        ticketId,
        type: 'draft_reply',
        content: { ...draft, tone },
        model: 'gpt-4o-mini',
      },
    });

    return NextResponse.json({ ok: true, data: draft });
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
