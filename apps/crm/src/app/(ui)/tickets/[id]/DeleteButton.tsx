'use client';

import { deleteTicket } from '@/lib/ticketActions';

export function DeleteButton({ ticketId }: { ticketId: string }) {
  return (
    <form
      action={deleteTicket.bind(null, ticketId)}
      onSubmit={(e) => {
        if (!confirm('Delete this ticket permanently? This cannot be undone.')) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="w-full rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      >
        Delete Ticket
      </button>
    </form>
  );
}
