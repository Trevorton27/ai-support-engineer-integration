-- Phase B: Similar Cases — add vector embedding column to Ticket
-- Requires pgvector extension (already enabled from Phase 4 KB migration)

ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "embeddingUpdatedAt" TIMESTAMP(3);

-- HNSW index for fast cosine similarity search over ticket embeddings
CREATE INDEX IF NOT EXISTS ticket_embedding_hnsw_idx
  ON "Ticket" USING hnsw (embedding vector_cosine_ops);

-- Phase B: add similar_cases to AISuggestionKind enum
ALTER TYPE "AISuggestionKind" ADD VALUE IF NOT EXISTS 'similar_cases';
