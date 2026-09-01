/*
  Warnings:

  - You are about to drop the column `isAnswer` on the `forum_comments` table. All the data in the column will be lost.
  - You are about to drop the column `isAnswered` on the `forum_posts` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `forum_posts` table. All the data in the column will be lost.
  - You are about to drop the column `commentId` on the `forum_votes` table. All the data in the column will be lost.
  - You are about to drop the column `postId` on the `forum_votes` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,targetType,targetId]` on the table `forum_votes` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `targetId` to the `forum_votes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetType` to the `forum_votes` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `voteType` on the `forum_votes` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ForumPostStatus" AS ENUM ('published', 'hidden', 'deleted');

-- CreateEnum
CREATE TYPE "ForumCommentStatus" AS ENUM ('published', 'hidden', 'deleted');

-- DropForeignKey
ALTER TABLE "forum_votes" DROP CONSTRAINT "forum_votes_commentId_fkey";

-- DropForeignKey
ALTER TABLE "forum_votes" DROP CONSTRAINT "forum_votes_postId_fkey";

-- DropIndex
DROP INDEX "forum_votes_userId_postId_commentId_key";

-- AlterTable
ALTER TABLE "forum_comments" DROP COLUMN "isAnswer",
ADD COLUMN     "contentJson" JSONB DEFAULT '{}',
ADD COLUMN     "isBestAnswer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentCommentId" TEXT,
ADD COLUMN     "status" "ForumCommentStatus" NOT NULL DEFAULT 'published';

-- AlterTable
ALTER TABLE "forum_posts" DROP COLUMN "isAnswered",
DROP COLUMN "tags",
ADD COLUMN     "commentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contentJson" JSONB DEFAULT '{}',
ADD COLUMN     "flaggedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "ForumPostStatus" NOT NULL DEFAULT 'published',
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "forum_votes" DROP COLUMN "commentId",
DROP COLUMN "postId",
ADD COLUMN     "targetId" UUID NOT NULL,
ADD COLUMN     "targetType" VARCHAR(20) NOT NULL,
DROP COLUMN "voteType",
ADD COLUMN     "voteType" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "forum_categories" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forum_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forum_categories_slug_key" ON "forum_categories"("slug");

-- CreateIndex
CREATE INDEX "forum_comments_postId_idx" ON "forum_comments"("postId");

-- CreateIndex
CREATE INDEX "forum_comments_userId_idx" ON "forum_comments"("userId");

-- CreateIndex
CREATE INDEX "forum_comments_parentCommentId_idx" ON "forum_comments"("parentCommentId");

-- CreateIndex
CREATE INDEX "forum_posts_userId_idx" ON "forum_posts"("userId");

-- CreateIndex
CREATE INDEX "forum_posts_categoryId_idx" ON "forum_posts"("categoryId");

-- CreateIndex
CREATE INDEX "forum_posts_courseId_idx" ON "forum_posts"("courseId");

-- CreateIndex
CREATE INDEX "forum_posts_status_idx" ON "forum_posts"("status");

-- CreateIndex
CREATE INDEX "forum_votes_targetType_targetId_idx" ON "forum_votes"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "forum_votes_userId_targetType_targetId_key" ON "forum_votes"("userId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "forum_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "forum_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
