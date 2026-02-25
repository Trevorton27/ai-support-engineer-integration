# Architecture Overview

This monorepo contains two Next.js applications that work together to form an AI-powered customer support platform.

| App | Port | Role |
|-----|------|------|
| `sample-crm` | 3000 | Source of truth for tickets — REST API + Clerk auth |
| `smart-ticket-system` | 3001 | AI support engineer — Copilot UI + async LLM pipeline |

Both apps share a single PostgreSQL database (Neon). The ticket system calls the CRM's REST API to fetch ticket data; the CRM never calls the ticket system directly.

---

## Repository Layout

```
ai-support-engineer-integration/
├── sample-crm/                  # CRM backend + REST API
└── smart-ticket-system/         # AI Copilot app
```

---

## `sample-crm`

### Purpose
Multi-tenant CRM that manages support tickets for multiple organizations. Exposes a REST API consumed by the smart-ticket-system.

### Directory Structure

```
sample-crm/
├── prisma/
│   ├── schema.prisma            # Data models
│   ├── seed.ts                  # Demo data (8 tickets, 2 users, 1 org)
│   └── migrations/
│       ├── 20260213035210_first/          # Core tables (Org, User, Ticket)
│       └── 20260213042957_add_messages…/  # TicketMessage, Attachment, TicketEvent
└── src/
    ├── middleware.ts             # Clerk JWT protection on all /api/* routes
    ├── app/api/tickets/
    │   ├── route.ts             # GET /api/tickets, POST /api/tickets
    │   └── [id]/
    │       ├── route.ts         # GET /api/tickets/:id
    │       ├── messages/
    │       │   └── route.ts     # POST /api/tickets/:id/messages
    │       ├── status/
    │       │   └── route.ts     # PATCH /api/tickets/:id/status
    │       └── attachments/
    │           └── route.ts     # POST /api/tickets/:id/attachments
    └── lib/
        ├── auth.ts              # authenticateRequest() — Clerk + DB user lookup
        ├── prisma.ts            # Singleton PrismaClient
        ├── validation.ts        # Input validation (subject, message, file type/size)
        └── utils.ts             # Display formatting (TKT-XXXX, priority colors, etc.)
```

### Data Models

```
Organization ─── User (role: ADMIN | AGENT | VIEWER)
     │
     └── Ticket (status, priority, channel, productArea)
              ├── TicketMessage (authorType: CUSTOMER | AGENT | SYSTEM)
              │       └── Attachment (file metadata)
              ├── Attachment (ticket-level files)
              └── TicketEvent (audit log: TICKET_CREATED, STATUS_CHANGED, MESSAGE_ADDED, …)
```

### API Contract

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tickets` | List tickets with filters (`status`, `priority`, `productArea`, `q`, `limit`, `offset`) |
| `POST` | `/api/tickets` | Create ticket (atomically creates Ticket + first TicketMessage + TICKET_CREATED event) |
| `GET` | `/api/tickets/:id` | Full ticket detail with messages, attachments, creator/assignee |
| `POST` | `/api/tickets/:id/messages` | Add message (creates TicketMessage + MESSAGE_ADDED event) |
| `PATCH` | `/api/tickets/:id/status` | Update lifecycle status (creates STATUS_CHANGED event) |
| `POST` | `/api/tickets/:id/attachments` | Upload file (validated type/size, stored in `/public/uploads`) |

### Key Patterns

**Authentication**: Every route calls `authenticateRequest()` — validates Clerk JWT, then looks up the user in the CRM DB. Returns `{ user }` or an error response.

**Multi-tenancy**: All queries are filtered by `orgId: user.orgId` so organizations never see each other's data.

**Atomic transactions**: Ticket creation, message posting, and status changes all use `prisma.$transaction()` so the ticket record and its associated event are always written together.

**Event audit trail**: `TicketEvent` records every change. The `payload` JSON field stores before/after state (e.g., `{ from: "OPEN", to: "IN_PROGRESS" }`). Events also carry webhook delivery metadata (`deliveredAt`, `deliveryAttempts`, `lastError`).

**File uploads**: Files are validated against an allowlist (`.txt .log .png .jpg .json`), capped at 5 MB, given a UUID filename, and written to the filesystem. A SHA-256 checksum is stored for deduplication.

### Environment Variables

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
DATABASE_URL=                        # Shared with smart-ticket-system
AI_WEBHOOK_URL=                      # Optional — notify AI app of CRM events
```

