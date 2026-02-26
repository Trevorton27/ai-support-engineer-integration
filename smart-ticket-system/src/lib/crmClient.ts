import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';

const CRM_API_BASE_URL = process.env.CRM_API_BASE_URL || 'http://localhost:3000/api';

type CRMResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function crmFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  options?: RequestInit,
): Promise<CRMResult<T>> {
  try {
    const { getToken } = await auth();
    const token = await getToken();

    if (!token) {
      return { ok: false, error: 'Not authenticated' };
    }

    const res = await fetch(`${CRM_API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errorData.error || `CRM API error: ${res.status} ${res.statusText}`,
      };
    }

    const json = await res.json();
    const parsed = schema.safeParse(json.data);

    if (!parsed.success) {
      return { ok: false, error: 'Invalid response from CRM API' };
    }

    return { ok: true, data: parsed.data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// Ticket snapshot type for AI processing
export type TicketSnapshot = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  customerName: string;
  productArea: string;
  messages: Array<{
    authorType: string;
    authorName: string;
    content: string;
  }>;
};

const MessageSchema = z.object({
  id: z.string(),
  authorType: z.string(),
  authorName: z.string(),
  content: z.string(),
  createdAt: z.string(),
  attachments: z.array(z.any()).optional(),
});

const TicketSnapshotSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  priority: z.string(),
  customerName: z.string(),
  productArea: z.string(),
  messages: z.array(MessageSchema),
});

// Transform full ticket data to snapshot
function toTicketSnapshot(ticket: any): TicketSnapshot {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    customerName: ticket.customerName,
    productArea: ticket.productArea,
    messages: ticket.messages.map((m: any) => ({
      authorType: m.authorType,
      authorName: m.authorName,
      content: m.content,
    })),
  };
}

const TicketListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  priority: z.string(),
  customerName: z.string(),
  productArea: z.string(),
  createdAt: z.string(),
});

export type TicketListItem = z.infer<typeof TicketListItemSchema>;

const TicketsResponseSchema = z.object({
  tickets: z.array(TicketListItemSchema),
  total: z.number(),
  hasMore: z.boolean(),
});

// Export functions to call CRM API
export async function getTickets(): Promise<CRMResult<TicketListItem[]>> {
  const result = await crmFetch('/tickets', TicketsResponseSchema);
  if (result.ok) return { ok: true, data: result.data.tickets };
  return result;
}

export async function getTicket(id: string): Promise<CRMResult<TicketSnapshot>> {
  const result = await crmFetch(`/tickets/${id}`, TicketSnapshotSchema);
  if (result.ok) {
    return { ok: true, data: toTicketSnapshot(result.data) };
  }
  return result;
}

export async function addTicketMessage(
  ticketId: string,
  content: string,
): Promise<CRMResult<{ id: string }>> {
  return crmFetch(
    `/tickets/${ticketId}/messages`,
    z.object({ id: z.string() }),
    {
      method: 'POST',
      body: JSON.stringify({ content, authorType: 'AGENT' }),
    },
  );
}
