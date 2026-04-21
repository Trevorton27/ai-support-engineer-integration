# Architecture Overview

This monorepo contains two Next.js applications and a shared types package.

| App | Port | Role |
|-----|------|------|
| `apps/crm` | 3000 | Source of truth for tickets — REST API + Clerk auth |
| `apps/copilot-service` | 3001 | AI support engineer — Copilot UI + async LLM pipeline |

Both apps share a single PostgreSQL database (Neon with pgvector). The copilot service calls the CRM's REST API to fetch ticket data; the CRM never calls the copilot service directly.

---

## Repository Layout

```
ai-support-engineer-integration/
├── apps/
│   ├── crm/                      # CRM backend + REST API
│   └── copilot-service/          # AI Copilot app
├── packages/
│   └── shared-types/             # Zod schemas shared across both apps
├── docs/
│   ├── api-contract.md           # Copilot API v1 full reference
│   └── user-ux-tests.md          # Manual + automated UX test checklist
├── .github/workflows/ci.yml      # CI: typecheck → test → build
├── ARCHITECTURE.md               # This file
├── CHANGELOG.md
├── CONTRIBUTING.md
└── README.md
```

---

## `apps/crm`

### Purpose
Multi-tenant CRM managing support tickets for multiple organizations. Exposes a REST API consumed by the copilot service.

### Directory Structure

```
apps/crm/
├── prisma/
│   ├── schema.prisma             # Org, User, Ticket, TicketMessage, Attachment, TicketEvent
│   ├── seed.ts                   # Demo data
│   └── migrations/
├── next.config.ts                # Cache-Control: no-store on all /api/tickets/* routes
└── src/
    ├── middleware.ts             # Clerk JWT protection on all /api/* routes
    ├── app/
    │   ├── layout.tsx            # Root layout + metadata
    │   ├── page.tsx              # Redirect to /tickets if signed in
    │   ├── (ui)/
    │   │   ├── layout.tsx        # Authenticated shell with Nav
    │   │   └── tickets/
    │   │       ├── page.tsx      # Ticket list (filter, search, pagination)
    │   │       ├── new/page.tsx  # Create ticket form
    │   │       └── [id]/page.tsx # Ticket detail (thread, status, danger zone)
    │   └── api/tickets/
    │       ├── route.ts          # GET /api/tickets, POST /api/tickets
    │       └── [id]/
    │           ├── route.ts      # GET /api/tickets/:id
    │           ├── messages/route.ts     # POST /api/tickets/:id/messages
    │           ├── status/route.ts       # PATCH /api/tickets/:id/status
    │           └── attachments/route.ts  # POST /api/tickets/:id/attachments
    └── lib/
        ├── auth.ts               # authenticateRequest() — Clerk + DB user lookup
        ├── env.ts                # Zod-validated process.env
        ├── prisma.ts             # Singleton PrismaClient
        ├── validation.ts         # Input validation (length, file type/size)
        └── utils.ts              # Display formatting helpers
```

### Data Models

```
Organization ─── User (role: ADMIN | AGENT | VIEWER)
     │
     └── Ticket (status, priority, channel, productArea, embedding)
              ├── TicketMessage (authorType: CUSTOMER | AGENT | SYSTEM)
              │       └── Attachment (file metadata)
              ├── Attachment (ticket-level files)
              └── TicketEvent (audit log: TICKET_CREATED, STATUS_CHANGED, MESSAGE_ADDED, …)
```