---

## `smart-ticket-system`

### Purpose
AI-powered support engineer interface. Agents use the Copilot panel to analyze tickets, get suggestions, draft replies, and ask questions — all via asynchronous LLM jobs with live status updates.

### Directory Structure

```
smart-ticket-system/
├── prisma/
│   ├── schema.prisma            # CRM models (mirror) + AI models (AISuggestion, AIConversation, AICache)
│   └── migrations/
│       ├── 20260213035210_first/
│       └── 20260213042957_add_messages_attachments_events/
├── e2e/
│   └── copilot.spec.ts          # Playwright E2E tests
├── vitest.config.ts
├── playwright.config.ts
└── src/
    ├── middleware.ts             # Clerk route protection (all except /, /sign-in, /sign-up)
    ├── app/
    │   ├── layout.tsx            # Root layout (ClerkProvider, metadata)
    │   ├── page.tsx              # Landing page — redirects to /tickets if signed in
    │   ├── sign-in/…/page.tsx
    │   ├── sign-up/…/page.tsx
    │   ├── (dashboard)/
    │   │   └── layout.tsx        # Authenticated shell with <Nav />
    │   └── api/
    │       ├── analyze/route.ts          # POST (legacy, synchronous)
    │       ├── suggest/route.ts          # POST (legacy, synchronous)
    │       ├── draft-reply/route.ts      # POST (legacy, synchronous)
    │       ├── chat/route.ts             # POST (legacy, synchronous)
    │       └── copilot/v1/
    │           ├── analyze/route.ts      # POST — queued async analysis
    │           ├── suggest/route.ts      # POST — queued async next steps
    │           ├── draft-reply/route.ts  # POST — queued async draft reply
    │           ├── chat/route.ts         # POST — queued async chat
    │           └── status/[id]/route.ts  # GET  — poll job state + result
    ├── components/
    │   ├── copilot-panel.tsx     # Main AI panel component (polling, state display, results)
    │   ├── nav.tsx               # Navigation bar (links, dark mode toggle, Clerk user button)
    │   └── dark-mode-toggle.tsx  # localStorage + system-preference dark mode
    └── lib/
        ├── aiProvider.ts         # OpenAI GPT-4o-mini calls (4 functions, redaction applied)
        ├── asyncExecution.ts     # setImmediate background job runner
        ├── copilotClient.ts      # Frontend fetch wrapper for /api/copilot/v1/*
        ├── crmClient.ts          # Backend HTTP client for CRM API
        ├── schemas.ts            # Zod schemas for all request/response shapes
        ├── redaction.ts          # PII redaction before LLM calls
        ├── prisma.ts             # Singleton PrismaClient
        ├── utils.ts              # UI formatting helpers
        └── __tests__/
            ├── redaction.test.ts
            ├── schemas.test.ts
            ├── utils.test.ts
            └── validation.test.ts
```

### Data Models (AI-specific additions to shared DB)

```
AISuggestion
├── ticketId        String       — which ticket this belongs to
├── type            String       — backward-compat string ('analysis', 'next_steps', …)
├── kind            AISuggestionKind  — analysis | next_steps | draft_reply | chat
├── state           AISuggestionState — queued | running | success | error
├── content         Json         — validated LLM output stored here on success
├── error           String?      — error message if state = error
├── model           String       — which LLM model was used
├── promptTokens    Int?
├── completionTokens Int?
├── createdAt / updatedAt
└── @@index([ticketId], [createdAt], [state])

AIConversation
├── ticketId
└── messages        Json         — Array<{ role, content }>

AICache
├── key             String @unique  — SHA-256 hash of the prompt
├── value           Json
└── expiresAt       DateTime
```

### Copilot API v1 Contract

All routes live under `/api/copilot/v1/` and follow the same async pattern.

