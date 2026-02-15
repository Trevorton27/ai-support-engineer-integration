import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateSubject, validateMessage } from '@/lib/validation';

// GET /api/tickets - List tickets with filters
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest();
  if ('error' in auth) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  const { user } = auth;
  const { searchParams } = new URL(request.url);

  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const productArea = searchParams.get('productArea');
  const q = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  const where: any = { orgId: user.orgId };

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (productArea) where.productArea = productArea;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        createdBy: { select: { id: true, email: true } },
        assignedTo: { select: { id: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  const data = tickets.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    channel: t.channel,
    customerName: t.customerName,
    customerOrg: t.customerOrg,
    productArea: t.productArea,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    messageCount: t._count.messages,
    createdBy: t.createdBy,
    assignedTo: t.assignedTo,
  }));

  return NextResponse.json({
    ok: true,
    data: {
      tickets: data,
      total,
      hasMore: offset + tickets.length < total,
    },
  });
}

// POST /api/tickets - Create ticket
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest();
  if ('error' in auth) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  const { user } = auth;
  const body = await request.json();

  const { title, description, priority, channel, customerName, customerOrg, productArea } = body;

  // Validation
  const subjectError = validateSubject(title);
  if (subjectError) {
    return NextResponse.json(
      { ok: false, error: subjectError },
      { status: 400 },
    );
  }

  const messageError = validateMessage(description);
  if (messageError) {
    return NextResponse.json(
      { ok: false, error: messageError },
      { status: 400 },
    );
  }

  if (!customerName?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'Customer name is required' },
      { status: 400 },
    );
  }

  // Create ticket with first message and event
  const ticket = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        priority: priority || 'MEDIUM',
        channel: channel || null,
        customerName: customerName.trim(),
        customerOrg: customerOrg?.trim(),
        productArea: productArea?.trim() || 'General',
        orgId: user.orgId,
        createdById: user.id,
      },
    });

    await tx.ticketMessage.create({
      data: {
        ticketId: t.id,
        authorType: 'CUSTOMER',
        authorName: customerName.trim(),
        content: description.trim(),
      },
    });

    await tx.ticketEvent.create({
      data: {
        ticketId: t.id,
        type: 'TICKET_CREATED',
        payload: {
          title: t.title,
          priority: t.priority,
          status: t.status,
          customerName: t.customerName,
          productArea: t.productArea,
        },
      },
    });

    return t;
  });

  return NextResponse.json({
    ok: true,
    data: {
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt.toISOString(),
    },
  });
}
