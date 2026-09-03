/*
  Warnings:

  - You are about to drop the column `platform` on the `device_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `device_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `data` on the `notifications` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,deviceToken]` on the table `device_tokens` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `deviceToken` to the `device_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deviceType` to the `device_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `device_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "device_tokens_userId_token_key";

-- AlterTable
ALTER TABLE "device_tokens" DROP COLUMN "platform",
DROP COLUMN "token",
ADD COLUMN     "appVersion" TEXT,
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "deviceModel" TEXT,
ADD COLUMN     "deviceToken" TEXT NOT NULL,
ADD COLUMN     "deviceType" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "osVersion" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "data",
ADD COLUMN     "channelsSent" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "iconUrl" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDismissed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "metadata" JSONB DEFAULT '{}',
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "senderId" TEXT;

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectAr" TEXT,
    "subjectEn" TEXT,
    "bodyAr" TEXT,
    "bodyEn" TEXT,
    "variables" JSONB DEFAULT '{}',
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_slug_key" ON "notification_templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_userId_deviceToken_key" ON "device_tokens"("userId", "deviceToken");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