**Trigger endpoints** — immediately return a job ID:

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| `POST` | `/api/copilot/v1/analyze` | `{ ticketId }` | `{ ok, data: { suggestionId, state: "queued" } }` |
| `POST` | `/api/copilot/v1/suggest` | `{ ticketId }` | same shape |
| `POST` | `/api/copilot/v1/draft-reply` | `{ ticketId, tone }` | same shape |
| `POST` | `/api/copilot/v1/chat` | `{ ticketId, message }` | same shape |

**Status endpoint** — poll until `state` is `success` or `error`:

| Method | Endpoint | Response |
|--------|----------|---------|
| `GET` | `/api/copilot/v1/status/:id` | `{ ok, data: { id, state, content, error, kind, updatedAt } }` |

### Async Execution Flow

```
1. POST /api/copilot/v1/analyze { ticketId }
       │
       ├── Zod validates ticketId is a CUID
       ├── prisma.aISuggestion.create({ state: 'queued' })
       └── executeAsyncJob(suggestionId, handler)   ← returns immediately
               │
               │   setImmediate() — deferred, non-blocking
               │
               ├── update state → 'running'
               ├── handler()
               │     ├── crmClient.getTicket(ticketId)   ← calls CRM REST API
               │     ├── redactTicketSnapshot(ticket)     ← strip emails/tokens
               │     ├── OpenAI GPT-4o-mini call
               │     └── AnalysisResultSchema.parse(rawResult)  ← Zod validate
               ├── update state → 'success', content = result
               └── on error → update state → 'error', error = message

2. Client polls every 1s: GET /api/copilot/v1/status/:suggestionId
       └── Returns { state, content } until state ∈ { success, error }
```

### Redaction Pipeline

Before any data is sent to OpenAI, `redactTicketSnapshot()` is called in every `aiProvider` function:

| Pattern | Replacement |
|---------|-------------|
| Email addresses | `[EMAIL_REDACTED]` |
| `sk_`, `pk_`, `api_`, `secret_`, `token_` + 20+ chars | `[TOKEN_REDACTED]` |
| `Bearer <token>` | `[TOKEN_REDACTED]` |
| GitHub tokens (`ghp_*`) | `[TOKEN_REDACTED]` |
| GitLab tokens (`glpat-*`) | `[TOKEN_REDACTED]` |

### Zod Validation Schemas

**Response schemas** (LLM output is validated against these before being stored):

| Schema | Fields |
|--------|--------|
| `AnalysisResultSchema` | `summary` (1–500), `sentiment` (positive\|neutral\|negative), `category`, `urgency?`, `suggestedActions?` (max 5) |
| `NextStepsResultSchema` | `steps[]` (1–5 items, each max 200 chars) |
| `DraftReplyResultSchema` | `reply` (1–2000 chars), `tone?` |
| `ChatResultSchema` | `answer` (1–1000 chars) |

**Request schemas** (validated in route handlers before touching the DB):

| Schema | Fields |
|--------|--------|
| `AnalyzeRequestSchema` | `ticketId` (CUID) |
| `SuggestRequestSchema` | `ticketId` (CUID) |
| `DraftReplyRequestSchema` | `ticketId`, `tone` (default: `professional`) |
| `ChatRequestSchema` | `ticketId`, `message` (1–1000 chars) |

### CopilotPanel Component

The `CopilotPanel` is a client component that implements the full async UX:

```
State:
  currentJob  { suggestionId, state, content?, error? }
  result      any — cached result from last successful job
  resultType  'analysis' | 'steps' | 'draft' | 'chat'

Polling (useEffect):
  when currentJob.state ∈ { queued, running }:
    setInterval(1000ms) → GET /api/copilot/v1/status/:id
    update currentJob; when success → set result

UI elements:
  [Analyze Ticket]     → handleAnalyze() → analyzeTicketAsync()
  [Suggest Next Steps] → handleSuggest() → suggestNextStepsAsync()
  [tone ▾] [Draft Reply] → handleDraftReply() → draftReplyAsync(tone)
  [Ask Copilot…] [Ask]   → handleChat() → chatAsync(message)

State indicator badge:
  queued  → yellow "Queued..."
  running → blue   "Processing..."
  success → green  "Complete"
  error   → red    "Error: <message>"

Result renderers:
  analysis → Summary, Sentiment badge, Category, Urgency, Suggested Actions list
  steps    → Bulleted list
  draft    → Pre-formatted text block
  chat     → Plain text answer
  all      → "Copy JSON" button (navigator.clipboard)

data-testid attributes:
  copilot-panel, analyze-button, copilot-state, analysis-summary, copilot-error
```

