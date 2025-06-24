/*
  Warnings:

  - Added the required column `secretKey` to the `WhatsAppClient` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsAppClient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sessionData" JSONB NOT NULL,
    "secretKey" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "replyTemplateId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppClient_replyTemplateId_fkey" FOREIGN KEY ("replyTemplateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WhatsAppClient" ("createdAt", "id", "isReply", "name", "replyTemplateId", "sessionData", "status", "updatedAt") SELECT "createdAt", "id", "isReply", "name", "replyTemplateId", "sessionData", "status", "updatedAt" FROM "WhatsAppClient";
DROP TABLE "WhatsAppClient";
ALTER TABLE "new_WhatsAppClient" RENAME TO "WhatsAppClient";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
