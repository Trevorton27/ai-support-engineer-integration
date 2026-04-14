-- CreateTable
CREATE TABLE "DraftVersion" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "markedSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DraftVersion_suggestionId_version_key" ON "DraftVersion"("suggestionId", "version");

-- CreateIndex
CREATE INDEX "DraftVersion_suggestionId_idx" ON "DraftVersion"("suggestionId");

-- CreateTable
CREATE TABLE "AIFeedback" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIFeedback_suggestionId_idx" ON "AIFeedback"("suggestionId");
