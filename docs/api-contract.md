# API Contract

All copilot endpoints are versioned under `/api/copilot/v1`. Every response follows a consistent envelope:

```json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": "description" }
```

---

## Health

### `GET /v1/health`

Returns service health status including database connectivity.

**Response** `200`
```json
{ "ok": true, "data": { "status": "healthy", "timestamp": "2026-04-13T12:00:00.000Z" } }
```

**Response** `503`
```json
{ "ok": false, "data": { "status": "unhealthy", "timestamp": "2026-04-13T12:00:00.000Z" } }
```

---

## Analyze

### `POST /v1/analyze`

Analyzes a ticket: extracts signals, generates hypotheses, identifies risks, and retrieves KB references.

**Request**
```json
{ "ticketId": "cuid" }
```

**Response** `200` — returns immediately with a queued job
```json
{ "ok": true, "data": { "suggestionId": "string", "state": "queued" } }
```

**Result shape** (via polling):
```json
{
  "extractedSignals": {
    "product": "string?",
    "platform": "string?",
    "os": "string?",
    "browser": "string?",
    "appVersion": "string?",
    "device": "string?",
    "errorStrings": ["string"],
    "urls": ["string"]
  },
  "hypotheses": [{
    "cause": "string",
    "evidence": ["string"],
    "confidence": 0.85,
    "tests": ["string"]
  }],
  "clarifyingQuestions": ["string"],
  "nextSteps": ["string"],
  "riskFlags": ["string"],
  "escalationWhen": ["string"],
  "references": [{ "id": "string", "title": "string", "url": "string|null", "snippet": "string", "score": 0.92 }]
}
```

---

## Suggest

### `POST /v1/suggest`

Generates 1-5 next-step suggestions for a ticket, with KB references.

**Request**
```json
{ "ticketId": "cuid" }
```

**Response** `200`
```json
{ "ok": true, "data": { "suggestionId": "string", "state": "queued" } }
```

**Result shape**:
```json
{
  "steps": ["string"],
  "references": [{ "id": "string", "title": "string", "url": "string|null", "snippet": "string", "score": 0.92 }]
}
```

---

## Draft Reply

### `POST /v1/draft-reply`

Generates a draft response. Supports three draft types and four tones.

**Request**
```json
{
  "ticketId": "cuid",
  "draftType": "customer_reply" | "internal_note" | "escalation",
  "tone": "professional" | "friendly" | "concise" | "surfer"
}
```

**Response** `200`
```json
{ "ok": true, "data": { "suggestionId": "string", "state": "queued" } }
```

**Result shape** (varies by `draftType`):

Customer reply:
```json
{ "text": "string", "draftType": "customer_reply", "tone": "string", "usedAnalysisId": "string|null", "markedSent": false }
```

Internal note:
```json
{ "text": "string", "draftType": "internal_note", "usedAnalysisId": "string|null", "markedSent": false }
```

Escalation:
```json
{ "text": "string", "draftType": "escalation", "usedAnalysisId": "string|null", "markedSent": false }
```

### `PATCH /v1/draft-reply/:id`

Saves edits to a generated draft.

**Request**
```json
{ "text": "string", "markedSent": true }
```

**Response** `200`
```json
{ "ok": true, "data": { "id": "string", "content": { ... } } }
```

---

## Chat

### `POST /v1/chat`

Free-form question about a ticket, answered by the AI copilot.

**Request**
```json
{ "ticketId": "cuid", "message": "string (1-1000 chars)" }
```

**Response** `200`
```json
{ "ok": true, "data": { "suggestionId": "string", "state": "queued" } }
```

**Result shape**:
```json
{ "answer": "string" }
```

---

## Update Status

### `POST /v1/update-status`

Proxies a ticket status change to the CRM API.

**Request**
```json
{ "ticketId": "string", "status": "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" }
```

**Response** `200`
```json
{ "ok": true, "data": { "id": "string", "status": "string", "updatedAt": "string" } }
```

---

## Run Status

### `GET /v1/status/:id`

Poll for the result of an async AI job.

**Response** `200`
```json
{
  "ok": true,
  "data": {
    "id": "string",
    "state": "queued" | "running" | "success" | "error",
    "kind": "analysis" | "next_steps" | "draft_reply" | "draft_customer_reply" | "draft_internal_note" | "draft_escalation" | "chat" | null,
    "content": { ... },
    "error": "string|null",
    "updatedAt": "string"
  }
}
```

### `GET /v1/runs/:runId`

Alias for `/v1/status/:id`. Same response shape.

---

## Chat Streaming (SSE)

### `POST /v1/chat/stream`

Same request shape as `/v1/chat` but returns a Server-Sent Events stream.

