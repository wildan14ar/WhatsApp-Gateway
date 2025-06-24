/*
  Warnings:

  - You are about to drop the column `keyword` on the `Template` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `WhatsAppClient` table. The data in that column could be lost. The data in that column will be cast from `String` to `Boolean`.
  - Added the required column `updatedAt` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Template` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scheduledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "WhatsAppClient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("body", "clientId", "createdAt", "direction", "id", "scheduledAt", "status", "templateId", "to") SELECT "body", "clientId", "createdAt", "direction", "id", "scheduledAt", "status", "templateId", "to" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE TABLE "new_Template" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "variables" JSONB,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Template_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "WhatsAppClient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Template" ("clientId", "content", "createdAt", "id", "name") SELECT "clientId", "content", "createdAt", "id", "name" FROM "Template";
DROP TABLE "Template";
ALTER TABLE "new_Template" RENAME TO "Template";
CREATE TABLE "new_WhatsAppClient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "sessionData" JSONB NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "replyTemplateId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppClient_replyTemplateId_fkey" FOREIGN KEY ("replyTemplateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WhatsAppClient" ("createdAt", "id", "name", "sessionData", "status", "updatedAt") SELECT "createdAt", "id", "name", "sessionData", "status", "updatedAt" FROM "WhatsAppClient";
DROP TABLE "WhatsAppClient";
ALTER TABLE "new_WhatsAppClient" RENAME TO "WhatsAppClient";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
