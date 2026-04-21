import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Support CRM',
    template: '%s | Support CRM',
  },
  description: 'Customer support ticket management — create, track, and resolve tickets across your organization.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">{children}</body>
    </html>
  );
}
