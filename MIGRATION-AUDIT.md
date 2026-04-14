# Migration Audit: Monorepo Restructure

## Executive Summary

The codebase is **closer to the target architecture than it appears**. The two apps (`sample-crm` on :3000 and `smart-ticket-system` on :3001) already communicate via HTTP REST, the copilot's AI logic is already isolated behind `/api/copilot/v1/*` routes, and the async job lifecycle is fully implemented. The primary gaps are:

1. **No formal monorepo tooling** — no `pnpm-workspace.yaml`, no Turborepo, no shared `packages/` directory.
2. **Duplicated code** — `utils.ts`, `validation.ts`, Prisma enums, and Clerk config are copy-pasted between apps with minor drift.
3. **Shared database** — both apps point at the same Neon PostgreSQL instance. The smart-ticket-system's Prisma schema is a superset (CRM models + AI models). This works but violates service boundary principles.
4. **Naming doesn't match target** — `sample-crm` should be `apps/crm`, `smart-ticket-system` should be `apps/copilot-service`.
5. **Legacy API routes** — 4 synchronous endpoints at `/api/analyze`, `/api/suggest`, `/api/draft-reply`, `/api/chat` are dead code superseded by `/api/copilot/v1/*`.
6. **No shared type package** — request/response contracts are defined independently in each app (Zod schemas in smart-ticket-system, inline types in sample-crm).

The recommended migration is **incremental**: add monorepo tooling, extract shared types, rename apps, split the Prisma schema, then clean up dead code. No major rewrites needed.

---

## 1. Current-State Architecture Summary

