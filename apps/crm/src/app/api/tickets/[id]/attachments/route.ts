import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateFileType, validateFileSize } from '@/lib/validation';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

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

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const messageId = (formData.get('messageId') as string) || null;

  if (!file) {
    return NextResponse.json(
      { ok: false, error: 'No file provided' },
      { status: 400 },
    );
  }

  if (!validateFileType(file.name)) {
    return NextResponse.json(
      { ok: false, error: 'File type not allowed. Allowed: .txt, .log, .png, .jpg, .json' },
      { status: 400 },
    );
  }

  if (!validateFileSize(file.size)) {
    return NextResponse.json(
      { ok: false, error: 'File too large. Maximum size is 5MB' },
      { status: 400 },
    );
  }

  // Process file
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const checksum = createHash('sha256').update(buffer).digest('hex');
  const ext = file.name.split('.').pop() ?? 'bin';
  const safeName = `${randomUUID()}.${ext}`;

  const uploadsDir = join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(join(uploadsDir, safeName), buffer);

  const fileUrl = `/uploads/${safeName}`;

  // Create attachment and event
  const attachment = await prisma.$transaction(async (tx) => {
    const att = await tx.attachment.create({
      data: {
        ticketId,
        messageId,
        fileName: file.name,
        fileUrl,
        fileType: file.type || `application/${ext}`,
        size: file.size,
        checksum,
      },
    });

    await tx.ticketEvent.create({
      data: {
        ticketId,
        type: 'ATTACHMENT_ADDED',
        payload: {
          attachmentId: att.id,
          fileName: file.name,
          fileType: att.fileType,
          size: file.size,
        },
      },
    });

    return att;
  });

  return NextResponse.json({
    ok: true,
    data: {
      id: attachment.id,
      ticketId: attachment.ticketId,
      messageId: attachment.messageId,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      fileType: attachment.fileType,
      size: attachment.size,
      checksum: attachment.checksum,
      createdAt: attachment.createdAt.toISOString(),
    },
  });
}
