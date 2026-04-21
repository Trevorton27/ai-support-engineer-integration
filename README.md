# AI Support Engineer

An AI-powered support copilot that layers on top of a customer support CRM. Support agents analyze tickets, surface similar resolved cases, generate reply drafts, and ask free-form questions — all powered by OpenAI, running asynchronously, with live status updates in the browser.

> **Portfolio project** — demonstrates async LLM pipelines, RAG retrieval with pgvector, PII redaction, accessible UI, and a full test suite (unit + E2E).

---

## Architecture

```mermaid
graph TD
    Browser["Browser (Agent)"]

    subgraph Monorepo
        CRM["apps/crm\n(port 3000)\nNext.js · Prisma · Clerk\nTicket REST API"]
        Copilot["apps/copilot-service\n(port 3001)\nNext.js · OpenAI · pgvector\nAI Copilot UI + async jobs"]
    end

    subgraph Infrastructure
        DB[("PostgreSQL\n(Neon)\nTickets · AISuggestions\nKnowledgeBase · Embeddings")]
        OpenAI["OpenAI\ngpt-4o-mini\ntext-embedding-3-small"]
        Clerk["Clerk\nAuth + JWT"]
    end

    Browser -->|"loads ticket page"| Copilot
    Browser -->|"manages tickets"| CRM
    Copilot -->|"GET /api/tickets/:id"| CRM
    CRM --> DB
    Copilot --> DB
    Copilot -->|"LLM calls"| OpenAI
    CRM -->|"auth"| Clerk
    Copilot -->|"auth"| Clerk
```

**Request flow for AI analysis:**

1. Agent clicks **Analyze Ticket** in the Copilot panel
2. `POST /api/copilot/v1/analyze` creates an `AISuggestion` record (`state: queued`) and returns a job ID immediately
3. `executeAsyncJob` (via `setImmediate`) fetches the ticket from the CRM API, redacts PII, calls OpenAI, and updates the record to `state: success`
4. Browser polls `GET /api/copilot/v1/status/:id` every second until it resolves
5. Panel renders the structured result (signals, hypotheses, questions, next steps)

---

## Features

