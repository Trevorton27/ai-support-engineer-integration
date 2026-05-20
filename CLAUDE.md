# AI Support Engineer — CLAUDE.md

## Overview

An AI-powered support copilot layered on top of a customer support CRM. Two independent Next.js applications in a pnpm monorepo. Support agents analyze tickets, surface similar resolved cases, generate reply drafts, and ask free-form questions — all powered by OpenAI, running asynchronously, with live polling-based status updates.

- `apps/crm` (port 3000) — ticket management REST API + Clerk auth
- `apps/copilot-service` (port 3001) — AI copilot UI + async LLM pipeline

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript |
| Package manager | pnpm 10 workspaces |
| Database | PostgreSQL via Neon, Prisma ORM 6 |
| Vector search | pgvector (HNSW index, cosine similarity, 1536 dimensions) |
| AI | OpenAI `gpt-4o-mini` + `text-embedding-3-small` |
| Auth | Clerk (`@clerk/nextjs` v6) |
| Styling | Tailwind CSS v4 |
| Unit testing | Vitest |
| E2E testing | Playwright (MCP-enabled via `@playwright/test`) |
| Shared types | `packages/shared-types` (Zod schemas) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |
| Deployment | Vercel (two separate projects) |

---

## Repository Structure

```
ai-support-engineer-integration/
├── apps/
│   ├── crm/                        # CRM — ticket REST API (port 3000)
│   │   ├── prisma/                 # schema.prisma, migrations/, seed.ts
│   │   └── src/
│   │       ├── app/api/tickets/    # REST endpoints
│   │       └── lib/                # auth, prisma, validation, utils
│   └── copilot-service/            # AI Copilot (port 3001)
│       ├── prisma/                 # schema.prisma, migrations/, seed/embed scripts
│       ├── e2e/                    # Playwright E2E tests
│       └── src/
│           ├── app/
│           │   ├── (dashboard)/    # Authenticated ticket pages
│           │   ├── test-fixture/panel/  # Dev-only E2E fixture page (public)
│           │   └── api/copilot/v1/ # All AI API routes
│           ├── components/         # CopilotPanel, Nav, DarkModeToggle
│           └── lib/                # aiProvider, asyncExecution, embeddings,
│                                   #   kbRetrieval, ticketEmbeddings, redaction,
│                                   #   schemas, copilotClient, crmClient, etc.
├── packages/
│   └── shared-types/               # Zod schemas shared across apps
├── docs/
│   ├── api-contract.md             # Full Copilot API v1 reference
│   └── user-ux-tests.md            # Manual + automated UX test checklist
├── ARCHITECTURE.md                 # Detailed architecture reference
├── CHANGELOG.md
└── CLAUDE.md                       # This file
```

---

## Development Commands

```bash
# Install all dependencies
pnpm install

# Start both apps concurrently (crm :3000, copilot-service :3001)
pnpm dev

# Start individual apps
pnpm dev:crm
pnpm dev:copilot

# Unit tests (Vitest — copilot-service)
pnpm test

# E2E tests (Playwright — requires copilot-service running on :3001)
pnpm test:e2e

# Type check both apps
pnpm --dir apps/crm exec tsc --noEmit
pnpm --dir apps/copilot-service exec tsc --noEmit

# Database migrations (run from copilot-service; both apps share one DB)
pnpm --dir apps/copilot-service exec prisma migrate dev
pnpm --dir apps/copilot-service exec prisma generate

# Seeding (optional, one-time)
pnpm --dir apps/copilot-service exec tsx prisma/seed.ts
pnpm --dir apps/copilot-service exec tsx prisma/embed-tickets.ts
pnpm --dir apps/copilot-service exec tsx prisma/kb-seed.ts

# Build both apps
pnpm build

# Deploy
pnpm deploy:crm      # Vercel production deploy for CRM
pnpm deploy:copilot  # Vercel production deploy for copilot-service
pnpm deploy:all      # Both
```

---

## Environment Variables

### `apps/crm/.env`

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/dbname
```

### `apps/copilot-service/.env`

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...   # Same Clerk app as CRM
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/dbname  # Same DB as CRM
CRM_API_BASE_URL=http://localhost:3000/api
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_AI_PROVIDER=openai   # Shown in provider badge (optional)
SKIP_ENV_VALIDATION=1            # CI/test escape hatch only
```

> Both apps share the **same Clerk application** and the **same Neon PostgreSQL database**. The `pgvector` extension must be enabled on the database.

---

## Coding Standards

