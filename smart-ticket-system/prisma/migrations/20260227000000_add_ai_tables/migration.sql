-- CreateEnum
CREATE TYPE "AISuggestionState" AS ENUM ('queued', 'running', 'success', 'error');

-- CreateEnum
CREATE TYPE "AISuggestionKind" AS ENUM ('analysis', 'next_steps', 'draft_reply', 'chat');

-- CreateTable
CREATE TABLE "AISuggestion" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "kind" "AISuggestionKind",
    "content" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "state" "AISuggestionState" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AISuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AICache" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AICache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AISuggestion_ticketId_idx" ON "AISuggestion"("ticketId");

-- CreateIndex
CREATE INDEX "AISuggestion_createdAt_idx" ON "AISuggestion"("createdAt");

-- CreateIndex
CREATE INDEX "AISuggestion_state_idx" ON "AISuggestion"("state");

-- CreateIndex
CREATE INDEX "AIConversation_ticketId_idx" ON "AIConversation"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "AICache_key_key" ON "AICache"("key");

-- CreateIndex
CREATE INDEX "AICache_expiresAt_idx" ON "AICache"("expiresAt");
