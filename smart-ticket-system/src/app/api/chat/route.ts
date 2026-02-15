import { NextRequest, NextResponse } from 'next/server';
import { getTicket } from '@/lib/crmClient';
import { chatAboutTicket } from '@/lib/aiProvider';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { ticketId, message } = await req.json();

    if (!ticketId) {
      return NextResponse.json(
        { ok: false, error: 'ticketId is required' },
        { status: 400 },
      );
    }

    if (!message?.trim()) {
      return NextResponse.json(
        { ok: false, error: 'message is required' },
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

    // Chat with AI
    const response = await chatAboutTicket(ticketResult.data, message);

    // Store conversation
    await prisma.aIConversation.create({
      data: {
        ticketId,
        messages: [
          { role: 'user', content: message },
          { role: 'assistant', content: response.answer },
        ],
      },
    });

    return NextResponse.json({ ok: true, data: response });
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