### CRM API Contract

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tickets` | List tickets with filters (`status`, `priority`, `productArea`, `q`, `limit`, `offset`) |
| `POST` | `/api/tickets` | Create ticket (atomic: Ticket + first TicketMessage + TICKET_CREATED event) |
| `GET` | `/api/tickets/:id` | Full ticket detail with messages, attachments, creator/assignee |
| `POST` | `/api/tickets/:id/messages` | Add message (creates TicketMessage + MESSAGE_ADDED event) |
| `PATCH` | `/api/tickets/:id/status` | Update lifecycle status (creates STATUS_CHANGED event) |
| `POST` | `/api/tickets/:id/attachments` | Upload file (validated type/size, stored in `/public/uploads`) |

### Key Patterns

**Authentication**: Every route calls `authenticateRequest()` — validates Clerk JWT, then looks up the user in the DB. Returns `{ user }` or an error response.

**Multi-tenancy**: All queries are filtered by `orgId: user.orgId`.

**Atomic transactions**: Ticket creation, message posting, and status changes use `prisma.$transaction()` — the ticket record and its event are always written together.

**Audit trail**: `TicketEvent.payload` stores before/after state (e.g., `{ from: "OPEN", to: "IN_PROGRESS" }`).

**File uploads**: Validated against an allowlist (`.txt .log .png .jpg .json`), capped at 5 MB, given a UUID filename, SHA-256 checksum for deduplication.

---

## `apps/copilot-service`

### Purpose
AI-powered support engineer interface. Agents analyze tickets, find similar past cases, generate reply drafts, and ask free-form questions — via asynchronous LLM jobs with live status updates.

### Directory Structure

```
apps/copilot-service/
├── prisma/
│   ├── schema.prisma             # Mirror of CRM models + AI-specific models
│   ├── seed.ts                   # 12 deterministic tickets (tkt_001–tkt_012)
│   ├── embed-tickets.ts          # Idempotent ticket embedding backfill
│   ├── kb-seed.ts                # 8 sample Knowledge Base articles
│   └── migrations/
├── e2e/
│   ├── copilot.spec.ts           # Core Playwright E2E tests (31 tests)
│   └── ux-tests.spec.ts          # UX automation (collapsibles, copy, chat, status, toasts)
├── next.config.ts                # Cache-Control headers for all API routes
└── src/
    ├── middleware.ts             # Clerk auth; /test-fixture is public for E2E
    ├── instrumentation.ts        # Env validation at startup
    ├── app/
    │   ├── layout.tsx            # Root layout + OpenGraph metadata
    │   ├── page.tsx              # Landing — redirects to /tickets if signed in
    │   ├── sign-in/ sign-up/
    │   ├── test-fixture/panel/   # Dev-only fixture page for Playwright tests
    │   ├── (dashboard)/
    │   │   ├── layout.tsx        # Authenticated shell with Nav
    │   │   └── tickets/[id]/     # Ticket detail page with CopilotPanel
    │   └── api/copilot/v1/
    │       ├── analyze/route.ts
    │       ├── suggest/route.ts
    │       ├── draft-reply/route.ts
    │       ├── chat/route.ts
    │       ├── similar/route.ts
    │       ├── similar/[id]/apply/route.ts
    │       ├── status/[id]/route.ts
    │       ├── update-status/route.ts
    │       ├── feedback/route.ts
    │       ├── kb/ingest/route.ts
    │       ├── activity/route.ts
    │       └── health/route.ts
    ├── components/
    │   ├── copilot-panel.tsx     # Main AI panel (polling, state, results, toasts)
    │   ├── nav.tsx               # Navigation bar with dark mode toggle + Clerk user
    │   └── dark-mode-toggle.tsx  # localStorage + system-preference dark mode
    └── lib/
        ├── aiProvider.ts         # OpenAI calls (analyze, suggest, draft, chat, similar)
        ├── asyncExecution.ts     # setImmediate background job runner
        ├── copilotClient.ts      # Frontend fetch wrapper for /api/copilot/v1/*
        ├── crmClient.ts          # Backend HTTP client for CRM API
        ├── embeddings.ts         # generateEmbedding() via text-embedding-3-small
        ├── kbRetrieval.ts        # searchKnowledgeBase() cosine similarity via pgvector
        ├── ticketEmbeddings.ts   # findSimilarTickets() cosine search on Ticket embeddings
        ├── schemas.ts            # All Zod request/response + KB schemas
        ├── redaction.ts          # PII redaction before LLM calls
        ├── env.ts                # Zod-validated process.env
        ├── prisma.ts             # Singleton PrismaClient
        ├── chatMemory.ts         # AIConversation persistence
        ├── activity.ts           # Agent activity tracking
        ├── rateLimit.ts          # Simple per-IP rate limiter
        ├── logger.ts             # Structured logger
        ├── apiResponse.ts        # Typed JSON response helpers
        ├── requestContext.ts     # Request-scoped context
        ├── utils.ts              # UI formatting helpers
        └── __tests__/
            ├── redaction.test.ts
            ├── schemas.test.ts
            ├── utils.test.ts
            ├── validation.test.ts
            ├── env.test.ts
            └── ticketEmbeddings.test.ts
```

### Data Models (AI-specific additions to shared DB)

```
AISuggestion
├── ticketId        String              — which ticket this belongs to
├── kind            AISuggestionKind    — analysis | next_steps | draft_customer_reply |
│                                         draft_internal_note | draft_escalation |
│                                         chat | similar_cases
├── state           AISuggestionState  — queued | running | success | error
├── content         Json               — validated LLM output on success
├── error           String?            — error message if state = error
├── model           String             — which LLM model was used
├── promptTokens / completionTokens    Int?
└── createdAt / updatedAt

AIConversation
├── ticketId
└── messages   Json   — Array<{ role, content }>

AICache
├── key        String @unique   — SHA-256 hash of the prompt
├── value      Json
└── expiresAt  DateTime

KnowledgeBaseArticle
├── title / content / url? / productArea?
├── embedding  vector(1536)     — HNSW index (cosine)
└── createdAt / updatedAt

