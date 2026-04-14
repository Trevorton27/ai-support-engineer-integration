import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DraftSaveRequestSchema } from '@/lib/schemas';
import { ok, fail, handleRouteError } from '@/lib/apiResponse';
import { enforceRateLimit } from '@/lib/rateLimit';
import { getRateLimitKey, newRequestId } from '@/lib/requestContext';
import { logger } from '@/lib/logger';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = newRequestId();
  const log = logger.child({ route: 'draft-reply-patch', requestId });
  try {
    const rlKey = await getRateLimitKey(req);
    enforceRateLimit(`draft-patch:${rlKey}`);

    const { id } = await params;
    const body = await req.json();
    const parsed = DraftSaveRequestSchema.parse(body);

    const existing = await prisma.aISuggestion.findUnique({ where: { id } });
    if (!existing) {
      return fail('Draft not found', 404);
    }

    const prevContent =
      existing.content && typeof existing.content === 'object'
        ? (existing.content as Record<string, unknown>)
        : {};

    const nextContent: Record<string, unknown> = {
      ...prevContent,
      text: parsed.text,
    };
    if (parsed.markedSent !== undefined) {
      nextContent.markedSent = parsed.markedSent;
    }

    // Record a new version (for history)
    const lastVersion = await prisma.draftVersion.findFirst({
      where: { suggestionId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersionNumber = (lastVersion?.version ?? 0) + 1;

    const [updated] = await prisma.$transaction([
      prisma.aISuggestion.update({
        where: { id },
        data: { content: nextContent as object },
      }),
      prisma.draftVersion.create({
        data: {
          suggestionId: id,
          version: nextVersionNumber,
          text: parsed.text,
          markedSent: parsed.markedSent ?? false,
        },
      }),
    ]);

    log.info('draft_saved', {
      suggestionId: id,
      version: nextVersionNumber,
      markedSent: parsed.markedSent ?? false,
    });

    return ok({
      id: updated.id,
      content: updated.content,
      version: nextVersionNumber,
    });
  } catch (err) {
    return handleRouteError(err, 'draft-reply-patch', { requestId });
  }
}
