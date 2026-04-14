-- Add new draft kinds to AISuggestionKind enum for Phase 3
ALTER TYPE "AISuggestionKind" ADD VALUE IF NOT EXISTS 'draft_customer_reply';
ALTER TYPE "AISuggestionKind" ADD VALUE IF NOT EXISTS 'draft_internal_note';
ALTER TYPE "AISuggestionKind" ADD VALUE IF NOT EXISTS 'draft_escalation';
