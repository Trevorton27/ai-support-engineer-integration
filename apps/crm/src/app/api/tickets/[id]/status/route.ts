import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
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

  const { status } = body;

  if (!status || !['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid status' },
      { status: 400 },
    );
  }

  // Get old ticket for event
  const oldTicket = await prisma.ticket.findFirst({
    where: { id: ticketId, orgId: user.orgId },
  });

  if (!oldTicket) {
    return NextResponse.json(
      { ok: false, error: 'Ticket not found' },
      { status: 404 },
    );
  }

  // Update status and create event
  const ticket = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.update({
      where: { id: ticketId },
      data: { status },
    });

    await tx.ticketEvent.create({
      data: {
        ticketId,
        type: 'STATUS_CHANGED',
        payload: {
          from: oldTicket.status,
          to: status,
        },
      },
    });

    return t;
  });

  return NextResponse.json({
    ok: true,
    data: {
      id: ticket.id,
      status: ticket.status,
      updatedAt: ticket.updatedAt.toISOString(),
    },
  });
}
