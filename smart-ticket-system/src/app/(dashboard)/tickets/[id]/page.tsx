import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTicket } from '@/lib/crmClient';
import { CopilotPanel } from '@/components/copilot-panel';

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  URGENT: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export default async function TicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const result = await getTicket(params.id);

  if (!result.ok) {
    notFound();
  }

  const ticket = result.data;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/tickets"
          className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
        >
          ← Back to Tickets
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Ticket info + messages */}
        <div className="space-y-6 lg:col-span-2">
          {/* Header */}
          <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-800">
            <div className="mb-3 flex flex-wrap items-start gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs ${statusColors[ticket.status] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {ticket.status.replace('_', ' ')}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs ${priorityColors[ticket.priority] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {ticket.priority}
              </span>
            </div>

            <h1 className="text-xl font-bold">{ticket.title}</h1>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Customer</dt>
                <dd className="font-medium">{ticket.customerName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Product Area</dt>
                <dd className="font-medium">{ticket.productArea}</dd>
              </div>
            </dl>

            {ticket.description && (
              <div className="mt-4">
                <p className="text-sm text-gray-500">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {ticket.description}
                </p>
              </div>
            )}
          </div>

          {/* Messages thread */}
          {ticket.messages.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Conversation ({ticket.messages.length})
              </h2>
              {ticket.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-4 text-sm ${
                    msg.authorType === 'AGENT'
                      ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
                      : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium">{msg.authorName}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        msg.authorType === 'AGENT'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {msg.authorType}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                    {msg.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Copilot panel */}
        <div>
          <CopilotPanel snapshot={ticket} />
        </div>
      </div>
    </div>
  );
}
