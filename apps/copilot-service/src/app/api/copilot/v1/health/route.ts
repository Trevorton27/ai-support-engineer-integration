import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      data: { status: 'healthy', timestamp: new Date().toISOString() },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        data: { status: 'unhealthy', timestamp: new Date().toISOString() },
      },
      { status: 503 },
    );
  }
}
