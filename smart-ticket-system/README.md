# Smart Ticket System

AI Support Engineer Copilot — a Demo CRM ticketing system with a detachable AI Copilot panel. Built with Next.js, Clerk, Prisma, and Tailwind CSS.

## Prerequisites

- **Node.js** >= 18
- **pnpm** (install via `npm install -g pnpm`)
- **PostgreSQL** running locally or remotely

## Setup

1. **Clone and install dependencies:**

```bash
pnpm install
```

2. **Configure environment variables:**

```bash
cp .env.example .env
```

Fill in your values:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (from [Clerk Dashboard](https://dashboard.clerk.com)) |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `DATABASE_URL` | PostgreSQL connection string |
| `COPILOT_API_BASE_URL` | (Optional) AI Copilot API base URL |
| `COPILOT_WEBHOOK_URL` | (Optional) Webhook endpoint for event delivery |

> **Clerk Organizations:** Enable organizations in the Clerk Dashboard under **Settings > Organizations** to use org-scoped features.

3. **Run database migrations:**

```bash
pnpm db:migrate
```

4. **Seed demo data:**

```bash
pnpm db:seed
```

This creates 1 org, 2 users, 8 realistic tickets with message threads, attachments, and outbox events.

## Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture: Detachable Copilot

The CRM works standalone — it never imports AI implementation modules. The only bridge is `src/lib/copilotClient.ts`, an HTTP client that calls an external Copilot API. If `COPILOT_API_BASE_URL` is not set, the Copilot panel shows "unavailable" and the CRM functions normally.

```
CRM Code  -->  copilotClient.ts (HTTP)  -->  External AI Service
                    |
              Zod-validated payloads
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run Vitest unit tests (24 tests) |
| `pnpm playwright` | Run Playwright E2E tests (11 tests) |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed the database |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format with Prettier |

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── tickets/
│   │   │   ├── page.tsx          # Ticket list (filters, search)
│   │   │   ├── new/page.tsx      # Create ticket form
│   │   │   ├── [id]/page.tsx     # Ticket detail + Copilot panel
│   │   │   ├── actions.ts        # Server actions (create, reply, status)
│   │   │   └── [id]/copilot-actions.ts
│   │   └── settings/page.tsx     # Settings + event delivery
│   ├── api/
│   │   ├── upload/route.ts       # File upload API
│   │   └── tickets/events/deliver/route.ts  # Outbox delivery
│   ├── sign-in/, sign-up/        # Clerk auth pages
│   ├── layout.tsx                # Root layout with ClerkProvider
│   └── page.tsx                  # Landing page
├── components/
│   ├── nav.tsx                   # Top navigation
│   ├── ticket-filters.tsx        # Filter bar
│   ├── create-ticket-form.tsx    # Ticket creation form
│   ├── message-thread.tsx        # Message display
│   ├── reply-form.tsx            # Reply + file upload
│   ├── ticket-header.tsx         # Ticket metadata + status
│   ├── copilot-panel.tsx         # AI Copilot panel (detached)
│   ├── deliver-events-button.tsx # Event delivery trigger
│   └── dark-mode-toggle.tsx
├── lib/
│   ├── prisma.ts                 # Prisma client singleton
│   ├── copilotClient.ts          # HTTP bridge to AI (Zod-validated)
│   ├── validation.ts             # Input validation functions
│   └── utils.ts                  # Utility functions
└── middleware.ts                  # Clerk auth middleware
prisma/
├── schema.prisma                  # DB schema (6 models, 6 enums)
└── seed.ts                        # Seed script (8 tickets, threads)
e2e/
└── tickets.spec.ts                # Playwright E2E tests
```

## Data Models

- **Organization** — Clerk org scope
- **User** — Clerk user with role (Admin/Agent/Viewer)
- **Ticket** — Subject, status, priority, channel, customer info, product area
- **TicketMessage** — Thread messages (customer/agent/system)
- **Attachment** — File uploads (.txt, .log, .png, .jpg, .json)
- **TicketEvent** — Outbox pattern for event delivery

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS 4**
- **Clerk** (authentication + organizations)
- **Prisma 6** (ORM) + PostgreSQL
- **Zod 4** (payload validation)
- **Vitest** (unit tests)
- **Playwright** (E2E tests)
- **ESLint 9** + **Prettier**
