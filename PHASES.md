# Implementation Phases

## Phase 3 — Draft Generation

**What gets built:**
- `POST /api/copilot/v1/draft-reply` generates 3 draft types: customer reply, internal note, escalation handoff
- Drafts stored as `AISuggestion` rows (`kind = draft_customer_reply | draft_internal_note | draft_escalation`)
- Drafts pull from the latest successful analysis (`kind=analysis, state=success`) + ticket context

**Output rules enforced:**
- `customer_reply`: empathy + 3–5 steps + 1–3 questions + reassurance, < 2000 chars
- `internal_note`: technical, references hypotheses/evidence, tried/next
- `escalation`: structured handoff (summary, repro, env, logs, hypotheses, ask)

**UI changes (CopilotPanel):**
- Draft type dropdown (Customer Reply / Internal Note / Escalation)
- Edit-in-place textarea
- Save, Copy, and "Mark as sent" buttons

**Tests:**
- Unit: length constraints, prompt includes latest analysis + last customer message
- E2E: generate each type → saves → reloads; edit persists after refresh

---

## Phase 4 — Knowledge Base + RAG

**What gets built:**
- pgvector + embeddings ingestion pipeline
- `/api/copilot/v1/analyze` and `/suggest` call retrieval first, append `references` to stored output
- `AISuggestion.content` includes `references: [{ id, title, url?, snippet, score }]`

**UI changes:**
- "References" section rendered in CopilotPanel (citations/snippets only — no direct DB/vector logic in UI)

**Tests:**
- Unit: citations schema validation
- E2E: analyze shows "References" section with mocked retriever

---

## Phase 5 — Similar Cases ("Support Memory")

**What gets built:**
- `POST /api/copilot/v1/similar` — vector similarity search over tickets + outcomes
- Optional filters: same product/platform
- "Apply pattern" button: UI calls the endpoint, backend creates a saved draft `AISuggestion`

**UI changes:**
- "Similar Cases" section in CopilotPanel
- "Apply" button per case

**Tests:**
- Unit: similarity ranking stable given fixtures
- E2E: "Apply pattern" creates a saved draft and it persists

---

## Phase 6 — Pro Polish + Demo Mode

**What gets built:**
- Loading states + toast notifications throughout
- Collapsed/expandable JSON sections
- Copy buttons on all outputs
- Provider indicator badge (OpenAI vs Claude) in panel metadata
- Demo mode: end-to-end happy path showcasing all features in one flow

**Tests:**
- E2E "happy demo path": deliver events → open ticket → analyze → generate customer reply → edit → save → copy
