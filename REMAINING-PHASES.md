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

## Phase B — Similar Cases / Support Memory (from PHASES.md Phase 5)

*Biggest remaining product feature. Leverages the pgvector infra already in place from Phase 4.*

- [ ] `POST /v1/similar` — embed current ticket (title + description), cosine search against `Ticket` embeddings with resolved outcomes, optional `productArea`/`platform` filters
- [ ] Backfill embeddings for existing tickets (one-off script) + generate on create/update
- [ ] `POST /v1/similar/:id/apply` — creates an `AISuggestion` (`kind=draft_customer_reply`) derived from the matched ticket's resolution
- [ ] CopilotPanel: "Similar Cases" section with score, title snippet, outcome, "Apply" button
- [ ] Unit: ranking stability with fixtures + mocked embeddings
- [ ] E2E: Apply pattern → saved draft persists after reload
- [ ] Document endpoints in `docs/api-contract.md`

**Exit criteria:** opening a ticket surfaces 3–5 relevant prior tickets; Apply creates a usable draft.

---

## Phase C — Pro Polish + Demo Mode (from PHASES.md Phase 6 + MASSIVE Phase 4 overlap)

*Makes the app feel finished. Mostly UI.*

- [ ] Loading skeletons on every async section in CopilotPanel
- [ ] Toast notifications (success/error) for: save draft, copy, mark sent, apply pattern, feedback
- [ ] Collapsed/expandable JSON sections (analysis hypotheses, extracted signals)
- [ ] Copy buttons on every output block
- [ ] Provider indicator badge ("OpenAI" / "Claude") sourced from `AI_PROVIDER` env
- [ ] Demo mode toggle: deterministic happy-path flow (open ticket → analyze → draft → edit → save → copy → feedback)
- [ ] E2E "happy demo path" test covering the full sequence

**Exit criteria:** full flow looks and feels production-grade; recruiter can walk through it in < 2 minutes.

---

## Phase D — Accessibility & Responsiveness (from MASSIVE Phase 4)

- [ ] A11y audit (axe / Lighthouse) on CRM list, ticket detail, CopilotPanel; fix contrast, focus order, aria-labels
- [ ] Keyboard navigation through copilot actions (tab order, Enter/Esc on modals)
- [ ] Mobile responsiveness pass on CRM + panel (drawer on narrow viewports)

**Exit criteria:** Lighthouse a11y ≥ 95 on primary pages; usable on a 390px viewport.

---

## Phase E — Presentation Layer (from MASSIVE Phase 4)

*Last — only polish once the product is stable.*

- [ ] Landing / marketing page (or README overhaul) with architecture diagram (Mermaid or SVG)
- [ ] OpenGraph / meta tags for public pages
- [ ] `LICENSE`, `CONTRIBUTING.md`, `CHANGELOG.md`
- [ ] Performance profiling: bundle analyzer pass, cold-start measurement, cache headers where appropriate
- [ ] Final end-to-end demo recording (Loom/GIF) embedded in README

**Exit criteria:** GitHub landing page is a compelling portfolio piece; repo is shareable.

---

## Recommendation

**Start with Phase A.** It's the smallest (half a day) and every subsequent phase benefits: CI catches regressions from Phase B onward, env validation prevents silent config drift, and the seed improvements directly feed Phase B's Similar Cases demo.

After Phase A, **Phase B** is the highest-signal single unit of work remaining — it's the last genuine product feature, and it's the one most visible in a portfolio walkthrough ("the AI also finds similar past tickets and can apply their resolutions").

Phases C–E are polish and can be reordered or partially interleaved based on appetite.
