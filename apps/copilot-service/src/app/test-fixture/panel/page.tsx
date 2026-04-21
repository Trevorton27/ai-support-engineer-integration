/**
 * Test fixture page — renders CopilotPanel with a hardcoded TicketSnapshot.
 * Only accessible in non-production environments; returns 404 in production.
 * Used exclusively by Playwright E2E tests so they don't need a live CRM or auth session.
 */
import { notFound } from 'next/navigation';
import { CopilotPanel } from '@/components/copilot-panel';
import type { TicketSnapshot } from '@/lib/copilotClient';

const FIXTURE_TICKET: TicketSnapshot = {
  id: 'test-ticket-id',
  title: 'SSO login returns 500 for Chrome users',
  description:
    'Users attempting to log in via SSO on Chrome receive a 500 Internal Server Error. Firefox works fine. Started after the deploy on 2026-04-15.',
  status: 'OPEN',
  priority: 'HIGH',
  customerName: 'Alice Johnson',
  productArea: 'Authentication',
  messages: [
    {
      authorType: 'CUSTOMER',
      authorName: 'Alice Johnson',
      content: 'Getting 500 errors when logging in via SSO on Chrome.',
    },
    {
      authorType: 'AGENT',
      authorName: 'Support Agent',
      content: 'Thanks for reaching out. We are investigating.',
    },
  ],
};

export default function TestFixturePanelPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="mx-auto max-w-sm p-4">
      <CopilotPanel snapshot={FIXTURE_TICKET} />
    </div>
  );
}
