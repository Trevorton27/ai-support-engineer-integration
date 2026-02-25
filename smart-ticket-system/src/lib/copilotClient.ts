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
  tone: 'professional' | 'friendly' | 'concise',
) {
  return copilotFetch('/draft-reply', {
    method: 'POST',
    body: JSON.stringify({ ticketId, tone }),
  });
}

export async function chatAsync(ticketId: string, message: string) {
  return copilotFetch('/chat', {
    method: 'POST',
    body: JSON.stringify({ ticketId, message }),
  });
}