- **TypeScript** — no `any` unless genuinely unavoidable and commented why
- **Zod** — all external data validation: API request bodies, LLM outputs, environment variables
- **Tailwind CSS v4** — no inline `style=` props except for dynamic values Tailwind cannot express
- **No cross-app imports** — `crm` and `copilot-service` never import each other; communication is HTTP only
- New API routes in copilot-service must follow the async job pattern in `asyncExecution.ts`
- New LLM calls go through `aiProvider.ts` and must call `redactTicketSnapshot()` before sending any data to OpenAI
- All Prisma queries in the CRM must be scoped by `orgId: user.orgId` (multi-tenancy)
- Atomic writes (ticket creation, message posting, status changes) use `prisma.$transaction()`

---

## Architecture Rules

1. **Async-first LLM pipeline** — every AI operation creates an `AISuggestion` record (`state: queued`) and returns a job ID immediately. The actual LLM call runs via `setImmediate` in `executeAsyncJob`. Never do synchronous LLM work in a route handler.

2. **PII redaction at the boundary** — `redactTicketSnapshot()` is called in every `aiProvider` function before any payload reaches OpenAI. Patterns redacted: email addresses, bearer tokens, API keys (`sk_`, `pk_`, `api_`, `secret_`, `token_`), GitHub/GitLab tokens.

3. **No cross-app module imports** — copilot-service fetches ticket data via `crmClient.ts` (HTTP), not by importing CRM modules. The CRM never calls the copilot-service.

4. **State machine** — `AISuggestion.state` transitions: `queued → running → success | error`. Never skip states or write `success` without validated content.

5. **pgvector RAG** — both `Ticket` and `KnowledgeBaseArticle` tables carry a `vector(1536)` embedding with an HNSW cosine index. Score threshold is 0.7. Do not lower this threshold without understanding the precision/recall tradeoff.

6. **Multi-tenancy** — every CRM query filters by `orgId`. This is non-negotiable; missing this creates data leakage.

---

## API Conventions

All copilot routes live under `/api/copilot/v1/`.

**Pattern — trigger then poll:**

1. `POST` to a trigger endpoint → returns `{ ok: true, data: { suggestionId, state: "queued" } }` immediately
2. Client polls `GET /api/copilot/v1/status/:id` every 1 second until `state` is `"success"` or `"error"`

**Trigger endpoints:**

| Method | Endpoint | Body |
|---|---|---|
| `POST` | `/analyze` | `{ ticketId }` |
| `POST` | `/suggest` | `{ ticketId }` |
| `POST` | `/draft-reply` | `{ ticketId, type, tone? }` |
| `POST` | `/chat` | `{ ticketId, message }` |
| `POST` | `/similar` | `{ ticketId, productArea? }` |
| `POST` | `/similar/:id/apply` | `{}` |

**Other endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/status/:id` | Poll job state + result |
| `PATCH` | `/update-status` | Update ticket status |
| `POST` | `/feedback` | Rate an AI suggestion |
| `POST` | `/kb/ingest` | Ingest a KB article |
| `GET` | `/activity` | Recent agent activity |
| `GET` | `/health` | Health check |

See `docs/api-contract.md` for full request/response shapes.

---

## Testing Requirements

### Unit tests (Vitest)

Run with `pnpm test`. Located in `apps/copilot-service/src/lib/__tests__/`.

| File | Covers |
|---|---|
| `redaction.test.ts` | Email/token patterns, snapshot redaction |
| `schemas.test.ts` | All LLM response + request Zod schemas |
| `utils.test.ts` | Ticket ID formatting, priority colors, status labels |
| `validation.test.ts` | Subject/message length, file type/size allowlist |
| `env.test.ts` | Zod env parsing, required/optional keys |
| `ticketEmbeddings.test.ts` | Score threshold, productArea filter, excludeId |

### E2E tests (Playwright MCP)

Run with `pnpm test:e2e`. Located in `apps/copilot-service/e2e/`.

- All E2E tests navigate to `/test-fixture/panel` — a dev-only route that renders `CopilotPanel` with hardcoded fixture data, bypassing Clerk auth and the CRM entirely
- `copilot.spec.ts` — async state transitions, API errors, draft generation (all types/tones), save/copy/sent, localStorage persistence, similar cases, demo mode (31 tests)
- `ux-tests.spec.ts` — collapsibles, per-block copy, suggest, chat, status toggle, toasts, keyboard nav

**Use the Playwright MCP tools for all E2E verification:**

```
mcp__playwright__browser_navigate     → navigate to pages
mcp__playwright__browser_snapshot     → inspect DOM / accessibility tree
mcp__playwright__browser_click        → click buttons and links
mcp__playwright__browser_fill_form    → fill form fields
mcp__playwright__browser_wait_for     → wait for async state changes
mcp__playwright__browser_network_requests → inspect API calls
mcp__playwright__browser_take_screenshot  → capture visual state
```

**Fixture page URL (local):** `http://localhost:3001/test-fixture/panel`