### Key Library Files

| File | Role |
|------|------|
| `lib/aiProvider.ts` | Four functions (`analyzeTicket`, `suggestNextSteps`, `draftReply`, `chatAboutTicket`) — each redacts, prompts OpenAI, and validates response |
| `lib/asyncExecution.ts` | `executeAsyncJob(id, fn)` — wraps handler in `setImmediate`, manages state transitions in DB |
| `lib/copilotClient.ts` | Frontend fetch wrapper (`analyzeTicketAsync`, `pollStatus`, etc.) — all return `{ ok, data } \| { ok, error }` |
| `lib/crmClient.ts` | Backend HTTP client for CRM API — uses Clerk Bearer token, 30s timeout, Zod validation |
| `lib/redaction.ts` | `redactSensitiveData(text)` + `redactTicketSnapshot(snapshot)` |
| `lib/schemas.ts` | All Zod request/response schemas |
| `lib/prisma.ts` | Singleton `PrismaClient` with dev HMR guard |
| `lib/utils.ts` | `formatTicketId`, `getPriorityColor`, `getStatusLabel`, `getChannelLabel`, `getProductAreas` |

### Testing

**Unit tests** (`vitest`):

| File | Covers |
|------|--------|
| `__tests__/redaction.test.ts` | Email/token redaction, snapshot redaction, clean text passthrough |
| `__tests__/schemas.test.ts` | Valid/invalid cases for all 4 response schemas + request schemas |
| `__tests__/utils.test.ts` | Ticket ID formatting, priority colors, status labels |
| `__tests__/validation.test.ts` | Subject/message length rules, file type/size allowlist |

**E2E tests** (`playwright`):

| Test | Scenario |
|------|----------|
| `copilot.spec.ts: async transitions` | Mocks analyze + status endpoints; asserts Queued → Processing → Complete, renders result |
| `copilot.spec.ts: API error` | Mocks analyze returning 500; asserts no state indicator |
| `copilot.spec.ts: job error state` | Mocks status returning `state: error`; asserts error badge + message |

**Run commands:**
```bash
# Unit tests
npm test

# E2E tests (requires dev server on :3001)
npm run test:e2e
```

### Environment Variables

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
DATABASE_URL=                         # Shared with sample-crm
OPENAI_API_KEY=
CRM_API_BASE_URL=http://localhost:3000/api
COPILOT_API_BASE_URL=                 # When unset, CopilotPanel shows "unavailable"
```

---

## Inter-App Data Flow

```
Browser (Agent)
    │
    │  1. Load ticket page
    ▼
smart-ticket-system (port 3001)
    │
    │  2. GET /api/copilot/v1/analyze (from CopilotPanel)
    ▼
/api/copilot/v1/analyze route
    ├── Create AISuggestion { state: queued } in shared DB
    └── executeAsyncJob → setImmediate
                │
                │  3. Fetch ticket data
                ▼
         crmClient.getTicket(ticketId)
                │
                │  HTTP GET with Clerk token
                ▼
         sample-crm (port 3000)
         /api/tickets/:id
                │
                │  Returns TicketSnapshot JSON
                ▼
         redactTicketSnapshot()  ← strip PII
                │
                ▼
         OpenAI GPT-4o-mini
                │
                │  Raw JSON response
                ▼
         AnalysisResultSchema.parse()  ← validate
                │
                ▼
         AISuggestion { state: success, content: result }
                │
    │  4. Browser polls every 1s
    ▼
GET /api/copilot/v1/status/:id
    │
    └── Returns { state: success, content: { summary, sentiment, … } }
                │
                ▼
         CopilotPanel renders structured result
```

---

## Development Quick Start

```bash
# Terminal 1 — CRM
cd sample-crm
npm install
npm run dev          # http://localhost:3000

# Terminal 2 — AI Copilot
cd smart-ticket-system
npm install
npm run dev          # http://localhost:3001

# Database
npx prisma db push   # (from either app — shared schema)
```

Both apps must be running simultaneously. The smart-ticket-system calls sample-crm's API at `CRM_API_BASE_URL`.
