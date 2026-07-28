-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cause" TEXT,
    "solution" TEXT,
    "sourceModel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeEventEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "KnowledgeEventEvidence_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "KnowledgeEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeEventEvidence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeDocumentEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgeId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    CONSTRAINT "KnowledgeDocumentEvidence_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "KnowledgeEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeDocumentEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KnowledgeEntry_projectId_createdAt_idx" ON "KnowledgeEntry"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeEventEvidence_eventId_idx" ON "KnowledgeEventEvidence"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEventEvidence_knowledgeId_eventId_key" ON "KnowledgeEventEvidence"("knowledgeId", "eventId");

-- CreateIndex
CREATE INDEX "KnowledgeDocumentEvidence_documentId_idx" ON "KnowledgeDocumentEvidence"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocumentEvidence_knowledgeId_documentId_key" ON "KnowledgeDocumentEvidence"("knowledgeId", "documentId");