Ticket (additions over CRM model)
├── embedding           vector(1536)
└── embeddingUpdatedAt  DateTime?
```

### Copilot API v1 Contract

All routes live under `/api/copilot/v1/`. Trigger endpoints return immediately with a job ID; poll `/status/:id` until terminal.

**Trigger endpoints:**

| Method | Endpoint | Request body | Description |
|--------|----------|--------------|-------------|
| `POST` | `/analyze` | `{ ticketId }` | Queue ticket analysis |
| `POST` | `/suggest` | `{ ticketId }` | Queue next-steps suggestion |
| `POST` | `/draft-reply` | `{ ticketId, type, tone? }` | Queue draft generation |
| `POST` | `/chat` | `{ ticketId, message }` | Queue chat response |
| `POST` | `/similar` | `{ ticketId, productArea? }` | Find similar resolved tickets |
| `POST` | `/similar/:id/apply` | `{}` | Apply a similar case as a draft |

**Polling:**

| Method | Endpoint | Response |
|--------|----------|---------|
| `GET` | `/status/:id` | `{ ok, data: { id, state, content, error, kind, updatedAt } }` |

**Other:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PATCH` | `/update-status` | Update ticket status from CopilotPanel |
| `POST` | `/feedback` | Rate an AI suggestion |
| `POST` | `/kb/ingest` | Ingest a Knowledge Base article |
| `GET` | `/activity` | Recent agent activity |
| `GET` | `/health` | Health check |

All trigger responses: `{ ok: true, data: { suggestionId, state: "queued" } }`

See [docs/api-contract.md](docs/api-contract.md) for full request/response shapes.

### Async Execution Flow

```
1. POST /api/copilot/v1/analyze { ticketId }
       │
       ├── Zod validates ticketId
       ├── prisma.aISuggestion.create({ state: 'queued' })
       └── executeAsyncJob(suggestionId, handler) ← returns immediately
               │
               │  setImmediate() — deferred, non-blocking
               │
               ├── update state → 'running'
               ├── crmClient.getTicket(ticketId)   ← CRM REST API
               ├── redactTicketSnapshot(ticket)     ← strip PII
               ├── searchKnowledgeBase(query)       ← pgvector RAG
               ├── OpenAI gpt-4o-mini
               ├── AnalysisResultSchema.parse(raw)  ← Zod validate
               ├── merge { ...analysis, references }
               └── update state → 'success', content = result

2. Client polls every 1s: GET /api/copilot/v1/status/:suggestionId
       └── Returns { state, content } until state ∈ { success, error }
```

### PII Redaction Pipeline

`redactTicketSnapshot()` is called in every `aiProvider` function before data reaches OpenAI:

| Pattern | Replacement |
|---------|-------------|
| Email addresses | `[EMAIL_REDACTED]` |
| `sk_`, `pk_`, `api_`, `secret_`, `token_` + 20+ chars | `[TOKEN_REDACTED]` |
| `Bearer <token>` | `[TOKEN_REDACTED]` |
| GitHub tokens (`ghp_*`) | `[TOKEN_REDACTED]` |
| GitLab tokens (`glpat-*`) | `[TOKEN_REDACTED]` |

### RAG Pipeline

Two separate vector retrieval flows both use `text-embedding-3-small` (1536 dimensions) with HNSW cosine similarity:

**Similar Cases** (`ticketEmbeddings.ts`):
- Search target: `Ticket` table (`state: RESOLVED | CLOSED` only)
- Score threshold: 0.7
- Returns: `{ id, title, productArea, score, resolutionSnippet }`
- Triggered: on `CopilotPanel` mount + `/v1/similar` endpoint

**Knowledge Base** (`kbRetrieval.ts`):
- Search target: `KnowledgeBaseArticle` table
- Score threshold: 0.7
- Optional `productArea` filter
- Returns: `{ id, title, url?, snippet, score }`
- Triggered: server-side in analyze + suggest routes before LLM call

### Zod Schemas

**LLM output schemas** (validated before DB storage):

| Schema | Key fields |
|--------|-----------|
| `AnalysisResultSchema` | `extractedSignals[]`, `hypotheses[]`, `clarifyingQuestions[]`, `nextSteps[]`, `references[]` |
| `NextStepsResultSchema` | `steps[]` (1–5 items), `references[]` |
| `DraftReplyResultSchema` | `reply` (1–2000 chars), `tone?` |
| `ChatResultSchema` | `answer` (1–1000 chars) |
| `KBReferenceSchema` | `id`, `title`, `url?`, `snippet`, `score` |
| `SimilarCaseSchema` | `id`, `title`, `productArea?`, `score`, `resolutionSnippet?` |

**Request schemas** (validated in route handlers):

| Schema | Key fields |
|--------|-----------|
| `AnalyzeRequestSchema` | `ticketId` (CUID) |
| `DraftReplyRequestSchema` | `ticketId`, `type` (customer_reply \| internal_note \| escalation), `tone?` |
| `ChatRequestSchema` | `ticketId`, `message` (1–1000 chars) |
| `SimilarCasesRequestSchema` | `ticketId`, `productArea?` |

