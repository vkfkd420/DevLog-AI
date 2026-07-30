-- CreateTable
CREATE TABLE "AutoDraftSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "time" TEXT NOT NULL DEFAULT '18:00',
    "daysOfWeek" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "lastRunDate" TEXT,
    "updatedAt" DATETIME NOT NULL
);
