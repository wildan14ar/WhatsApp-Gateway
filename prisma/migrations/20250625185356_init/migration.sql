-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "WhatsAppClient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "replyTemplate" TEXT,
    "isReplyPersonal" BOOLEAN NOT NULL DEFAULT false,
    "isReplyGroup" BOOLEAN NOT NULL DEFAULT false,
    "isReplyTag" BOOLEAN NOT NULL DEFAULT false,
    "replyTemplatePersonal" TEXT,
    "replyTemplateGroup" TEXT,
    "replyTemplateTag" TEXT,
    "webhookUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WhatsAppClient" ("createdAt", "description", "id", "isReply", "name", "replyTemplate", "secretKey", "sessionFolder", "status", "updatedAt", "webhookUrl") SELECT "createdAt", "description", "id", "isReply", "name", "replyTemplate", "secretKey", "sessionFolder", "status", "updatedAt", "webhookUrl" FROM "WhatsAppClient";
DROP TABLE "WhatsAppClient";
ALTER TABLE "new_WhatsAppClient" RENAME TO "WhatsAppClient";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
