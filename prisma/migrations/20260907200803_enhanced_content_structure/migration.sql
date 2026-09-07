/*
  Warnings:

  - You are about to drop the `path_categories` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SlideType" AS ENUM ('INFO', 'QUIZ', 'DRAG_DROP', 'TRUE_FALSE', 'FILL_BLANK');

-- DropForeignKey
ALTER TABLE "path_categories" DROP CONSTRAINT "path_categories_parentId_fkey";

-- DropForeignKey
ALTER TABLE "paths" DROP CONSTRAINT "paths_categoryId_fkey";

-- AlterTable
ALTER TABLE "forum_posts" ADD COLUMN     "search_vector_ar" tsvector,
ADD COLUMN     "search_vector_en" tsvector;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "miniQuestJson" JSONB,
ADD COLUMN     "rechargeBoostMultiplier" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "rechargeBoostWindowHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "rechargeMessageAr" TEXT,
ADD COLUMN     "rechargeMessageEn" TEXT,
ADD COLUMN     "rechargeXpBoost" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "warmUpJson" JSONB;

-- DropTable
DROP TABLE "path_categories";

-- CreateTable
CREATE TABLE "course_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slides" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "slideType" "SlideType" NOT NULL DEFAULT 'INFO',
    "titleAr" TEXT,
    "titleEn" TEXT,
    "bodyAr" TEXT,
    "bodyEn" TEXT,
    "questionAr" TEXT,
    "questionEn" TEXT,
    "optionsJson" JSONB,
    "correctIndex" INTEGER,
    "explanationAr" TEXT,
    "explanationEn" TEXT,
    "instructionAr" TEXT,
    "instructionEn" TEXT,
    "itemsJson" JSONB,
    "statementAr" TEXT,
    "statementEn" TEXT,
    "correctAnswer" BOOLEAN,
    "sentenceAr" TEXT,
    "sentenceEn" TEXT,
    "acceptedAnswersJson" JSONB,
    "order" INTEGER NOT NULL,
    "xpAward" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_checkpoints" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT,
    "taskAr" TEXT NOT NULL,
    "taskEn" TEXT,
    "hintAr" TEXT,
    "hintEn" TEXT,
    "xpAward" INTEGER NOT NULL DEFAULT 15,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quest_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boss_battles" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT,
    "narrativeAr" TEXT NOT NULL,
    "narrativeEn" TEXT,
    "monsterNameAr" TEXT NOT NULL,
    "monsterNameEn" TEXT,
    "victoryBonusPerfect" INTEGER NOT NULL DEFAULT 50,
    "victoryBonusGood" INTEGER NOT NULL DEFAULT 30,
    "victoryBonusFair" INTEGER NOT NULL DEFAULT 15,
    "victoryBonusRetry" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boss_battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boss_battle_questions" (
    "id" TEXT NOT NULL,
    "bossBattleId" TEXT NOT NULL,
    "questionAr" TEXT NOT NULL,
    "questionEn" TEXT,
    "optionsAr" JSONB NOT NULL,
    "optionsEn" JSONB,
    "correctIndex" INTEGER NOT NULL,
    "explanationAr" TEXT,
    "explanationEn" TEXT,
    "xpAward" INTEGER NOT NULL DEFAULT 10,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boss_battle_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_slide_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_slide_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quest_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_quest_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_boss_battle_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bossBattleId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "victoryLevel" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_boss_battle_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slides_lessonId_order_idx" ON "slides"("lessonId", "order");

-- CreateIndex
CREATE INDEX "quest_checkpoints_lessonId_order_idx" ON "quest_checkpoints"("lessonId", "order");

-- CreateIndex
CREATE INDEX "boss_battle_questions_bossBattleId_order_idx" ON "boss_battle_questions"("bossBattleId", "order");

-- CreateIndex
CREATE INDEX "user_slide_progress_userId_lessonId_idx" ON "user_slide_progress"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "user_slide_progress_userId_slideId_key" ON "user_slide_progress"("userId", "slideId");

-- CreateIndex
CREATE INDEX "user_quest_progress_userId_lessonId_idx" ON "user_quest_progress"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "user_quest_progress_userId_checkpointId_key" ON "user_quest_progress"("userId", "checkpointId");

-- CreateIndex
CREATE UNIQUE INDEX "user_boss_battle_progress_userId_bossBattleId_key" ON "user_boss_battle_progress"("userId", "bossBattleId");

-- AddForeignKey
ALTER TABLE "paths" ADD CONSTRAINT "paths_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "course_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "course_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slides" ADD CONSTRAINT "slides_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_checkpoints" ADD CONSTRAINT "quest_checkpoints_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boss_battles" ADD CONSTRAINT "boss_battles_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boss_battle_questions" ADD CONSTRAINT "boss_battle_questions_bossBattleId_fkey" FOREIGN KEY ("bossBattleId") REFERENCES "boss_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_slide_progress" ADD CONSTRAINT "user_slide_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_slide_progress" ADD CONSTRAINT "user_slide_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_slide_progress" ADD CONSTRAINT "user_slide_progress_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "slides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "quest_checkpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_boss_battle_progress" ADD CONSTRAINT "user_boss_battle_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_boss_battle_progress" ADD CONSTRAINT "user_boss_battle_progress_bossBattleId_fkey" FOREIGN KEY ("bossBattleId") REFERENCES "boss_battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ensure search vector columns and indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "paths" ADD COLUMN IF NOT EXISTS "search_vector_ar" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('arabic', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce("description", '')), 'B')
  ) STORED;

ALTER TABLE "paths" ADD COLUMN IF NOT EXISTS "search_vector_en" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("titleEn", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("descriptionEn", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "idx_paths_search_ar" ON "paths" USING GIN ("search_vector_ar");
CREATE INDEX IF NOT EXISTS "idx_paths_search_en" ON "paths" USING GIN ("search_vector_en");
CREATE INDEX IF NOT EXISTS "idx_paths_title_trgm" ON "paths" USING GIN ("title" gin_trgm_ops);

ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "search_vector_ar" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('arabic', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce("content", '')), 'B')
  ) STORED;

ALTER TABLE "forum_posts" ADD COLUMN IF NOT EXISTS "search_vector_en" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("content", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "idx_forum_posts_search_ar" ON "forum_posts" USING GIN ("search_vector_ar");
CREATE INDEX IF NOT EXISTS "idx_forum_posts_search_en" ON "forum_posts" USING GIN ("search_vector_en");
CREATE INDEX IF NOT EXISTS "idx_forum_posts_title_trgm" ON "forum_posts" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_users_fullname_trgm" ON "users" USING GIN ("fullName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_users_email_trgm" ON "users" USING GIN ("email" gin_trgm_ops);