import { NextRequest, NextResponse } from 'next/server';
import { updateTicketStatus } from '@/lib/crmClient';
import { z } from 'zod';

const UpdateStatusSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticketId, status } = UpdateStatusSchema.parse(body);

    const result = await updateTicketStatus(ticketId, status);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data: result.data });
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
