import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { generateDummyTickets } from '@/lib/ticketActions';

export async function POST() {
  const auth = await authenticateRequest();
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  await generateDummyTickets(10);

  return NextResponse.json({ ok: true, data: {} });
}
