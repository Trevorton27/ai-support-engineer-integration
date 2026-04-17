// Re-export TicketSnapshot type from CRM client
export type { TicketSnapshot } from './crmClient';

type CopilotResult<T> = { ok: true; data: T } | { ok: false; error: string };

const COPILOT_API_BASE = '/api/copilot/v1';

async function copilotFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<CopilotResult<T>> {
  try {
    const res = await fetch(`${COPILOT_API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      return { ok: false, error: json.error || 'Request failed' };
    }

    return { ok: true, data: json.data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function pollStatus(suggestionId: string) {
  return copilotFetch(`/status/${suggestionId}`);
}

export async function analyzeTicketAsync(ticketId: string) {
  return copilotFetch('/analyze', {
    method: 'POST',
    body: JSON.stringify({ ticketId }),
  });
}

export async function suggestNextStepsAsync(ticketId: string) {
  return copilotFetch('/suggest', {
    method: 'POST',
    body: JSON.stringify({ ticketId }),
  });
}

export async function draftReplyAsync(
  ticketId: string,
  tone: 'professional' | 'friendly' | 'concise' | 'surfer',
) {
  return copilotFetch('/draft-reply', {
    method: 'POST',
    body: JSON.stringify({ ticketId, tone }),
  });
}

export async function generateDraftAsync(
  ticketId: string,
  draftType: 'customer_reply' | 'internal_note' | 'escalation',
  tone?: 'professional' | 'friendly' | 'concise' | 'surfer',
) {
  return copilotFetch('/draft-reply', {
    method: 'POST',
    body: JSON.stringify({ ticketId, draftType, tone }),
  });
}

export async function saveDraft(
  suggestionId: string,
  text: string,
  markedSent?: boolean,
) {
  return copilotFetch(`/draft-reply/${suggestionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      text,
      ...(markedSent !== undefined && { markedSent }),
    }),
  });
}

export async function updateTicketStatusAsync(
  ticketId: string,
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
) {
  return copilotFetch<{ id: string; status: string; updatedAt: string }>(
    '/update-status',
    {
      method: 'POST',
      body: JSON.stringify({ ticketId, status }),
    },
  );
}

export async function chatAsync(ticketId: string, message: string) {
  return copilotFetch('/chat', {
    method: 'POST',
    body: JSON.stringify({ ticketId, message }),
  });
}

export async function sendFeedback(
  suggestionId: string,
  rating: 'up' | 'down',
  comment?: string,
) {
  return copilotFetch<{ id: string }>('/feedback', {
    method: 'POST',
    body: JSON.stringify({ suggestionId, rating, comment }),
  });
}

export type SimilarCase = {
  id: string;
  title: string;
  productArea: string;
  status: string;
  score: number;
  resolution: string | null;
};

export async function findSimilarCases(
  ticketId: string,
  options?: { productArea?: string; limit?: number },
) {
  return copilotFetch<{ cases: SimilarCase[] }>('/similar', {
    method: 'POST',
    body: JSON.stringify({ ticketId, ...options }),
  });
}

export async function applySimilarCase(
  ticketId: string,
  matchedTicketId: string,
) {
  return copilotFetch<{ suggestionId: string; state: string }>(
    `/similar/${matchedTicketId}/apply`,
    {
      method: 'POST',
      body: JSON.stringify({ ticketId }),
    },
  );
}
