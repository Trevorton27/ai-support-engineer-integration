# Architecture

## Overview

AI Support Engineer is a two-app monorepo that pairs a customer-facing CRM with an AI copilot service. Support agents use the CRM to manage tickets; the copilot service analyzes tickets, suggests next steps, drafts replies, and answers ad-hoc questions — all powered by LLM inference and RAG retrieval against a knowledge base.

## Monorepo Structure

```
ai-support-engineer/
  apps/
    crm/                  # Next.js 15 — ticket CRUD, agent-facing UI
    copilot-service/      # Next.js 15 — AI copilot API + embedded UI panel
  packages/
    shared-types/         # Zod schemas, TS types, utils shared across apps
  docs/                   # Architecture and API documentation
  pnpm-workspace.yaml     # Workspace definition
```

Managed with **pnpm workspaces**. Internal dependencies use the `workspace:*` protocol.

## Apps

### CRM (`apps/crm` — port 3000)

The primary ticket management application.

- **Stack**: Next.js 15 (App Router), Prisma, PostgreSQL (Neon), Clerk auth, Tailwind CSS
- **Responsibilities**: Ticket CRUD, message threads, file attachments, status management
- **Database**: Owns the Prisma schema and all migrations. Models include `Ticket`, `Message`, `Attachment`, `User`.
- **API surface**: REST endpoints under `/api/tickets/...` consumed by its own frontend and by the copilot service.

### Copilot Service (`apps/copilot-service` — port 3001)

The AI-powered support assistant.

- **Stack**: Next.js 15 (App Router), OpenAI (GPT-4o-mini), pgvector, Prisma (shared DB)
- **Responsibilities**: Ticket analysis, next-step suggestions, draft generation (customer reply, internal note, escalation), free-form chat, knowledge base RAG retrieval
- **Database models**: `AISuggestion` (async job tracking), `KnowledgeBaseArticle` (vector embeddings)
- **API surface**: Versioned REST endpoints under `/api/copilot/v1/...`

## Shared Package

### `@repo/shared-types` (`packages/shared-types`)

Zero-dependency (except Zod) package exporting:

- **Domain types**: `TicketSnapshot`, `TicketListItem`, status/priority/channel enums
- **API contracts**: Request and response Zod schemas for all copilot endpoints
- **Utilities**: `formatTicketId`, `getPriorityColor`, `getStatusLabel`, `getChannelLabel`, `getProductAreas`
- **Validation**: `validateSubject`, `validateMessage`, `validateFileType`, `validateFileSize`

Both apps import from `@repo/shared-types`. App-local files (`schemas.ts`, `utils.ts`, `validation.ts`) are thin re-export layers for path convenience.

## Data Flow

```
 Customer submits ticket
        |
        v
  [CRM] POST /api/tickets
        |
        v
  Agent opens ticket in CRM UI
        |
        v
  CRM UI renders <CopilotPanel>
        |
        v
  Panel calls copilot-service API (e.g. POST /api/copilot/v1/analyze)
        |
        v
  Copilot creates AISuggestion (state: queued), returns suggestionId
        |
        v
  Background job:
    1. Fetches ticket from CRM API (GET /api/tickets/:id)
    2. Searches knowledge base (pgvector cosine similarity)
    3. Calls OpenAI for analysis/suggestion/draft
    4. Redacts PII from output
    5. Updates AISuggestion (state: success, content: {...})
        |
        v
  Panel polls GET /api/copilot/v1/status/:id until state != queued/running
        |
        v
  UI renders result (analysis, suggestions, draft, references)
```

## Async Job Pattern

All AI operations are asynchronous to avoid request timeouts:

1. **Client** sends POST request (e.g., `/v1/analyze`)
2. **Server** creates an `AISuggestion` record with `state: queued`, returns `{ suggestionId }`
3. **Background** `executeAsyncJob()` runs the AI pipeline, transitions state: `queued -> running -> success|error`
4. **Client** polls `GET /v1/status/:id` (or `/v1/runs/:runId`) until terminal state
5. **Result** is stored in `AISuggestion.content` as JSON

## Knowledge Base (RAG)

- Articles stored in `KnowledgeBaseArticle` with `vector(1536)` embeddings (OpenAI `text-embedding-3-small`)
- HNSW index for fast cosine similarity search
- `searchKnowledgeBase()` embeds the query, runs `<=>` similarity search, filters by score threshold and optional `productArea`
- References appended to `analyze` and `suggest` results server-side (not LLM-generated)
- Ingestion via `POST /v1/kb/ingest`

## Authentication

- **Clerk** handles user authentication for both apps
- CRM API routes are protected by Clerk middleware
- Copilot service authenticates to CRM API using Clerk service tokens (`auth().getToken()`)

## Key Libraries

| Library | Purpose |
|---------|---------|
| Next.js 15 | App Router, API routes, SSR |
| Prisma | Database ORM + migrations |
| Zod | Runtime schema validation |
| OpenAI SDK | LLM inference + embeddings |
| pgvector | Vector similarity search |
| Clerk | Authentication |
| Tailwind CSS | Styling |
| Vitest | Unit testing |
| Playwright | E2E testing |
