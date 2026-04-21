import Link from 'next/link';
import { DarkModeToggle } from '@/components/dark-mode-toggle';

export default function UILayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/tickets" className="text-base font-bold text-gray-900 dark:text-white">
            Sample CRM
          </Link>
          <div className="flex items-center gap-2">
            <nav aria-label="Main navigation" className="flex gap-5 text-sm text-gray-600 dark:text-gray-400">
              <Link href="/tickets" className="hover:text-gray-900 dark:hover:text-white">
                Tickets
              </Link>
              <Link href="/tickets/new" className="hover:text-gray-900 dark:hover:text-white">
                + New Ticket
              </Link>
            </nav>
            <DarkModeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
