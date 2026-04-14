import { prisma } from '@/lib/prisma';
import { ok, fail } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('health_check_failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return fail('Service unhealthy', 503, {
      data: { status: 'unhealthy', timestamp: new Date().toISOString() },
    });
  }
}
