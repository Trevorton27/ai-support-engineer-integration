# Changelog

All notable changes to this project are documented here, organized by build phase.

---

## Phase E — Presentation Layer (2026-04-21)

- Overhauled root `README.md`: current architecture, Mermaid system diagram, full setup guide, feature table, design decisions
- Added OpenGraph / Twitter meta tags to both app layouts
- Added `LICENSE` (MIT), `CONTRIBUTING.md`, and this `CHANGELOG.md`
- Added `Cache-Control` headers for AI API responses and static assets via `next.config.ts`
- Updated `ARCHITECTURE.md` to reflect current monorepo structure and all features through Phase D

---

## Phase D — Accessibility & Responsiveness (2026-04-21)

- CRM: `<nav>` gains `aria-label`; ticket list table adds `scope="col"` on `<th>`, `aria-label` on `<table>`, `role="search"` on filter form, explicit `id`/`htmlFor` label associations (sr-only), and "Clear filters" rename
- CRM: ticket list table container changed to `overflow-x-auto` for 390px mobile scrolling
- CRM: ticket detail — conversation thread promoted to `<section aria-label>`; timestamps use `<time dateTime>`; reply textarea and author inputs get explicit labels; status form gets `aria-label`, buttons get `aria-pressed`, group gets `role="group"`
- CRM: new ticket form — all labels wired with `htmlFor`/`id` pairs; required stars use `aria-hidden` + sr-only text
- Copilot service: Nav gets `aria-label`, active links get `aria-current="page"`
- CopilotPanel: state badge gets `role="status" aria-live="polite"`; error div gets `role="alert"`; skeleton gets `aria-busy`; toast container gets `aria-live`; all form controls get explicit labels; status buttons get `aria-pressed` + `role="group"`; Apply buttons get contextual `aria-label`
- Added 31 Playwright E2E tests in `e2e/ux-tests.spec.ts` covering: analyze, collapsibles, copy, suggest, mark-as-sent, chat, status, toasts, provider badge, keyboard navigation
- Created `/test-fixture/panel` dev-only page + Clerk public-route exception so E2E tests run without auth or a live CRM

---

## Phase C — Pro Polish + Demo Mode (2026-04-17)

- Loading skeleton with `animate-pulse` during job execution (`data-testid="result-skeleton"`)
- Toast notification queue: 3 s auto-dismiss, fires on save/copy/sent/apply; `aria-live` container
- Collapsible sections on Extracted Signals and Hypotheses using native `<details>`/`<summary>`
- Per-block Copy buttons on all analysis sections, suggest steps, and chat answer
- Provider badge in panel header reads `NEXT_PUBLIC_AI_PROVIDER`; defaults to `openai`
- Demo mode: "▶ Run Demo" button chains analyze → draft reply with toast narration at each step
- E2E test for happy demo path

---

## Phase B — Similar Cases / Support Memory (2026-04-16)

- `POST /v1/similar` — embeds ticket text, cosine-searches resolved tickets, returns top matches with score and resolution snippet
- `POST /v1/similar/:id/apply` — async job derives a customer reply draft from a matched ticket's resolution
- CopilotPanel: "Similar Cases" section with score badge, snippet, Apply button wired to draft polling
- `prisma/embed-tickets.ts` — idempotent backfill script for ticket embeddings
- Schema: `embedding vector(1536)` + `embeddingUpdatedAt` on `Ticket`; `similar_cases` added to `AISuggestionKind`
- Shared Zod types in `packages/shared-types`: `SimilarCaseSchema`, `SimilarCasesResultSchema`, `ApplySimilarCaseRequestSchema`
- 8 unit tests for embedding retrieval (score threshold, productArea filter, exclusion, null resolution)

---

## Phase A — Hardening Foundations (2026-04-15)

- Env var validation at startup via Zod in `src/lib/env.ts` + `src/instrumentation.ts`; `SKIP_ENV_VALIDATION=1` escape hatch
- CI/CD pipeline: `.github/workflows/ci.yml` — pnpm install → typecheck → vitest → build
- Seed script improvements: deterministic IDs (`tkt_001`–`tkt_012`), 12 tickets covering all KB product areas (Auth, Billing, API, Mobile, Dashboard, General) with resolved outcomes

---

## Phase 4 — Knowledge Base + RAG (2026-04-14)

- pgvector extension + `KnowledgeBaseArticle` model with HNSW index
- `src/lib/embeddings.ts` — `generateEmbedding()` via `text-embedding-3-small`
- `src/lib/kbRetrieval.ts` — `searchKnowledgeBase()` with cosine similarity, score threshold, productArea filter
- `KBReferenceSchema` in `schemas.ts`; `references` field appended to analysis and suggest responses
- `POST /v1/kb/ingest` route for ingesting articles
- `prisma/kb-seed.ts` — 8 sample KB articles
- "References" section in CopilotPanel
- Unit tests for `KBReferenceSchema` and `kbRetrieval`

---

## Phase 3 — Draft Generation (2026-04-13)

- `POST /v1/draft-reply` async endpoint with `tone` parameter (professional · friendly · concise · surfer)
- Internal note and escalation draft types (tone selector hidden for non-customer types)
- Draft textarea with edit, Save (persists to `localStorage`), Copy, and Mark as Sent
- "Draft saved ✓" / "Copied to clipboard" / "Sent ✓" feedback states
- Draft persistence across page reload via `localStorage` keyed by ticket ID + type

---

## Phase 2 — Async Execution + Polling (2026-04-12)

- `executeAsyncJob()` in `asyncExecution.ts` — `setImmediate`-based background runner with DB state transitions
- `/api/copilot/v1/` route group: `analyze`, `suggest`, `draft-reply`, `chat`, `status/:id`
- Client-side polling loop in `CopilotPanel` via `setInterval(1000ms)`
- PII redaction pipeline: `redactTicketSnapshot()` applied before every LLM call
- Zod validation on all LLM outputs before storage

---

## Phase 1 — Initial Build (2026-04-11)

- `apps/crm`: ticket management REST API with Prisma, Clerk auth, multi-tenancy, atomic transactions, audit events
- `apps/copilot-service`: initial CopilotPanel with synchronous analyze, suggest, and chat endpoints
- Shared PostgreSQL database via Neon
- Basic Playwright E2E setup
