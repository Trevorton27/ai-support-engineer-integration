import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://localhost:3001';

export const metadata: Metadata = {
  title: {
    default: 'AI Support Engineer',
    template: '%s | AI Support Engineer',
  },
  description:
    'AI-powered support copilot — analyze tickets, surface similar cases, generate reply drafts, and ask free-form questions. Powered by OpenAI with async job execution and pgvector RAG.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: 'website',
    siteName: 'AI Support Engineer',
    title: 'AI Support Engineer',
    description:
      'AI-powered support copilot — analyze tickets, surface similar cases, generate reply drafts, and ask free-form questions.',
    url: APP_URL,
  },
  twitter: {
    card: 'summary',
    title: 'AI Support Engineer',
    description:
      'AI-powered support copilot — analyze tickets, surface similar cases, generate reply drafts, and ask free-form questions.',
  },
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
