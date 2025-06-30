/*
  Warnings:

  - You are about to drop the column `SignatureKey` on the `WhatsAppClient` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsAppClient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "signatureKey" TEXT NOT NULL DEFAULT 'Key-Author',
    "secretKey" TEXT NOT NULL,
    "sessionFolder" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCANNING',
    "waName" TEXT,
    "phoneNumber" TEXT,
    "waId" TEXT,
    "profilePicUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WhatsAppClient" ("createdAt", "description", "id", "name", "phoneNumber", "profilePicUrl", "secretKey", "sessionFolder", "status", "updatedAt", "waId", "waName") SELECT "createdAt", "description", "id", "name", "phoneNumber", "profilePicUrl", "secretKey", "sessionFolder", "status", "updatedAt", "waId", "waName" FROM "WhatsAppClient";
DROP TABLE "WhatsAppClient";
ALTER TABLE "new_WhatsAppClient" RENAME TO "WhatsAppClient";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