| Aspect | Current State |
|--------|--------------|
| **Monorepo** | Pseudo-monorepo: root `package.json` with `concurrently` to run both apps. No workspace protocol. |
| **Apps** | `sample-crm` (CRM + UI, :3000) and `smart-ticket-system` (AI Copilot + UI, :3001) |
| **Communication** | HTTP REST. `crmClient.ts` in smart-ticket-system calls `CRM_API_BASE_URL` (sample-crm's API) with Clerk JWT. |
| **Database** | Single shared Neon PostgreSQL. Both apps have their own Prisma schema pointing to the same DB. |
| **Auth** | Clerk in both apps. CRM uses dev-mode bypass for UI routes. Smart-ticket-system protects all routes. |
| **AI Pipeline** | OpenAI gpt-4o-mini via `aiProvider.ts`. Async execution with `setImmediate` + polling. |
| **RAG** | pgvector + `text-embedding-3-small` embeddings. KB articles seeded. References appended to analyze/suggest output. |
| **Testing** | 113 unit tests (Vitest) + 7 E2E tests (Playwright) in smart-ticket-system. 0 tests in sample-crm. |

---

## 2. Current Folder/App Map

```
ai-support-engineer integration/        # Root (pseudo-monorepo)
├── package.json                         # concurrently dev script
├── ARCHITECTURE.md                      # Architecture reference
├── PHASES.md                            # Phase roadmap (3-6)
├── README.md                            # Getting started guide
│
├── sample-crm/                          # CRM app (Next.js 15, :3000)
│   ├── prisma/schema.prisma             # CRM-only models (6 models, 6 enums)
│   ├── prisma/seed.ts                   # 8 sample tickets
│   ├── src/app/api/tickets/             # REST API (GET/POST/PATCH)
│   ├── src/app/(ui)/tickets/            # CRM UI pages
│   ├── src/lib/auth.ts                  # Clerk auth + dev bypass
│   ├── src/lib/ticketActions.ts         # Server actions (create/update/delete)
│   ├── src/lib/utils.ts                 # Formatting utilities (DUPLICATED)
│   ├── src/lib/validation.ts            # Input validation (DRIFTED COPY)
│   └── src/middleware.ts                # Clerk middleware
│
└── smart-ticket-system/                 # Copilot Service (Next.js 15, :3001)
    ├── prisma/schema.prisma             # Superset: CRM models + AI models (10 models, 8 enums)
    ├── prisma/kb-seed.ts                # 8 KB articles for RAG
    ├── src/app/api/copilot/v1/          # Copilot REST API (7 endpoints)
    ├── src/app/api/{analyze,suggest,    # LEGACY: 4 synchronous endpoints (dead code)
    │    draft-reply,chat}/route.ts
    ├── src/app/(dashboard)/tickets/     # Copilot UI pages
    ├── src/lib/aiProvider.ts            # OpenAI integration (482 lines)
    ├── src/lib/asyncExecution.ts        # Background job runner
    ├── src/lib/copilotClient.ts         # Browser → /api/copilot/* HTTP client
    ├── src/lib/crmClient.ts             # Server → sample-crm API HTTP client
    ├── src/lib/embeddings.ts            # OpenAI embeddings
    ├── src/lib/kbRetrieval.ts           # pgvector search
    ├── src/lib/schemas.ts               # All Zod schemas (request + response)
    ├── src/lib/redaction.ts             # PII redaction
    ├── src/lib/utils.ts                 # Formatting utilities (DUPLICATED)
    ├── src/lib/validation.ts            # Input validation (DRIFTED COPY)
    ├── src/components/copilot-panel.tsx  # Main copilot UI component
    ├── src/lib/__tests__/               # 6 unit test files (113 tests)
    └── e2e/copilot.spec.ts              # 7 E2E tests
```

---

## 3. Current Domain Model Summary

### CRM Domain (in both Prisma schemas)
- **Organization** → **User** (1:N, role-based)
- **Organization** → **Ticket** (1:N)
- **Ticket** → **TicketMessage** (1:N, cascade)
- **Ticket** → **Attachment** (1:N, cascade)
- **Ticket** → **TicketEvent** (1:N, cascade, audit trail)
- Enums: Role, TicketStatus, Priority, Channel, AuthorType, TicketEventType

### AI Domain (smart-ticket-system only)
- **AISuggestion**: ticketId, kind (enum), state (queued/running/success/error), content (JSON), model, tokens
- **AIConversation**: ticketId, messages (JSON array)
- **AICache**: key (hash), value (JSON), expiresAt
- **KnowledgeBaseArticle**: title, content, url, productArea, embedding (vector(1536))
- Enums: AISuggestionState, AISuggestionKind

---

## 4. Current API Boundary Summary

### sample-crm API (port 3000)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/tickets` | GET | Clerk JWT | List tickets (filter, paginate) |
| `/api/tickets` | POST | Clerk JWT | Create ticket |
| `/api/tickets/[id]` | GET | Clerk JWT | Get ticket with messages |
| `/api/tickets/[id]/status` | PATCH | Clerk JWT | Update ticket status |
| `/api/tickets/[id]/messages` | POST | Clerk JWT | Add message |
| `/api/tickets/[id]/attachments` | POST | Clerk JWT | Upload attachment |

### smart-ticket-system Copilot API (port 3001)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/copilot/v1/analyze` | POST | Clerk | Async ticket analysis + RAG |
| `/api/copilot/v1/suggest` | POST | Clerk | Async next steps + RAG |
| `/api/copilot/v1/draft-reply` | POST | Clerk | Async draft generation (3 types) |
| `/api/copilot/v1/draft-reply/[id]` | PATCH | Clerk | Save/edit draft |
| `/api/copilot/v1/chat` | POST | Clerk | Async chat about ticket |
| `/api/copilot/v1/status/[id]` | GET | Clerk | Poll job status |
| `/api/copilot/v1/update-status` | POST | Clerk | Proxy to CRM status update |
| `/api/copilot/v1/kb/ingest` | POST | Clerk | Ingest KB article |

### Legacy (dead code in smart-ticket-system)
| `/api/analyze` | POST | — | Synchronous analyze (superseded) |
| `/api/suggest` | POST | — | Synchronous suggest (superseded) |
| `/api/draft-reply` | POST | — | Synchronous draft (superseded) |
| `/api/chat` | POST | — | Synchronous chat (superseded) |

---

## 5. Current Async Job/Run Lifecycle Summary

```
Client (browser)                    Copilot API                      Background
─────────────────────────────────────────────────────────────────────────────────
POST /api/copilot/v1/analyze  ──►  Create AISuggestion(state=queued)
                                   executeAsyncJob(id, handler)  ──►  setImmediate()
                              ◄──  { suggestionId, state: 'queued' }     │
                                                                         ▼
GET /status/{id}  ──────────►  SELECT state,content              state → running
                  ◄──────────  { state: 'running' }              handler() executing
                                                                         │
GET /status/{id}  ──────────►  SELECT state,content              state → success
                  ◄──────────  { state: 'success', content }     content = AI result
```

- Polling interval: 1 second (client-side `setInterval`)
- Error handling: handler throws → state='error', error=message
- Draft lifecycle adds: save (PATCH), mark-sent, localStorage reload

---

## 6. Current Testing Summary

| Category | Location | Count | Coverage |
|----------|----------|-------|----------|
| Unit: Zod schemas | `__tests__/schemas.test.ts` | 56 | All request/response schemas incl. KB references |
| Unit: Redaction | `__tests__/redaction.test.ts` | 12 | Email, token, API key, Bearer token patterns |
| Unit: Validation | `__tests__/validation.test.ts` | 18 | File type, file size, subject, message |
| Unit: Utils | `__tests__/utils.test.ts` | 6 | formatTicketId, priority colors, status labels |
| Unit: Draft prompts | `__tests__/draftPrompts.test.ts` | 15 | Prompt builders for 3 draft types |
| Unit: KB retrieval | `__tests__/kbRetrieval.test.ts` | 6 | Vector search with mocked Prisma + embeddings |
| E2E: Copilot flows | `e2e/copilot.spec.ts` | 7 | Async state transitions, drafts, references, errors |
| **sample-crm** | — | **0** | **No tests** |

---

## 7. Gap Analysis Against Target Architecture

### Target:
```
apps/crm
apps/copilot-service
packages/shared-types
packages/ui (optional)
packages/config (optional)
```

| Target Requirement | Current State | Gap |
|-------------------|---------------|-----|
| `apps/crm` | `sample-crm/` at root level | **Rename + move** |
| `apps/copilot-service` | `smart-ticket-system/` at root level | **Rename + move** |
| `packages/shared-types` | No shared package. Zod schemas only in smart-ticket-system. Types duplicated or inferred ad-hoc in sample-crm. | **Create new package** |
| `packages/ui` (optional) | `dark-mode-toggle.tsx` duplicated in both apps | **Low priority** — extract if desired |
| `packages/config` (optional) | Tailwind, TypeScript configs similar but not shared | **Low priority** |
| pnpm workspace | No `pnpm-workspace.yaml` | **Add** |
| Turborepo | No `turbo.json` | **Add** (optional but recommended) |
| HTTP-only communication | Already true: `crmClient.ts` calls CRM via HTTP | **Preserved** |
| Typed contracts (TS + Zod) | Zod schemas exist in smart-ticket-system but CRM doesn't consume them | **Extract to shared-types** |
| Async run lifecycle | Fully implemented (queued/running/success/error) | **Preserved** |
| Auditability | TicketEvent audit trail, PII redaction, AISuggestion history | **Preserved** |
| Human-in-the-loop | Draft edit → save → mark-sent flow | **Preserved** |
| Separate Prisma schemas | Both apps share one DB with one schema (smart-ticket-system is superset) | **Split into CRM schema + AI schema** |
| No legacy dead code | 4 synchronous API routes still exist | **Delete** |
| CRM has no AI imports | True — CRM never imports AI modules | **Preserved** |

---

## 8. Proposed Target Folder Tree

```
ai-support-engineer/                     # Root monorepo
├── package.json                         # Workspace root
├── pnpm-workspace.yaml                  # Workspace definition
├── turbo.json                           # (Optional) Turborepo config
├── ARCHITECTURE.md
├── PHASES.md
├── README.md
├── .gitignore
│
├── apps/
│   ├── crm/                             # Renamed from sample-crm
│   │   ├── prisma/
│   │   │   ├── schema.prisma            # CRM-only models (unchanged)
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── app/api/tickets/         # CRM REST API (unchanged)
│   │   │   ├── app/(ui)/tickets/        # CRM UI (unchanged)
│   │   │   ├── lib/auth.ts              # Clerk auth (unchanged)
│   │   │   ├── lib/ticketActions.ts     # Server actions (unchanged)
│   │   │   ├── lib/prisma.ts            # Prisma singleton (unchanged)
│   │   │   └── middleware.ts
│   │   ├── package.json
│   │   └── next.config.ts
│   │
│   └── copilot-service/                 # Renamed from smart-ticket-system
│       ├── prisma/
│       │   ├── schema.prisma            # AI-only models + FK references
│       │   └── kb-seed.ts
│       ├── src/
│       │   ├── app/api/copilot/v1/      # Copilot REST API (unchanged)
│       │   ├── app/(dashboard)/         # Copilot UI (unchanged)
│       │   ├── lib/aiProvider.ts        # AI logic (unchanged)
│       │   ├── lib/asyncExecution.ts    # Job runner (unchanged)
│       │   ├── lib/crmClient.ts         # HTTP bridge to CRM (unchanged)
│       │   ├── lib/copilotClient.ts     # Browser client (unchanged)
│       │   ├── lib/schemas.ts           # Imports from @repo/shared-types
│       │   ├── lib/embeddings.ts
│       │   ├── lib/kbRetrieval.ts
│       │   ├── lib/redaction.ts
│       │   ├── components/copilot-panel.tsx
│       │   └── lib/__tests__/
│       ├── e2e/
│       ├── package.json
│       └── next.config.ts
│
└── packages/
    └── shared-types/                    # NEW: shared contracts
        ├── package.json
        ├── tsconfig.json
        ├── src/
        │   ├── index.ts                 # Re-exports
        │   ├── ticket.ts               # TicketSnapshot, TicketListItem, status/priority enums
        │   ├── copilot.ts              # AISuggestionKind, AISuggestionState, API request/response shapes
        │   ├── validation.ts           # Unified validation (merged from both apps)
        │   └── utils.ts                # Shared formatting utilities
        └── __tests__/
            ├── validation.test.ts       # Moved from both apps
            └── utils.test.ts            # Moved from smart-ticket-system
```

---

## 9. Preserve As-Is

These items already align with the target and should not be changed:

| Item | Location | Why preserve |
|------|----------|-------------|
| CRM REST API | `sample-crm/src/app/api/tickets/` | Clean, well-structured, all 6 endpoints working |
| Copilot REST API | `smart-ticket-system/src/app/api/copilot/v1/` | Versioned, async, complete |
| `aiProvider.ts` | `smart-ticket-system/src/lib/` | Fully implemented (482 lines, 7 functions, repair pattern) |
| `asyncExecution.ts` | `smart-ticket-system/src/lib/` | Clean 42-line job runner |
| `crmClient.ts` | `smart-ticket-system/src/lib/` | HTTP-only CRM bridge with Clerk JWT |
| `copilotClient.ts` | `smart-ticket-system/src/lib/` | Browser-side API client |
| `redaction.ts` | `smart-ticket-system/src/lib/` | PII safety layer |
| `embeddings.ts` + `kbRetrieval.ts` | `smart-ticket-system/src/lib/` | Phase 4 RAG pipeline |
| `copilot-panel.tsx` | `smart-ticket-system/src/components/` | Full UI with status/drafts/chat/references |
| Prisma seed files | Both `prisma/seed.ts` and `prisma/kb-seed.ts` | Demo data |
| All 113 unit tests | `smart-ticket-system/src/lib/__tests__/` | Full coverage |
| All 7 E2E tests | `smart-ticket-system/e2e/` | Async flow coverage |
| `ARCHITECTURE.md` | Root | Comprehensive reference |
| `PHASES.md` | Root | Phase roadmap |
| Clerk auth in both apps | `middleware.ts` + `auth.ts` | Working auth flow |
| TicketEvent audit trail | `sample-crm` | Event sourcing for auditability |

---

## 10. Refactor, Don't Rewrite

| Item | Current | Proposed Change |
|------|---------|----------------|
| Root folder name | `ai-support-engineer integration` (space) | Rename to `ai-support-engineer` (no space) or keep as-is |
| `sample-crm/` | Root-level app | Move to `apps/crm/` |
| `smart-ticket-system/` | Root-level app | Move to `apps/copilot-service/` |
| `utils.ts` (identical in both) | Duplicated | Extract to `packages/shared-types/src/utils.ts`, import in both |
| `validation.ts` (drifted) | Two diverged copies | Merge into `packages/shared-types/src/validation.ts`, reconcile differences |
| Zod schemas in `schemas.ts` | Only in smart-ticket-system | Extract shared shapes (TicketSnapshot, status enums) to `packages/shared-types` |
| `copilot-panel.tsx` AnalysisResult type | Inline type (lines 38-59) duplicates Zod schema | Import from shared-types instead |
| Root `package.json` scripts | `concurrently` | Update paths to `apps/crm` and `apps/copilot-service` |
| Prisma schema (smart-ticket-system) | Superset of CRM schema | Keep AI models only; reference CRM ticketId as plain string (no FK relation across services) |

---

## 11. Missing and Needs to Be Added

| Item | Purpose | Priority |
|------|---------|----------|
| `pnpm-workspace.yaml` | Formal workspace definition | **High** — enables shared packages |
| `packages/shared-types/` | Shared TS + Zod contracts | **High** — eliminates duplication |
| `turbo.json` | Parallel builds, dependency-aware caching | **Medium** — nice for DX, not blocking |
| `packages/ui/` | Shared components (dark-mode-toggle) | **Low** — only 1 shared component |
| `packages/config/` | Shared tsconfig, eslint, tailwind base | **Low** — apps work independently |
| CRM unit tests | sample-crm has 0 tests | **Medium** — portfolio gap |
| Vercel deployment config | Neither app has `vercel.json` or `vercel.ts` | **Medium** — needed for deployment |

---

## 12. Recommended Migration Order

### Phase A: Monorepo Foundation (low risk, high value)
1. Add `pnpm-workspace.yaml` at root
2. Move `sample-crm/` → `apps/crm/`
3. Move `smart-ticket-system/` → `apps/copilot-service/`
4. Update root `package.json` scripts (paths)
5. Update `.gitignore`
6. Verify `pnpm install` and `pnpm dev` still work

### Phase B: Extract Shared Types (medium risk, high value)
1. Create `packages/shared-types/` with `package.json`, `tsconfig.json`
2. Move `utils.ts` → `packages/shared-types/src/utils.ts`
3. Merge `validation.ts` → `packages/shared-types/src/validation.ts`
4. Extract `TicketSnapshot`, `TicketListItem`, status/priority types → `packages/shared-types/src/ticket.ts`
5. Extract `AISuggestionKind`, `AISuggestionState`, API request/response Zod schemas → `packages/shared-types/src/copilot.ts`
6. Update imports in both apps
7. Move `utils.test.ts` and `validation.test.ts` to shared-types
8. Verify all 113+ tests pass

### Phase C: Cleanup (low risk, low effort)
1. Delete 4 legacy synchronous API routes from copilot-service
2. Remove duplicated `utils.ts` and `validation.ts` from both apps (now imported from shared-types)
3. Replace inline `AnalysisResult` type in `copilot-panel.tsx` with import from shared-types
4. Update `ARCHITECTURE.md` to reflect new structure

### Phase D: Schema Split (medium risk, medium value)
1. Trim copilot-service Prisma schema to AI-only models (remove CRM model definitions, keep enums needed for type safety)
2. Keep `ticketId: String` as plain reference (no FK to Ticket model)
3. Run migration to verify no DB changes needed (same tables, just different schema files)

### Phase E: Portfolio Polish (optional, for interviews)
1. Add `turbo.json` for monorepo orchestration
2. Add basic CRM unit tests (API validation, server actions)
3. Add Vercel deployment configs (`vercel.json` or `vercel.ts` per app)
4. Add `packages/ui/` if more shared components emerge

---

## 13. Risk List

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `pnpm install` breaks after folder moves | Medium | High | Run `pnpm install` immediately after moves, before any code changes |
| Path alias `@/*` breaks after rename | Low | Medium | Each app's `tsconfig.json` uses relative `./src/*` — unaffected by parent folder name |
| Shared DATABASE_URL causes conflicts | Already present | Low | Both apps already share the DB. Schema split (Phase D) is cosmetic, not a data migration. |
| Clerk auth tokens rejected after rename | None | — | Clerk config is env-var based, not path-dependent |
| E2E tests fail after moves | Low | Medium | Playwright config uses relative paths (`./e2e`). Port unchanged (:3001). |
| Vercel deployment breaks | Medium | Medium | Each app deploys independently. Vercel auto-detects `apps/crm` and `apps/copilot-service` as separate projects. Root dir setting may need updating. |
| Import path changes cascade | Medium | Medium | Phase B (shared-types) is the riskiest step. Do it in one atomic commit with full test run. |

---

## Phase 2 Checklist

When ready to implement Phase A (Monorepo Foundation):

- [ ] Create `pnpm-workspace.yaml` with `packages: ['apps/*', 'packages/*']`
- [ ] `mkdir -p apps packages`
- [ ] `git mv sample-crm apps/crm`
- [ ] `git mv smart-ticket-system apps/copilot-service`
- [ ] Update root `package.json` script paths
- [ ] Run `pnpm install` from root
- [ ] Run `pnpm --dir apps/crm run dev` — verify :3000
- [ ] Run `pnpm --dir apps/copilot-service run dev` — verify :3001
- [ ] Run `pnpm --dir apps/copilot-service run test` — verify 113 tests pass
- [ ] Run `pnpm --dir apps/copilot-service run test:e2e` — verify E2E
- [ ] Commit: "restructure: move apps into apps/ directory, add pnpm workspace"