### CopilotPanel Component

`CopilotPanel` is a client component implementing the full async UX:

```
Props: snapshot: TicketSnapshot

State:
  currentJob  { suggestionId, state, content?, error? }
  result      any — last successful result
  resultKind  'analysis' | 'steps' | 'draft' | 'chat'
  toasts      { id, message, type }[]
  draftText   string — editable textarea value
  savedDraft  string — localStorage-persisted draft

Polling (useEffect):
  when currentJob.state ∈ { queued, running }:
    setInterval(1000ms) → GET /api/copilot/v1/status/:id
    on terminal state → set result, stop interval

Sections rendered (in order):
  1. Provider badge + job state indicator
  2. Ticket status toggle (Open / In Progress / Resolved / Closed)
  3. Action buttons: Analyze · Suggest Next Steps · ▶ Run Demo
  4. Draft type select + tone select + Generate Draft button
  5. Result area: analysis (signals, hypotheses, questions, steps) | steps | chat answer
  6. Draft textarea (edit, Save, Copy, Mark as Sent)
  7. Ask Copilot chat input
  8. Similar Cases (loads on mount)
  9. Toast notifications (bottom-right, aria-live)

data-testid attributes:
  copilot-panel, analyze-button, suggest-button, demo-button,
  copilot-state, result-skeleton, analysis-summary, copilot-error,
  draft-textarea, similar-cases, provider-badge
```

### Testing

**Unit tests** (`vitest`, 147 tests):

| File | Covers |
|------|--------|
| `redaction.test.ts` | Email/token patterns, snapshot redaction, clean passthrough |
| `schemas.test.ts` | Valid/invalid for all LLM response + request schemas |
| `utils.test.ts` | Ticket ID formatting, priority colors, status labels |
| `validation.test.ts` | Subject/message length, file type/size allowlist |
| `env.test.ts` | Zod env parsing, required/optional keys, startup failure |
| `ticketEmbeddings.test.ts` | Score threshold, productArea filter, excludeId, null resolution |

**E2E tests** (`playwright`, 31 tests):

| File | Scenarios |
|------|-----------|
| `copilot.spec.ts` | Async state transitions, API errors, job error state, draft generation (all types/tones), save/copy/sent, localStorage persistence, similar cases, demo mode |
| `ux-tests.spec.ts` | Collapsible sections, per-block copy, suggest, mark-as-sent, chat (Enter/button/disabled/copy), status toggle, toast stack/dismiss, provider badge, keyboard nav |

Both test files navigate to `/test-fixture/panel` — a dev-only page that renders `CopilotPanel` with hardcoded fixture data, bypassing Clerk auth and the CRM entirely.

```bash
pnpm test           # Vitest unit tests
pnpm test:e2e       # Playwright E2E (requires :3001 running)
```

---

## Inter-App Data Flow

```
Browser (Agent)
    │
    │  1. Load ticket page
    ▼
apps/copilot-service (port 3001)
    │  (dashboard)/tickets/[id]/page.tsx
    │  → getTicket(id) via crmClient
    │
    │  2. POST /api/copilot/v1/analyze
    ▼
Route handler
    ├── Create AISuggestion { state: queued }
    └── executeAsyncJob → setImmediate (returns immediately)
                │
                │  Background:
                ├── crmClient.getTicket(id)  ──────────▶  apps/crm (port 3000)
                ├── redactTicketSnapshot()                 /api/tickets/:id
                ├── searchKnowledgeBase()  ◀──┐
                │                             │ pgvector
                │                        KnowledgeBaseArticle
                ├── OpenAI gpt-4o-mini
                └── AISuggestion { state: success, content }

    │  3. Browser polls every 1s
    ▼
GET /api/copilot/v1/status/:id
    └── { state: "success", content: { extractedSignals, hypotheses, ... references } }
                │
                ▼
         CopilotPanel renders structured result
```

---

## Environment Variables

### `apps/crm`

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
DATABASE_URL=                        # Shared with copilot-service
```

### `apps/copilot-service`

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=   # Same Clerk app as CRM
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
DATABASE_URL=                        # Same DB as CRM (must have pgvector enabled)
CRM_API_BASE_URL=http://localhost:3000/api
OPENAI_API_KEY=
NEXT_PUBLIC_AI_PROVIDER=openai       # Shown in provider badge (optional)
SKIP_ENV_VALIDATION=1                # CI/test escape hatch (optional)
```

---

## CI/CD

`.github/workflows/ci.yml` runs on every push and PR to `main`:

1. `pnpm install`
2. `tsc --noEmit` (both apps)
3. `vitest run` (copilot-service)
4. `next build` (both apps)
