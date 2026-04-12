-- CreateTable
CREATE TABLE "KnowledgeBaseArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "url" TEXT,
    "productArea" TEXT,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeBaseArticle_productArea_idx" ON "KnowledgeBaseArticle"("productArea");

-- CreateIndex (HNSW for fast cosine similarity search)
CREATE INDEX "kb_embedding_idx" ON "KnowledgeBaseArticle"
USING hnsw (embedding vector_cosine_ops);
