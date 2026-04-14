import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getDevContext } from '@/lib/devDb';
import { generateDummyTickets } from '@/lib/ticketActions';

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
  RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
  CLOSED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-gray-500 dark:text-gray-400',
  MEDIUM: 'text-yellow-600 dark:text-yellow-400',
  HIGH: 'text-orange-600 dark:text-orange-400',
  CRITICAL: 'text-red-600 font-semibold dark:text-red-400',
};

type SearchParams = {
  status?: string;
  priority?: string;
  q?: string;
};

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { org } = await getDevContext();
  const filters = await searchParams;

  const where: any = { orgId: org.id };
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: 'insensitive' } },
      { customerName: { contains: filters.q, mode: 'insensitive' } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: { _count: { select: { messages: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ticket.count({ where: { orgId: org.id } }),
  ]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tickets</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {tickets.length} shown · {total} total
          </p>
        </div>
        <div className="flex gap-2">
          <form action={generateDummyTickets.bind(null, 5)}>
            <button
              type="submit"
              className="rounded-md border border-dashed border-gray-400 bg-white px-3 py-1.5 text-sm text-gray-600 hover:border-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-gray-400 dark:hover:bg-gray-800"
            >
              Generate 5 dummy tickets
            </button>
          </form>
          <Link
            href="/tickets/new"
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            + New Ticket
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="mb-5 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search title or customer…"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder-gray-500"
        />
        <select
          name="status"
          defaultValue={filters.status ?? ''}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select
          name="priority"
          defaultValue={filters.priority ?? ''}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <button
          type="submit"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Filter
        </button>
        {(filters.status || filters.priority || filters.q) && (
          <Link
            href="/tickets"
            className="rounded-md px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      {tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-16 text-center dark:border-gray-700">
          <p className="text-gray-400 dark:text-gray-500">No tickets yet.</p>
          <div className="mt-4 flex justify-center gap-3">
            <form action={generateDummyTickets.bind(null, 5)}>
              <button
                type="submit"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Generate dummy tickets
              </button>
            </form>
            <Link
              href="/tickets/new"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              Create first ticket
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Msgs</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-3">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="font-medium text-gray-900 hover:underline dark:text-white"
                    >
                      {ticket.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {ticket.customerName}
                    {ticket.customerOrg && (
                      <span className="ml-1 text-gray-400 dark:text-gray-500">· {ticket.customerOrg}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{ticket.productArea}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${PRIORITY_COLORS[ticket.priority] ?? 'text-gray-500'}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {STATUS_LABELS[ticket.status] ?? ticket.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{ticket._count.messages}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
