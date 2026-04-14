import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Smart Ticket System',
  description: 'AI Support Engineer Copilot',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
