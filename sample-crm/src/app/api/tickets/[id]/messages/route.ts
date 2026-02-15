import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateMessage } from '@/lib/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest();
  if ('error' in auth) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  const { user } = auth;
  const { id: ticketId } = await params;
  const body = await request.json();

  const { content, authorType = 'AGENT' } = body;

  // Validation
  const messageError = validateMessage(content);
  if (messageError) {
    return NextResponse.json(
      { ok: false, error: messageError },
      { status: 400 },
    );
  }

  // Verify ticket exists and user has access
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, orgId: user.orgId },
  });

  if (!ticket) {
    return NextResponse.json(
      { ok: false, error: 'Ticket not found' },
      { status: 404 },
    );
  }

  // Create message and event
  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.ticketMessage.create({
      data: {
        ticketId,
        authorType,
        authorName: user.email,
        content: content.trim(),
      },
    });

    await tx.ticketEvent.create({
      data: {
        ticketId,
        type: 'MESSAGE_ADDED',
        payload: {
          authorType,
          authorName: user.email,
          contentPreview: content.trim().slice(0, 100),
        },
      },
    });

    return msg;
  });

  return NextResponse.json({
    ok: true,
    data: {
      id: message.id,
      ticketId: message.ticketId,
      authorType: message.authorType,
      authorName: message.authorName,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    },
  });
}
