import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Returns a stable key for rate limiting: Clerk userId if authenticated,
// otherwise the client IP.
export async function getRateLimitKey(req: NextRequest): Promise<string> {
  try {
    const { userId } = await auth();
    if (userId) return `user:${userId}`;
  } catch {
    // fall through to IP
  }
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd?.split(',')[0]?.trim() || 'unknown';
  return `ip:${ip}`;
}

// Short request id for log correlation.
export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}
