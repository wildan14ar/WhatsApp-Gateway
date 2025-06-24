/*
  Warnings:

  - You are about to drop the `Template` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `templateId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `replyTemplateId` on the `WhatsAppClient` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Template";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientId" INTEGER NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "scheduledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "WhatsAppClient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("body", "clientId", "createdAt", "direction", "id", "scheduledAt", "status", "to", "updatedAt") SELECT "body", "clientId", "createdAt", "direction", "id", "scheduledAt", "status", "to", "updatedAt" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE TABLE "new_WhatsAppClient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sessionData" JSONB,
    "secretKey" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "replyTemplate" TEXT,
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WhatsAppClient" ("createdAt", "description", "id", "isReply", "name", "secretKey", "sessionData", "status", "updatedAt") SELECT "createdAt", "description", "id", "isReply", "name", "secretKey", "sessionData", "status", "updatedAt" FROM "WhatsAppClient";
DROP TABLE "WhatsAppClient";
ALTER TABLE "new_WhatsAppClient" RENAME TO "WhatsAppClient";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
