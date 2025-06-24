/*
  Warnings:

  - Added the required column `sessionFolder` to the `WhatsAppClient` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsAppClient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sessionData" JSONB,
    "sessionFolder" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "replyTemplate" TEXT,
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WhatsAppClient" ("createdAt", "description", "id", "isReply", "name", "replyTemplate", "secretKey", "sessionData", "status", "updatedAt") SELECT "createdAt", "description", "id", "isReply", "name", "replyTemplate", "secretKey", "sessionData", "status", "updatedAt" FROM "WhatsAppClient";
DROP TABLE "WhatsAppClient";
ALTER TABLE "new_WhatsAppClient" RENAME TO "WhatsAppClient";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
