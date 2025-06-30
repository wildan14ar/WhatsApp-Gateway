-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Webhook" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "signatureHeader" TEXT DEFAULT 'X-Signature',
    "secretKey" TEXT,
    "outputFormat" TEXT NOT NULL DEFAULT '$body.output',
    "isPersonal" BOOLEAN NOT NULL DEFAULT false,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "isTag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Webhook_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "WhatsAppClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Webhook" ("clientId", "createdAt", "description", "id", "isGroup", "isPersonal", "isTag", "name", "outputFormat", "secretKey", "signatureHeader", "updatedAt", "url") SELECT "clientId", "createdAt", "description", "id", "isGroup", "isPersonal", "isTag", "name", "outputFormat", "secretKey", "signatureHeader", "updatedAt", "url" FROM "Webhook";
DROP TABLE "Webhook";
ALTER TABLE "new_Webhook" RENAME TO "Webhook";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
