# AI Support Engineer Integration

A two-app platform that adds an AI Copilot layer on top of a customer support CRM. Support agents can analyze tickets, generate next-step suggestions, draft customer replies, and ask free-form questions — all powered by OpenAI and running asynchronously alongside the existing ticket workflow.

## Apps

| App | Port | Description |
|-----|------|-------------|
| `sample-crm` | 3000 | CRM backend — manages tickets, messages, attachments, and audit events via a REST API. Purely to serve as an example of a typical CRM platform only. The money is in the AI copilot. |
| `smart-ticket-system` | 3001 | AI Copilot — async LLM analysis, suggestions, and draft replies with live status polling. |

Both apps share a single PostgreSQL database and use [Clerk](https://clerk.com) for authentication.

## Features

- **Analyze Ticket** — extracts sentiment, category, urgency, and suggested actions from a ticket thread
- **Suggest Next Steps** — generates 3–5 actionable steps for the support agent
- **Draft Reply** — writes a customer-facing reply in a chosen tone (professional, friendly, or concise)
- **Ask Copilot** — free-form chat about a ticket
- **Async execution** — jobs are queued immediately and processed in the background; the UI polls for status transitions (queued → running → success / error)
- **PII redaction** — emails, API keys, and tokens are stripped from ticket data before being sent to the LLM
- **Audit trail** — every ticket change (status updates, messages, attachments) is logged as an event

---

## Local Setup

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/installation) (used by `smart-ticket-system`)
- A PostgreSQL database (local or hosted — [Neon](https://neon.tech) free tier works)
- A [Clerk](https://clerk.com) application with an organization enabled
- An [OpenAI](https://platform.openai.com) API key

### 1. Clone and install

```bash
git clone https://github.com/Trevorton27/ai-support-engineer-integration.git
cd ai-support-engineer-integration
npm install        # installs concurrently for the root dev script

cd sample-crm
npm install

cd ../smart-ticket-system
pnpm install
```

### 2. Configure environment variables

**`sample-crm/.env`** (copy from `.env.example`):

```bash
cp sample-crm/.env.example sample-crm/.env
```

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE_NAME
```

**`smart-ticket-system/.env`** (copy from `.env.example`):

```bash
cp smart-ticket-system/.env.example smart-ticket-system/.env
```

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...   # same Clerk app as CRM
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE_NAME  # same DB
CRM_API_BASE_URL=http://localhost:3000/api
OPENAI_API_KEY=sk-...
```

> Both apps must point to the **same Clerk application** and the **same database**.

### 3. Run database migrations

Run from either app directory (schema is shared):

```bash
cd smart-ticket-system
npx prisma db push
```

Optionally seed the CRM with demo tickets:

```bash
cd sample-crm
npx tsx prisma/seed.ts
```

### 4. Start the apps

From the repo root, start both apps with a single command:

```bash
npm run dev
```

Or start them individually:

```bash
npm run dev:crm      # sample-crm on http://localhost:3000
npm run dev:tickets  # smart-ticket-system on http://localhost:3001
```

Open [http://localhost:3001](http://localhost:3001) to use the AI Copilot interface.

---

## Project Structure

```
ai-support-engineer-integration/
├── sample-crm/            # CRM REST API (Next.js, Prisma, Clerk)
├── smart-ticket-system/   # AI Copilot app (Next.js, OpenAI, async jobs)
├── ARCHITECTURE.md        # Full architecture reference
└── package.json           # Root dev scripts (concurrently)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed breakdown of every file, API contract, and data flow.