**Key `data-testid` attributes on `CopilotPanel`:**
`copilot-panel`, `analyze-button`, `suggest-button`, `demo-button`, `copilot-state`, `result-skeleton`, `analysis-summary`, `copilot-error`, `draft-textarea`, `similar-cases`, `provider-badge`

### Before opening a PR

```bash
pnpm --dir apps/crm exec tsc --noEmit
pnpm --dir apps/copilot-service exec tsc --noEmit
pnpm test
pnpm test:e2e   # copilot-service must be running on :3001
```

---

## Deployment Process

Two separate Vercel projects, deployed independently.

```bash
# CRM
pnpm deploy:crm
# Vercel project: crm | ID: prj_piVl9mfU5k2fIrPOp774iTTWel0d

# Copilot Service
pnpm deploy:copilot
# Vercel project: copilot-service | ID: prj_vanxkAvJcqIN0ToUMVdZTsPFLfbS
```

Both deploy scripts set `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` inline. CI runs typecheck → unit tests → build on every push/PR to `main` but does not auto-deploy. Production deploys are manual via the scripts above.

---

## AI Agent Instructions

When working in this codebase:

1. **Read `ARCHITECTURE.md` first** for any task touching data models, API routes, or the async pipeline.

2. **New AI features** must:
   - Create an `AISuggestion` record with `state: queued` before any async work
   - Use `executeAsyncJob()` from `asyncExecution.ts` — never do inline async LLM work
   - Call `redactTicketSnapshot()` before passing ticket data to any `aiProvider` function
   - Validate LLM output with a Zod schema before writing to the DB

3. **New API routes** must:
   - Follow the trigger-then-poll pattern
   - Validate the request body with a Zod schema at the top of the handler
   - Use `authenticateRequest()` for Clerk JWT verification
   - Return typed responses via the helpers in `apiResponse.ts`
   - Update `docs/api-contract.md`

4. **Database changes** must:
   - Be written as Prisma migrations (`prisma migrate dev`)
   - Scope all CRM queries by `orgId`

5. **Testing new behavior**:
   - Unit tests go in `apps/copilot-service/src/lib/__tests__/`
   - E2E tests go in `apps/copilot-service/e2e/`
   - Use the Playwright MCP tools to verify E2E flows against the running dev server
   - The test-fixture page at `/test-fixture/panel` is the entry point for all E2E tests

6. **Never commit** `.env` files, secrets, or build artifacts.

7. **Do not add ESLint/lint steps** to CI — `next lint` is currently broken by a circular-ref bug in `eslint-config-next` 16.x. Re-enable once upstream resolves it.

---

## Known Pitfalls

- **pgvector must be enabled** before running migrations: `CREATE EXTENSION IF NOT EXISTS vector;`
- **Prisma generate** must run before the app starts; it runs automatically via `postinstall`
- **E2E tests require `:3001` to be running** — `pnpm test:e2e` does not start the dev server
- **`SKIP_ENV_VALIDATION=1`** is required in CI because real secrets are not available; never set this in production
- **`next lint` is broken** in CI due to a circular-ref bug in `eslint-config-next` 16.x — do not attempt to re-enable it without fixing the upstream issue
- **The test-fixture page is dev-only** — it bypasses Clerk middleware by an explicit public route matcher in `middleware.ts`. Do not expose it in production builds
- **Both apps share one database** — migrations run from `copilot-service` apply to the schema used by both apps; always coordinate schema changes
- **Polling is client-side** — the copilot UI uses `setInterval(1000ms)` in `CopilotPanel`. If you add new job kinds, the polling logic must handle the new `AISuggestionKind` values
- **`lightningcss` is a CRM-only dep** — do not add it to copilot-service; Tailwind v4 in copilot-service uses `@tailwindcss/postcss`

---

## Definition of Done

A task is complete when all of the following are true:

- [ ] TypeScript compiles with no errors (`tsc --noEmit`) in both apps
- [ ] All Vitest unit tests pass (`pnpm test`)
- [ ] All Playwright E2E tests pass (`pnpm test:e2e`) against the running dev server
- [ ] New behavior has corresponding unit tests in `src/lib/__tests__/`
- [ ] New E2E scenarios are covered in `e2e/` and verified with the Playwright MCP tools
- [ ] New or changed API routes are documented in `docs/api-contract.md`
- [ ] PII redaction is applied before any ticket data reaches OpenAI
- [ ] No `any` types introduced without justification
- [ ] No secrets, `.env` files, or build artifacts committed
- [ ] `CHANGELOG.md` updated if the change is user-visible
