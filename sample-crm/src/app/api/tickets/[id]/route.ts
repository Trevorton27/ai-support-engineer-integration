import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
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
  const { id } = await params;

  const ticket = await prisma.ticket.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          attachments: {
            select: {
              id: true,
              fileName: true,
              fileUrl: true,
              fileType: true,
              size: true,
            },
          },
        },
      },
      attachments: {
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          fileType: true,
          size: true,
        },
      },
      createdBy: { select: { id: true, email: true, role: true } },
      assignedTo: { select: { id: true, email: true, role: true } },
    },
  });

  if (!ticket) {
    return NextResponse.json(
      { ok: false, error: 'Ticket not found' },
      { status: 404 },
    );
  }

  const data = {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    channel: ticket.channel,
    customerName: ticket.customerName,
    customerOrg: ticket.customerOrg,
    productArea: ticket.productArea,
    orgId: ticket.orgId,
    createdById: ticket.createdById,
    assignedToId: ticket.assignedToId,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    messages: ticket.messages.map((m) => ({
      id: m.id,
      authorType: m.authorType,
      authorName: m.authorName,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      attachments: m.attachments,
    })),
    attachments: ticket.attachments,
    createdBy: ticket.createdBy,
    assignedTo: ticket.assignedTo,
  };

  return NextResponse.json({ ok: true, data });
}
