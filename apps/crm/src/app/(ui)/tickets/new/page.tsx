import Link from 'next/link';
import { createTicket } from '@/lib/ticketActions';

export default function NewTicketPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/tickets" className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
          ← Back to Tickets
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">New Ticket</h1>
      </div>

      <form action={createTicket} className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
        {/* Title */}
        <div>
          <label htmlFor="new-ticket-title" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title <span className="text-red-500" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <input
            id="new-ticket-title"
            name="title"
            required
            maxLength={200}
            placeholder="Short description of the issue"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder-gray-500"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="new-ticket-description" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description <span className="text-red-500" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <textarea
            id="new-ticket-description"
            name="description"
            required
            rows={5}
            placeholder="Detailed description of the issue…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder-gray-500"
          />
        </div>

        {/* Customer */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="new-ticket-customer-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Customer Name <span className="text-red-500" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              id="new-ticket-customer-name"
              name="customerName"
              required
              placeholder="Jane Smith"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder-gray-500"
            />
          </div>
          <div>
            <label htmlFor="new-ticket-customer-org" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Customer Org
            </label>
            <input
              id="new-ticket-customer-org"
              name="customerOrg"
              placeholder="Acme Corp (optional)"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder-gray-500"
            />
          </div>
        </div>

        {/* Product area / Priority / Channel */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="new-ticket-product-area" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Product Area
            </label>
            <input
              id="new-ticket-product-area"
              name="productArea"
              placeholder="e.g. Billing"
              defaultValue="General"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            />
          </div>
          <div>
            <label htmlFor="new-ticket-priority" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Priority
            </label>
            <select
              id="new-ticket-priority"
              name="priority"
              defaultValue="MEDIUM"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div>
            <label htmlFor="new-ticket-channel" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Channel
            </label>
            <select
              id="new-ticket-channel"
              name="channel"
              defaultValue=""
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <option value="">— None —</option>
              <option value="EMAIL">Email</option>
              <option value="CHAT">Chat</option>
              <option value="PHONE">Phone</option>
              <option value="WEB">Web</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/tickets"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-900"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
          >
            Create Ticket
          </button>
        </div>
      </form>
    </div>
  );
}
