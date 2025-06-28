/*
  Warnings:

  - You are about to drop the column `contacts` on the `WhatsAppClient` table. All the data in the column will be lost.
  - You are about to drop the column `groups` on the `WhatsAppClient` table. All the data in the column will be lost.
  - You are about to drop the column `secretKey` on the `WhatsAppClient` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WhatsAppClient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sessionFolder" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "selectContacts" TEXT,
    "selectGroups" TEXT,
    "isReplyPersonal" BOOLEAN NOT NULL DEFAULT false,
    "isReplyGroup" BOOLEAN NOT NULL DEFAULT false,
    "isReplyTag" BOOLEAN NOT NULL DEFAULT false,
    "replyTemplatePersonal" TEXT,
    "replyTemplateGroup" TEXT,
    "replyTemplateTag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WhatsAppClient" ("createdAt", "description", "id", "isReplyGroup", "isReplyPersonal", "isReplyTag", "name", "replyTemplateGroup", "replyTemplatePersonal", "replyTemplateTag", "selectContacts", "selectGroups", "sessionFolder", "status", "updatedAt") SELECT "createdAt", "description", "id", "isReplyGroup", "isReplyPersonal", "isReplyTag", "name", "replyTemplateGroup", "replyTemplatePersonal", "replyTemplateTag", "selectContacts", "selectGroups", "sessionFolder", "status", "updatedAt" FROM "WhatsAppClient";
DROP TABLE "WhatsAppClient";
ALTER TABLE "new_WhatsAppClient" RENAME TO "WhatsAppClient";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
