/*
  Warnings:

  - You are about to drop the `WebhookEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `webhookUrl` on the `WhatsAppClient` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "WebhookEvent";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Webhook" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "signatureHeader" TEXT NOT NULL DEFAULT 'X-Signature',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPersonal" BOOLEAN NOT NULL DEFAULT false,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "isTag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Webhook_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "WhatsAppClient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsAppClient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sessionFolder" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "isReplyPersonal" BOOLEAN NOT NULL DEFAULT false,
    "isReplyGroup" BOOLEAN NOT NULL DEFAULT false,
    "isReplyTag" BOOLEAN NOT NULL DEFAULT false,
    "replyTemplatePersonal" TEXT,
    "replyTemplateGroup" TEXT,
    "replyTemplateTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WhatsAppClient" ("createdAt", "description", "id", "isReplyGroup", "isReplyPersonal", "isReplyTag", "name", "replyTemplateGroup", "replyTemplatePersonal", "replyTemplateTag", "secretKey", "sessionFolder", "status", "updatedAt") SELECT "createdAt", "description", "id", "isReplyGroup", "isReplyPersonal", "isReplyTag", "name", "replyTemplateGroup", "replyTemplatePersonal", "replyTemplateTag", "secretKey", "sessionFolder", "status", "updatedAt" FROM "WhatsAppClient";
DROP TABLE "WhatsAppClient";
ALTER TABLE "new_WhatsAppClient" RENAME TO "WhatsAppClient";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