**Request**
```json
{ "ticketId": "cuid", "message": "string (1-1000 chars)" }
```

**Response** — `text/event-stream`
```
event: delta
data: { "text": "partial text" }

event: delta
data: { "text": " more text" }

event: done
data: { "answer": "full concatenated answer" }
```

On failure, a single `event: error` is emitted with `{ "error": "..." }`.

---

## Draft Versions

### `GET /v1/draft-reply/:id/versions`

Returns edit history for a saved draft. Each PATCH on `/v1/draft-reply/:id` creates a new version.

**Response** `200`
```json
{
  "ok": true,
  "data": {
    "versions": [
      { "version": 3, "text": "...", "markedSent": true, "createdAt": "..." },
      { "version": 2, "text": "...", "markedSent": false, "createdAt": "..." }
    ]
  }
}
```

---

## Activity Timeline

### `GET /v1/activity?ticketId=...`

Returns AI-generated events for a ticket (analyze, suggest, draft, chat, feedback).

**Response** `200`
```json
{
  "ok": true,
  "data": {
    "events": [
      { "id": "...", "type": "AI_ANALYZED", "payload": { "suggestionId": "..." }, "createdAt": "..." }
    ]
  }
}
```

Event types: `AI_ANALYZED`, `AI_SUGGESTED`, `AI_DRAFTED`, `AI_CHATTED`, `AI_FEEDBACK`.

---

## Feedback

### `POST /v1/feedback`

Records a thumbs-up/down rating on an AI suggestion.

**Request**
```json
{ "suggestionId": "string", "rating": "up" | "down", "comment": "string (optional, max 1000)" }
```

**Response** `200`
```json
{ "ok": true, "data": { "id": "fb_..." } }
```

### `GET /v1/feedback?suggestionId=...`

Returns all feedback entries for a suggestion.

---

## Rate Limits

All AI endpoints are rate-limited per user (or per IP when unauthenticated):
- Default: 30 requests per 60 seconds, token-bucket
- `kb/ingest`: 10 requests per 60 seconds
- Exceeding the limit returns `429` with `{ code: "rate_limit_exceeded" }`

---

## Knowledge Base

### `POST /v1/kb/ingest`

Ingests a knowledge base article with auto-generated vector embedding.

**Request**
```json
{
  "title": "string",
  "content": "string",
  "url": "string (optional)",
  "productArea": "string (optional)"
}
```

**Response** `200`
```json
{ "ok": true, "data": { "id": "string" } }
```

---

## Similar Cases

### `POST /v1/similar`

Finds resolved/closed tickets semantically similar to a given ticket using vector cosine similarity.

**Request**
```json
{ "ticketId": "cuid", "productArea": "string (optional)", "limit": 1-10 }
```

**Response** `200`
```json
{
  "ok": true,
  "data": {
    "cases": [
      {
        "id": "tkt_001",
        "title": "SSO login returns 500 for Chrome users",
        "productArea": "Authentication",
        "status": "RESOLVED",
        "score": 0.91,
        "resolution": "Last agent/system message from the matched ticket"
      }
    ]
  }
}
```

Returns `{ cases: [] }` when no ticket embeddings exist (run `pnpm tsx prisma/embed-tickets.ts` to backfill).

### `POST /v1/similar/:id/apply`

Creates a `draft_customer_reply` AISuggestion derived from the resolution of the matched ticket. Returns a queued async job polled via `GET /v1/status/:suggestionId`.

**Request**
```json
{ "ticketId": "cuid" }
```

**Response** `200`
```json
{ "ok": true, "data": { "suggestionId": "string", "state": "queued" } }
```

**Polled result shape**:
```json
{
  "text": "string",
  "draftType": "customer_reply",
  "tone": "professional",
  "usedAnalysisId": null,
  "markedSent": false,
  "sourceSimilarTicketId": "string"
}
```

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 400 | Invalid request (Zod validation failure) |
| 404 | Resource not found |
| 500 | Internal server error |
| 503 | Service unhealthy |

## Schemas

All request and response schemas are defined in `@repo/shared-types` using Zod. Key schemas:

- `AnalyzeRequestSchema`, `AnalysisResultSchema`
- `SuggestRequestSchema`, `NextStepsResultSchema`
- `DraftGenerateRequestSchema`, `DraftSaveRequestSchema`
- `DraftCustomerReplyResultSchema`, `DraftInternalNoteResultSchema`, `DraftEscalationResultSchema`
- `ChatRequestSchema`, `ChatResultSchema`
- `UpdateStatusRequestSchema`
- `RunStatusSchema`
- `KBReferenceSchema`
- `SimilarCasesRequestSchema`, `SimilarCaseSchema`, `SimilarCasesResultSchema`
- `ApplySimilarCaseRequestSchema`
