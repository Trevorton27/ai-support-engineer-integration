import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getDevContext } from '@/lib/devDb';
import { updateTicketStatus, addMessage } from '@/lib/ticketActions';
import { DeleteButton } from './DeleteButton';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const AUTHOR_COLORS: Record<string, string> = {
  CUSTOMER: 'bg-white border border-gray-200',
  AGENT: 'bg-blue-50 border border-blue-200',
  SYSTEM: 'bg-gray-50 border border-gray-100',
};

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org } = await getDevContext();
  const { id } = await params;

  const ticket = await prisma.ticket.findFirst({
    where: { id, orgId: org.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      _count: { select: { messages: true } },
    },
  });

  if (!ticket) notFound();

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/tickets" className="text-sm text-gray-500 hover:text-gray-800">
          ← All Tickets
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left: messages ─────────────────────────────────────────── */}
        <div className="space-y-5 lg:col-span-2">
          {/* Ticket header */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-3 flex flex-wrap gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {ticket.status.replace('_', ' ')}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs ${PRIORITY_COLORS[ticket.priority] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {ticket.priority}
              </span>
              {ticket.channel && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {ticket.channel}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <dt className="text-gray-500">Customer</dt>
                <dd className="font-medium">
                  {ticket.customerName}
                  {ticket.customerOrg && (
                    <span className="ml-1 text-gray-400">· {ticket.customerOrg}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Product Area</dt>
                <dd className="font-medium">{ticket.productArea}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd>{new Date(ticket.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Updated</dt>
                <dd>{new Date(ticket.updatedAt).toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          {/* Messages */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-600">
              Conversation ({ticket._count.messages})
            </h2>
            {ticket.messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg p-4 text-sm ${AUTHOR_COLORS[msg.authorType] ?? 'bg-white border border-gray-200'}`}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="font-medium text-gray-900">{msg.authorName}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                    {msg.authorType}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-gray-800">{msg.content}</p>
              </div>
            ))}
          </div>

          {/* Add message form */}
          <form action={addMessage} className="rounded-lg border border-gray-200 bg-white p-4">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <div className="mb-3 flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Author name
                </label>
                <input
                  name="authorName"
                  defaultValue="Agent"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Author type
                </label>
                <select
                  name="authorType"
                  defaultValue="AGENT"
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  <option value="AGENT">Agent</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="SYSTEM">System</option>
                </select>
              </div>
            </div>
            <textarea
              name="content"
              required
              rows={3}
              placeholder="Write a reply…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
              >
                Add Reply
              </button>
            </div>
          </form>
        </div>

        {/* ── Right: actions sidebar ─────────────────────────────────── */}
        <div className="space-y-4">
          {/* Status */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Status</h3>
            <form>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <div className="flex flex-col gap-2">
                {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
                  <button
                    key={s}
                    formAction={updateTicketStatus.bind(null, ticket.id, s)}
                    type="submit"
                    className={`rounded px-3 py-1.5 text-left text-sm transition-colors ${
                      ticket.status === s
                        ? (STATUS_COLORS[s] ?? 'bg-gray-100 text-gray-700') + ' font-semibold'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {s.replace('_', ' ')}
                    {ticket.status === s && ' ✓'}
                  </button>
                ))}
              </div>
            </form>
          </div>

          {/* Ticket info */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Priority</dt>
                <dd>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${PRIORITY_COLORS[ticket.priority] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {ticket.priority}
                  </span>
                </dd>
              </div>
              {ticket.channel && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Channel</dt>
                  <dd className="text-gray-700">{ticket.channel}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Messages</dt>
                <dd className="text-gray-700">{ticket._count.messages}</dd>
              </div>
            </dl>
          </div>

          {/* Danger zone */}
          <div className="rounded-lg border border-red-100 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-red-600">Danger Zone</h3>
            <DeleteButton ticketId={ticket.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
