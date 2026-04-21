# Remaining Phases — Consolidated Roadmap

Collates outstanding work from both trackers:
- `PHASES.md` (product features): Phase 5, Phase 6
- `MASSIVE-REFACTOR-PHASES.MD` (engineering polish): Phase 4

Reordered below by productive sequence (foundations → features → polish → presentation).

---

## Phase A — Hardening Foundations (from MASSIVE Phase 4, partial) [COMPLETE]

*Short, high-leverage. Done first so later phases land on a stable base.*

- [x] **Env var validation at startup** — `src/lib/env.ts` in both apps with Zod-parsed `process.env`, wired via `src/instrumentation.ts` so misconfig fails fast at runtime (not at build). `SKIP_ENV_VALIDATION=1` escape hatch for CI/tests. 3 unit tests in `env.test.ts`.
- [x] **CI/CD pipeline** — `.github/workflows/ci.yml`: pnpm install → typecheck (both apps) → vitest → build (both apps). Lint step omitted pending eslint-config-next 16.x upstream fix.
- [x] **Seed script improvements** — deterministic IDs (`tkt_001`..`tkt_012`, `org_demo_acme`, `usr_admin_sarah`, etc.), 12 tickets covering all KB productAreas (Auth, Billing, API, Mobile, Dashboard, General) with resolved outcomes so Phase B's Similar Cases retrieval has signal.

**Exit criteria met:** CI workflow validates locally; missing env key throws readable Zod error; seed yields 12 tickets / deterministic IDs / full KB topic coverage.

---

## Phase B — Similar Cases / Support Memory (from PHASES.md Phase 5) [COMPLETE]

*Biggest remaining product feature. Leverages the pgvector infra already in place from Phase 4.*

- [x] `POST /v1/similar` — embed current ticket text, cosine search against `Ticket` embeddings (resolved/closed only), optional `productArea` filter
- [x] `POST /v1/similar/:id/apply` — queued async job creates `draft_customer_reply` AISuggestion derived from matched ticket's resolution
- [x] CopilotPanel: "Similar Cases" section renders on mount with score badge, resolution snippet, Apply button; Apply wires to draft polling flow
- [x] Backfill script at `prisma/embed-tickets.ts` — idempotent, processes stale/missing embeddings
- [x] Prisma schema: `embedding vector(1536)` + `embeddingUpdatedAt` on `Ticket`; migration `20260417000000_add_ticket_embeddings`; `similar_cases` added to `AISuggestionKind` enum
- [x] Shared types: `SimilarCaseSchema`, `SimilarCasesRequestSchema`, `SimilarCasesResultSchema`, `ApplySimilarCaseRequestSchema` in `@repo/shared-types`
- [x] 8 unit tests in `ticketEmbeddings.test.ts` (score threshold, productArea filter, excludeTicketId, null resolution)
- [x] E2E test: Similar Cases renders, Apply button creates draft, textarea populated
- [x] `docs/api-contract.md` updated with `/v1/similar` and `/v1/similar/:id/apply`

**Exit criteria met:** 147 unit tests pass; both apps typecheck clean; applying a similar case wires through to draft edit flow.

---

## Phase C — Pro Polish + Demo Mode (from PHASES.md Phase 6 + MASSIVE Phase 4 overlap) [COMPLETE]

*Makes the app feel finished. Mostly UI.*

- [x] **Loading skeleton** — `animate-pulse` bars render in result area while `isLoading && !result` (`data-testid="result-skeleton"`)
- [x] **Toast notifications** — local toast queue in CopilotPanel renders fixed bottom-right toasts (3 s auto-dismiss); fires on: save draft, copy draft, mark sent, apply similar case, feedback rated
- [x] **Collapsible sections** — native `<details>`/`<summary>` on Extracted Signals and Hypotheses; open by default, no JS required; chevron indicator
- [x] **Per-block copy buttons** — Copy buttons on Hypotheses, Clarifying Questions, Next Steps (analysis), Steps (suggest), Answer (chat); all call `addToast('Copied to clipboard')`
- [x] **Provider badge** — reads `process.env.NEXT_PUBLIC_AI_PROVIDER` (optional, defaults `openai`); rendered in panel header with `data-testid="provider-badge"`; added to `env.ts` schema as optional
- [x] **Demo mode** — "▶ Run Demo" button triggers `handleRunDemo`: analyze → wait for success via `onJobCompleteRef` → generate customer reply → wait for success; toast narration at each step
- [x] **E2E happy demo path** — `happy demo path: analyze → draft → edit → save → copy → feedback` test: mocks all endpoints, clicks Demo button, asserts analysis renders + draft textarea populates + save toast appears + provider badge visible

