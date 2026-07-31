-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Todo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "dueDate" DATETIME,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT,
    "eventId" TEXT,
    "documentId" TEXT,
    CONSTRAINT "Todo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Todo_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Todo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Todo_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Todo" ("completed", "completedAt", "createdAt", "documentId", "dueDate", "eventId", "id", "priority", "projectId", "sessionId", "source", "title") SELECT "completed", "completedAt", "createdAt", "documentId", "dueDate", "eventId", "id", "priority", "projectId", "sessionId", "source", "title" FROM "Todo";
DROP TABLE "Todo";
ALTER TABLE "new_Todo" RENAME TO "Todo";
CREATE INDEX "Todo_projectId_completed_idx" ON "Todo"("projectId", "completed");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
