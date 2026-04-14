import { NextRequest, NextResponse } from 'next/server';
import { getTicket } from '@/lib/crmClient';
import {
  draftReply,
  draftCustomerReply,
  draftInternalNote,
  draftEscalation,
} from '@/lib/aiProvider';
import { prisma } from '@/lib/prisma';
import {
  DraftReplyRequestSchema,
  DraftGenerateRequestSchema,
  type AnalysisResult,
} from '@/lib/schemas';
import { executeAsyncJob } from '@/lib/asyncExecution';
import type { AISuggestionKind } from '@prisma/client';

type DraftType = 'customer_reply' | 'internal_note' | 'escalation';

const DRAFT_TYPE_TO_KIND: Record<DraftType, AISuggestionKind> = {
  customer_reply: 'draft_customer_reply',
  internal_note: 'draft_internal_note',
  escalation: 'draft_escalation',
};

async function loadLatestAnalysis(ticketId: string): Promise<{
  id: string | null;
  content: AnalysisResult | null;
}> {
  const row = await prisma.aISuggestion.findFirst({
    where: { ticketId, kind: 'analysis', state: 'success' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, content: true },
  });
  if (!row) return { id: null, content: null };
  return {
    id: row.id,
    content: row.content as unknown as AnalysisResult,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Phase 3 path: body includes draftType
    if (body && typeof body === 'object' && 'draftType' in body) {
      const { ticketId, draftType, tone } =
        DraftGenerateRequestSchema.parse(body);

      const kind = DRAFT_TYPE_TO_KIND[draftType];

      const suggestion = await prisma.aISuggestion.create({
        data: {
          ticketId,
          type: kind,
          kind,
          content: {},
          model: 'gpt-4o-mini',
          state: 'queued',
        },
      });

      executeAsyncJob(suggestion.id, async () => {
        const ticketResult = await getTicket(ticketId);
        if (!ticketResult.ok) {
          throw new Error(ticketResult.error);
        }

        const { id: analysisId, content: analysis } =
          await loadLatestAnalysis(ticketId);

        if (draftType === 'customer_reply') {
          return draftCustomerReply(
            ticketResult.data,
            analysis,
            analysisId,
            tone,
          );
        }
        if (draftType === 'internal_note') {
          return draftInternalNote(ticketResult.data, analysis, analysisId);
        }
        return draftEscalation(ticketResult.data, analysis, analysisId);
      });

      return NextResponse.json({
        ok: true,
        data: {
          suggestionId: suggestion.id,
          state: 'queued',
        },
      });
    }

    // Legacy Phase 2 path: tone-only request
    const { ticketId, tone } = DraftReplyRequestSchema.parse(body);

    const suggestion = await prisma.aISuggestion.create({
      data: {
        ticketId,
        type: 'draft_reply',
        kind: 'draft_reply',
        content: {},
        model: 'gpt-4o-mini',
        state: 'queued',
      },
    });

    executeAsyncJob(suggestion.id, async () => {
      const ticketResult = await getTicket(ticketId);
      if (!ticketResult.ok) {
        throw new Error(ticketResult.error);
      }

      const draft = await draftReply(ticketResult.data, tone);
      return draft;
    });

    return NextResponse.json({
      ok: true,
      data: {
        suggestionId: suggestion.id,
        state: 'queued',
      },
    });
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
