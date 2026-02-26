import Link from 'next/link';

export default function UILayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/tickets" className="text-base font-bold text-gray-900">
            Sample CRM
          </Link>
          <nav className="flex gap-5 text-sm text-gray-600">
            <Link href="/tickets" className="hover:text-gray-900">
              Tickets
            </Link>
            <Link href="/tickets/new" className="hover:text-gray-900">
              + New Ticket
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