| Feature | Description |
|---|---|
| **Analyze Ticket** | Extracts signals, hypotheses, clarifying questions, and next steps from a ticket thread |
| **Similar Cases** | Embeds the ticket and cosine-searches resolved tickets; agents can apply a past resolution as a draft |
| **Suggest Next Steps** | Generates 3–5 actionable steps for the support agent |
| **Draft Reply** | Writes a customer-facing reply in a chosen tone (Professional · Friendly · Concise · Surfer) or an internal note / escalation |
| **Ask Copilot** | Free-form chat about a ticket with conversation memory |
| **Knowledge Base** | pgvector RAG pipeline — KB articles are embedded and retrieved alongside analysis results |
| **Async execution** | All LLM jobs are queued immediately; UI polls for state transitions (queued → running → success / error) |
| **PII redaction** | Emails, API keys, and bearer tokens are stripped before any data reaches OpenAI |
| **Demo mode** | One-click animated walkthrough: analyze → draft → edit → save |
| **Audit trail** | Every ticket change is logged as a typed `TicketEvent` |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript |
| Database | PostgreSQL via [Neon](https://neon.tech), Prisma ORM |
| Vector search | pgvector (HNSW index, cosine similarity) |
| AI | OpenAI `gpt-4o-mini` + `text-embedding-3-small` |
| Auth | [Clerk](https://clerk.com) |
| Testing | Vitest (unit), Playwright (E2E) |
| Styling | Tailwind CSS v4 |
| Monorepo | pnpm workspaces |

---

## Local Setup

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/installation) 9+
- A PostgreSQL database — [Neon](https://neon.tech) free tier works; must have the `pgvector` extension enabled
- A [Clerk](https://clerk.com) application (both apps share the same Clerk instance)
- An [OpenAI](https://platform.openai.com) API key

### 1. Clone and install

```bash
git clone https://github.com/Trevorton27/ai-support-engineer-integration.git
cd ai-support-engineer-integration
pnpm install
```

### 2. Configure environment variables

**`apps/crm/.env`** (copy from `.env.example`):

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/dbname
```

**`apps/copilot-service/.env`** (copy from `.env.example`):

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...   # same Clerk app
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/dbname  # same DB
CRM_API_BASE_URL=http://localhost:3000/api
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_AI_PROVIDER=openai   # shown in the provider badge
```

> Both apps share the **same Clerk application** and the **same database**.

### 3. Enable pgvector and run migrations

```bash
# Enable the pgvector extension (run once against your DB):
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Apply Prisma migrations:
pnpm --dir apps/copilot-service exec prisma migrate deploy

# (Optional) Seed the CRM with 12 demo tickets:
pnpm --dir apps/copilot-service exec tsx prisma/seed.ts

# (Optional) Embed seed tickets for Similar Cases retrieval:
pnpm --dir apps/copilot-service exec tsx prisma/embed-tickets.ts

# (Optional) Seed the Knowledge Base with sample articles:
pnpm --dir apps/copilot-service exec tsx prisma/kb-seed.ts
```

### 4. Start both apps

```bash
pnpm dev          # starts crm on :3000 and copilot-service on :3001
```

Or start individually:

```bash
pnpm dev:crm      # http://localhost:3000
pnpm dev:copilot  # http://localhost:3001
```

Open [http://localhost:3001](http://localhost:3001) to use the AI Copilot interface.

---

## Project Structure

```
ai-support-engineer-integration/
├── apps/
│   ├── crm/                   # CRM — ticket management REST API
│   │   ├── prisma/            # Schema + migrations + seed
│   │   └── src/
│   │       ├── app/api/       # REST endpoints (tickets, messages, status, attachments)
│   │       └── lib/           # auth, prisma, validation, utils
│   └── copilot-service/       # AI Copilot — async LLM pipeline + UI
│       ├── prisma/            # Schema + migrations + embed/seed scripts
│       ├── e2e/               # Playwright E2E tests
│       └── src/
│           ├── app/
│           │   ├── (dashboard)/   # Authenticated pages
│           │   └── api/copilot/v1/  # Async AI endpoints
│           ├── components/    # CopilotPanel, Nav, DarkModeToggle
│           └── lib/           # aiProvider, asyncExecution, embeddings,
│                              #   kbRetrieval, ticketEmbeddings, redaction,
│                              #   schemas, copilotClient, crmClient
├── packages/
│   └── shared-types/          # Zod schemas shared across apps
├── docs/
│   ├── api-contract.md        # Full Copilot API v1 reference
│   └── user-ux-tests.md       # Manual + automated UX test checklist
└── ARCHITECTURE.md            # Detailed architecture reference
```

---

## Testing

```bash
# Unit tests (Vitest)
pnpm test

# E2E tests (Playwright — requires copilot-service running on :3001)
pnpm test:e2e

# Type check both apps
pnpm --dir apps/crm exec tsc --noEmit
pnpm --dir apps/copilot-service exec tsc --noEmit
```

The E2E suite uses a `/test-fixture/panel` page that bypasses Clerk auth and renders `CopilotPanel` with hardcoded fixture data, so tests run without a live CRM or auth session.

---

## Key Design Decisions

**Async-first LLM pipeline** — every AI operation returns a job ID immediately and transitions through `queued → running → success / error`. This prevents HTTP timeouts and gives the UI a clean polling-based progress model. The UI polls every second using `setInterval`, stopping when it reaches a terminal state.

**PII redaction at the boundary** — `redactTicketSnapshot()` is called in every `aiProvider` function before the payload leaves the system. Emails, API keys, and bearer tokens are replaced with typed placeholders so they never reach OpenAI.

**pgvector for Similar Cases + KB** — both the `Ticket` and `KnowledgeBaseArticle` tables carry a `vector(1536)` embedding column with an HNSW index. Retrieval is a single cosine-distance query with an optional `productArea` filter and a score threshold (≥ 0.7).

**Native `<details>`/`<summary>` for collapsibles** — keyboard-accessible, zero JS, progressive enhancement. No state management needed.

**Test fixture page** — Playwright's `page.route()` only intercepts browser-side requests; Next.js server components make Node.js HTTP calls that bypass it. The `/test-fixture/panel` dev-only page renders `CopilotPanel` directly with hardcoded data, letting all 31 E2E tests run without a live CRM or database.

---

## API Reference

See [docs/api-contract.md](docs/api-contract.md) for the full Copilot API v1 contract.

### Quick reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/copilot/v1/analyze` | Queue ticket analysis job |
| `POST` | `/api/copilot/v1/suggest` | Queue next-steps suggestion job |
| `POST` | `/api/copilot/v1/draft-reply` | Queue draft reply generation |
| `POST` | `/api/copilot/v1/chat` | Queue free-form chat response |
| `GET` | `/api/copilot/v1/status/:id` | Poll job state and result |
| `POST` | `/api/copilot/v1/similar` | Find similar resolved tickets |
| `POST` | `/api/copilot/v1/similar/:id/apply` | Apply a similar case's resolution as a draft |
| `POST` | `/api/copilot/v1/kb/ingest` | Ingest a Knowledge Base article |

All trigger endpoints return `{ ok: true, data: { suggestionId, state: "queued" } }` immediately. Poll `/status/:id` until `state` is `"success"` or `"error"`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