**Exit criteria met:** typecheck clean; 147 unit tests pass; full demo flow scripted and E2E tested.

---

## Phase D — Accessibility & Responsiveness (from MASSIVE Phase 4) [COMPLETE]

- [x] **A11y audit + fixes** — CRM layout nav gets `aria-label="Main navigation"`; ticket list table adds `scope="col"` on all `<th>` and `aria-label` on `<table>`; filter inputs/selects get explicit `<label htmlFor>` + `id` associations (visually hidden with `sr-only`); filter form gets `role="search"`; empty-state "Clear" link renamed "Clear filters" for clarity
- [x] **Mobile overflow** — ticket list table container changed to `overflow-x-auto` so it scrolls horizontally on 390px instead of clipping
- [x] **CRM ticket detail** — conversation thread promoted to `<section aria-label="Conversation">`; `<time dateTime>` on message timestamps; reply textarea gets a visually-hidden `<label>`; author name/type inputs get explicit `id`/`htmlFor`; status form gets `aria-label` and status buttons get `aria-pressed`; status option group gets `role="group"` + `aria-label`
- [x] **New ticket form** — all labels wired with explicit `id`/`htmlFor` pairs; required star uses `aria-hidden="true"` with sr-only "(required)" text
- [x] **Copilot service Nav** — `<nav>` gets `aria-label="Main navigation"`; active links get `aria-current="page"`
- [x] **CopilotPanel** — state badge gets `role="status" aria-live="polite"`; error div gets `role="alert"`; loading skeleton gets `role="status" aria-label="Loading AI response" aria-busy="true"`; toast container gets `aria-live="polite" aria-atomic="false"` with each toast as `role="status"` or `role="alert"`; draft textarea gets `<label htmlFor>` and `aria-label`; chat input gets explicit label + `aria-label` + `aria-label` on Ask button; draft type/tone selects get explicit `id`/`htmlFor`; ticket status buttons get `aria-pressed` + `role="group"` with `aria-labelledby`; Apply similar-case buttons get contextual `aria-label`
- [x] **Keyboard navigation** — chat input already has `onKeyDown` Enter handler; all interactive elements are native `<button>`/`<input>`/`<select>` with no keyboard traps; `<details>`/`<summary>` is natively keyboard-accessible

**Exit criteria met:** typecheck clean; 147 unit tests pass; all interactive controls have accessible names; table is mobile-scrollable; landmark regions labelled throughout.

---

## Phase E — Presentation Layer (from MASSIVE Phase 4) [COMPLETE]

- [x] **README overhaul** — Mermaid architecture diagram, full feature table, tech stack, local setup guide, key design decisions, API quick reference
- [x] **OpenGraph / meta tags** — `apps/copilot-service/src/app/layout.tsx` and `apps/crm/src/app/layout.tsx` updated with `title`, `description`, `openGraph`, and `twitter` metadata objects
- [x] **LICENSE** — MIT license at repo root
- [x] **CONTRIBUTING.md** — dev workflow, code style, PR guidelines
- [x] **CHANGELOG.md** — full phase-by-phase history (Phases 1–E)
- [x] **Cache headers** — `no-store` on all AI trigger, status, and CRM mutation routes via `headers()` in both `next.config.ts` files; short `public, max-age=10` on health/activity endpoints
- [x] **ARCHITECTURE.md** — rewritten to reflect current monorepo (`apps/crm`, `apps/copilot-service`, `packages/shared-types`), all current API routes, data models, RAG pipeline, Zod schemas, and test inventory
- [ ] **Final demo recording** — Loom/GIF embedded in README (manual — requires screen recording)

**Exit criteria met:** GitHub landing page is a compelling portfolio piece; repo is shareable. Demo recording remains as a manual follow-up.

---

## Recommendation

**Start with Phase A.** It's the smallest (half a day) and every subsequent phase benefits: CI catches regressions from Phase B onward, env validation prevents silent config drift, and the seed improvements directly feed Phase B's Similar Cases demo.

After Phase A, **Phase B** is the highest-signal single unit of work remaining — it's the last genuine product feature, and it's the one most visible in a portfolio walkthrough ("the AI also finds similar past tickets and can apply their resolutions").

Phases C–E are polish and can be reordered or partially interleaved based on appetite.
